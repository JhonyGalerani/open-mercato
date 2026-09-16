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
 * Crash/recovery: force WMS step to fail after Sales succeeds, then recover.
 * Guarantees no duplicate SalesOrder / SalesPayment / WMS / Cash side effects.
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'soanas_cash', 'sales', 'wms', 'catalog'],
}

type RolesResponse = {
  items?: Array<{ id?: string; name?: string }>
}

type RoleAclResponse = {
  isSuperAdmin?: boolean
  features?: string[]
  organizations?: string[] | null
}

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
  const mergedFeatures = Array.from(new Set([...original.features, ...requiredFeatures])).sort()
  const changed = mergedFeatures.join('|') !== [...original.features].sort().join('|')
  if (changed) {
    const updateResponse = await apiRequest(request, 'PUT', '/api/auth/roles/acl', {
      token,
      data: {
        roleId,
        tenantId,
        isSuperAdmin: original.isSuperAdmin,
        features: mergedFeatures,
        organizations: original.organizations,
      },
    })
    expect(updateResponse.ok(), `Failed PUT /api/auth/roles/acl: ${updateResponse.status()}`).toBeTruthy()
  }

  return async () => {
    if (!changed) return
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
  data: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const response = await apiRequest(request, 'POST', path, { token, data })
  const body = (await readJsonSafe<Record<string, unknown>>(response)) ?? {}
  return { ok: response.ok(), status: response.status(), body }
}

async function createCrudFixture(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  const result = await postJson(request, token, path, data)
  expect(result.ok, `POST ${path} → ${result.status} ${JSON.stringify(result.body)}`).toBeTruthy()
  return expectId(result.body.id as string | undefined, `Missing id in ${path}`)
}

