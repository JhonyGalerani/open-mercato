import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import { expectId, getTokenScope, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'
import {
  cleanupPosContext,
  createCrudFixture,
  ensureRoleFeatures,
  postJson,
  seedPosContext,
  SOANAS_POS_ACL_FEATURES,
} from './helpers/soanasFixtures'

/**
 * TC-SOANAS-GATE0-MULTILOC-001: Multi-location WMS consumption (ADR-008)
 *
 * Location A=3, location B=2 on-hand → sell qty 5 @ 1000 centavos → both locations 0,
 * ≥2 WMS movements, complete replay stays idempotent (no duplicate movements).
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'soanas_cash', 'sales', 'wms', 'catalog'],
}

test.describe('TC-SOANAS-GATE0-MULTILOC-001: multi-location stock split on complete', () => {
  test('consumes across two locations, reaches zero on-hand, and replays idempotently', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)

    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )

    let productId: string | null = null
    let ctx: Awaited<ReturnType<typeof seedPosContext>> | null = null
    let secondLocationId: string | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
        initialStock: '0',
        openingFloatCents: '50000',
      })

      secondLocationId = await createCrudFixture(request, adminToken, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId: ctx.warehouseId,
        code: `SOANAS-MT-LOC-B-${ctx.suffix}`,
        type: 'bin',
        isActive: true,
      })

      await postJson(request, adminToken, '/api/wms/inventory/adjust', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId: ctx.warehouseId,
        locationId: ctx.primaryLocationId,
        catalogVariantId: ctx.variantId,
        delta: '3',
        reason: 'soanas_gate0_multiloc_a',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      await postJson(request, adminToken, '/api/wms/inventory/adjust', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId: ctx.warehouseId,
        locationId: secondLocationId,
        catalogVariantId: ctx.variantId,
        delta: '2',
        reason: 'soanas_gate0_multiloc_b',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      const txBody = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId: ctx.terminalId,
        cashSessionId: ctx.sessionId,
        currencyCode: 'BRL',
        idempotencyKey: `multiloc-tx-${ctx.suffix}`,
      })
      const transactionId = expectId(txBody.id as string | undefined, 'transaction id')

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: ctx.productId,
        catalogVariantId: ctx.variantId,
        sku: `SOANAS-MT-SKU-${ctx.suffix}`,
        nameSnapshot: `Soanas MT ${ctx.suffix}`,
        quantity: '5',
        unitPriceCents: '1000',
      })

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
        amountReceivedCents: '5000',
        idempotencyKey: `multiloc-tender-${ctx.suffix}`,
      })

      const completeBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(completeBody.status)).toBe('COMPLETED')
      const salesOrderId = expectId(completeBody.salesOrderId as string | undefined, 'salesOrderId')

      for (const locationId of [ctx.primaryLocationId, secondLocationId]) {
        const balancesResponse = await apiRequest(
          request,
          'GET',
          `/api/wms/inventory/balances?warehouseId=${encodeURIComponent(ctx.warehouseId)}&catalogVariantId=${encodeURIComponent(ctx.variantId)}&locationId=${encodeURIComponent(locationId)}&page=1&pageSize=20`,
          { token: adminToken },
        )
        expect(balancesResponse.ok()).toBeTruthy()
        const balancesBody = await readJsonSafe<{
          items?: Array<{ quantityOnHand?: string | number; quantity_on_hand?: string | number }>
        }>(balancesResponse)
        const onHand = Number(
          balancesBody?.items?.[0]?.quantityOnHand ?? balancesBody?.items?.[0]?.quantity_on_hand ?? 0,
        )
        expect(onHand).toBe(0)
      }

      const movementsResponse = await apiRequest(
        request,
        'GET',
        `/api/wms/inventory/movements?warehouseId=${encodeURIComponent(ctx.warehouseId)}&catalogVariantId=${encodeURIComponent(ctx.variantId)}&referenceType=so&referenceId=${encodeURIComponent(salesOrderId)}&page=1&pageSize=50`,
        { token: adminToken },
      )
      expect(movementsResponse.ok()).toBeTruthy()
      const movementsBody = await readJsonSafe<{ items?: unknown[] }>(movementsResponse)
      const movementCountAfterComplete = movementsBody?.items?.length ?? 0
      expect(movementCountAfterComplete).toBeGreaterThanOrEqual(2)

      const replayBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(replayBody.status)).toBe('COMPLETED')
      expect(String(replayBody.salesOrderId)).toBe(salesOrderId)
      expect(Boolean(replayBody.replayed)).toBe(true)

      const movementsReplay = await apiRequest(
        request,
        'GET',
        `/api/wms/inventory/movements?warehouseId=${encodeURIComponent(ctx.warehouseId)}&catalogVariantId=${encodeURIComponent(ctx.variantId)}&referenceType=so&referenceId=${encodeURIComponent(salesOrderId)}&page=1&pageSize=50`,
        { token: adminToken },
      )
      const movementsReplayBody = await readJsonSafe<{ items?: unknown[] }>(movementsReplay)
      expect(movementsReplayBody?.items?.length).toBe(movementCountAfterComplete)
    } finally {
      if (ctx) {
        productId = ctx.productId
      }
      await cleanupPosContext(request, adminToken, productId)
      await restoreAcl()
    }
  })
})
