import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandBus, CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { badRequest, forbidden, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { InventoryMovement } from '@open-mercato/core/modules/wms/data/entities'
import { PosRecoveryState, PosTerminal, PosTransaction } from '../data/entities'
import { posReverseSchema, type PosReverseInput } from '../data/validators'
import { emitSoanasPosEvent } from '../events'
import { consumeApprovedApproval } from './approvals'
import {
  POS_STOCK_APPROVAL_FEATURE,
  callerHasFeature,
  forkEm,
  loadTerminalOrThrow,
  loadTransactionForUpdate,
  transitionTo,
} from './helpers'
import { POS_SALES_SOURCE } from './complete'

export type ReversePosSaleResult = {
  transactionId: string
  status: string
  wmsRestored: number
  cashReversalMovementId: string | null
  replayed: boolean
}

function dispatchContext(ctx: CommandRuntimeContext): CommandRuntimeContext {
  return { ...ctx, request: undefined }
}

function locationIdOf(movement: InventoryMovement): string | null {
  const to = movement.locationTo
  if (!to) return null
  if (typeof to === 'string') return to
  return to.id ?? null
}

async function restoreWmsStock(args: {
  ctx: CommandRuntimeContext
  em: EntityManager
  transaction: PosTransaction
  terminal: PosTerminal
  operatorUserId: string
}): Promise<number> {
  const { ctx, em, transaction, terminal } = args
  if (!terminal.warehouseId || !transaction.salesOrderId) return 0
  const movements = await em.find(InventoryMovement, {
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId,
    referenceType: 'so',
    referenceId: transaction.salesOrderId,
    deletedAt: null,
  })
  const saleMovements = movements.filter((movement) => {
    const meta = (movement.metadata ?? {}) as Record<string, unknown>
    return (
      meta.sourceTransactionId === transaction.id ||
      meta.source === POS_SALES_SOURCE ||
      movement.reasonCode === 'pos_sale'
    )
  })
  if (!saleMovements.length) return 0

  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  let restored = 0
  for (const movement of saleMovements) {
    const qty = Number(movement.quantity)
    if (!Number.isFinite(qty) || qty >= 0) continue
    const locationId = locationIdOf(movement)
    if (!locationId) continue
    const restoreQty = Math.abs(qty).toFixed(4)
    await commandBus.execute('wms.inventory.adjust', {
      input: {
        organizationId: transaction.organizationId,
        tenantId: transaction.tenantId,
        warehouseId: terminal.warehouseId,
        locationId,
        catalogVariantId: movement.catalogVariantId,
        lotId: movement.lot ? (typeof movement.lot === 'string' ? movement.lot : movement.lot.id) : undefined,
        serialNumber: movement.serialNumber ?? undefined,
        delta: restoreQty,
        reason: `POS reversal ${transaction.id}`,
        reasonCode: 'pos_reversal',
        referenceType: 'so',
        referenceId: transaction.salesOrderId,
        performedBy: args.operatorUserId,
        metadata: {
          source: POS_SALES_SOURCE,
          sourceTransactionId: transaction.id,
          reversalOfMovementId: movement.id,
          correlationId: transaction.correlationId,
        },
      },
      ctx: dispatchContext(ctx),
    })
    restored += 1
  }
  return restored
}

async function reverseCashIfNeeded(args: {
  ctx: CommandRuntimeContext
  em: EntityManager
  transaction: PosTransaction
  operatorUserId: string
  reason: string
}): Promise<string | null> {
  const recovery = await args.em.findOne(PosRecoveryState, {
    transactionId: args.transaction.id,
    tenantId: args.transaction.tenantId,
  })
  const movementId = recovery?.cashMovementId ?? null
  if (!movementId) return null

  const commandBus = args.ctx.container.resolve('commandBus') as CommandBus
  const { result } = await commandBus.execute('soanas_cash.movements.reverse', {
    input: {
      tenantId: args.transaction.tenantId,
      organizationId: args.transaction.organizationId,
      movementId,
      operatorUserId: args.operatorUserId,
      reason: args.reason,
      idempotencyKey: `${POS_SALES_SOURCE}:cash-reversal:${args.transaction.id}`,
    },
    ctx: dispatchContext(args.ctx),
  })
  const typed = result as { reversalMovementId?: string } | undefined
  return typed?.reversalMovementId ?? null
}

const reverseCommand: CommandHandler<PosReverseInput, ReversePosSaleResult> = {
  id: 'soanas_pos.transactions.reverse',
  async execute(input, ctx) {
    const parsed = posReverseSchema.parse(input)
    const { translate } = await resolveTranslations()
    if (!(await callerHasFeature(ctx, 'soanas_pos.transactions.cancel'))) {
      throw forbidden(translate('soanas_pos.errors.cancel_forbidden', 'You are not allowed to cancel POS sales'))
    }

    const em = forkEm(ctx)
    const transaction = await em.findOne(PosTransaction, {
      id: parsed.transactionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })
    if (!transaction) {
      throw notFound(translate('soanas_pos.errors.transaction_not_found', 'POS transaction not found'))
    }

    if (transaction.status === 'REVERSED') {
      return {
        transactionId: transaction.id,
        status: 'REVERSED',
        wmsRestored: 0,
        cashReversalMovementId: transaction.reversalCashMovementId ?? null,
        replayed: true,
      }
    }
    if (transaction.status !== 'COMPLETED') {
      throw badRequest(
        translate(
          'soanas_pos.errors.reverse_requires_completed',
          'Only a completed POS sale can be reversed',
        ),
      )
    }

    const canBypassRequest =
      (await callerHasFeature(ctx, POS_STOCK_APPROVAL_FEATURE)) &&
      ctx.auth?.sub !== transaction.operatorUserId
    if (!canBypassRequest) {
      if (!parsed.approvalRequestId) {
        throw forbidden(
          translate(
            'soanas_pos.errors.reverse_approval_required',
            'Reversing a completed sale requires a manager approval',
          ),
        )
      }
    }

    const terminal = await loadTerminalOrThrow(
      em,
      {
        id: transaction.terminalId,
        tenantId: transaction.tenantId,
        organizationId: transaction.organizationId,
      },
      { requireActive: false },
    )

    const wmsRestored = await restoreWmsStock({
      ctx,
      em,
      transaction,
      terminal,
      operatorUserId: parsed.operatorUserId,
    })
    const cashReversalMovementId = await reverseCashIfNeeded({
      ctx,
      em,
      transaction,
      operatorUserId: parsed.operatorUserId,
      reason: parsed.reason,
    })

    await withAtomicFlush(
      em,
      [
        async () => {
          const locked = await loadTransactionForUpdate(em, {
            transactionId: parsed.transactionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          if (locked.status === 'REVERSED') return
          if (parsed.approvalRequestId) {
            await consumeApprovedApproval(em, {
              approvalRequestId: parsed.approvalRequestId,
              tenantId: parsed.tenantId,
              organizationId: parsed.organizationId,
              kind: 'cancel',
              transactionId: parsed.transactionId,
            })
          }
          await transitionTo(em, locked, 'REVERSED', {
            trigger: 'soanas_pos.transactions.reverse',
            actorId: parsed.operatorUserId,
            metadata: {
              reason: parsed.reason,
              approvalRequestId: parsed.approvalRequestId ?? null,
              wmsRestored,
              cashReversalMovementId,
            },
          })
          locked.reversedAt = new Date()
          locked.reversalReason = parsed.reason
          locked.reversalCashMovementId = cashReversalMovementId
          locked.updatedAt = new Date()
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.reverse' },
    )

    await emitSoanasPosEvent('soanas.pos.transaction.reversed', {
      id: parsed.transactionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      salesOrderId: transaction.salesOrderId ?? null,
    })

    return {
      transactionId: parsed.transactionId,
      status: 'REVERSED',
      wmsRestored,
      cashReversalMovementId,
      replayed: false,
    }
  },
}

registerCommand(reverseCommand)
