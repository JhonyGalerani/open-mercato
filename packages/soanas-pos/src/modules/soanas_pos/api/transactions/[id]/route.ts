import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  PaymentTender,
  PosPrintJob,
  PosRecoveryState,
  PosTransaction,
  PosTransactionLine,
} from '../../../data/entities'
import { centsToString } from '../../../lib/money'
import { posScopeErrorResponse, resolvePosRequestScope } from '../../utils'

export const metadata = {
  path: '/soanas_pos/transactions/[id]',
  GET: { requireAuth: true, requireFeatures: ['soanas_pos.transactions.view'] },
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { translate } = await resolveTranslations()
  try {
    const scope = await resolvePosRequestScope(req)
    const { id } = await params
    const em = (scope.container.resolve('em') as EntityManager).fork()
    const transaction = await em.findOne(PosTransaction, {
      id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    })
    if (!transaction) {
      return NextResponse.json(
        { error: translate('soanas_pos.errors.transaction_not_found', 'POS transaction not found') },
        { status: 404 },
      )
    }
    const lines = await em.find(
      PosTransactionLine,
      { transactionId: transaction.id, tenantId: transaction.tenantId },
      { orderBy: { sortOrder: 'asc' } },
    )
    const tenders = await em.find(
      PaymentTender,
      { posTransactionId: transaction.id, tenantId: transaction.tenantId },
      { orderBy: { createdAt: 'asc' } },
    )
    const recovery = await em.findOne(PosRecoveryState, {
      transactionId: transaction.id,
      tenantId: transaction.tenantId,
    })
    const printJobs = await em.find(
      PosPrintJob,
      { transactionId: transaction.id, tenantId: transaction.tenantId, deletedAt: null },
      { orderBy: { createdAt: 'asc' } },
    )

    return NextResponse.json({
      id: transaction.id,
      terminalId: transaction.terminalId,
      cashSessionId: transaction.cashSessionId ?? null,
      operatorUserId: transaction.operatorUserId,
      customerId: transaction.customerId ?? null,
      salesOrderId: transaction.salesOrderId ?? null,
      status: transaction.status,
      currencyCode: transaction.currencyCode,
      subtotalCents: centsToString(transaction.subtotalCents),
      discountTotalCents: centsToString(transaction.discountTotalCents),
      surchargeTotalCents: centsToString(transaction.surchargeTotalCents),
      taxTotalCents: centsToString(transaction.taxTotalCents),
      grandTotalCents: centsToString(transaction.grandTotalCents),
      amountPaidCents: centsToString(transaction.amountPaidCents),
      changeAmountCents: centsToString(transaction.changeAmountCents),
      correlationId: transaction.correlationId,
      holdName: transaction.holdName ?? null,
      heldAt: transaction.heldAt ? transaction.heldAt.toISOString() : null,
      heldByUserId: transaction.heldByUserId ?? null,
      expiresAt: transaction.expiresAt ? transaction.expiresAt.toISOString() : null,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
      completedAt: transaction.completedAt ? transaction.completedAt.toISOString() : null,
      cancelledAt: transaction.cancelledAt ? transaction.cancelledAt.toISOString() : null,
      reversedAt: transaction.reversedAt ? transaction.reversedAt.toISOString() : null,
      reversalReason: transaction.reversalReason ?? null,
      lines: lines.map((line) => ({
        id: line.id,
        catalogProductId: line.catalogProductId ?? null,
        catalogVariantId: line.catalogVariantId ?? null,
        sku: line.sku,
        nameSnapshot: line.nameSnapshot,
        quantity: line.quantity,
        unitPriceCents: centsToString(line.unitPriceCents),
        discountAmountCents: centsToString(line.discountAmountCents),
        lineTotalCents: centsToString(line.lineTotalCents),
        unit: line.unit ?? null,
        sortOrder: line.sortOrder,
      })),
      tenders: tenders.map((tender) => ({
        id: tender.id,
        type: tender.type,
        status: tender.status,
        amountAppliedCents: centsToString(tender.amountAppliedCents),
        amountReceivedCents:
          tender.amountReceivedCents == null ? null : centsToString(tender.amountReceivedCents),
        changeAmountCents:
          tender.changeAmountCents == null ? null : centsToString(tender.changeAmountCents),
        brand: tender.brand ?? null,
        installments: tender.installments ?? null,
        nsu: tender.nsu ?? null,
        authorizationCode: tender.authorizationCode ?? null,
        acquirer: tender.acquirer ?? null,
        externalTerminal: tender.externalTerminal ?? null,
        externalReference: tender.externalReference ?? null,
        notes: tender.notes ?? null,
        confirmedByUserId: tender.confirmedByUserId ?? null,
        confirmedAt: tender.confirmedAt ? tender.confirmedAt.toISOString() : null,
      })),
      recovery: recovery
        ? {
            lastStep: recovery.lastStep,
            salesOrderId: recovery.salesOrderId ?? null,
            wmsMovementId: recovery.wmsMovementId ?? null,
            cashMovementId: recovery.cashMovementId ?? null,
            errorCode: recovery.errorCode ?? null,
            errorMessage: recovery.errorMessage ?? null,
          }
        : null,
      printJobs: printJobs.map((job) => ({
        id: job.id,
        kind: job.kind,
        status: job.status,
        attempts: job.attempts ?? 0,
        printerJobId: job.printerJobId ?? null,
        lastError: job.lastError ?? null,
        printedAt: job.printedAt ? job.printedAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    const scopeResponse = posScopeErrorResponse(err)
    if (scopeResponse) return scopeResponse
    return NextResponse.json(
      { error: translate('soanas_pos.errors.detail_failed', 'Failed to load the POS transaction') },
      { status: 500 },
    )
  }
}

export const openApi = {
  tag: 'Soanas POS',
  summary: 'POS transaction detail',
  pathParams: z.object({ id: z.string().uuid() }),
  methods: {
    GET: {
      summary: 'Get a POS transaction with its lines, tenders and recovery checkpoint',
      responses: [
        {
          status: 200,
          schema: z.object({
            id: z.string().uuid(),
            status: z.string(),
            grandTotalCents: z.string(),
            lines: z.array(z.object({ id: z.string().uuid(), sku: z.string() })),
            tenders: z.array(z.object({ id: z.string().uuid(), type: z.string() })),
          }),
        },
      ],
    },
  },
}
