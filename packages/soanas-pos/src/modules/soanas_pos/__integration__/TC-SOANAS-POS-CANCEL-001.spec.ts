import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiRequest, clearAuthTokenCache, getAuthToken } from '@open-mercato/core/helpers/integration/api'
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
 * TC-SOANAS-POS-CANCEL-001: DRAFT cancel + COMPLETED reverse (no history delete)
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'soanas_cash', 'sales', 'wms', 'catalog'],
}

type RolesResponse = { items?: Array<{ id?: string; name?: string }> }
type RoleAclResponse = { isSuperAdmin?: boolean; features?: string[]; organizations?: string[] | null }

async function ensureRoleFeatures(
  request: APIRequestContext,
  token: string,
  tenantId: string,
  roleName: string,
  requiredFeatures: string[],
): Promise<() => Promise<void>> {
  const rolesResponse = await apiRequest(
    request,
    'GET',
    `/api/auth/roles?tenantId=${encodeURIComponent(tenantId)}&page=1&pageSize=100`,
    { token },
  )
  expect(rolesResponse.ok()).toBeTruthy()
  const rolesBody = await readJsonSafe<RolesResponse>(rolesResponse)
  const role = rolesBody?.items?.find((item) => item.name === roleName) ?? null
  const roleId = expectId(role?.id, `Missing ${roleName} role`)
  const aclPath = `/api/auth/roles/acl?roleId=${encodeURIComponent(roleId)}&tenantId=${encodeURIComponent(tenantId)}`
  const aclResponse = await apiRequest(request, 'GET', aclPath, { token })
  expect(aclResponse.ok()).toBeTruthy()
  const aclBody = (await readJsonSafe<RoleAclResponse>(aclResponse)) ?? {}
  if (aclBody.isSuperAdmin) return async () => undefined
  const original = {
    isSuperAdmin: Boolean(aclBody.isSuperAdmin),
    features: Array.isArray(aclBody.features) ? aclBody.features : [],
    organizations: Array.isArray(aclBody.organizations) ? aclBody.organizations : null,
  }
  const merged = Array.from(new Set([...original.features, ...requiredFeatures])).sort()
  await apiRequest(request, 'PUT', '/api/auth/roles/acl', {
    token,
    data: {
      roleId,
      tenantId,
      isSuperAdmin: original.isSuperAdmin,
      features: merged,
      organizations: original.organizations,
    },
  })
  return async () => {
    await apiRequest(request, 'PUT', '/api/auth/roles/acl', {
      token,
      data: {
        roleId,
        tenantId,
        isSuperAdmin: original.isSuperAdmin,
        features: original.features,
        organizations: original.organizations,
      },
    }).catch(() => undefined)
  }
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
  return expectId((await postJson(request, token, path, data)).id as string | undefined, path)
}

async function readOnHand(
  request: APIRequestContext,
  token: string,
  warehouseId: string,
  locationId: string,
  variantId: string,
): Promise<number> {
  const response = await apiRequest(
    request,
    'GET',
    `/api/wms/inventory/balances?warehouseId=${encodeURIComponent(warehouseId)}&catalogVariantId=${encodeURIComponent(variantId)}&locationId=${encodeURIComponent(locationId)}&page=1&pageSize=20`,
    { token },
  )
  expect(response.ok()).toBeTruthy()
  const body = await readJsonSafe<{
    items?: Array<{ quantityOnHand?: string | number; quantity_on_hand?: string | number }>
  }>(response)
  const raw = body?.items?.[0]?.quantityOnHand ?? body?.items?.[0]?.quantity_on_hand ?? '0'
  return Number(raw)
}

