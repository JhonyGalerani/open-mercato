import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from '@open-mercato/core/helpers/integration/auth'
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
 * TC-SOANAS-RETAIL-UI-001: Retail operator browser path
 * Source: .ai/qa/scenarios/TC-SOANAS-RETAIL-001-cash-pos-sale.md (UI path)
 *
 * login → open cash (UI) → POS sell (UI) → search/add/checkout/cash/complete
 * → sales history → close cash (UI)
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
    expect(updateResponse.ok()).toBeTruthy()
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
    })
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
  return expectId(body.id as string | undefined, `Missing id in ${path}`)
}

async function ensurePriceKindId(
  request: APIRequestContext,
  token: string,
): Promise<{ id: string; currencyCode: string }> {
  const list = await apiRequest(request, 'GET', '/api/catalog/price-kinds?page=1&pageSize=1', { token })
  expect(list.ok()).toBeTruthy()
  const body = await readJsonSafe<{ items?: Array<Record<string, unknown>> }>(list)
  const first = body?.items?.[0]
  if (first?.id) {
    return {
      id: String(first.id),
      currencyCode: String(first.currency_code ?? first.currencyCode ?? 'BRL'),
    }
  }
  const created = await postJson(request, token, '/api/catalog/price-kinds', {
    title: `Soanas UI PK ${randomUUID().slice(0, 6)}`,
    code: `soanas_ui_${randomUUID().slice(0, 6)}`,
    displayMode: 'including-tax',
    currencyCode: 'BRL',
  })
  return { id: expectId(created.id as string | undefined, 'price kind'), currencyCode: 'BRL' }
}

async function selectOptionByLabel(page: Page, triggerId: string, optionText: RegExp | string) {
  await page.locator(`#${triggerId}`).click()
  await page.getByRole('option', { name: optionText }).click()
}

