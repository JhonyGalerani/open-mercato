import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import { expectId, getTokenScope, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'
import {
  cleanupPosContext,
  ensureRoleFeatures,
  getTransactionDetail,
  postJson,
  seedPosContext,
  SOANAS_POS_ACL_FEATURES,
} from './helpers/soanasFixtures'

/**
 * TC-SOANAS-GATE0-PRINTJOB-001: Sale receipt print job on complete + retry (ADR-011)
 */
export const integrationMeta = {
  dependsOnModules: ['soanas_pos', 'soanas_cash', 'sales', 'wms', 'catalog'],
}

type PrintJobRow = {
  kind?: string
  status?: string
}

test.describe('TC-SOANAS-GATE0-PRINTJOB-001: sale receipt print job', () => {
  test('complete creates PRINTED sale_receipt job; retry stays idempotent', async ({ request }) => {
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

    let ctx: Awaited<ReturnType<typeof seedPosContext>> | null = null

    try {
      ctx = await seedPosContext({
        request,
        token: adminToken,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        userId: scope.userId,
        openingFloatCents: '50000',
      })

      const txBody = await postJson(request, adminToken, '/api/soanas_pos/transactions', {
        terminalId: ctx.terminalId,
        cashSessionId: ctx.sessionId,
        currencyCode: 'BRL',
        idempotencyKey: `print-tx-${ctx.suffix}`,
      })
      const transactionId = expectId(txBody.id as string | undefined, 'transaction id')

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/lines`, {
        catalogProductId: ctx.productId,
        catalogVariantId: ctx.variantId,
        sku: `SOANAS-MT-SKU-${ctx.suffix}`,
        nameSnapshot: `Soanas MT ${ctx.suffix}`,
        quantity: '1',
        unitPriceCents: '2500',
      })

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/checkout`, {})

      await postJson(request, adminToken, `/api/soanas_pos/transactions/${transactionId}/tenders/cash`, {
        amountReceivedCents: '2500',
        idempotencyKey: `print-tender-${ctx.suffix}`,
      })

      const completeBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/complete`,
        {},
      )
      expect(String(completeBody.status)).toBe('COMPLETED')

      const detail = await getTransactionDetail(request, adminToken, transactionId)
      const printJobs = (detail.printJobs as PrintJobRow[] | undefined) ?? []
      expect(printJobs.length).toBeGreaterThanOrEqual(1)
      expect(printJobs[0]?.kind).toBe('sale_receipt')
      expect(printJobs[0]?.status).toBe('PRINTED')

      const retryBody = await postJson(
        request,
        adminToken,
        `/api/soanas_pos/transactions/${transactionId}/print/retry`,
        {},
      )
      expect(String(retryBody.status)).toBe('PRINTED')
      expect(retryBody.jobId).toBeTruthy()

      const detailAfterRetry = await getTransactionDetail(request, adminToken, transactionId)
      const printJobsAfterRetry = (detailAfterRetry.printJobs as PrintJobRow[] | undefined) ?? []
      expect(printJobsAfterRetry.length).toBe(1)
      expect(printJobsAfterRetry[0]?.kind).toBe('sale_receipt')
      expect(printJobsAfterRetry[0]?.status).toBe('PRINTED')

      const detailResponse = await apiRequest(
        request,
        'GET',
        `/api/soanas_pos/transactions/${transactionId}`,
        { token: adminToken },
      )
      expect(detailResponse.ok()).toBeTruthy()
    } finally {
      await cleanupPosContext(request, adminToken, ctx?.productId ?? null)
      await restoreAcl()
    }
  })
})
