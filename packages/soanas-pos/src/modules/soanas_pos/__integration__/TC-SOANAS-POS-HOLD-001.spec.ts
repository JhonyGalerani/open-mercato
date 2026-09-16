import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import {
  createProductFixture,
  createVariantFixture,
  deleteCatalogProductIfExists,
} from '@open-mercato/core/helpers/integration/catalogFixtures'
import {
  expectId,
  getTokenScope,
  readJsonSafe,
} from '@open-mercato/core/helpers/integration/generalFixtures'

/**
 * TC-SOANAS-POS-HOLD-001: Suspend / resume a DRAFT POS cart (POS-HOLD-001)
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'catalog'],
}

async function postJson(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await apiRequest(request, 'POST', path, { token, data })
  const body = await readJsonSafe<Record<string, unknown>>(response)
  expect(response.ok(), `POST ${path} → ${response.status()} ${JSON.stringify(body)}`).toBeTruthy()
  return body ?? {}
}

async function createCrudFixture(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  const body = await postJson(request, token, path, data)
  return expectId(body.id as string | undefined, `Missing id in ${path}`)
}

test.describe('TC-SOANAS-POS-HOLD-001: suspend and resume draft cart', () => {
  test('hold DRAFT → HELD, list held, resume → DRAFT, reject expired resume', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const scope = getTokenScope(adminToken)
    const suffix = randomUUID().slice(0, 8)
    let productId: string | null = null

    try {
      productId = await createProductFixture(request, adminToken, {
        title: `Hold Product ${suffix}`,
        sku: `HOLD-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, adminToken, {
        productId,
        name: `Hold Variant ${suffix}`,
        sku: `HOLD-SKU-${suffix}`,
        isDefault: true,
      })

      const terminalId = await createCrudFixture(request, adminToken, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `HOLD-POS-${suffix}`,
        name: `Hold Terminal ${suffix}`,
        stockPolicy: 'ALLOW',
        status: 'active',
      })

      const created = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId,
        idempotencyKey: `hold-open-${suffix}`,
      })
      const transactionId = expectId(created.id as string | undefined, 'transaction id')

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `HOLD-SKU-${suffix}`,
        nameSnapshot: `Hold Variant ${suffix}`,
        quantity: '1',
        unitPriceCents: '1500',
      })

      const held = await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/hold`, {
        name: `Mesa ${suffix}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      expect(held.status).toBe('HELD')
      expect(held.holdName).toBe(`Mesa ${suffix}`)
      expect(held.heldAt).toBeTruthy()

      const listHeld = await apiRequest(
        request,
        'GET',
        `/api/soanas_pos/transactions?status=HELD&terminalId=${encodeURIComponent(terminalId)}`,
        { token: adminToken },
      )
      expect(listHeld.ok()).toBeTruthy()
      const listBody = await readJsonSafe<{ items?: Array<{ id?: string; holdName?: string }> }>(listHeld)
      expect((listBody?.items ?? []).some((item) => item.id === transactionId)).toBeTruthy()
      expect((listBody?.items ?? []).find((item) => item.id === transactionId)?.holdName).toBe(
        `Mesa ${suffix}`,
      )

      const lineBlocked = await apiRequest(
        request,
        'POST',
        `/api/soanas_pos/transactions/${transactionId}/lines`,
        {
          token: adminToken,
          data: {
            catalogProductId: productId,
            catalogVariantId: variantId,
            sku: `HOLD-SKU-${suffix}`,
            nameSnapshot: `Hold Variant ${suffix}`,
            quantity: '1',
            unitPriceCents: '1500',
          },
        },
      )
      expect(lineBlocked.ok()).toBeFalsy()

      const resumed = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/resume`,
        {},
      )
      expect(resumed.status).toBe('DRAFT')

      const detail = await apiRequest(
        request,
        'GET',
        `/api/soanas_pos/transactions/${transactionId}`,
        { token: adminToken },
      )
      expect(detail.ok()).toBeTruthy()
      const detailBody = await readJsonSafe<{
        status?: string
        holdName?: string | null
        lines?: unknown[]
      }>(detail)
      expect(detailBody?.status).toBe('DRAFT')
      expect(detailBody?.holdName).toBeNull()
      expect((detailBody?.lines ?? []).length).toBe(1)

      const expiredTx = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId,
        idempotencyKey: `hold-expire-${suffix}`,
      })
      const expiredId = expectId(expiredTx.id as string | undefined, 'expired tx')
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${expiredId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `HOLD-SKU-${suffix}`,
        nameSnapshot: `Hold Variant ${suffix}`,
        quantity: '1',
        unitPriceCents: '900',
      })
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${expiredId}/hold`, {
        name: 'Expired hold',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })
      const resumeExpired = await apiRequest(
        request,
        'POST',
        `/api/soanas_pos/transactions/${expiredId}/resume`,
        { token: adminToken, data: {} },
      )
      expect(resumeExpired.ok()).toBeFalsy()
      expect(resumeExpired.status()).toBeGreaterThanOrEqual(400)
    } finally {
      await deleteCatalogProductIfExists(request, adminToken, productId)
    }
  })
})