test.describe('TC-SOANAS-RETAIL-UI-001: Retail operator browser path', () => {
  test.describe.configure({ timeout: 180_000 })

  test('open cash → sell on POS → history → close cash', async ({ page, request }) => {
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
        title: `UI Product ${suffix}`,
        sku: `UI-P-${suffix}`,
      })
      const variantId = await createVariantFixture(request, adminToken, {
        productId,
        name: `UI Variant ${suffix}`,
        sku: `UI-SKU-${suffix}`,
        isDefault: true,
      })
      const priceKind = await ensurePriceKindId(request, adminToken)
      await postJson(request, adminToken, '/api/catalog/prices', {
        productId,
        variantId,
        priceKindId: priceKind.id,
        currencyCode: priceKind.currencyCode === 'USD' ? 'USD' : 'BRL',
        minQuantity: 1,
        unitPriceGross: 41.25,
      })

      const warehouseId = await createCrudFixture(request, adminToken, '/api/wms/warehouses', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: `UI WH ${suffix}`,
        code: `UI-WH-${suffix}`,
        isActive: true,
        timezone: 'UTC',
      })
      const locationId = await createCrudFixture(request, adminToken, '/api/wms/locations', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        warehouseId,
        code: `UI-LOC-${suffix}`,
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
        reason: 'ui_seed',
        referenceType: 'manual',
        referenceId: randomUUID(),
        performedBy: scope.userId,
      })

      const registerId = await createCrudFixture(request, adminToken, '/api/soanas_cash/registers', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `UI-REG-${suffix}`,
        name: `UI Register ${suffix}`,
        warehouseId,
        blindClosing: false,
        discrepancyToleranceCents: '0',
        isActive: true,
      })
      await createCrudFixture(request, adminToken, '/api/soanas_pos/terminals', {
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        code: `UI-POS-${suffix}`,
        name: `UI Terminal ${suffix}`,
        warehouseId,
        cashRegisterId: registerId,
        stockPolicy: 'BLOCK',
        status: 'active',
      })

      await login(page, 'admin')

      await page.goto('/backend/soanas/cash/session')
      await selectOptionByLabel(page, 'soanas-cash-register', new RegExp(`UI-REG-${suffix}`))
      await page.locator('#soanas-cash-opening-float').fill('200.00')
      await page.getByRole('button', { name: 'Open session' }).click()
      await expect(page.getByText('open', { exact: false }).first()).toBeVisible({ timeout: 20000 })
      await expect(page.locator('#soanas-cash-counted')).toBeVisible({ timeout: 20000 })

      const currentResponse = await apiRequest(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: adminToken },
      )
      expect(currentResponse.ok()).toBeTruthy()
      const currentBody = await readJsonSafe<{ session?: { id?: string } }>(currentResponse)
      const sessionId = expectId(currentBody?.session?.id, 'session from UI open')

      await page.goto('/backend/soanas/pos/sell')
      await selectOptionByLabel(page, 'soanas-pos-terminal', new RegExp(`UI-POS-${suffix}`))
      await page.locator('#soanas-pos-session').fill(sessionId)
      await page.getByRole('button', { name: 'Start sale' }).click()
      await expect(page.getByText(/Status:\s*DRAFT/)).toBeVisible({ timeout: 20000 })

      await page.getByPlaceholder('SKU, barcode or name').fill(`UI-SKU-${suffix}`)
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByRole('button', { name: 'Add', exact: true }).first().click()
      await expect(page.getByText(`UI-SKU-${suffix}`).first()).toBeVisible({ timeout: 20000 })

      const qtyInput = page.getByLabel('Qty').first()
      await qtyInput.fill('2')
      await qtyInput.press('Tab')
      await expect(page.getByText(/82,50|82\.50/).first()).toBeVisible({ timeout: 20000 })

      await page.getByRole('button', { name: 'Checkout', exact: true }).click()
      await expect(page.getByText(/Status:\s*(PAYMENT_PENDING|CHECKOUT)/)).toBeVisible({
        timeout: 20000,
      })

      // Checkout already opens the cash-payment dialog; do not click the
      // underlying payment confirm button (it is covered by the overlay).
      const paymentDialog = page.getByRole('dialog').filter({ hasText: /Register payment/i })
      await expect(paymentDialog).toBeVisible({ timeout: 15000 })
      const received = paymentDialog.locator('#soanas-pos-received')
      await received.fill('100.00')
      await expect(received).toHaveValue('100.00')
      await expect(paymentDialog.getByText(/Change:\s*17[,.]50/)).toBeVisible({
        timeout: 15000,
      })
      await paymentDialog.getByRole('button', { name: 'Register payment', exact: true }).click()
      await expect(page.getByText(/Status:\s*PAID/)).toBeVisible({ timeout: 30000 })

      await page.getByRole('button', { name: 'Complete sale', exact: true }).click()
      await expect(page.getByText(/Status:\s*COMPLETED/)).toBeVisible({ timeout: 30000 })
      const receiptDialog = page.getByRole('dialog').filter({ hasText: /Receipt/i })
      await expect(receiptDialog).toBeVisible({ timeout: 15000 })
      await receiptDialog.locator('button').filter({ hasText: /^Close$/ }).click()
      await expect(receiptDialog).toHaveCount(0)

      await page.goto('/backend/soanas/pos/sales')
      await expect(page.getByText('COMPLETED').first()).toBeVisible({ timeout: 20000 })

      await page.goto('/backend/soanas/cash/session')
      await selectOptionByLabel(page, 'soanas-cash-register', new RegExp(`UI-REG-${suffix}`))
      const beforeClose = await apiRequest(
        request,
        'GET',
        `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
        { token: adminToken },
      )
      const beforeCloseBody = await readJsonSafe<{
        totals?: { expectedCashCents?: string }
        movements?: Array<{ type?: string }>
      }>(beforeClose)
      expect(
        (beforeCloseBody?.movements ?? []).some((movement) => movement.type === 'cash_sale'),
      ).toBeTruthy()
      const expectedCents = String(beforeCloseBody?.totals?.expectedCashCents ?? '28250')
      const expectedReais = (Number(expectedCents) / 100).toFixed(2)
      await page.locator('#soanas-cash-counted').fill(expectedReais)
      await page.getByRole('button', { name: 'Close session', exact: true }).click()
      await expect(page.locator('#soanas-cash-opening-float')).toBeVisible({ timeout: 20000 })
    } finally {
      await deleteCatalogProductIfExists(request, adminToken, productId)
      await restoreAcl()
    }
  })
})
