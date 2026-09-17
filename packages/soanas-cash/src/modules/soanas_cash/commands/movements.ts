import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { EntityManager } from '@mikro-orm/postgresql'
import { badRequest, conflict, isUniqueViolation, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CashApproval, CashMovement, CashRegister, CashSession } from '../data/entities'
import {
  cashWithdrawalCreateSchema,
  cashSupplyCreateSchema,
  cashMovementReverseSchema,
  cashSaleRecordSchema,
  type CashWithdrawalCreateInput,
  type CashSupplyCreateInput,
  type CashMovementReverseInput,
  type CashSaleRecordInput,
} from '../data/validators'
import { validateDenominationsMatchAmount } from '../lib/denominations'
import { centsToWire } from '../lib/cents'
import { resolveSupplyRequiresApproval, resolveWithdrawalRequiresApproval } from '../lib/policy'
import { buildCashMovementReceipt } from '../lib/receipt'
import { emitSoanasCashEvent } from '../events'
import {
  enforceDualCustody,
  forkEm,
  loadRegisterOrThrow,
  loadSessionForUpdate,
  loadSessionTotals,
} from './helpers'

type MovementResult = { movementId: string; approvalId: string | null }

async function findMovementByIdempotencyKey(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; idempotencyKey: string },
): Promise<CashMovement | null> {
  return em.findOne(CashMovement, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    idempotencyKey: scope.idempotencyKey,
  })
}

/**
 * Unique index is (tenant_id, idempotency_key). A cross-org collision must conflict,
 * never return another organization's movement.
 */
async function resolveIdempotentMovementOrConflict(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; idempotencyKey: string },
  conflictMessage: string,
): Promise<CashMovement> {
  const sameOrg = await findMovementByIdempotencyKey(em, scope)
  if (sameOrg) return sameOrg
  const otherOrg = await em.findOne(CashMovement, {
    tenantId: scope.tenantId,
    idempotencyKey: scope.idempotencyKey,
  })
  if (otherOrg && otherOrg.organizationId !== scope.organizationId) {
    throw conflict(conflictMessage)
  }
  throw conflict(conflictMessage)
}

function movementSnapshot(movement: CashMovement) {
  return {
    id: movement.id,
    tenantId: movement.tenantId,
    organizationId: movement.organizationId,
    sessionId: movement.sessionId,
    registerId: movement.registerId,
    type: movement.type,
    amountCents: centsToWire(movement.amountCents),
    status: movement.status,
    operatorUserId: movement.operatorUserId,
    approverUserId: movement.approverUserId ?? null,
    reversesMovementId: movement.reversesMovementId ?? null,
  }
}

async function requireOpenSession(
  em: EntityManager,
  scope: { sessionId: string; tenantId: string; organizationId: string },
): Promise<CashSession> {
  const session = await loadSessionForUpdate(em, scope)
  if (session.status !== 'open') {
    const { translate } = await resolveTranslations()
    throw badRequest(translate('soanas_cash.errors.session_not_open', 'Cash session is not open'))
  }
  return session
}

