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
import {
  createLocalRuntimeConfig,
  probeLocalBoot,
  probeWanDocumentationAddress,
  restartStoreLocalAppProcess,
  findPidsListeningOnPort,
} from '@open-mercato/soanas-desktop'

/**
 * TC-SOANAS-E1-LOCAL-BOOT-001
 * Store-local boot: health + auth + POS UI, durable Postgres sale across OS process
 * SIGKILL restart (not class re-instantiation), WAN probe while loopback remains usable.
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
  return expectId(body.id as string | undefined, `Missing id in ${path} create response`)
}

test.describe('TC-SOANAS-E1-LOCAL-BOOT-001: store-local boot + process restart', () => {
  test('health/auth/UI, complete sale in Postgres, SIGKILL restart, no duplicate effects', async ({
    request,
  }) => {
    test.setTimeout(420_000)

    const baseUrl = (process.env.BASE_URL || process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
    const runtime = createLocalRuntimeConfig({ uiOrigin: baseUrl })
    const boot = await probeLocalBoot(runtime)
    expect(boot.loginPage.ok, `login page: ${boot.loginPage.detail}`).toBeTruthy()
    expect(boot.health.ok, `health: ${boot.health.detail}`).toBeTruthy()
    expect(boot.authLogin.ok, `auth login: ${boot.authLogin.detail}`).toBeTruthy()
    expect(boot.posSellUi.ok, `POS sell UI: ${boot.posSellUi.detail}`).toBeTruthy()

    const wan = await probeWanDocumentationAddress(1500)
    expect(wan.reachable).toBe(false)
    const loopbackAfterWan = await probeLocalBoot(runtime)
    expect(loopbackAfterWan.loginPage.ok).toBeTruthy()

    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const suffix = randomUUID().slice(0, 8)

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

    let productId: string | null = null
    let warehouseId: string | null = null

    try {
      productId = await createProductFixture(request, adminToken, {
        title: `E1 Product ${suffix}`,
        sku: `E1-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, adminToken, {
        productId,
        name: `E1 Variant ${suffix}`,
        sku: `E1-SKU-${suffix}`,
        isDefault: true,
      })

      warehouseId = await createCrudFixture(request, adminToken, '/api/wms/warehouses', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: `E1 WH ${suffix}`,
        code: `E1-WH-${suffix}`,
        isActive: true,
        timezone: 'UTC',
      })
      const locationId = await createCrudFixture(request, adminToken, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        code: `E1-LOC-${suffix}`,
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
        reason: 'soanas_e1_seed',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      const registerId = await createCrudFixture(request, adminToken, '/api/soanas_cash/registers', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `E1-REG-${suffix}`,
        name: `E1 Register ${suffix}`,
        warehouseId,
        blindClosing: false,
        withdrawalLimitWithoutApprovalCents: '100000',
        discrepancyToleranceCents: '0',
        isActive: true,
      })

      const sessionBody = await postJson(request, adminToken, '/api/soanas_cash/sessions/open', {
        registerId,
        openingFloatCents: '10000',
        openingDenominations: { '100': 1 },
        idempotencyKey: `e1-open-${suffix}`,
      })
      const sessionId = expectId(
        (sessionBody.id as string | undefined) ?? (sessionBody.sessionId as string | undefined),
        'session id',
      )

      const terminalId = await createCrudFixture(request, adminToken, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `E1-POS-${suffix}`,
        name: `E1 Terminal ${suffix}`,
        warehouseId,
        cashRegisterId: registerId,
        stockPolicy: 'BLOCK',
        status: 'active',
      })

      const txBody = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId,
        cashSessionId: sessionId,
        currencyCode: 'BRL',
        idempotencyKey: `e1-tx-${suffix}`,
      })
      const transactionId = expectId(txBody.id as string | undefined, 'transaction id')

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `E1-SKU-${suffix}`,
        nameSnapshot: `E1 Product ${suffix}`,
        quantity: '1',
        unitPriceCents: '2500',
      })
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})
      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
        amountReceivedCents: '2500',
        idempotencyKey: `e1-tender-${suffix}`,
      })

      const completeBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(completeBody.status)).toBe('COMPLETED')
      const salesOrderId = expectId(completeBody.salesOrderId as string | undefined, 'salesOrderId')

      const port = Number(new URL(baseUrl).port || 3000)
      const pidsBefore = findPidsListeningOnPort(port)
      expect(pidsBefore.length).toBeGreaterThan(0)

      const restart = await restartStoreLocalAppProcess({
        baseUrl,
        databaseUrl: process.env.DATABASE_URL,
        signal: 'SIGKILL',
        readyTimeoutMs: 240_000,
      })
      expect(restart.ready, 'app ready after SIGKILL restart').toBeTruthy()
      expect(restart.previousPids.length).toBeGreaterThan(0)
      expect(restart.newPid).toBeTruthy()
      expect(restart.lockCleared).toBe(true)
      expect(restart.previousPids.includes(Number(restart.newPid))).toBe(false)

      // New Playwright request context still points at same baseURL; re-auth after restart.
      const adminTokenAfter = await getAuthToken(request, 'admin')

      const txAfter = await apiRequest(
        request,
        'GET',
        `/api/soanas_pos/transactions/${transactionId}`,
        { token: adminTokenAfter },
      )
      expect(txAfter.ok()).toBeTruthy()
      const txAfterBody = await readJsonSafe<{ status?: string; salesOrderId?: string }>(txAfter)
      expect(String(txAfterBody?.status)).toBe('COMPLETED')
      expect(String(txAfterBody?.salesOrderId ?? salesOrderId)).toBe(salesOrderId)

      const replay = await postJson(
        request,
        adminTokenAfter,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(replay.status)).toBe('COMPLETED')
      expect(String(replay.salesOrderId)).toBe(salesOrderId)
      expect(Boolean(replay.replayed)).toBe(true)

      const payments = await apiRequest(
        request,
        'GET',
        `/api/sales/payments?orderId=${encodeURIComponent(salesOrderId)}`,
        { token: adminTokenAfter },
      )
      const paymentsBody = await readJsonSafe<{ items?: unknown[] }>(payments)
      expect(paymentsBody?.items?.length).toBe(1)

      const current = await apiRequest(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: adminTokenAfter },
      )
      const currentBody = await readJsonSafe<{
        movements?: Array<{ type?: string }>
      }>(current)
      const cashSales = (currentBody?.movements ?? []).filter((movement) => movement.type === 'cash_sale')
      expect(cashSales.length).toBe(1)

      const balances = await apiRequest(
        request,
        'GET',
        `/api/wms/inventory/balances?warehouseId=${encodeURIComponent(warehouseId)}&catalogVariantId=${encodeURIComponent(variantId)}&locationId=${encodeURIComponent(locationId)}&page=1&pageSize=20`,
        { token: adminTokenAfter },
      )
      const balancesBody = await readJsonSafe<{
        items?: Array<{ quantityOnHand?: string | number; quantity_on_hand?: string | number }>
      }>(balances)
      const onHand = Number(
        balancesBody?.items?.[0]?.quantityOnHand ?? balancesBody?.items?.[0]?.quantity_on_hand ?? NaN,
      )
      expect(onHand).toBe(4)
    } finally {
      await restoreAcl()
      if (productId) await deleteCatalogProductIfExists(request, adminToken, productId).catch(() => undefined)
    }
  })
})
