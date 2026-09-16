import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest, forbidden, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PosTransaction, PosTransactionLine } from '../data/entities'
import {
  posApplyDiscountSchema,
  posCancelSchema,
  posCheckoutSchema,
  posLineAddSchema,
  posLineRemoveSchema,
  posLineUpdateSchema,
  posSetCustomerSchema,
  posTransactionCreateSchema,
  type PosApplyDiscountInput,
  type PosCancelInput,
  type PosCheckoutInput,
  type PosLineAddInput,
  type PosLineRemoveInput,
  type PosLineUpdateInput,
  type PosSetCustomerInput,
  type PosTransactionCreateInput,
} from '../data/validators'
import { isEditableState } from '../lib/stateMachine'
import { centsToString } from '../lib/money'
import { emitSoanasPosEvent } from '../events'
import {
  POS_DISCOUNT_APPROVAL_FEATURE,
  POS_DISCOUNT_APPROVAL_THRESHOLD_PERCENT,
  POS_DISCOUNT_FEATURE,
  callerHasFeature,
  currentCartDiscountCents,
  enforceStockPolicy,
  forkEm,
  loadLines,
  loadTerminalOrThrow,
  loadTransactionForUpdate,
  recalculateTransactionTotals,
  transitionTo,
} from './helpers'

function transactionSnapshot(transaction: PosTransaction) {
  return {
    id: transaction.id,
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId,
    terminalId: transaction.terminalId,
    cashSessionId: transaction.cashSessionId ?? null,
    status: transaction.status,
    grandTotalCents: centsToString(transaction.grandTotalCents),
    amountPaidCents: centsToString(transaction.amountPaidCents),
    salesOrderId: transaction.salesOrderId ?? null,
    updatedAt: transaction.updatedAt.toISOString(),
  }
}

async function requireEditable(transaction: PosTransaction): Promise<void> {
  if (isEditableState(transaction.status)) return
  const { translate } = await resolveTranslations()
  throw badRequest(
    translate('soanas_pos.errors.transaction_not_editable', 'This POS transaction can no longer be edited'),
  )
}

const createTransactionCommand: CommandHandler<PosTransactionCreateInput, { transactionId: string }> = {
  id: 'soanas_pos.transactions.create',
  async execute(input, ctx) {
    const parsed = posTransactionCreateSchema.parse(input)
    const em = forkEm(ctx)

    if (parsed.idempotencyKey) {
      const prior = await em.findOne(PosTransaction, {
        tenantId: parsed.tenantId,
        idempotencyKey: parsed.idempotencyKey,
        deletedAt: null,
      })
      if (prior) return { transactionId: prior.id }
    }

    const terminal = await loadTerminalOrThrow(em, {
      id: parsed.terminalId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })

    const now = new Date()
    const transaction = em.create(PosTransaction, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      establishmentId: terminal.establishmentId ?? null,
      terminalId: terminal.id,
      cashSessionId: parsed.cashSessionId ?? null,
      operatorUserId: parsed.operatorUserId,
      customerId: parsed.customerId ?? null,
      status: 'DRAFT',
      currencyCode: parsed.currencyCode,
      subtotalCents: '0',
      discountTotalCents: '0',
      surchargeTotalCents: '0',
      taxTotalCents: '0',
      grandTotalCents: '0',
      amountPaidCents: '0',
      changeAmountCents: '0',
      correlationId: crypto.randomUUID(),
      idempotencyKey: parsed.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(transaction)
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_pos.transactions.create',
    })

    await emitSoanasPosEvent('soanas.pos.transaction.created', {
      id: transaction.id,
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      terminalId: transaction.terminalId,
      cashSessionId: transaction.cashSessionId ?? null,
      operatorUserId: transaction.operatorUserId,
    })
    return { transactionId: transaction.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(PosTransaction, { id: result.transactionId })
    return record ? transactionSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ReturnType<typeof transactionSnapshot> | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_pos.audit.transaction_create', 'Open POS transaction'),
      resourceKind: 'soanas_pos.pos_transaction',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const addLineCommand: CommandHandler<PosLineAddInput, { lineId: string; grandTotalCents: string }> = {
  id: 'soanas_pos.transactions.add_line',
  async execute(input, ctx) {
    const parsed = posLineAddSchema.parse(input)
    const em = forkEm(ctx)
    const lineId = crypto.randomUUID()
    let grandTotalCents = '0'

    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          await requireEditable(transaction)
          const terminal = await loadTerminalOrThrow(
            em,
            {
              id: transaction.terminalId,
              tenantId: transaction.tenantId,
              organizationId: transaction.organizationId,
            },
            { requireActive: false },
          )
          await enforceStockPolicy({
            ctx,
            em,
            terminal,
            tenantId: transaction.tenantId,
            organizationId: transaction.organizationId,
            catalogVariantId: parsed.catalogVariantId ?? null,
            quantity: parsed.quantity,
          })

          const existing = await loadLines(em, transaction)
          const now = new Date()
          em.persist(
            em.create(PosTransactionLine, {
              id: lineId,
              transactionId: transaction.id,
              tenantId: transaction.tenantId,
              organizationId: transaction.organizationId,
              catalogProductId: parsed.catalogProductId ?? null,
              catalogVariantId: parsed.catalogVariantId ?? null,
              sku: parsed.sku,
              nameSnapshot: parsed.nameSnapshot,
              quantity: parsed.quantity,
              unitPriceCents: parsed.unitPriceCents,
              originalUnitPriceCents: parsed.originalUnitPriceCents ?? parsed.unitPriceCents,
              discountAmountCents: '0',
              surchargeAmountCents: '0',
              taxAmountCents: '0',
              lineTotalCents: '0',
              unit: parsed.unit ?? null,
              metadata: parsed.metadata ?? null,
              sortOrder: existing.length,
              createdAt: now,
              updatedAt: now,
            }),
          )
          await em.flush()
          await recalculateTransactionTotals(em, transaction)
          grandTotalCents = transaction.grandTotalCents
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.add_line' },
    )

    return { lineId, grandTotalCents }
  },
}

const updateLineCommand: CommandHandler<PosLineUpdateInput, { lineId: string; grandTotalCents: string }> = {
  id: 'soanas_pos.transactions.update_line',
  async execute(input, ctx) {
    const parsed = posLineUpdateSchema.parse(input)
    const em = forkEm(ctx)
    let grandTotalCents = '0'

    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          await requireEditable(transaction)
          const line = await em.findOne(PosTransactionLine, {
            id: parsed.lineId,
            transactionId: transaction.id,
            tenantId: transaction.tenantId,
          })
          if (!line) {
            const { translate } = await resolveTranslations()
            throw notFound(translate('soanas_pos.errors.line_not_found', 'POS line not found'))
          }
          if (parsed.quantity !== undefined) {
            const terminal = await loadTerminalOrThrow(
              em,
              {
                id: transaction.terminalId,
                tenantId: transaction.tenantId,
                organizationId: transaction.organizationId,
              },
              { requireActive: false },
            )
            await enforceStockPolicy({
              ctx,
              em,
              terminal,
              tenantId: transaction.tenantId,
              organizationId: transaction.organizationId,
              catalogVariantId: line.catalogVariantId ?? null,
              quantity: parsed.quantity,
            })
            line.quantity = parsed.quantity
          }
          if (parsed.unitPriceCents !== undefined) line.unitPriceCents = parsed.unitPriceCents
          line.updatedAt = new Date()
          await recalculateTransactionTotals(em, transaction)
          grandTotalCents = transaction.grandTotalCents
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.update_line' },
    )

    return { lineId: parsed.lineId, grandTotalCents }
  },
}

