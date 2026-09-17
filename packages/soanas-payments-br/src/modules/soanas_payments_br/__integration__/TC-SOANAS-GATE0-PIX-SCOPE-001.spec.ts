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
 * TC-SOANAS-GATE0-PIX-SCOPE-001: Pix charge org isolation within a tenant
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_payments_br'],
}

const PIX_ACL_FEATURES = [
  'soanas_payments_br.pix.view',
  'soanas_payments_br.pix.create',
  'soanas_payments_br.pix.cancel',
  'soanas_payments_br.pix.refund',
]

type RolesResponse = { items?: Array<{ id?: string; name?: string }> }
type RoleAclResponse = { isSuperAdmin?: boolean; features?: string[]; organizations?: string[] | null }

async function ensureAdminPixFeatures(
  request: Parameters<typeof apiRequest>[0],
  superadminToken: string,
  tenantId: string,
): Promise<() => Promise<void>> {
  const rolesResponse = await apiRequest(
    request,
    'GET',
    `/api/auth/roles?tenantId=${encodeURIComponent(tenantId)}&page=1&pageSize=100`,
    { token: superadminToken },
  )
  expect(rolesResponse.ok()).toBeTruthy()
  const rolesBody = await readJsonSafe<RolesResponse>(rolesResponse)
  const role = rolesBody?.items?.find((item) => item.name === 'admin') ?? null
  const roleId = expectId(role?.id, 'Missing admin role')

  const aclPath = `/api/auth/roles/acl?roleId=${encodeURIComponent(roleId)}&tenantId=${encodeURIComponent(tenantId)}`
  const aclResponse = await apiRequest(request, 'GET', aclPath, { token: superadminToken })
  expect(aclResponse.ok()).toBeTruthy()
  const aclBody = (await readJsonSafe<RoleAclResponse>(aclResponse)) ?? {}
  if (aclBody.isSuperAdmin) return async () => undefined

  const original = {
    isSuperAdmin: Boolean(aclBody.isSuperAdmin),
    features: Array.isArray(aclBody.features) ? aclBody.features : [],
    organizations: Array.isArray(aclBody.organizations) ? aclBody.organizations : null,
  }
  const mergedFeatures = Array.from(new Set([...original.features, ...PIX_ACL_FEATURES])).sort()
  const changed = mergedFeatures.join('|') !== [...original.features].sort().join('|')
  if (changed) {
    const updateResponse = await apiRequest(request, 'PUT', '/api/auth/roles/acl', {
      token: superadminToken,
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
      token: superadminToken,
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

test.describe('TC-SOANAS-GATE0-PIX-SCOPE-001: Pix charge organization scope', () => {
  test('returns charge in owning org and 404 from sibling org in same tenant', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const suffix = randomUUID().slice(0, 8)

    const restoreAcl = await ensureAdminPixFeatures(request, superadminToken, scope.tenantId)

    let orgAId: string | null = null
    let orgBId: string | null = null

    try {
      orgAId = await createOrganizationFixture(request, superadminToken, {
        name: `Soanas Pix Org A ${suffix}`,
        tenantId: scope.tenantId,
      })
      orgBId = await createOrganizationFixture(request, superadminToken, {
        name: `Soanas Pix Org B ${suffix}`,
        tenantId: scope.tenantId,
      })

      const createResponse = await apiRequestWithSelectedOrg(request, 'POST', '/api/soanas_payments_br/pix/charges', {
        token: adminToken,
        selectedOrgId: orgAId,
        data: {
          amountCents: '1500',
          description: `Gate0 Pix ${suffix}`,
          idempotencyKey: `pix-gate0-${suffix}`,
        },
      })
      expect(createResponse.status(), 'Pix create should return 201').toBe(201)
      const createBody = await readJsonSafe<{ txid?: string }>(createResponse)
      const txid = expectId(createBody?.txid as string | undefined, 'pix txid')

      const detailInOrgA = await apiRequestWithSelectedOrg(
        request,
        'GET',
        `/api/soanas_payments_br/pix/charges/${encodeURIComponent(txid)}`,
        { token: adminToken, selectedOrgId: orgAId },
      )
      expect(detailInOrgA.status(), 'owner org should read the charge').toBe(200)
      const detailA = await readJsonSafe<{ txid?: string; organizationId?: string }>(detailInOrgA)
      expect(detailA?.txid).toBe(txid)
      expect(detailA?.organizationId).toBe(orgAId)

      const detailInOrgB = await apiRequestWithSelectedOrg(
        request,
        'GET',
        `/api/soanas_payments_br/pix/charges/${encodeURIComponent(txid)}`,
        { token: adminToken, selectedOrgId: orgBId },
      )
      expect(detailInOrgB.status(), 'sibling org must not see the charge').toBe(404)
    } finally {
      await deleteOrganizationIfExists(request, superadminToken, orgAId)
      await deleteOrganizationIfExists(request, superadminToken, orgBId)
      await restoreAcl()
    }
  })
})
