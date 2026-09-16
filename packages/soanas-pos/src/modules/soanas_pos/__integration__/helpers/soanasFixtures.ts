import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import {
  createProductFixture,
  createVariantFixture,
  deleteCatalogProductIfExists,
} from '@open-mercato/core/helpers/integration/catalogFixtures'
import { expectId, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'

type RolesResponse = { items?: Array<{ id?: string; name?: string }> }
type RoleAclResponse = {
  isSuperAdmin?: boolean
  features?: string[]
  organizations?: string[] | null
}

export type SoanasPosContext = {
  suffix: string
  registerId: string
  sessionId: string
  terminalId: string
  warehouseId: string
  productId: string
  variantId: string
  primaryLocationId: string
}

export const SOANAS_POS_ACL_FEATURES = [
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
]

export async function ensureRoleFeatures(
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

export async function postJson(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await apiRequest(request, 'POST', path, { token, data })
  const body = await readJsonSafe<Record<string, unknown>>(response)
  expect(response.ok(), `POST ${path} → ${response.status()} ${JSON.stringify(body)}`).toBeTruthy()
  return body ?? {}
}

export async function postJsonRaw(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const response = await apiRequest(request, 'POST', path, { token, data })
  const body = (await readJsonSafe<Record<string, unknown>>(response)) ?? {}
  return { ok: response.ok(), status: response.status(), body }
}

export async function deleteJsonRaw(
  request: APIRequestContext,
  token: string,
  path: string,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const response = await apiRequest(request, 'DELETE', path, { token })
  const body = (await readJsonSafe<Record<string, unknown>>(response)) ?? {}
  return { ok: response.ok(), status: response.status(), body }
}

export async function createCrudFixture(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  const body = await postJson(request, token, path, data)
  return expectId(body.id as string | undefined, `Missing id in ${path} create response`)
}

export async function getTransactionDetail(
  request: APIRequestContext,
  token: string,
  transactionId: string,
): Promise<Record<string, unknown>> {
  const response = await apiRequest(
    request,
    'GET',
    `/api/soanas_pos/transactions/${transactionId}`,
    { token },
  )
  expect(response.ok()).toBeTruthy()
  return (await readJsonSafe<Record<string, unknown>>(response)) ?? {}
}

export async function seedPosContext(args: {
  request: APIRequestContext
  token: string
  tenantId: string
  organizationId: string
  userId: string
  openingFloatCents?: string
  initialStock?: string
}): Promise<SoanasPosContext> {
  const suffix = randomUUID().slice(0, 8)
  const productId = await createProductFixture(args.request, args.token, {
    title: `Soanas MT ${suffix}`,
    sku: `SOANAS-MT-P-${suffix}`,
  })
  const variantId = await createVariantFixture(args.request, args.token, {
    productId,
    name: `Soanas MT Variant ${suffix}`,
    sku: `SOANAS-MT-SKU-${suffix}`,
    isDefault: true,
  })

  const warehouseId = await createCrudFixture(args.request, args.token, '/api/wms/warehouses', {
    organizationId: args.organizationId,
    tenantId: args.tenantId,
    name: `Soanas MT WH ${suffix}`,
    code: `SOANAS-MT-WH-${suffix}`,
    isActive: true,
    timezone: 'UTC',
  })
  const primaryLocationId = await createCrudFixture(args.request, args.token, '/api/wms/locations', {
    organizationId: args.organizationId,
    tenantId: args.tenantId,
    warehouseId,
    code: `SOANAS-MT-LOC-${suffix}`,
    type: 'bin',
    isActive: true,
  })

  const initialStock = args.initialStock ?? '100'
  if (BigInt(initialStock) !== 0n) {
    await postJson(args.request, args.token, '/api/wms/inventory/adjust', {
      organizationId: args.organizationId,
      tenantId: args.tenantId,
      warehouseId,
      locationId: primaryLocationId,
      catalogVariantId: variantId,
      delta: initialStock,
      reason: 'soanas_manual_tender_seed',
      referenceType: 'manual',
      referenceId: randomUUID(),
      performedBy: args.userId,
    })
  }

  const registerId = await createCrudFixture(args.request, args.token, '/api/soanas_cash/registers', {
    organizationId: args.organizationId,
    tenantId: args.tenantId,
    code: `SOANAS-MT-REG-${suffix}`,
    name: `Register MT ${suffix}`,
    warehouseId,
    blindClosing: false,
    withdrawalLimitWithoutApprovalCents: '100000',
    discrepancyToleranceCents: '0',
    isActive: true,
  })

  const sessionBody = await postJson(args.request, args.token, '/api/soanas_cash/sessions/open', {
    registerId,
    openingFloatCents: args.openingFloatCents ?? '50000',
    idempotencyKey: `mt-open-${suffix}`,
  })
  const sessionId = expectId(
    (sessionBody.id as string | undefined) ?? (sessionBody.sessionId as string | undefined),
    'cash session id',
  )

  const terminalId = await createCrudFixture(args.request, args.token, '/api/soanas_pos/terminals', {
    organizationId: args.organizationId,
    tenantId: args.tenantId,
    code: `SOANAS-MT-POS-${suffix}`,
    name: `Terminal MT ${suffix}`,
    warehouseId,
    cashRegisterId: registerId,
    stockPolicy: 'BLOCK',
    status: 'active',
  })

  return {
    suffix,
    registerId,
    sessionId,
    terminalId,
    warehouseId,
    productId,
    variantId,
    primaryLocationId,
  }
}

export async function openPosTransaction(args: {
  request: APIRequestContext
  token: string
  ctx: SoanasPosContext
  unitPriceCents: string
  quantity?: string
}): Promise<string> {
  const txBody = await postJson(args.request, args.token, '/api/soanas_pos/transactions', {
    terminalId: args.ctx.terminalId,
    cashSessionId: args.ctx.sessionId,
    currencyCode: 'BRL',
    idempotencyKey: `mt-tx-${args.ctx.suffix}-${args.unitPriceCents}`,
  })
  const transactionId = expectId(txBody.id as string | undefined, 'transaction id')
  await postJson(args.request, args.token, `/api/soanas_pos/transactions/${transactionId}/lines`, {
    catalogProductId: args.ctx.productId,
    catalogVariantId: args.ctx.variantId,
    sku: `SOANAS-MT-SKU-${args.ctx.suffix}`,
    nameSnapshot: `Soanas MT ${args.ctx.suffix}`,
    quantity: args.quantity ?? '1',
    unitPriceCents: args.unitPriceCents,
  })
  await postJson(args.request, args.token, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})
  return transactionId
}

export async function cleanupPosContext(
  request: APIRequestContext,
  token: string,
  productId: string | null,
): Promise<void> {
  await deleteCatalogProductIfExists(request, token, productId)
}
