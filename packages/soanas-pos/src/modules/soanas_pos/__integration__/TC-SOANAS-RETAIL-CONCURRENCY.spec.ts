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
 * Real DB concurrency: stock=1, two paid carts complete in parallel under BLOCK.
 * At most one sale may consume the last unit (WMS adjust + POS stock policy).
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
  expect(result.ok, `POST ${path} → ${result.status}`).toBeTruthy()
  return expectId(result.body.id as string | undefined, `Missing id in ${path}`)
}

test.describe('TC-SOANAS-RETAIL-CONCURRENCY: real stock race', () => {
  test('at most one of two concurrent completes consumes the last unit under BLOCK', async ({
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
        title: `Race Product ${suffix}`,
        sku: `RACE-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, adminToken, {
        productId,
        name: `Race Variant ${suffix}`,
        sku: `RACE-SKU-${suffix}`,
        isDefault: true,
      })

      const warehouseId = await createCrudFixture(request, adminToken, '/api/wms/warehouses', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: `Race WH ${suffix}`,
        code: `RACE-WH-${suffix}`,
        isActive: true,
        timezone: 'UTC',
      })
      const locationId = await createCrudFixture(request, adminToken, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        code: `RACE-LOC-${suffix}`,
        type: 'bin',
        isActive: true,
      })

      await postJson(request, adminToken, '/api/wms/inventory/adjust', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        locationId,
        catalogVariantId: variantId,
        delta: 1,
        reason: 'race_seed',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      const registerId = await createCrudFixture(request, adminToken, '/api/soanas_cash/registers', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `RACE-REG-${suffix}`,
        name: `Race Register ${suffix}`,
        warehouseId,
        blindClosing: false,
        discrepancyToleranceCents: '0',
        isActive: true,
      })
      const session = await postJson(request, adminToken, '/api/soanas_cash/sessions/open', {
        registerId,
        openingFloatCents: '10000',
        idempotencyKey: `race-open-${suffix}`,
      })
      const sessionId = expectId(
        (session.body.id as string | undefined) ?? (session.body.sessionId as string | undefined),
        'session',
      )
      const terminalId = await createCrudFixture(request, adminToken, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `RACE-POS-${suffix}`,
        name: `Race Terminal ${suffix}`,
        warehouseId,
        cashRegisterId: registerId,
        stockPolicy: 'BLOCK',
        status: 'active',
      })

      async function buildPaidCart(key: string): Promise<string> {
        const tx = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
          terminalId,
          cashSessionId: sessionId,
          currencyCode: 'BRL',
          idempotencyKey: `race-tx-${key}-${suffix}`,
        })
        const transactionId = expectId(tx.body.id as string | undefined, 'tx')
        await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
          catalogProductId: productId,
          catalogVariantId: variantId,
          sku: `RACE-SKU-${suffix}`,
          nameSnapshot: `Race Product ${suffix}`,
          quantity: '1',
          unitPriceCents: '1000',
        })
        await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})
        await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
          amountReceivedCents: '1000',
          idempotencyKey: `race-tender-${key}-${suffix}`,
        })
        return transactionId
      }

      const txA = await buildPaidCart('a')
      const txB = await buildPaidCart('b')

      const [resultA, resultB] = await Promise.all([
        postJson(request, adminToken, `/api/soanas_pos/transactions/${txA}/complete`, {}),
        postJson(request, adminToken, `/api/soanas_pos/transactions/${txB}/complete`, {}),
      ])

      const completed = [resultA, resultB].filter(
        (result) => String(result.body.status) === 'COMPLETED' && result.body.replayed !== true,
      )
      const failed = [resultA, resultB].filter((result) => String(result.body.status) !== 'COMPLETED')
      expect(
        completed.length,
        `expected exactly one fresh COMPLETED; A=${JSON.stringify(resultA)} B=${JSON.stringify(resultB)}`,
      ).toBe(1)
      expect(failed.length).toBe(1)
      expect(
        Array.isArray(completed[0]?.body.wmsMovementIds) &&
          (completed[0]?.body.wmsMovementIds as unknown[]).length >= 1,
        `winner must deduct WMS stock; body=${JSON.stringify(completed[0]?.body)}`,
      ).toBeTruthy()

      const balancesResponse = await apiRequest(
        request,
        'GET',
        `/api/wms/inventory/balances?warehouseId=${encodeURIComponent(warehouseId)}&catalogVariantId=${encodeURIComponent(variantId)}&page=1&pageSize=50`,
        { token: adminToken },
      )
      const balancesBody = await readJsonSafe<{
        items?: Array<{
          quantityOnHand?: string | number
          quantity_on_hand?: string | number
          locationId?: string
          location_id?: string
        }>
      }>(balancesResponse)
      const totalOnHand = (balancesBody?.items ?? []).reduce((sum, item) => {
        const raw = item.quantityOnHand ?? item.quantity_on_hand ?? 0
        return sum + Number(raw)
      }, 0)
      expect(totalOnHand, `balances=${JSON.stringify(balancesBody?.items)}`).toBe(0)
    } finally {
      await deleteCatalogProductIfExists(request, adminToken, productId)
      await restoreAcl()
    }
  })
})
