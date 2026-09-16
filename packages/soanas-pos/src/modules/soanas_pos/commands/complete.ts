import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandBus, CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { badRequest, CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { SalesOrder, SalesPayment } from '@open-mercato/core/modules/sales/data/entities'
import { InventoryBalance, WarehouseLocation } from '@open-mercato/core/modules/wms/data/entities'
import {
  PaymentTender,
  PosRecoveryState,
  PosStateTransition,
  PosTerminal,
  PosTransaction,
  PosTransactionLine,
  type PosAllocationStep,
  type PosRecoveryStep,
} from '../data/entities'
import { posCompleteSchema, type PosCompleteInput } from '../data/validators'
import { centsToDecimalString, centsToString } from '../lib/money'
import { planCompleteSale } from '../lib/completeSale'
import { planStockDeductions } from '../lib/quantity'
import { planLocationDeductions } from '../lib/stockAllocation'
import { allocationPlanComplete, buildAllocationSteps } from '../lib/allocationCheckpoints'
import { buildSaleReceiptDocument, type SaleReceiptDocument } from '../lib/receipt'
import { enqueueAndAttemptPrint } from '../lib/printJob'
import { posError } from '../lib/errors'
import { emitSoanasPosEvent } from '../events'
import { forkEm, loadLines, loadTransactionForUpdate, transitionTo } from './helpers'

export const POS_SALES_SOURCE = 'soanas_pos'

export async function retrySaleReceiptPrint(
  input: PosCompleteInput,
  ctx: CommandRuntimeContext,
): Promise<{ jobId: string; status: string }> {
  const parsed = posCompleteSchema.parse(input)
  const em = forkEm(ctx)
  const { translate } = await resolveTranslations()
  const transaction = await em.findOne(PosTransaction, {
    id: parsed.transactionId,
    tenantId: parsed.tenantId,
    organizationId: parsed.organizationId,
    deletedAt: null,
  })
  if (!transaction) {
    throw notFound(translate('soanas_pos.errors.transaction_not_found', 'POS transaction not found'))
  }
  if (transaction.status !== 'COMPLETED') {
    throw badRequest(
      translate(
        'soanas_pos.errors.print_retry_not_completed',
        'Receipt print retry is only available for completed sales',
      ),
    )
  }
  const terminal = await em.findOneOrFail(PosTerminal, {
    id: transaction.terminalId,
    tenantId: transaction.tenantId,
  })
  const lines = await loadLines(em, transaction)
  const tenders = await em.find(PaymentTender, {
    posTransactionId: transaction.id,
    tenantId: transaction.tenantId,
  })
  const receipt = buildReceipt({ transaction, terminal, lines, tenders })
  return enqueueAndAttemptPrint({ em, ctx, transaction, receipt })
}

export type CompletePosSaleResult = {
  transactionId: string
  status: string
  salesOrderId: string | null
  cashMovementId: string | null
  wmsMovementIds: string[]
  receipt: SaleReceiptDocument | null
  replayed: boolean
}

function dispatchContext(ctx: CommandRuntimeContext): CommandRuntimeContext {
  return { ...ctx, request: undefined }
}

function externalReferenceFor(transactionId: string): string {
  return `${POS_SALES_SOURCE}:${transactionId}`
}

async function ensureRecoveryState(
  em: EntityManager,
  transaction: PosTransaction,
): Promise<PosRecoveryState> {
  const existing = await em.findOne(PosRecoveryState, {
    transactionId: transaction.id,
    tenantId: transaction.tenantId,
  })
  if (existing) return existing
  const now = new Date()
  const record = em.create(PosRecoveryState, {
    transactionId: transaction.id,
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId,
    lastStep: 'validate',
    salesOrderId: transaction.salesOrderId ?? null,
    createdAt: now,
    updatedAt: now,
  })
  em.persist(record)
  await em.flush()
  return record
}

async function checkpoint(
  em: EntityManager,
  recovery: PosRecoveryState,
  patch: Partial<
    Pick<
      PosRecoveryState,
      'lastStep' | 'salesOrderId' | 'wmsMovementId' | 'wmsMovementIds' | 'cashMovementId' | 'allocationPlan'
    >
  >,
): Promise<void> {
  if (patch.lastStep !== undefined) recovery.lastStep = patch.lastStep as PosRecoveryStep
  if (patch.salesOrderId !== undefined) recovery.salesOrderId = patch.salesOrderId
  if (patch.wmsMovementId !== undefined) recovery.wmsMovementId = patch.wmsMovementId
  if (patch.wmsMovementIds !== undefined) recovery.wmsMovementIds = patch.wmsMovementIds
  if (patch.cashMovementId !== undefined) recovery.cashMovementId = patch.cashMovementId
  if (patch.allocationPlan !== undefined) recovery.allocationPlan = patch.allocationPlan
  recovery.errorCode = null
  recovery.errorMessage = null
  recovery.updatedAt = new Date()
  await em.flush()
}

/**
 * Loads WMS balance buckets for a variant. Direct ORM read is intentional and documented in
 * ADR-008: WMS has no public multi-location consume command yet; writes still go through
 * `wms.inventory.adjust`. Coupling surface is limited to this helper.
 */
async function loadVariantBalanceBuckets(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  warehouseId: string,
  catalogVariantId: string,
): Promise<{
  buckets: Array<{
    locationId: string
    quantityOnHand: string
    quantityReserved: string
    quantityAllocated: string
    lotId: string | null
    serialNumber: string | null
  }>
  fallbackLocationId: string | null
}> {
  const balances = await em.find(InventoryBalance, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    warehouse: warehouseId,
    catalogVariantId,
    deletedAt: null,
  })
  const buckets = balances
    .map((balance) => {
      const locationId = typeof balance.location === 'string' ? balance.location : balance.location?.id
      if (!locationId) return null
      const lotRaw = balance.lot ?? null
      const lotId = typeof lotRaw === 'string' ? lotRaw : lotRaw?.id ?? null
      return {
        locationId,
        quantityOnHand: String(balance.quantityOnHand ?? '0'),
        quantityReserved: String(balance.quantityReserved ?? '0'),
        quantityAllocated: String(balance.quantityAllocated ?? '0'),
        lotId,
        serialNumber: balance.serialNumber ?? null,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const fallback = await em.findOne(WarehouseLocation, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    warehouse: warehouseId,
    isActive: true,
    deletedAt: null,
  })
  return { buckets, fallbackLocationId: fallback?.id ?? null }
}

async function runSalesStep(args: {
  ctx: CommandRuntimeContext
  em: EntityManager
  transaction: PosTransaction
  terminal: PosTerminal
  lines: PosTransactionLine[]
  cashTenders: PaymentTender[]
  knownSalesOrderId: string | null
}): Promise<string> {
  const { ctx, em, transaction, terminal, lines, cashTenders } = args
  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  let salesOrderId = args.knownSalesOrderId

  // A crash between `sales.orders.create` and the checkpoint flush would leave an order that
  // no POS row points at. The external reference is derived from the transaction id, so it is
  // the durable link that lets a retry adopt that order instead of creating a second one.
  if (!salesOrderId) {
    const orphan = await em.findOne(SalesOrder, {
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      externalReference: externalReferenceFor(transaction.id),
    })
    if (orphan) {
      salesOrderId = orphan.id
      transaction.salesOrderId = salesOrderId
      transaction.updatedAt = new Date()
      await em.flush()
    }
  }

  if (!salesOrderId) {
    const { result } = await commandBus.execute('sales.orders.create', {
      input: {
        organizationId: transaction.organizationId,
        tenantId: transaction.tenantId,
        currencyCode: transaction.currencyCode,
        channelId: terminal.salesChannelId ?? undefined,
        customerEntityId: transaction.customerId ?? undefined,
        externalReference: externalReferenceFor(transaction.id),
        placedAt: new Date(),
        metadata: {
          source: POS_SALES_SOURCE,
          sourceTransactionId: transaction.id,
          terminalId: terminal.id,
          cashSessionId: transaction.cashSessionId ?? null,
          correlationId: transaction.correlationId,
        },
        lines: lines.map((line, index) => ({
          lineNumber: index + 1,
          name: line.nameSnapshot,
          productId: line.catalogProductId ?? undefined,
          productVariantId: line.catalogVariantId ?? undefined,
          currencyCode: transaction.currencyCode,
          quantity: line.quantity,
          quantityUnit: line.unit ?? undefined,
          unitPriceGross: centsToDecimalString(line.unitPriceCents),
          discountAmount: centsToDecimalString(line.discountAmountCents),
          totalGrossAmount: centsToDecimalString(line.lineTotalCents),
          catalogSnapshot: { sku: line.sku, name: line.nameSnapshot, source: POS_SALES_SOURCE },
          metadata: { sku: line.sku, posLineId: line.id },
        })),
      },
      ctx: dispatchContext(ctx),
    })
    const created = result as { orderId?: string } | undefined
    if (!created?.orderId) {
      throw new Error('[internal] soanas_pos sales.orders.create returned no orderId')
    }
    salesOrderId = created.orderId
    transaction.salesOrderId = salesOrderId
    transaction.updatedAt = new Date()
    await em.flush()
  }

  const paidCents = cashTenders.reduce((sum, tender) => sum + BigInt(tender.amountAppliedCents), 0n)
  if (paidCents > 0n) {
    const paymentReference = externalReferenceFor(transaction.id)
    const existingPayment = await em.findOne(SalesPayment, {
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      paymentReference,
    })
    if (!existingPayment) {
      await commandBus.execute('sales.payments.create', {
        input: {
          organizationId: transaction.organizationId,
          tenantId: transaction.tenantId,
          orderId: salesOrderId,
          currencyCode: transaction.currencyCode,
          amount: centsToDecimalString(paidCents),
          capturedAmount: centsToDecimalString(paidCents),
          paymentReference,
          receivedAt: new Date(),
          capturedAt: new Date(),
          metadata: {
            source: POS_SALES_SOURCE,
            sourceTransactionId: transaction.id,
            correlationId: transaction.correlationId,
            tenderTypes: cashTenders.map((tender) => tender.type),
          },
        },
        ctx: dispatchContext(ctx),
      })
    }
  }

  return salesOrderId as string
}

async function runWmsStep(args: {
  ctx: CommandRuntimeContext
  em: EntityManager
  transaction: PosTransaction
  terminal: PosTerminal
  lines: PosTransactionLine[]
  salesOrderId: string | null
  recovery: PosRecoveryState
}): Promise<string[]> {
  const { ctx, em, transaction, terminal, lines, recovery } = args
  if (!terminal.warehouseId) return []
  const salesOrderId = args.salesOrderId
  if (!salesOrderId) {
    throw new Error('[internal] soanas_pos WMS step requires salesOrderId for referenceType=so')
  }
  const commandBus = ctx.container.resolve('commandBus') as CommandBus

  // Gate 0: WMS rejects negative stock. Terminal ALLOW is not honored until core supports it.
  const allowShortage = false

  let plan: PosAllocationStep[] = Array.isArray(recovery.allocationPlan)
    ? (recovery.allocationPlan as PosAllocationStep[])
    : []

  if (!plan.length) {
    const built: PosAllocationStep[] = []
    for (const deduction of planStockDeductions(lines)) {
      const { buckets, fallbackLocationId } = await loadVariantBalanceBuckets(
        em,
        { tenantId: transaction.tenantId, organizationId: transaction.organizationId },
        terminal.warehouseId,
        deduction.catalogVariantId,
      )
      const locationPlan = planLocationDeductions({
        quantity: deduction.quantity,
        balances: buckets,
        fallbackLocationId,
        allowShortage,
      })
      if (locationPlan.shortfall !== '0.0000') {
        throw new Error(
          `[internal] soanas_pos multi-location plan shortfall=${locationPlan.shortfall} for variant ${deduction.catalogVariantId}`,
        )
      }
      if (!locationPlan.deductions.length) {
        throw new Error('[internal] soanas_pos found no warehouse location to deduct stock from')
      }
      built.push(
        ...buildAllocationSteps({
          transactionId: transaction.id,
          salesOrderId,
          catalogVariantId: deduction.catalogVariantId,
          deductions: locationPlan.deductions,
        }),
      )
    }
    plan = built
    await checkpoint(em, recovery, { allocationPlan: plan })
  }

  const movementIds: string[] = [...(recovery.wmsMovementIds ?? [])]

  for (let index = 0; index < plan.length; index += 1) {
    const step = plan[index]
    if (step.status === 'COMPLETED' && step.movementId) {
      if (!movementIds.includes(step.movementId)) movementIds.push(step.movementId)
      continue
    }

    const { result } = await commandBus.execute('wms.inventory.adjust', {
      input: {
        organizationId: transaction.organizationId,
        tenantId: transaction.tenantId,
        warehouseId: terminal.warehouseId,
        locationId: step.locationId,
        catalogVariantId: step.catalogVariantId,
        lotId: step.lotId ?? undefined,
        serialNumber: step.serialNumber ?? undefined,
        delta: `-${step.plannedQuantity}`,
        reason: `POS sale ${transaction.id}`,
        reasonCode: 'pos_sale',
        referenceType: 'so',
        referenceId: salesOrderId,
        performedBy: transaction.operatorUserId,
        metadata: {
          source: POS_SALES_SOURCE,
          sourceTransactionId: transaction.id,
          correlationId: transaction.correlationId,
          allocationIdempotencyKey: step.idempotencyKey,
          allocationStep: index,
        },
      },
      ctx: dispatchContext(ctx),
    })
    const movement = result as { movementId?: string } | undefined
    const movementId = movement?.movementId ?? null
    plan[index] = {
      ...step,
      movementId,
      status: movementId ? 'COMPLETED' : 'FAILED',
    }
    if (movementId && !movementIds.includes(movementId)) movementIds.push(movementId)

    await checkpoint(em, recovery, {
      allocationPlan: plan,
      wmsMovementIds: movementIds,
      wmsMovementId: movementIds[0] ?? null,
    })

    if (!movementId) {
      throw new Error(`[internal] soanas_pos WMS adjust returned no movementId for step ${index}`)
    }
  }

  if (!allocationPlanComplete(plan)) {
    throw new Error('[internal] soanas_pos WMS allocation plan incomplete after loop')
  }

  return movementIds
}

async function runCashStep(args: {
  ctx: CommandRuntimeContext
  transaction: PosTransaction
  terminal: PosTerminal
  cashTenders: PaymentTender[]
}): Promise<string | null> {
  const { ctx, transaction, cashTenders } = args
  if (!transaction.cashSessionId || !cashTenders.length) return null
  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  const amountCents = cashTenders.reduce((sum, tender) => sum + BigInt(tender.amountAppliedCents), 0n)
  if (amountCents <= 0n) return null

  const { result } = await commandBus.execute('soanas_cash.movements.record_sale', {
    input: {
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      sessionId: transaction.cashSessionId,
      amountCents: amountCents.toString(),
      operatorUserId: transaction.operatorUserId,
      terminalId: args.terminal.id,
      posTransactionId: transaction.id,
      salesOrderId: transaction.salesOrderId ?? null,
      paymentTenderId: cashTenders[0]?.id ?? null,
      idempotencyKey: `${POS_SALES_SOURCE}:cash:${transaction.id}`,
    },
    ctx: dispatchContext(ctx),
  })
  const movement = result as { movementId?: string } | undefined
  return movement?.movementId ?? null
}

function buildReceipt(args: {
  transaction: PosTransaction
  terminal: PosTerminal
  lines: PosTransactionLine[]
  tenders: PaymentTender[]
}): SaleReceiptDocument {
  const { transaction, terminal, lines, tenders } = args
  return buildSaleReceiptDocument({
    transactionId: transaction.id,
    correlationId: transaction.correlationId,
    salesOrderId: transaction.salesOrderId ?? null,
    terminalCode: terminal.code,
    terminalName: terminal.name,
    operatorUserId: transaction.operatorUserId,
    customerId: transaction.customerId ?? null,
    currencyCode: transaction.currencyCode,
    lines: lines.map((line) => ({
      sku: line.sku,
      name: line.nameSnapshot,
      quantity: line.quantity,
      unitPriceCents: centsToString(line.unitPriceCents),
      discountAmountCents: centsToString(line.discountAmountCents),
      lineTotalCents: centsToString(line.lineTotalCents),
    })),
    tenders: tenders.map((tender) => ({
      type: tender.type,
      amountAppliedCents: centsToString(tender.amountAppliedCents),
      amountReceivedCents:
        tender.amountReceivedCents == null ? null : centsToString(tender.amountReceivedCents),
      changeAmountCents:
        tender.changeAmountCents == null ? null : centsToString(tender.changeAmountCents),
    })),
    subtotalCents: centsToString(transaction.subtotalCents),
    discountTotalCents: centsToString(transaction.discountTotalCents),
    surchargeTotalCents: centsToString(transaction.surchargeTotalCents),
    taxTotalCents: centsToString(transaction.taxTotalCents),
    grandTotalCents: centsToString(transaction.grandTotalCents),
    amountPaidCents: centsToString(transaction.amountPaidCents),
    changeAmountCents: centsToString(transaction.changeAmountCents),
  })
}

function describeError(err: unknown): { code: string; message: string } {
  if (err instanceof CrudHttpError) {
    const body = err.body as { error?: unknown } | null
    const message = typeof body?.error === 'string' ? body.error : `HTTP ${err.status}`
    return { code: `HTTP_${err.status}`, message }
  }
  if (err instanceof Error) return { code: 'POS_COMPLETE_FAILED', message: err.message }
  return { code: 'POS_COMPLETE_FAILED', message: String(err) }
}

/**
 * Idempotent completion saga (ADR-007). Every cross-module call is a sequential commandBus
 * dispatch with its own idempotency guard; only Soanas POS writes share a local transaction.
 * A failure parks the sale in FAILED_RECOVERABLE with the checkpoint intact so
 * `soanas_pos.transactions.recover` can resume exactly where it stopped.
 */
export async function completePosSale(
  input: PosCompleteInput,
  ctx: CommandRuntimeContext,
): Promise<CompletePosSaleResult> {
  const parsed = posCompleteSchema.parse(input)
  const em = forkEm(ctx)
  const { translate } = await resolveTranslations()

  // Replay path: COMPLETED is terminal — no row lock needed.
  const alreadyDone = await em.findOne(PosTransaction, {
    id: parsed.transactionId,
    tenantId: parsed.tenantId,
    organizationId: parsed.organizationId,
    deletedAt: null,
  })
  if (!alreadyDone) {
    throw notFound(translate('soanas_pos.errors.transaction_not_found', 'POS transaction not found'))
  }
  if (alreadyDone.status === 'COMPLETED') {
    const lines = await loadLines(em, alreadyDone)
    const tenders = await em.find(PaymentTender, {
      posTransactionId: alreadyDone.id,
      tenantId: alreadyDone.tenantId,
    })
    const terminal = await em.findOneOrFail(PosTerminal, { id: alreadyDone.terminalId })
    return {
      transactionId: alreadyDone.id,
      status: alreadyDone.status,
      salesOrderId: alreadyDone.salesOrderId ?? null,
      cashMovementId: null,
      wmsMovementIds: [],
      receipt: buildReceipt({ transaction: alreadyDone, terminal, lines, tenders }),
      replayed: true,
    }
  }

  // PESSIMISTIC_WRITE requires an open DB transaction (MikroORM ValidationError otherwise).
  // Keep this critical section short: claim COMPLETING + recovery row, then release before
  // nested Sales/WMS/Cash commands (they fork their own EMs / transactions).
  let transaction!: PosTransaction
  let terminal!: PosTerminal
  let lines!: PosTransactionLine[]
  let tenders!: PaymentTender[]
  let cashTenders!: PaymentTender[]
  let recovery!: PosRecoveryState
  let lockedReplay: CompletePosSaleResult | null = null

  await withAtomicFlush(
    em,
    [
      async () => {
        transaction = await loadTransactionForUpdate(em, {
          transactionId: parsed.transactionId,
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
        })

        // Concurrent double-complete: the loser acquires the row lock after the winner
        // already flipped to COMPLETED. Treat as an idempotent replay.
        if (transaction.status === 'COMPLETED') {
          const replayLines = await loadLines(em, transaction)
          const replayTenders = await em.find(PaymentTender, {
            posTransactionId: transaction.id,
            tenantId: transaction.tenantId,
          })
          const replayTerminal = await em.findOneOrFail(PosTerminal, { id: transaction.terminalId })
          lockedReplay = {
            transactionId: transaction.id,
            status: transaction.status,
            salesOrderId: transaction.salesOrderId ?? null,
            cashMovementId: null,
            wmsMovementIds: [],
            receipt: buildReceipt({
              transaction,
              terminal: replayTerminal,
              lines: replayLines,
              tenders: replayTenders,
            }),
            replayed: true,
          }
          return
        }

        if (!['PAID', 'COMPLETING', 'FAILED_RECOVERABLE'].includes(transaction.status)) {
          throw badRequest(
            translate(
              'soanas_pos.errors.not_fully_paid',
              'The POS transaction must be fully paid before completion',
            ),
          )
        }

        terminal = await em.findOneOrFail(PosTerminal, {
          id: transaction.terminalId,
          tenantId: transaction.tenantId,
        })
        lines = await loadLines(em, transaction)
        if (!lines.length) {
          throw badRequest(translate('soanas_pos.errors.empty_cart', 'Cannot check out an empty cart'))
        }
        tenders = await em.find(PaymentTender, {
          posTransactionId: transaction.id,
          tenantId: transaction.tenantId,
        })
        cashTenders = tenders.filter((tender) => tender.type === 'CASH' && tender.status === 'captured')

        if (transaction.status !== 'COMPLETING') {
          await transitionTo(em, transaction, 'COMPLETING', {
            trigger: 'soanas_pos.transactions.complete',
            actorId: parsed.operatorUserId,
          })
        }
        recovery = await ensureRecoveryState(em, transaction)
      },
    ],
    { transaction: true, label: 'soanas_pos.transactions.complete.begin' },
  )

  if (lockedReplay) return lockedReplay

  const plan = planCompleteSale({
    recovery: {
      lastStep: recovery.lastStep,
      salesOrderId: recovery.salesOrderId ?? null,
      wmsMovementId: recovery.wmsMovementId ?? null,
      cashMovementId: recovery.cashMovementId ?? null,
    },
    salesOrderId: transaction.salesOrderId ?? null,
    warehouseId: terminal.warehouseId ?? null,
    lineCount: lines.length,
    cashSessionId: transaction.cashSessionId ?? null,
    hasCashTender: cashTenders.length > 0,
  })

  let wmsMovementIds: string[] = []
  let cashMovementId = recovery.cashMovementId ?? null

  try {
    if (plan.steps.includes('sales')) {
      const salesOrderId = await runSalesStep({
        ctx,
        em,
        transaction,
        terminal,
        lines,
        cashTenders,
        knownSalesOrderId: transaction.salesOrderId ?? recovery.salesOrderId ?? null,
      })
      await checkpoint(em, recovery, { lastStep: 'sales', salesOrderId })
    }

    if (plan.steps.includes('wms')) {
      wmsMovementIds = await runWmsStep({
        ctx,
        em,
        transaction,
        terminal,
        lines,
        salesOrderId: transaction.salesOrderId ?? recovery.salesOrderId ?? null,
        recovery,
      })
      await checkpoint(em, recovery, {
        lastStep: 'wms',
        wmsMovementId: wmsMovementIds[0] ?? null,
        wmsMovementIds,
      })
    }

    if (plan.steps.includes('cash')) {
      cashMovementId = await runCashStep({ ctx, transaction, terminal, cashTenders })
      await checkpoint(em, recovery, { lastStep: 'cash', cashMovementId })
    }

    await withAtomicFlush(
      em,
      [
        async () => {
          await transitionTo(em, transaction, 'COMPLETED', {
            trigger: 'soanas_pos.transactions.complete',
            actorId: parsed.operatorUserId,
            metadata: { salesOrderId: transaction.salesOrderId ?? null, cashMovementId },
          })
          transaction.completedAt = new Date()
          recovery.lastStep = 'complete'
          recovery.errorCode = null
          recovery.errorMessage = null
          recovery.updatedAt = new Date()
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.complete' },
    )
  } catch (err) {
    const described = describeError(err)
    const failureEm = forkEm(ctx)
    const failed = await failureEm.findOne(PosTransaction, { id: transaction.id })
    const failedRecovery = await failureEm.findOne(PosRecoveryState, { transactionId: transaction.id })
    if (failed && failed.status === 'COMPLETING') {
      failed.status = 'FAILED_RECOVERABLE'
      failed.updatedAt = new Date()
      failureEm.persist(
        failureEm.create(PosStateTransition, {
          transactionId: failed.id,
          tenantId: failed.tenantId,
          fromState: 'COMPLETING',
          toState: 'FAILED_RECOVERABLE',
          trigger: 'soanas_pos.transactions.complete',
          actorId: parsed.operatorUserId,
          correlationId: failed.correlationId,
          metadata: { errorCode: described.code, errorMessage: described.message },
          createdAt: new Date(),
        }),
      )
    }
    if (failedRecovery) {
      failedRecovery.errorCode = described.code
      failedRecovery.errorMessage = described.message
      failedRecovery.updatedAt = new Date()
    }
    await failureEm.flush()

    await emitSoanasPosEvent('soanas.pos.transaction.failed', {
      id: transaction.id,
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      errorCode: described.code,
      correlationId: transaction.correlationId,
    })

    if (err instanceof CrudHttpError) throw err
    throw new CrudHttpError(
      500,
      posError({
        errorCode: 'POS_COMPLETE_FAILED',
        message: described.message,
        correlationId: transaction.correlationId,
        retryable: true,
        operatorAction: translate(
          'soanas_pos.errors.complete_failed_action',
          'Retry the completion from the POS recovery action',
        ),
      }) as unknown as Record<string, unknown>,
    )
  }

  const receipt = buildReceipt({ transaction, terminal, lines, tenders })
  await enqueueAndAttemptPrint({
    em,
    ctx,
    transaction,
    receipt,
  })

  await emitSoanasPosEvent('soanas.pos.transaction.completed', {
    id: transaction.id,
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId,
    salesOrderId: transaction.salesOrderId ?? null,
    grandTotalCents: centsToString(transaction.grandTotalCents),
    correlationId: transaction.correlationId,
  })

  return {
    transactionId: transaction.id,
    status: transaction.status,
    salesOrderId: transaction.salesOrderId ?? null,
    cashMovementId,
    wmsMovementIds,
    receipt,
    replayed: false,
  }
}

const completeCommand: CommandHandler<PosCompleteInput, CompletePosSaleResult> = {
  id: 'soanas_pos.transactions.complete',
  async execute(input, ctx) {
    return completePosSale(input as PosCompleteInput, ctx)
  },
}

/**
 * Resumes a sale parked in FAILED_RECOVERABLE (or one that crashed mid-COMPLETING) by
 * replaying only the steps the recovery checkpoint says are still pending.
 */
const recoverCommand: CommandHandler<PosCompleteInput, CompletePosSaleResult> = {
  id: 'soanas_pos.transactions.recover',
  async execute(input, ctx) {
    return completePosSale(input as PosCompleteInput, ctx)
  },
}

const retryPrintCommand: CommandHandler<PosCompleteInput, { jobId: string; status: string }> = {
  id: 'soanas_pos.transactions.retry_print',
  async execute(input, ctx) {
    return retrySaleReceiptPrint(input, ctx)
  },
}

registerCommand(completeCommand)
registerCommand(recoverCommand)
registerCommand(retryPrintCommand)
