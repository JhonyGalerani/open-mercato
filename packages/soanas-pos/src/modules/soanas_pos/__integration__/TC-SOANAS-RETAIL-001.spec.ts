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
 * TC-SOANAS-RETAIL-001: Retail Vertical Slice v1 (API)
 * Source: .ai/qa/scenarios/TC-SOANAS-RETAIL-001-cash-pos-sale.md
 *
 * open cash → POS sale → cash tender → complete → SalesOrder + WMS + cash ledger
 * → replay complete (idempotent) → close cash with count
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

test.describe('TC-SOANAS-RETAIL-001: Retail cash+POS sale vertical slice', () => {
  test('completes a cash sale end-to-end and replays complete idempotently', async ({ request }) => {
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
    let locationId: string | null = null

    try {
      productId = await createProductFixture(request, adminToken, {
        title: `Soanas Product ${suffix}`,
        sku: `SOANAS-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, adminToken, {
        productId,
        name: `Soanas Variant ${suffix}`,
        sku: `SKU-${suffix}`,
        isDefault: true,
      })

      warehouseId = await createCrudFixture(request, adminToken, '/api/wms/warehouses', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: `Soanas WH ${suffix}`,
        code: `SOANAS-WH-${suffix}`,
        isActive: true,
        timezone: 'UTC',
      })
      locationId = await createCrudFixture(request, adminToken, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        code: `SOANAS-LOC-${suffix}`,
        type: 'bin',
        isActive: true,
      })

      await postJson(request, adminToken, '/api/wms/inventory/adjust', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        locationId,
        catalogVariantId: variantId,
        delta: 10,
        reason: 'soanas_retail_seed',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      const registerId = await createCrudFixture(request, adminToken, '/api/soanas_cash/registers', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `REG-${suffix}`,
        name: `Register ${suffix}`,
        warehouseId,
        blindClosing: false,
        withdrawalLimitWithoutApprovalCents: '100000',
        discrepancyToleranceCents: '0',
        isActive: true,
      })

      const sessionBody = await postJson(request, adminToken, '/api/soanas_cash/sessions/open', {
        registerId,
        openingFloatCents: '20000',
        openingDenominations: { '100': 1, '50': 2 },
        idempotencyKey: `open-${suffix}`,
      })
      const sessionId = expectId(
        (sessionBody.id as string | undefined) ?? (sessionBody.sessionId as string | undefined),
        'session id',
      )

      const terminalId = await createCrudFixture(request, adminToken, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `POS-${suffix}`,
        name: `Terminal ${suffix}`,
        warehouseId,
        cashRegisterId: registerId,
        stockPolicy: 'BLOCK',
        status: 'active',
      })

      const txBody = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId,
        cashSessionId: sessionId,
        currencyCode: 'BRL',
        idempotencyKey: `tx-${suffix}`,
      })
      const transactionId = expectId(txBody.id as string | undefined, 'transaction id')

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `SKU-${suffix}`,
        nameSnapshot: `Soanas Product ${suffix}`,
        quantity: '2',
        unitPriceCents: '4125',
      })

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})

      const tenderBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/tenders/cash`,
        {
          amountReceivedCents: '10000',
          idempotencyKey: `tender-${suffix}`,
        },
      )
      expect(String(tenderBody.changeAmountCents)).toBe('1750')
      expect(String(tenderBody.amountAppliedCents)).toBe('8250')

      const completeBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(completeBody.status)).toBe('COMPLETED')
      const salesOrderId = expectId(completeBody.salesOrderId as string | undefined, 'salesOrderId')

      const replayBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(replayBody.status)).toBe('COMPLETED')
      expect(String(replayBody.salesOrderId)).toBe(salesOrderId)
      expect(Boolean(replayBody.replayed)).toBe(true)

      const detailResponse = await apiRequest(
        request,
        'GET',
        `/api/soanas_pos/transactions/${transactionId}`,
        { token: adminToken },
      )
      expect(detailResponse.ok()).toBeTruthy()
      const detail = await readJsonSafe<{ status?: string; salesOrderId?: string }>(detailResponse)
      expect(detail?.status).toBe('COMPLETED')
      expect(detail?.salesOrderId).toBe(salesOrderId)

      // opening 20000 + cash sale 8250 = 28250
      await postJson(request, adminToken, '/api/soanas_cash/sessions/close', {
        sessionId,
        countedCashCents: '28250',
        denominations: { '100': 2, '50': 1, '20': 1, '10': 1, '2': 1, '0.5': 1 },
        idempotencyKey: `close-${suffix}`,
      })
    } finally {
      await deleteCatalogProductIfExists(request, adminToken, productId)
      await restoreAcl()
    }
  })
})