const removeLineCommand: CommandHandler<PosLineRemoveInput, { lineId: string; grandTotalCents: string }> = {
  id: 'soanas_pos.transactions.remove_line',
  async execute(input, ctx) {
    const parsed = posLineRemoveSchema.parse(input)
    const em = forkEm(ctx)
    let grandTotalCents = '0'

    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          await requireEditable(transaction)
          const line = await em.findOne(PosTransactionLine, {
            id: parsed.lineId,
            transactionId: transaction.id,
            tenantId: transaction.tenantId,
          })
          if (!line) {
            const { translate } = await resolveTranslations()
            throw notFound(translate('soanas_pos.errors.line_not_found', 'POS line not found'))
          }
          em.remove(line)
          await em.flush()
          await recalculateTransactionTotals(em, transaction)
          grandTotalCents = transaction.grandTotalCents
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.remove_line' },
    )

    return { lineId: parsed.lineId, grandTotalCents }
  },
}

const setCustomerCommand: CommandHandler<PosSetCustomerInput, { transactionId: string }> = {
  id: 'soanas_pos.transactions.set_customer',
  async execute(input, ctx) {
    const parsed = posSetCustomerSchema.parse(input)
    const em = forkEm(ctx)
    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          await requireEditable(transaction)
          transaction.customerId = parsed.customerId ?? null
          transaction.updatedAt = new Date()
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.set_customer' },
    )
    return { transactionId: parsed.transactionId }
  },
}

const applyDiscountCommand: CommandHandler<
  PosApplyDiscountInput,
  { transactionId: string; grandTotalCents: string }
