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
 * TC-SOANAS-POS-APPROVAL-001: manager approval request/decide/consume for over-limit discount
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'catalog'],
}

type RolesResponse = { items?: Array<{ id?: string; name?: string }> }
type RoleAclResponse = { isSuperAdmin?: boolean; features?: string[]; organizations?: string[] | null }

async function ensureAdminApproverAcl(
  request: APIRequestContext,
  token: string,
  tenantId: string,
): Promise<() => Promise<void>> {
  const rolesResponse = await apiRequest(
    request,
    'GET',
    `/api/auth/roles?tenantId=${encodeURIComponent(tenantId)}&page=1&pageSize=100`,
    { token },
  )
  expect(rolesResponse.ok()).toBeTruthy()
  const rolesBody = await readJsonSafe<RolesResponse>(rolesResponse)
  const role = rolesBody?.items?.find((item) => item.name === 'admin') ?? null
  const roleId = expectId(role?.id, 'Missing admin role')
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
  const merged = Array.from(
    new Set([
      ...original.features,
      'soanas_pos.*',
      'soanas_pos.discount.approve',
      'soanas_pos.approval.manager',
    ]),
  ).sort()
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

async function setEmployeePosSellerAcl(
  request: APIRequestContext,
  token: string,
  tenantId: string,
): Promise<() => Promise<void>> {
  const rolesResponse = await apiRequest(
    request,
    'GET',
    `/api/auth/roles?tenantId=${encodeURIComponent(tenantId)}&page=1&pageSize=100`,
    { token },
  )
  expect(rolesResponse.ok()).toBeTruthy()
  const rolesBody = await readJsonSafe<RolesResponse>(rolesResponse)
  const role = rolesBody?.items?.find((item) => item.name === 'employee') ?? null
  const roleId = expectId(role?.id, 'Missing employee role')
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
  const sellerFeatures = [
    'soanas_pos.terminals.view',
    'soanas_pos.transactions.view',
    'soanas_pos.transactions.sell',
    'soanas_pos.catalog.search',
    'soanas_pos.discount.grant',
    'catalog.products.view',
    'catalog.variants.view',
  ]
  await apiRequest(request, 'PUT', '/api/auth/roles/acl', {
    token,
    data: {
      roleId,
      tenantId,
      isSuperAdmin: false,
      features: sellerFeatures,
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

test.describe('TC-SOANAS-POS-APPROVAL-001: discount approval dual custody', () => {
  test('request → self-approve denied → manager approve → consume on discount', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const employeeToken = await getAuthToken(request, 'employee')
    const scope = getTokenScope(adminToken)
    const employeeScope = getTokenScope(employeeToken)
    const suffix = randomUUID().slice(0, 8)
    let productId: string | null = null

    const restoreAdmin = await ensureAdminApproverAcl(request, superadminToken, scope.tenantId)
    const restoreEmployee = await setEmployeePosSellerAcl(request, superadminToken, scope.tenantId)
    clearAuthTokenCache()
    const freshAdminToken = await getAuthToken(request, 'admin')
    const freshEmployeeToken = await getAuthToken(request, 'employee')

    try {
      productId = await createProductFixture(request, freshAdminToken, {
        title: `Appr Product ${suffix}`,
        sku: `APPR-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, freshAdminToken, {
        productId,
        name: `Appr Variant ${suffix}`,
        sku: `APPR-SKU-${suffix}`,
        isDefault: true,
      })
      const terminalId = expectId(
        (
          await postJson(request, freshAdminToken, '/api/soanas_pos/terminals', {
            organizationId: scope.organizationId,
            tenantId: scope.tenantId,
            code: `APPR-POS-${suffix}`,
            name: `Approval Terminal ${suffix}`,
            stockPolicy: 'ALLOW',
            status: 'active',
          })
        ).id as string | undefined,
        'terminal',
      )
      const created = await postJson(request, freshEmployeeToken, '/api/soanas_pos/transactions', {
        terminalId,
        idempotencyKey: `appr-open-${suffix}`,
      })
      const transactionId = expectId(created.id as string | undefined, 'tx')
      await postJson(request, freshEmployeeToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: productId,
        catalogVariantId: variantId,
        sku: `APPR-SKU-${suffix}`,
        nameSnapshot: `Appr Variant ${suffix}`,
        quantity: '1',
        unitPriceCents: '10000',
      })

      const blocked = await apiRequest(
        request,
        'POST',
        `/api/soanas_pos/transactions/${transactionId}/discount`,
        {
          token: freshEmployeeToken,
          data: { scope: 'cart', amountCents: '5000', reason: 'too big without approval' },
        },
      )
      expect(blocked.ok()).toBeFalsy()

      const requested = await postJson(request, freshEmployeeToken, '/api/soanas_pos/approvals/request', {
        kind: 'discount',
        transactionId,
        terminalId,
        reason: 'Cliente fidelidade',
        payload: { scope: 'cart', amountCents: '5000' },
        before: { discountTotalCents: '0' },
        after: { discountTotalCents: '5000' },
        idempotencyKey: `appr-req-${suffix}`,
      })
      const approvalId = expectId(requested.id as string | undefined, 'approval')

      const selfApprove = await apiRequest(request, 'POST', '/api/soanas_pos/approvals/decide', {
        token: freshEmployeeToken,
        data: { approvalRequestId: approvalId, decision: 'approved' },
      })
      expect(selfApprove.ok()).toBeFalsy()

      const decided = await postJson(request, freshAdminToken, '/api/soanas_pos/approvals/decide', {
        approvalRequestId: approvalId,
        decision: 'approved',
        decisionReason: 'Ok campanha',
      })
      expect(decided.status).toBe('approved')
      expect(decided.approverUserId).toBe(scope.userId)
      expect(decided.approverUserId).not.toBe(employeeScope.userId)

      const applied = await postJson(
        request,
        freshEmployeeToken,
        `/api/soanas_pos/transactions/${transactionId}/discount`,
        {
          scope: 'cart',
          amountCents: '5000',
          reason: 'Cliente fidelidade',
          approvalRequestId: approvalId,
        },
      )
      expect(BigInt(String(applied.grandTotalCents))).toBe(5000n)

      const reuse = await apiRequest(
        request,
        'POST',
        `/api/soanas_pos/transactions/${transactionId}/discount`,
        {
          token: freshEmployeeToken,
          data: {
            scope: 'cart',
            amountCents: '5000',
            approvalRequestId: approvalId,
          },
        },
      )
      expect(reuse.ok()).toBeFalsy()
    } finally {
      await deleteCatalogProductIfExists(request, freshAdminToken, productId)
      await restoreEmployee()
      await restoreAdmin()
    }
  })
})
