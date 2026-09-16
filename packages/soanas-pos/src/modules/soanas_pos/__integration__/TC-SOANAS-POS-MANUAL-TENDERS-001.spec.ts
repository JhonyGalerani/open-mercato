import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import { expectId, getTokenScope, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'
import {
  cleanupPosContext,
  deleteJsonRaw,
  ensureRoleFeatures,
  getTransactionDetail,
  openPosTransaction,
  postJson,
  postJsonRaw,
  seedPosContext,
  SOANAS_POS_ACL_FEATURES,
  type SoanasPosContext,
} from './helpers/soanasFixtures'

/**
 * TC-SOANAS-POS-MANUAL-TENDERS-001: Gate 1 manual split tenders (API)
 * Cash, Pix, credit/debit manual tenders, removal, insufficient payment, and idempotent complete.
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'soanas_cash', 'sales', 'wms', 'catalog'],
}

type TransactionDetail = {
  status?: string
  salesOrderId?: string | null
  changeAmountCents?: string
  amountPaidCents?: string
  grandTotalCents?: string
  tenders?: Array<{
    id?: string
    type?: string
    status?: string
    amountAppliedCents?: string
    changeAmountCents?: string | null
    brand?: string | null
    installments?: number | null
    nsu?: string | null
  }>
}

type CashSessionSnapshot = {
  movements?: Array<{ type?: string; amountCents?: string }>
}

async function addCashTender(
  request: APIRequestContext,
  token: string,
  transactionId: string,
  ctx: SoanasPosContext,
  amountReceivedCents: string,
  keySuffix: string,
): Promise<Record<string, unknown>> {
  return postJson(request, token, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
    amountReceivedCents,
    idempotencyKey: `cash-${ctx.suffix}-${keySuffix}`,
  })
}

async function addManualTender(
  request: APIRequestContext,
  token: string,
  transactionId: string,
  ctx: SoanasPosContext,
  args: {
    type: string
    amountAppliedCents: string
    keySuffix: string
    brand?: string | null
    installments?: number
    nsu?: string | null
  },
): Promise<Record<string, unknown>> {
  return postJson(request, token, `/api/soanas_pos/transactions/${transactionId}/tenders/manual`, {
    type: args.type,
    amountAppliedCents: args.amountAppliedCents,
    brand: args.brand ?? null,
    installments: args.installments ?? 1,
    nsu: args.nsu ?? null,
    idempotencyKey: `manual-${ctx.suffix}-${args.keySuffix}`,
  })
}

async function getCashSaleMovements(
  request: APIRequestContext,
  token: string,
  registerId: string,
): Promise<Array<{ type?: string; amountCents?: string }>> {
  const response = await apiRequest(
    request,
    'GET',
    `/api/soanas_cash/sessions/current?registerId=${encodeURIComponent(registerId)}`,
    { token },
  )
  expect(response.ok()).toBeTruthy()
  const body = await readJsonSafe<CashSessionSnapshot>(response)
  return (body?.movements ?? []).filter((movement) => movement.type === 'cash_sale')
}

async function countSalesPayments(
  request: APIRequestContext,
  token: string,
  salesOrderId: string,
): Promise<number> {
  const response = await apiRequest(
    request,
    'GET',
    `/api/sales/payments?orderId=${encodeURIComponent(salesOrderId)}`,
    { token },
  )
  expect(response.ok()).toBeTruthy()
  const body = await readJsonSafe<{ items?: unknown[] }>(response)
  return body?.items?.length ?? 0
}

async function assertSingleSalesOrder(
  request: APIRequestContext,
  token: string,
  salesOrderId: string,
): Promise<void> {
  const response = await apiRequest(
    request,
    'GET',
    `/api/sales/orders?id=${encodeURIComponent(salesOrderId)}`,
    { token },
  )
  expect(response.ok()).toBeTruthy()
  const body = await readJsonSafe<{ items?: unknown[] }>(response)
  expect(body?.items?.length).toBe(1)
}

test.describe('TC-SOANAS-POS-MANUAL-TENDERS-001: Gate 1 manual split tenders', () => {
  test('cash only 82.50 with 100 received yields 17.50 change and one cash_sale movement', async ({
    request,
  }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '8250',
      })

      const cashBody = await addCashTender(request, adminToken, transactionId, ctx, '10000', 'only')
      expect(String(cashBody.changeAmountCents)).toBe('1750')
      expect(String(cashBody.amountAppliedCents)).toBe('8250')

      const completeBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(completeBody.status)).toBe('COMPLETED')
      const salesOrderId = expectId(completeBody.salesOrderId as string | undefined, 'salesOrderId')

      await assertSingleSalesOrder(request, adminToken, salesOrderId)
      expect(await countSalesPayments(request, adminToken, salesOrderId)).toBe(1)

      const cashSales = await getCashSaleMovements(request, adminToken, ctx.registerId)
      expect(cashSales.length).toBe(1)
      expect(String(cashSales[0]?.amountCents)).toBe('8250')
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('cash 50 + Pix manual 150 settles 200 with cash_sale 5000 and no spurious change', async ({
    request,
  }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '20000',
      })

      const cashBody = await addCashTender(request, adminToken, transactionId, ctx, '5000', 'split-cash')
      expect(String(cashBody.amountAppliedCents)).toBe('5000')
      expect(String(cashBody.changeAmountCents)).toBe('0')

      const pixBody = await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'PIX',
        amountAppliedCents: '15000',
        keySuffix: 'split-pix',
      })
      expect(String(pixBody.status)).toBe('PAID')
      expect(String(pixBody.changeAmountCents)).toBe('0')

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/complete`, {})

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('COMPLETED')
      expect(String(detail.changeAmountCents)).toBe('0')

      const cashSales = await getCashSaleMovements(request, adminToken, ctx.registerId)
      expect(cashSales.length).toBe(1)
      expect(String(cashSales[0]?.amountCents)).toBe('5000')
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('cash 100 + credit 200 with 3x Mastercard records optional nsu on credit tender', async ({
    request,
  }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '30000',
      })

      await addCashTender(request, adminToken, transactionId, ctx, '10000', 'card-cash')
      await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'CARD_CREDIT',
        amountAppliedCents: '20000',
        keySuffix: 'card-credit',
        brand: 'Mastercard',
        installments: 3,
      })

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/complete`, {})

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('COMPLETED')
      expect(detail.tenders?.length).toBe(2)

      const creditTender = detail.tenders?.find((tender) => tender.type === 'CREDIT_MANUAL')
      expect(creditTender).toBeTruthy()
      expect(creditTender?.brand).toBe('Mastercard')
      expect(creditTender?.installments).toBe(3)
      expect(creditTender?.nsu).toBeNull()
      expect(String(creditTender?.amountAppliedCents)).toBe('20000')
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('Pix 250 + credit 250 completes 500 sale without cash_sale movement', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '50000',
      })

      await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'PIX_MANUAL',
        amountAppliedCents: '25000',
        keySuffix: 'pix-half',
      })
      await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'CREDIT_MANUAL',
        amountAppliedCents: '25000',
        keySuffix: 'credit-half',
        brand: 'Visa',
      })

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/complete`, {})

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('COMPLETED')

      const cashSales = await getCashSaleMovements(request, adminToken, ctx.registerId)
      expect(cashSales.length).toBe(0)
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('credit 100 + debit 150 completes 250 sale without cash movement', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '25000',
      })

      await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'CARD_CREDIT',
        amountAppliedCents: '10000',
        keySuffix: 'credit-only',
      })
      await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'DEBIT_MANUAL',
        amountAppliedCents: '15000',
        keySuffix: 'debit-only',
      })

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/complete`, {})

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('COMPLETED')

      const cashSales = await getCashSaleMovements(request, adminToken, ctx.registerId)
      expect(cashSales.length).toBe(0)
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('insufficient 99.99 on 100 sale rejects complete and keeps PAYMENT_PENDING', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '10000',
      })

      const tenderBody = await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'PIX',
        amountAppliedCents: '9999',
        keySuffix: 'short',
      })
      expect(String(tenderBody.status)).toBe('PAYMENT_PENDING')
      expect(String(tenderBody.remainingDueCents)).toBe('1')

      const completeAttempt = await postJsonRaw(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(completeAttempt.ok).toBe(false)
      expect(completeAttempt.status).toBe(400)

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('PAYMENT_PENDING')
      expect(String(detail.amountPaidCents)).toBe('9999')
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('credit 110 on 100 sale rejects manual tender over remaining due', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '10000',
      })

      const rejected = await postJsonRaw(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/tenders/manual`,
        {
          type: 'CARD_CREDIT',
          amountAppliedCents: '11000',
          idempotencyKey: `manual-${ctx.suffix}-over`,
        },
      )
      expect(rejected.ok).toBe(false)
      expect(rejected.status).toBe(400)

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('PAYMENT_PENDING')
      expect(detail.tenders?.length ?? 0).toBe(0)
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('removing a Pix tender on a paid 150 sale returns PAYMENT_PENDING with zero tenders', async ({
    request,
  }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '15000',
      })

      const pixBody = await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'PIX',
        amountAppliedCents: '15000',
        keySuffix: 'removable',
      })
      expect(String(pixBody.status)).toBe('PAID')
      const tenderId = expectId(pixBody.id as string | undefined, 'tender id')

      const removed = await deleteJsonRaw(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/tenders/${tenderId}`,
      )
      expect(removed.ok).toBe(true)
      expect(String(removed.body.status)).toBe('PAYMENT_PENDING')

      const detail = (await getTransactionDetail(request, adminToken, transactionId)) as TransactionDetail
      expect(detail.status).toBe('PAYMENT_PENDING')
      expect(detail.tenders?.length ?? 0).toBe(0)
      expect(String(detail.amountPaidCents)).toBe('0')
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })

  test('cash 100 + Pix 100 on 200 sale completes and replays without duplicate side effects', async ({
    request,
  }) => {
    const adminToken = await getAuthToken(request, 'admin')
    const superadminToken = await getAuthToken(request, 'superadmin')
    const scope = getTokenScope(adminToken)
    const restoreAcl = await ensureRoleFeatures(
      request,
      superadminToken,
      scope.tenantId,
      'admin',
      SOANAS_POS_ACL_FEATURES,
    )
    let ctx: SoanasPosContext | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
      })
      const transactionId = await openPosTransaction({
        request,
        token: adminToken,
        ctx,
        unitPriceCents: '20000',
      })

      await addCashTender(request, adminToken, transactionId, ctx, '10000', 'replay-cash')
      await addManualTender(request, adminToken, transactionId, ctx, {
        type: 'PIX',
        amountAppliedCents: '10000',
        keySuffix: 'replay-pix',
      })

      const completeBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(completeBody.status)).toBe('COMPLETED')
      const salesOrderId = expectId(completeBody.salesOrderId as string | undefined, 'salesOrderId')

      await assertSingleSalesOrder(request, adminToken, salesOrderId)
      expect(await countSalesPayments(request, adminToken, salesOrderId)).toBe(1)

      const cashSalesAfterComplete = await getCashSaleMovements(request, adminToken, ctx.registerId)
      expect(cashSalesAfterComplete.length).toBe(1)
      expect(String(cashSalesAfterComplete[0]?.amountCents)).toBe('10000')

      const replayBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(replayBody.status)).toBe('COMPLETED')
      expect(String(replayBody.salesOrderId)).toBe(salesOrderId)
      expect(Boolean(replayBody.replayed)).toBe(true)

      await assertSingleSalesOrder(request, adminToken, salesOrderId)
      expect(await countSalesPayments(request, adminToken, salesOrderId)).toBe(1)

      const cashSalesAfterReplay = await getCashSaleMovements(request, adminToken, ctx.registerId)
      expect(cashSalesAfterReplay.length).toBe(1)
      expect(String(cashSalesAfterReplay[0]?.amountCents)).toBe('10000')
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })
})