> = {
  id: 'soanas_pos.transactions.apply_discount',
  async execute(input, ctx) {
    const parsed = posApplyDiscountSchema.parse(input)
    const { translate } = await resolveTranslations()
    if (!callerHasFeature(ctx, POS_DISCOUNT_FEATURE)) {
      throw forbidden(translate('soanas_pos.errors.discount_forbidden', 'You are not allowed to grant POS discounts'))
    }
    const em = forkEm(ctx)
    let grandTotalCents = '0'

    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          await requireEditable(transaction)
          const lines = await loadLines(em, transaction)
          const grossCents = lines.reduce(
            (sum, line) => sum + BigInt(line.lineTotalCents) + BigInt(line.discountAmountCents),
            0n,
          )
          const amount = BigInt(parsed.amountCents)
          // Above the self-service share the discount needs a second pair of eyes.
          const threshold = (grossCents * POS_DISCOUNT_APPROVAL_THRESHOLD_PERCENT) / 100n
          if (amount > threshold && !callerHasFeature(ctx, POS_DISCOUNT_APPROVAL_FEATURE)) {
            throw forbidden(
              translate(
                'soanas_pos.errors.discount_approval_required',
                'This discount exceeds your limit and needs a manager approval',
              ),
            )
          }

          if (parsed.scope === 'line') {
            const cartDiscountCents = currentCartDiscountCents(transaction, lines)
            const line = lines.find((candidate) => candidate.id === parsed.lineId)
            if (!line) throw notFound(translate('soanas_pos.errors.line_not_found', 'POS line not found'))
            line.discountAmountCents = amount.toString()
            line.updatedAt = new Date()
            await recalculateTransactionTotals(em, transaction, { cartDiscountCents })
          } else {
            await recalculateTransactionTotals(em, transaction, { cartDiscountCents: amount })
          }
          grandTotalCents = transaction.grandTotalCents
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.apply_discount' },
    )

    return { transactionId: parsed.transactionId, grandTotalCents }
  },
}

const checkoutCommand: CommandHandler<
  PosCheckoutInput,
  { transactionId: string; status: string; grandTotalCents: string }
> = {
  id: 'soanas_pos.transactions.checkout',
  async execute(input, ctx) {
    const parsed = posCheckoutSchema.parse(input)
    const em = forkEm(ctx)
    let grandTotalCents = '0'
    let status = 'PAYMENT_PENDING'

    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          const lines = await recalculateTransactionTotals(em, transaction)
          if (!lines.length) {
            const { translate } = await resolveTranslations()
            throw badRequest(translate('soanas_pos.errors.empty_cart', 'Cannot check out an empty cart'))
          }
          if (transaction.status === 'DRAFT') {
            await transitionTo(em, transaction, 'CHECKOUT', {
              trigger: 'soanas_pos.transactions.checkout',
              actorId: parsed.operatorUserId,
            })
          }
          if (transaction.status === 'CHECKOUT') {
            await transitionTo(em, transaction, 'PAYMENT_PENDING', {
              trigger: 'soanas_pos.transactions.checkout',
              actorId: parsed.operatorUserId,
              metadata: { grandTotalCents: transaction.grandTotalCents },
            })
          }
          grandTotalCents = transaction.grandTotalCents
          status = transaction.status
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.checkout' },
    )

    await emitSoanasPosEvent('soanas.pos.transaction.checked_out', {
      id: parsed.transactionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      grandTotalCents,
    })
    return { transactionId: parsed.transactionId, status, grandTotalCents }
  },
}

const cancelCommand: CommandHandler<PosCancelInput, { transactionId: string; status: string }> = {
  id: 'soanas_pos.transactions.cancel',
  async execute(input, ctx) {
    const parsed = posCancelSchema.parse(input)
    const em = forkEm(ctx)
    let status = 'CANCELLED'

    await withAtomicFlush(
      em,
      [
        async () => {
          const transaction = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          const { translate } = await resolveTranslations()
          if (transaction.status === 'COMPLETED') {
            // A completed sale already moved stock, cash and a SalesOrder. v1 has no refund
            // saga, so the operator must issue a Sales return instead of cancelling here.
            throw badRequest(
              translate(
                'soanas_pos.errors.completed_not_cancellable',
                'A completed POS sale cannot be cancelled; register a sales return instead',
              ),
            )
          }
          if (transaction.status === 'CANCELLED') return
          // Anything past payment leaves a trail worth reviewing, so it parks in
          // CANCEL_PENDING for an operator/manager instead of vanishing.
          const target = transaction.status === 'DRAFT' || transaction.status === 'CHECKOUT'
            ? 'CANCELLED'
            : 'CANCEL_PENDING'
          await transitionTo(em, transaction, target, {
            trigger: 'soanas_pos.transactions.cancel',
            actorId: parsed.operatorUserId,
            metadata: parsed.reason ? { reason: parsed.reason } : null,
          })
          if (target === 'CANCELLED') transaction.cancelledAt = new Date()
          status = target
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.cancel' },
    )

    await emitSoanasPosEvent('soanas.pos.transaction.cancelled', {
      id: parsed.transactionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      status,
    })
    return { transactionId: parsed.transactionId, status }
  },
}

registerCommand(createTransactionCommand)
registerCommand(addLineCommand)
registerCommand(updateLineCommand)
registerCommand(removeLineCommand)
registerCommand(setCustomerCommand)
registerCommand(applyDiscountCommand)
registerCommand(checkoutCommand)
registerCommand(cancelCommand)
