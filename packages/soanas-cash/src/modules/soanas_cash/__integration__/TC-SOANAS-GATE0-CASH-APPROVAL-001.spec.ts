import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import {
  apiRequestWithSelectedOrg,
  createOrganizationFixture,
  deleteOrganizationIfExists,
} from '@open-mercato/core/helpers/integration/authFixtures'
import { expectId, getTokenScope, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'

/**
 * TC-SOANAS-GATE0-CASH-APPROVAL-001: ADR-012 — approver identity from session, not body
 *
 * Register with null withdrawal/supply limits requires approval. Dual custody compares
 * against session.operatorUserId (not payload operator). Client-supplied approverUserId
 * is ignored; withdrawal and supply behave symmetrically.
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_cash', 'wms'],
}

const SOANAS_CASH_ACL_FEATURES = [
  'soanas_cash.*',
  'wms.view',
  'wms.manage_warehouses',
  'wms.manage_locations',
]

type RolesResponse = { items?: Array<{ id?: string; name?: string }> }
type RoleAclResponse = { isSuperAdmin?: boolean; features?: string[]; organizations?: string[] | null }

async function ensureRoleFeatures(
  request: Parameters<typeof apiRequest>[0],
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

async function postJsonWithOrg(
  request: Parameters<typeof apiRequest>[0],
  token: string,
  selectedOrgId: string,
  path: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await apiRequestWithSelectedOrg(request, 'POST', path, { token, selectedOrgId, data })
  const body = await readJsonSafe<Record<string, unknown>>(response)
  expect(response.ok(), `POST ${path} → ${response.status()} ${JSON.stringify(body)}`).toBeTruthy()
  return body ?? {}
}

async function seedOpenSession(args: {
  request: Parameters<typeof apiRequest>[0]
  adminToken: string
  organizationId: string
  suffix: string
}): Promise<{ registerId: string; sessionId: string }> {
  const { request, adminToken, organizationId, suffix } = args
  const warehouseBody = await postJsonWithOrg(request, adminToken, organizationId, '/api/wms/warehouses', {
    name: `Gate0 WH ${suffix}`,
    code: `G0-WH-${suffix}`,
    isActive: true,
    timezone: 'UTC',
  })
  const warehouseId = expectId(warehouseBody.id as string | undefined, 'warehouse id')

  const registerBody = await postJsonWithOrg(request, adminToken, organizationId, '/api/soanas_cash/registers', {
    code: `G0-REG-${suffix}`,
    name: `Gate0 Register ${suffix}`,
    warehouseId,
    blindClosing: false,
    withdrawalLimitWithoutApprovalCents: null,
    supplyLimitWithoutApprovalCents: null,
    discrepancyToleranceCents: '0',
    isActive: true,
  })
  const registerId = expectId(registerBody.id as string | undefined, 'register id')

  const sessionBody = await postJsonWithOrg(request, adminToken, organizationId, '/api/soanas_cash/sessions/open', {
    registerId,
    openingFloatCents: '50000',
    openingDenominations: { '100': 5 },
    idempotencyKey: `gate0-open-${suffix}`,
  })
  const sessionId = expectId(
    (sessionBody.id as string | undefined) ?? (sessionBody.sessionId as string | undefined),
    'session id',
  )
  return { registerId, sessionId }
}

test.describe('TC-SOANAS-GATE0-CASH-APPROVAL-001: dual custody session operator', () => {
  test('manager approves withdrawal; spoofed approverUserId ignored', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const adminScope = getTokenScope(adminToken)
    const superadminScope = getTokenScope(superadminToken)
    const suffix = randomUUID().slice(0, 8)
    const spoofedApproverUserId = '11111111-1111-4111-8111-111111111111'

    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      adminScope.tenantId,
      'admin',
      SOANAS_CASH_ACL_FEATURES,
    )

    let organizationId: string | null = null

    try {
      organizationId = await createOrganizationFixture(request, superadminToken, {
        name: `Soanas Gate0 Cash Org ${suffix}`,
        tenantId: adminScope.tenantId,
      })

      const { registerId, sessionId } = await seedOpenSession({
        request,
        adminToken,
        organizationId,
        suffix,
      })

      const withdrawalResponse = await apiRequestWithSelectedOrg(
        request,
        'POST',
        '/api/soanas_cash/withdrawals',
        {
          token: superadminToken,
          selectedOrgId: organizationId,
          data: {
            sessionId,
            amountCents: '10000',
            reasonCode: 'excess_cash',
            destination: 'safe',
            denominations: { '100': 1 },
            operatorUserId: superadminScope.userId,
            approverUserId: spoofedApproverUserId,
            idempotencyKey: `gate0-withdraw-${suffix}`,
          },
        },
      )
      expect(withdrawalResponse.ok(), `withdrawal failed: ${withdrawalResponse.status()}`).toBeTruthy()

      const currentResponse = await apiRequestWithSelectedOrg(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: superadminToken, selectedOrgId: organizationId },
      )
      expect(currentResponse.ok()).toBeTruthy()
      const currentBody = await readJsonSafe<{
        movements?: Array<{ type?: string; approverUserId?: string | null; operatorUserId?: string }>
      }>(currentResponse)

      const withdrawals = (currentBody?.movements ?? []).filter((movement) => movement.type === 'withdrawal')
      expect(withdrawals.length).toBe(1)
      expect(withdrawals[0]?.operatorUserId).toBe(adminScope.userId)
      expect(withdrawals[0]?.approverUserId).toBe(superadminScope.userId)
      expect(withdrawals[0]?.approverUserId).not.toBe(spoofedApproverUserId)
      expect(withdrawals[0]?.approverUserId).not.toBe(adminScope.userId)
    } finally {
      await deleteOrganizationIfExists(request, superadminToken, organizationId)
      await restoreAcl()
    }
  })

  test('supply is symmetric with withdrawal for dual custody + spoofed approver', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const adminScope = getTokenScope(adminToken)
    const superadminScope = getTokenScope(superadminToken)
    const suffix = randomUUID().slice(0, 8)
    const spoofedApproverUserId = '22222222-2222-4222-8222-222222222222'

    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      adminScope.tenantId,
      'admin',
      SOANAS_CASH_ACL_FEATURES,
    )

    let organizationId: string | null = null

    try {
      organizationId = await createOrganizationFixture(request, superadminToken, {
        name: `Soanas Gate0 Supply Org ${suffix}`,
        tenantId: adminScope.tenantId,
      })

      const { registerId, sessionId } = await seedOpenSession({
        request,
        adminToken,
        organizationId,
        suffix: `s-${suffix}`,
      })

      const selfSupply = await apiRequestWithSelectedOrg(request, 'POST', '/api/soanas_cash/supplies', {
        token: adminToken,
        selectedOrgId: organizationId,
        data: {
          sessionId,
          amountCents: '10000',
          reasonCode: 'change_fund',
          origin: 'safe',
          denominations: { '100': 1 },
          operatorUserId: adminScope.userId,
          approverUserId: spoofedApproverUserId,
          idempotencyKey: `gate0-supply-self-${suffix}`,
        },
      })
      expect(selfSupply.status()).toBe(403)

      const supplyResponse = await apiRequestWithSelectedOrg(request, 'POST', '/api/soanas_cash/supplies', {
        token: superadminToken,
        selectedOrgId: organizationId,
        data: {
          sessionId,
          amountCents: '10000',
          reasonCode: 'change_fund',
          origin: 'safe',
          denominations: { '100': 1 },
          operatorUserId: superadminScope.userId,
          approverUserId: spoofedApproverUserId,
          idempotencyKey: `gate0-supply-ok-${suffix}`,
        },
      })
      expect(supplyResponse.ok(), `supply failed: ${supplyResponse.status()}`).toBeTruthy()

      const currentResponse = await apiRequestWithSelectedOrg(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: superadminToken, selectedOrgId: organizationId },
      )
      expect(currentResponse.ok()).toBeTruthy()
      const currentBody = await readJsonSafe<{
        movements?: Array<{ type?: string; approverUserId?: string | null; operatorUserId?: string }>
      }>(currentResponse)

      const supplies = (currentBody?.movements ?? []).filter((movement) => movement.type === 'supply')
      expect(supplies.length).toBe(1)
      expect(supplies[0]?.operatorUserId).toBe(adminScope.userId)
      expect(supplies[0]?.approverUserId).toBe(superadminScope.userId)
      expect(supplies[0]?.approverUserId).not.toBe(spoofedApproverUserId)
      expect(supplies[0]?.approverUserId).not.toBe(adminScope.userId)
    } finally {
      await deleteOrganizationIfExists(request, superadminToken, organizationId)
      await restoreAcl()
    }
  })

  test('payload operatorUserId cannot bypass dual custody on withdrawal', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const adminScope = getTokenScope(adminToken)
    const suffix = randomUUID().slice(0, 8)

    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      adminScope.tenantId,
      'admin',
      SOANAS_CASH_ACL_FEATURES,
    )

    let organizationId: string | null = null

    try {
      organizationId = await createOrganizationFixture(request, superadminToken, {
        name: `Soanas Gate0 Bypass Org ${suffix}`,
        tenantId: adminScope.tenantId,
      })

      const { sessionId } = await seedOpenSession({
        request,
        adminToken,
        organizationId,
        suffix: `b-${suffix}`,
      })

      // Operator A opens the session; A tries to approve by claiming a different operator in the body.
      const selfWithdraw = await apiRequestWithSelectedOrg(request, 'POST', '/api/soanas_cash/withdrawals', {
        token: adminToken,
        selectedOrgId: organizationId,
        data: {
          sessionId,
          amountCents: '10000',
          reasonCode: 'excess_cash',
          destination: 'safe',
          denominations: { '100': 1 },
          operatorUserId: '33333333-3333-4333-8333-333333333333',
          approverUserId: '44444444-4444-4444-8444-444444444444',
          idempotencyKey: `gate0-withdraw-bypass-${suffix}`,
        },
      })
      expect(selfWithdraw.status()).toBe(403)
    } finally {
      await deleteOrganizationIfExists(request, superadminToken, organizationId)
      await restoreAcl()
    }
  })
})