test.describe('TC-SOANAS-RETAIL-RECOVERY: crash mid-complete then recover', () => {
  test('sales checkpoint survives WMS failure and recover finishes without duplicates', async ({
    request,
  }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const suffix = randomUUID().slice(0, 8)
    let productId: string | null = null

    const restoreAcl = await ensureRoleFeatures(request, superadminToken, scope.tenantId, 'admin', [
      'soanas_cash.*',
      'soanas_pos.*',
      'soanas.pos.*',
      'wms.view',
      'wms.manage_warehouses',
      'wms.manage_locations',
      'wms.manage_inventory',
      'wms.adjust_inventory',
      'sales.*',
      'catalog.*',
    ])

    try {
      productId = await createProductFixture(request, adminToken, {
        title: `Recover Product ${suffix}`,
        sku: `REC-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, adminToken, {
        productId,
        name: `Recover Variant ${suffix}`,
        sku: `REC-SKU-${suffix}`,
        isDefault: true,
      })

      const warehouseId = await createCrudFixture(request, adminToken, '/api/wms/warehouses', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: `Recover WH ${suffix}`,
        code: `REC-WH-${suffix}`,
        isActive: true,
        timezone: 'UTC',
      })
      // Intentionally no location yet → WMS adjust cannot resolve a bucket.

      const registerId = await createCrudFixture(request, adminToken, '/api/soanas_cash/registers', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `REC-REG-${suffix}`,
        name: `Recover Register ${suffix}`,
        warehouseId,
        blindClosing: false,
        discrepancyToleranceCents: '0',
        isActive: true,
      })
      const session = await postJson(request, adminToken, '/api/soanas_cash/sessions/open', {
        registerId,
        openingFloatCents: '5000',
        idempotencyKey: `rec-open-${suffix}`,
      })
      const sessionId = expectId(
        (session.body.id as string | undefined) ?? (session.body.sessionId as string | undefined),
        'session',
      )
      const terminalId = await createCrudFixture(request, adminToken, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `REC-POS-${suffix}`,
        name: `Recover Terminal ${suffix}`,
        warehouseId,
        cashRegisterId: registerId,
        stockPolicy: 'ALLOW',
        status: 'active',
      })

      const tx = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId,
        cashSessionId: sessionId,
        currencyCode: 'BRL',
        idempotencyKey: `rec-tx-${suffix}`,
      })
      const transactionId = expectId(tx.body.id as string | undefined, 'tx')
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `REC-SKU-${suffix}`,
        nameSnapshot: `Recover Product ${suffix}`,
        quantity: '1',
        unitPriceCents: '2500',
      })
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
        amountReceivedCents: '2500',
        idempotencyKey: `rec-tender-${suffix}`,
      })

      const failedComplete = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(failedComplete.ok).toBeFalsy()

      const detailFailed = await apiRequest(
        request,
        'GET',
        `/api/soanas_pos/transactions/${transactionId}`,
        { token: adminToken },
      )
      const failedBody = await readJsonSafe<{
        status?: string
        salesOrderId?: string | null
        recovery?: { lastStep?: string; salesOrderId?: string | null }
      }>(detailFailed)
      expect(failedBody?.status).toBe('FAILED_RECOVERABLE')
      const salesOrderId = expectId(
        failedBody?.salesOrderId ?? failedBody?.recovery?.salesOrderId ?? undefined,
        'salesOrderId after crash',
      )
      expect(failedBody?.recovery?.lastStep === 'sales' || Boolean(salesOrderId)).toBeTruthy()

      const paymentsAfterCrash = await apiRequest(
        request,
        'GET',
        `/api/sales/payments?orderId=${encodeURIComponent(salesOrderId)}`,
        { token: adminToken },
      )
      const paymentsCrashBody = await readJsonSafe<{ items?: unknown[] }>(paymentsAfterCrash)
      expect(paymentsCrashBody?.items?.length).toBe(1)

      // Repair WMS prerequisites and recover
      const locationId = await createCrudFixture(request, adminToken, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        code: `REC-LOC-${suffix}`,
        type: 'bin',
        isActive: true,
      })
      await postJson(request, adminToken, '/api/wms/inventory/adjust', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        locationId,
        catalogVariantId: variantId,
        delta: 5,
        reason: 'recover_seed',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      const recovered = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/recover`,
        {},
      )
      expect(recovered.ok, JSON.stringify(recovered.body)).toBeTruthy()
      expect(String(recovered.body.status)).toBe('COMPLETED')
      expect(String(recovered.body.salesOrderId)).toBe(salesOrderId)

      const paymentsAfterRecover = await apiRequest(
        request,
        'GET',
        `/api/sales/payments?orderId=${encodeURIComponent(salesOrderId)}`,
        { token: adminToken },
      )
      const paymentsRecoverBody = await readJsonSafe<{ items?: unknown[] }>(paymentsAfterRecover)
      expect(paymentsRecoverBody?.items?.length).toBe(1)

      const ordersAfterRecover = await apiRequest(
        request,
        'GET',
        `/api/sales/orders?id=${encodeURIComponent(salesOrderId)}`,
        { token: adminToken },
      )
      const ordersBody = await readJsonSafe<{ items?: unknown[] }>(ordersAfterRecover)
      expect(ordersBody?.items?.length).toBe(1)

      const movements = await apiRequest(
        request,
        'GET',
        `/api/wms/inventory/movements?warehouseId=${encodeURIComponent(warehouseId)}&catalogVariantId=${encodeURIComponent(variantId)}&referenceType=so&referenceId=${encodeURIComponent(salesOrderId)}&page=1&pageSize=50`,
        { token: adminToken },
      )
      const movementsBody = await readJsonSafe<{ items?: unknown[] }>(movements)
      expect((movementsBody?.items?.length ?? 0)).toBeGreaterThanOrEqual(1)

      const current = await apiRequest(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: adminToken },
      )
      const currentBody = await readJsonSafe<{ movements?: Array<{ type?: string }> }>(current)
      expect((currentBody?.movements ?? []).filter((movement) => movement.type === 'cash_sale').length).toBe(1)

      // Second recover/complete must remain idempotent
      const secondRecover = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/recover`,
        {},
      )
      expect(String(secondRecover.body.status)).toBe('COMPLETED')
      expect(String(secondRecover.body.salesOrderId)).toBe(salesOrderId)

      const paymentsFinal = await apiRequest(
        request,
        'GET',
        `/api/sales/payments?orderId=${encodeURIComponent(salesOrderId)}`,
        { token: adminToken },
      )
      const paymentsFinalBody = await readJsonSafe<{ items?: unknown[] }>(paymentsFinal)
      expect(paymentsFinalBody?.items?.length).toBe(1)

      const movementsFinal = await apiRequest(
        request,
        'GET',
        `/api/wms/inventory/movements?warehouseId=${encodeURIComponent(warehouseId)}&catalogVariantId=${encodeURIComponent(variantId)}&referenceType=so&referenceId=${encodeURIComponent(salesOrderId)}&page=1&pageSize=50`,
        { token: adminToken },
      )
      const movementsFinalBody = await readJsonSafe<{ items?: unknown[] }>(movementsFinal)
      expect(movementsFinalBody?.items?.length).toBe(movementsBody?.items?.length)

      const cashFinal = await apiRequest(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: adminToken },
      )
      const cashFinalBody = await readJsonSafe<{ movements?: Array<{ type?: string }> }>(cashFinal)
      expect((cashFinalBody?.movements ?? []).filter((movement) => movement.type === 'cash_sale').length).toBe(1)
    } finally {
      await deleteCatalogProductIfExists(request, adminToken, productId)
      await restoreAcl()
    }
  })
})