async function createApprovedCashMovement(args: {
  ctx: Parameters<CommandHandler['execute']>[1]
  kind: 'withdrawal' | 'supply'
  parsed: CashWithdrawalCreateInput | CashSupplyCreateInput
  amount: bigint
  extraMovementFields: Record<string, unknown>
  receiptExtraLines: Array<{ label: string; value: string }>
  duplicateConflictKey: string
  duplicateConflictFallback: string
  eventId: 'soanas.cash.withdrawal.created' | 'soanas.cash.supply.created'
  eventExtra?: Record<string, unknown>
}): Promise<MovementResult> {
  const {
    ctx,
    kind,
    parsed,
    amount,
    extraMovementFields,
    receiptExtraLines,
    duplicateConflictKey,
    duplicateConflictFallback,
    eventId,
    eventExtra,
  } = args
  const em = forkEm(ctx)
  const { translate } = await resolveTranslations()
  const idempotencyScope = {
    tenantId: parsed.tenantId,
    organizationId: parsed.organizationId,
    idempotencyKey: parsed.idempotencyKey,
  }

  const prior = await findMovementByIdempotencyKey(em, idempotencyScope)
  if (prior) return { movementId: prior.id, approvalId: null }

  const denominationCheck = validateDenominationsMatchAmount(parsed.denominations, amount)
  if (!denominationCheck.ok) {
    throw badRequest(
      translate(
        'soanas_cash.errors.denominations_mismatch',
        'Counted denominations do not match the declared amount',
      ),
    )
  }

  const movementId = crypto.randomUUID()
  const approvalId = crypto.randomUUID()
  let approvalPersisted = false
  let registerRecord: CashRegister | null = null
  let sessionRecord: CashSession | null = null
  let sessionApproverId: string | null = null
  const requesterUserId = ctx.auth?.sub ?? parsed.operatorUserId

  try {
    await withAtomicFlush(
      em,
      [
        async () => {
          const session = await requireOpenSession(em, {
            sessionId: parsed.sessionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          sessionRecord = session
          const register = await loadRegisterOrThrow(
            em,
            {
              id: session.registerId,
              tenantId: session.tenantId,
              organizationId: session.organizationId,
            },
            { requireActive: false },
          )
          registerRecord = register

          const requirement =
            kind === 'withdrawal'
              ? resolveWithdrawalRequiresApproval(register, amount)
              : resolveSupplyRequiresApproval(register, amount)
          sessionApproverId = await enforceDualCustody({
            ctx,
            requirement,
            operatorUserId: session.operatorUserId,
          })

          if (kind === 'withdrawal') {
            const { totals } = await loadSessionTotals(em, session)
            if (amount > totals.expectedCashCents) {
              throw badRequest(
                translate(
                  'soanas_cash.errors.insufficient_cash',
                  'Insufficient physical cash for this withdrawal',
                ),
              )
            }
          }

          const now = new Date()
          const sessionOperatorUserId = session.operatorUserId
          if (requirement.requiresApproval) {
            em.persist(
              em.create(CashApproval, {
                id: approvalId,
                tenantId: session.tenantId,
                organizationId: session.organizationId,
                sessionId: session.id,
                movementId,
                kind,
                requesterUserId,
                approverUserId: sessionApproverId,
                status: 'approved',
                reason: parsed.reasonDetail ?? parsed.reasonCode,
                createdAt: now,
                updatedAt: now,
              }),
            )
            approvalPersisted = true
          }

          em.persist(
            em.create(CashMovement, {
              id: movementId,
              tenantId: session.tenantId,
              organizationId: session.organizationId,
              sessionId: session.id,
              registerId: session.registerId,
              type: kind,
              amountCents: parsed.amountCents,
              status: 'confirmed',
              reasonCode: parsed.reasonCode,
              reasonDetail: parsed.reasonDetail ?? null,
              operatorUserId: sessionOperatorUserId,
              approverUserId: sessionApproverId,
              terminalId: parsed.terminalId ?? session.terminalId ?? null,
              denominations: parsed.denominations ?? null,
              receiptPayload: buildCashMovementReceipt({
                kind,
                movementId,
                sessionId: session.id,
                registerCode: register.code,
                registerName: register.name,
                amountCents: amount,
                issuedAt: now,
                operatorUserId: sessionOperatorUserId,
                approverUserId: sessionApproverId,
                denominations: parsed.denominations ?? null,
                extraLines: receiptExtraLines,
              }) as unknown as Record<string, unknown>,
              idempotencyKey: parsed.idempotencyKey,
              syncStatus: 'pending',
              createdAt: now,
              updatedAt: now,
              ...extraMovementFields,
            }),
          )
          session.updatedAt = now
        },
      ],
      { transaction: true, label: `soanas_cash.${kind === 'withdrawal' ? 'withdrawals' : 'supplies'}.create` },
    )
  } catch (err) {
    if (isUniqueViolation(err, 'soanas_cash_movements_idempotency_unique')) {
      const again = await resolveIdempotentMovementOrConflict(
        forkEm(ctx),
        idempotencyScope,
        translate(duplicateConflictKey, duplicateConflictFallback),
      )
      return { movementId: again.id, approvalId: null }
    }
    throw err
  }

  const session = sessionRecord as CashSession | null
  const register = registerRecord as CashRegister | null
  await emitSoanasCashEvent(eventId, {
    id: movementId,
    tenantId: parsed.tenantId,
    organizationId: parsed.organizationId,
    sessionId: parsed.sessionId,
    registerId: session?.registerId ?? register?.id ?? null,
    amountCents: parsed.amountCents,
    operatorUserId: session?.operatorUserId ?? null,
    approverUserId: sessionApproverId,
    requesterUserId,
    ...eventExtra,
  })

  return { movementId, approvalId: approvalPersisted ? approvalId : null }
}

const createWithdrawalCommand: CommandHandler<CashWithdrawalCreateInput, MovementResult> = {
  id: 'soanas_cash.withdrawals.create',
  async execute(input, ctx) {
    const parsed = cashWithdrawalCreateSchema.parse(input)
    return createApprovedCashMovement({
      ctx,
      kind: 'withdrawal',
      parsed,
      amount: BigInt(parsed.amountCents),
      extraMovementFields: {
        destination: parsed.destination,
        receiverName: parsed.receiverName ?? null,
      },
      receiptExtraLines: [{ label: 'destination', value: parsed.destination }],
      duplicateConflictKey: 'soanas_cash.errors.duplicate_withdrawal',
      duplicateConflictFallback: 'Duplicate withdrawal',
      eventId: 'soanas.cash.withdrawal.created',
    })
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const movement = await em.findOne(CashMovement, { id: result.movementId })
    return movement ? movementSnapshot(movement) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ReturnType<typeof movementSnapshot> | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.withdrawal_create', 'Create cash withdrawal (sangria)'),
      resourceKind: 'soanas_cash.cash_movement',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const createSupplyCommand: CommandHandler<CashSupplyCreateInput, MovementResult> = {
  id: 'soanas_cash.supplies.create',
  async execute(input, ctx) {
    const parsed = cashSupplyCreateSchema.parse(input)
    return createApprovedCashMovement({
      ctx,
      kind: 'supply',
      parsed,
      amount: BigInt(parsed.amountCents),
      extraMovementFields: {
        origin: parsed.origin,
      },
      receiptExtraLines: [{ label: 'origin', value: parsed.origin }],
      duplicateConflictKey: 'soanas_cash.errors.duplicate_supply',
      duplicateConflictFallback: 'Duplicate supply',
      eventId: 'soanas.cash.supply.created',
      eventExtra: { origin: parsed.origin },
    })
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const movement = await em.findOne(CashMovement, { id: result.movementId })
    return movement ? movementSnapshot(movement) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ReturnType<typeof movementSnapshot> | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.supply_create', 'Create cash supply (suprimento)'),
      resourceKind: 'soanas_cash.cash_movement',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

/**
 * ADR-003: a confirmed movement is never deleted. The original row is flipped to
 * `status = 'reversed'` (so the ledger stops counting it) and a compensating `reversal`
 * row carrying the opposite signed amount is appended, preserving the audit trail.
 */
const reverseMovementCommand: CommandHandler<
  CashMovementReverseInput,
  { movementId: string; reversalMovementId: string }
> = {
  id: 'soanas_cash.movements.reverse',
  async execute(input, ctx) {
    const parsed = cashMovementReverseSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()
    const idempotencyScope = {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      idempotencyKey: parsed.idempotencyKey,
    }

    const prior = await findMovementByIdempotencyKey(em, idempotencyScope)
    if (prior?.reversesMovementId) {
      return { movementId: prior.reversesMovementId, reversalMovementId: prior.id }
    }

    const reversalId = crypto.randomUUID()
    let originalSessionId: string | null = null
    let originalRegisterId: string | null = null
    let sessionOperatorUserId: string | null = null

    try {
      await withAtomicFlush(
        em,
        [
          async () => {
            const original = await em.findOne(CashMovement, {
              id: parsed.movementId,
              tenantId: parsed.tenantId,
              organizationId: parsed.organizationId,
            })
            if (!original) {
              throw notFound(
                translate('soanas_cash.errors.movement_not_found', 'Cash movement not found'),
              )
            }
            if (original.status !== 'confirmed') {
              throw conflict(
                translate('soanas_cash.errors.movement_not_reversible', 'Cash movement is already reversed'),
              )
            }
            if (original.type === 'reversal') {
              throw badRequest(
                translate(
                  'soanas_cash.errors.reversal_of_reversal',
                  'A reversal movement cannot itself be reversed',
                ),
              )
            }
            originalSessionId = original.sessionId
            originalRegisterId = original.registerId

            const session = await loadSessionForUpdate(em, {
              sessionId: original.sessionId,
              tenantId: original.tenantId,
              organizationId: original.organizationId,
            })
            if (session.status === 'closed') {
              throw conflict(
                translate('soanas_cash.errors.session_already_closed', 'Cash session is already closed'),
              )
            }
            sessionOperatorUserId = session.operatorUserId

            const { totals } = await loadSessionTotals(em, session)
            const originalAmount = BigInt(original.amountCents)
            const compensation = isInflow(original.type) ? -absBigInt(originalAmount) : absBigInt(originalAmount)
            if (totals.expectedCashCents + compensation < 0n) {
              throw badRequest(
                translate(
                  'soanas_cash.errors.insufficient_cash',
                  'Insufficient physical cash for this withdrawal',
                ),
              )
            }

            const now = new Date()
            em.persist(
              em.create(CashMovement, {
                id: reversalId,
                tenantId: original.tenantId,
                organizationId: original.organizationId,
                sessionId: original.sessionId,
                registerId: original.registerId,
                type: 'reversal',
                amountCents: compensation.toString(),
                status: 'confirmed',
                reasonCode: original.reasonCode ?? null,
                reasonDetail: parsed.reason,
                origin: original.origin ?? null,
                destination: original.destination ?? null,
                operatorUserId: session.operatorUserId,
                approverUserId: ctx.auth?.sub ?? null,
                terminalId: original.terminalId ?? null,
                reversesMovementId: original.id,
                posTransactionId: original.posTransactionId ?? null,
                salesOrderId: original.salesOrderId ?? null,
                paymentTenderId: original.paymentTenderId ?? null,
                idempotencyKey: parsed.idempotencyKey,
                syncStatus: 'pending',
                createdAt: now,
                updatedAt: now,
              }),
            )
            original.status = 'reversed'
            original.updatedAt = now
          },
        ],
        { transaction: true, label: 'soanas_cash.movements.reverse' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_movements_idempotency_unique')) {
        const again = await resolveIdempotentMovementOrConflict(
          forkEm(ctx),
          idempotencyScope,
          translate('soanas_cash.errors.duplicate_reversal', 'Duplicate reversal'),
        )
        if (again.reversesMovementId) {
          return { movementId: again.reversesMovementId, reversalMovementId: again.id }
        }
        throw conflict(translate('soanas_cash.errors.duplicate_reversal', 'Duplicate reversal'))
      }
      throw err
    }

    await emitSoanasCashEvent('soanas.cash.movement.reversed', {
      id: parsed.movementId,
      reversalMovementId: reversalId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId: originalSessionId,
      registerId: originalRegisterId,
      operatorUserId: sessionOperatorUserId,
      approverUserId: ctx.auth?.sub ?? null,
      reason: parsed.reason,
    })

    return { movementId: parsed.movementId, reversalMovementId: reversalId }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const movement = await em.findOne(CashMovement, { id: result.reversalMovementId })
    return movement ? movementSnapshot(movement) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ReturnType<typeof movementSnapshot> | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.movement_reverse', 'Reverse cash movement'),
      resourceKind: 'soanas_cash.cash_movement',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const recordSaleCommand: CommandHandler<CashSaleRecordInput, { movementId: string }> = {
  id: 'soanas_cash.movements.record_sale',
  async execute(input, ctx) {
    const parsed = cashSaleRecordSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()
    const idempotencyScope = {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      idempotencyKey: parsed.idempotencyKey,
    }

    const prior = await findMovementByIdempotencyKey(em, idempotencyScope)
    if (prior) return { movementId: prior.id }

    const movementId = crypto.randomUUID()
    let registerId: string | null = null
    let sessionOperatorUserId: string | null = null

    try {
      await withAtomicFlush(
        em,
        [
          async () => {
            const session = await requireOpenSession(em, {
              sessionId: parsed.sessionId,
              tenantId: parsed.tenantId,
              organizationId: parsed.organizationId,
            })
            registerId = session.registerId
            sessionOperatorUserId = session.operatorUserId
            const now = new Date()
            em.persist(
              em.create(CashMovement, {
                id: movementId,
                tenantId: session.tenantId,
                organizationId: session.organizationId,
                sessionId: session.id,
                registerId: session.registerId,
                type: 'cash_sale',
                amountCents: parsed.amountCents,
                status: 'confirmed',
                operatorUserId: session.operatorUserId,
                terminalId: parsed.terminalId ?? session.terminalId ?? null,
                posTransactionId: parsed.posTransactionId ?? null,
                salesOrderId: parsed.salesOrderId ?? null,
                paymentTenderId: parsed.paymentTenderId ?? null,
                idempotencyKey: parsed.idempotencyKey,
                syncStatus: 'pending',
                createdAt: now,
                updatedAt: now,
              }),
            )
            session.updatedAt = now
          },
        ],
        { transaction: true, label: 'soanas_cash.movements.record_sale' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_movements_idempotency_unique')) {
        const again = await resolveIdempotentMovementOrConflict(
          forkEm(ctx),
          idempotencyScope,
          translate('soanas_cash.errors.duplicate_sale', 'Duplicate cash sale'),
        )
        return { movementId: again.id }
      }
      throw err
    }

    await emitSoanasCashEvent('soanas.cash.sale.recorded', {
      id: movementId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId: parsed.sessionId,
      registerId,
      amountCents: centsToWire(parsed.amountCents),
      operatorUserId: sessionOperatorUserId,
      posTransactionId: parsed.posTransactionId ?? null,
      salesOrderId: parsed.salesOrderId ?? null,
    })

    return { movementId }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const movement = await em.findOne(CashMovement, { id: result.movementId })
    return movement ? movementSnapshot(movement) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as ReturnType<typeof movementSnapshot> | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.sale_record', 'Record cash sale'),
      resourceKind: 'soanas_cash.cash_movement',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

function isInflow(type: string): boolean {
  return type === 'opening' || type === 'cash_sale' || type === 'supply' || type === 'other_in'
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value
}

registerCommand(createWithdrawalCommand)
registerCommand(createSupplyCommand)
registerCommand(reverseMovementCommand)
registerCommand(recordSaleCommand)