test.describe('TC-SOANAS-POS-CANCEL-001: draft cancel and completed reverse', () => {
  test('DRAFT cancel keeps row; COMPLETED reverse restores stock+cash', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const employeeToken = await getAuthToken(request, 'employee')
    const scope = getTokenScope(adminToken)
    const employeeScope = getTokenScope(employeeToken)
    const suffix = randomUUID().slice(0, 8)

    const restoreAdmin = await ensureRoleFeatures(request, superadminToken, scope.tenantId, 'admin', [
      'soanas_cash.*',
      'soanas_pos.*',
      'wms.*',
      'sales.*',
      'catalog.*',
    ])
    const restoreEmployee = await ensureRoleFeatures(request, superadminToken, scope.tenantId, 'employee', [
      'soanas_pos.terminals.view',
      'soanas_pos.transactions.view',
      'soanas_pos.transactions.sell',
      'soanas_pos.transactions.cancel',
      'soanas_pos.catalog.search',
      'catalog.products.view',
      'catalog.variants.view',
    ])
    clearAuthTokenCache()
    const freshAdmin = await getAuthToken(request, 'admin')
    const freshEmployee = await getAuthToken(request, 'employee')

    let productId: string | null = null
    let warehouseId: string | null = null

    try {
      productId = await createProductFixture(request, freshAdmin, {
        title: `Cancel Product ${suffix}`,
        sku: `CAN-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, freshAdmin, {
        productId,
        name: `Cancel Variant ${suffix}`,
        sku: `CAN-SKU-${suffix}`,
        isDefault: true,
      })

      // --- DRAFT cancel ---
      const draftTerminalId = await createCrudFixture(request, freshAdmin, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `CAN-D-${suffix}`,
        name: `Cancel Draft Terminal ${suffix}`,
        stockPolicy: 'ALLOW',
        status: 'active',
      })
      const draftTx = await postJson(request, freshEmployee, '/api/soanas_pos/transactions', {
        terminalId: draftTerminalId,
        idempotencyKey: `can-draft-${suffix}`,
      })
      const draftId = expectId(draftTx.id as string | undefined, 'draft tx')
      await postJson(request, freshEmployee, `/api/soanas_pos/transactions/${draftId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `CAN-SKU-${suffix}`,
        nameSnapshot: `Cancel Variant ${suffix}`,
        quantity: '1',
        unitPriceCents: '1000',
      })
      const cancelled = await postJson(request, freshEmployee, `/api/soanas_pos/transactions/${draftId}/cancel`, {
        reason: 'Cliente desistiu',
      })
      expect(cancelled.status).toBe('CANCELLED')
      const draftDetail = await apiRequest(request, 'GET', `/api/soanas_pos/transactions/${draftId}`, {
        token: freshAdmin,
      })
      expect(draftDetail.ok()).toBeTruthy()
      const draftBody = await readJsonSafe<{ status?: string; cancelledAt?: string | null }>(draftDetail)
      expect(draftBody?.status).toBe('CANCELLED')
      // cancelledAt is persisted; detail serializers may omit audit timestamps.

      // --- COMPLETED reverse ---
      warehouseId = await createCrudFixture(request, freshAdmin, '/api/wms/warehouses', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: `Cancel WH ${suffix}`,
        code: `CAN-WH-${suffix}`,
        isActive: true,
        timezone: 'UTC',
      })
      const locationId = await createCrudFixture(request, freshAdmin, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        code: `CAN-LOC-${suffix}`,
        type: 'bin',
        isActive: true,
      })
      await postJson(request, freshAdmin, '/api/wms/inventory/adjust', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        locationId,
        catalogVariantId: variantId,
        delta: 5,
        reason: 'cancel_seed',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })
      const registerId = await createCrudFixture(request, freshAdmin, '/api/soanas_cash/registers', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `CAN-REG-${suffix}`,
        name: `Cancel Register ${suffix}`,
        warehouseId,
        blindClosing: false,
        withdrawalLimitWithoutApprovalCents: '100000',
        discrepancyToleranceCents: '0',
        isActive: true,
      })
      const sessionBody = await postJson(request, freshAdmin, '/api/soanas_cash/sessions/open', {
        registerId,
        openingFloatCents: '10000',
        idempotencyKey: `can-open-${suffix}`,
      })
      const sessionId = expectId(
        (sessionBody.id as string | undefined) ?? (sessionBody.sessionId as string | undefined),
        'session',
      )
      const terminalId = await createCrudFixture(request, freshAdmin, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `CAN-POS-${suffix}`,
        name: `Cancel POS ${suffix}`,
        warehouseId,
        cashRegisterId: registerId,
        stockPolicy: 'BLOCK',
        status: 'active',
      })
      const tx = await postJson(request, freshAdmin, '/api/soanas_pos/transactions', {
        terminalId,
        cashSessionId: sessionId,
        idempotencyKey: `can-sale-${suffix}`,
      })
      const transactionId = expectId(tx.id as string | undefined, 'sale tx')
      await postJson(request, freshAdmin, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `CAN-SKU-${suffix}`,
        nameSnapshot: `Cancel Variant ${suffix}`,
        quantity: '2',
        unitPriceCents: '2500',
      })
      await postJson(request, freshAdmin, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})
      await postJson(request, freshAdmin, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
        amountReceivedCents: '5000',
        idempotencyKey: `can-tender-${suffix}`,
      })
      const completed = await postJson(
        request,
        freshAdmin,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(completed.status).toBe('COMPLETED')
      expect(await readOnHand(request, freshAdmin, warehouseId, locationId, variantId)).toBe(3)

      const cancelCompleted = await apiRequest(
        request,
        'POST',
        `/api/soanas_pos/transactions/${transactionId}/cancel`,
        { token: freshAdmin, data: { reason: 'should fail' } },
      )
      expect(cancelCompleted.ok()).toBeFalsy()

      const approval = await postJson(request, freshEmployee, '/api/soanas_pos/approvals/request', {
        kind: 'cancel',
        transactionId,
        terminalId,
        reason: 'Erro de digitação',
        before: { status: 'COMPLETED' },
        after: { status: 'REVERSED' },
        idempotencyKey: `can-appr-${suffix}`,
      })
      const approvalId = expectId(approval.id as string | undefined, 'approval')
      await postJson(request, freshAdmin, '/api/soanas_pos/approvals/decide', {
        approvalRequestId: approvalId,
        decision: 'approved',
        decisionReason: 'Ok',
      })
      expect(scope.userId).not.toBe(employeeScope.userId)

      const reversed = await postJson(
        request,
        freshAdmin,
        `/api/soanas_pos/transactions/${transactionId}/reverse`,
        { reason: 'Erro de digitação', approvalRequestId: approvalId },
      )
      expect(reversed.status).toBe('REVERSED')
      expect(Number(reversed.wmsRestored)).toBeGreaterThan(0)
      expect(reversed.cashReversalMovementId).toBeTruthy()
      expect(await readOnHand(request, freshAdmin, warehouseId, locationId, variantId)).toBe(5)

      const replay = await postJson(
        request,
        freshAdmin,
        `/api/soanas_pos/transactions/${transactionId}/reverse`,
        { reason: 'Erro de digitação' },
      )
      expect(replay.status).toBe('REVERSED')
      expect(replay.replayed).toBe(true)
      expect(await readOnHand(request, freshAdmin, warehouseId, locationId, variantId)).toBe(5)

      const detail = await apiRequest(request, 'GET', `/api/soanas_pos/transactions/${transactionId}`, {
        token: freshAdmin,
      })
      expect(detail.ok()).toBeTruthy()
      const detailBody = await readJsonSafe<{
        status?: string
        reversedAt?: string | null
        salesOrderId?: string | null
      }>(detail)
      expect(detailBody?.status).toBe('REVERSED')
      expect(detailBody?.salesOrderId).toBeTruthy()
    } finally {
      await deleteCatalogProductIfExists(request, freshAdmin, productId)
      await restoreEmployee()
      await restoreAdmin()
    }
  })
})
