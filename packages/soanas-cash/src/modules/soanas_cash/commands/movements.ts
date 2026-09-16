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

async function findByIdempotencyKey(
  em: EntityManager,
  tenantId: string,
  idempotencyKey: string,
): Promise<CashMovement | null> {
  return em.findOne(CashMovement, { tenantId, idempotencyKey })
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

const createWithdrawalCommand: CommandHandler<CashWithdrawalCreateInput, MovementResult> = {
  id: 'soanas_cash.withdrawals.create',
  async execute(input, ctx) {
    const parsed = cashWithdrawalCreateSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()

    const prior = await findByIdempotencyKey(em, parsed.tenantId, parsed.idempotencyKey)
    if (prior) return { movementId: prior.id, approvalId: null }

    const amount = BigInt(parsed.amountCents)
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

            const requirement = resolveWithdrawalRequiresApproval(register, amount)
            await enforceDualCustody({
              ctx,
              requirement,
              operatorUserId: parsed.operatorUserId,
              approverUserId: parsed.approverUserId ?? null,
            })

            const { totals } = await loadSessionTotals(em, session)
            if (amount > totals.expectedCashCents) {
              throw badRequest(
                translate(
                  'soanas_cash.errors.insufficient_cash',
                  'Insufficient physical cash for this withdrawal',
                ),
              )
            }

            const now = new Date()
            if (requirement.requiresApproval) {
              em.persist(
                em.create(CashApproval, {
                  id: approvalId,
                  tenantId: session.tenantId,
                  organizationId: session.organizationId,
                  sessionId: session.id,
                  movementId,
                  kind: 'withdrawal',
                  requesterUserId: parsed.operatorUserId,
                  approverUserId: parsed.approverUserId ?? null,
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
                type: 'withdrawal',
                amountCents: parsed.amountCents,
                status: 'confirmed',
                reasonCode: parsed.reasonCode,
                reasonDetail: parsed.reasonDetail ?? null,
                destination: parsed.destination,
                receiverName: parsed.receiverName ?? null,
                operatorUserId: parsed.operatorUserId,
                approverUserId: parsed.approverUserId ?? null,
                terminalId: parsed.terminalId ?? session.terminalId ?? null,
                denominations: parsed.denominations ?? null,
                receiptPayload: buildCashMovementReceipt({
                  kind: 'withdrawal',
                  movementId,
                  sessionId: session.id,
                  registerCode: register.code,
                  registerName: register.name,
                  amountCents: amount,
                  issuedAt: now,
                  operatorUserId: parsed.operatorUserId,
                  approverUserId: parsed.approverUserId ?? null,
                  denominations: parsed.denominations ?? null,
                  extraLines: [{ label: 'destination', value: parsed.destination }],
                }) as unknown as Record<string, unknown>,
                idempotencyKey: parsed.idempotencyKey,
                syncStatus: 'pending',
                createdAt: now,
                updatedAt: now,
              }),
            )
            session.updatedAt = now
          },
        ],
        { transaction: true, label: 'soanas_cash.withdrawals.create' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_movements_idempotency_unique')) {
        const again = await forkEm(ctx).findOne(CashMovement, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
        })
        if (again) return { movementId: again.id, approvalId: null }
        throw conflict(translate('soanas_cash.errors.duplicate_withdrawal', 'Duplicate withdrawal'))
      }
      throw err
    }

    const session = sessionRecord as CashSession | null
    const register = registerRecord as CashRegister | null
    await emitSoanasCashEvent('soanas.cash.withdrawal.created', {
      id: movementId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId: parsed.sessionId,
      registerId: session?.registerId ?? register?.id ?? null,
      amountCents: parsed.amountCents,
      operatorUserId: parsed.operatorUserId,
      approverUserId: parsed.approverUserId ?? null,
    })

    return { movementId, approvalId: approvalPersisted ? approvalId : null }
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
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()

    const prior = await findByIdempotencyKey(em, parsed.tenantId, parsed.idempotencyKey)
    if (prior) return { movementId: prior.id, approvalId: null }

    const amount = BigInt(parsed.amountCents)
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
    let registerId: string | null = null

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
            const register = await loadRegisterOrThrow(
              em,
              {
                id: session.registerId,
                tenantId: session.tenantId,
                organizationId: session.organizationId,
              },
              { requireActive: false },
            )

            const requirement = resolveSupplyRequiresApproval(register, amount)
            await enforceDualCustody({
              ctx,
              requirement,
              operatorUserId: parsed.operatorUserId,
              approverUserId: parsed.approverUserId ?? null,
            })

            const now = new Date()
            if (requirement.requiresApproval) {
              em.persist(
                em.create(CashApproval, {
                  id: approvalId,
                  tenantId: session.tenantId,
                  organizationId: session.organizationId,
                  sessionId: session.id,
                  movementId,
                  kind: 'supply',
                  requesterUserId: parsed.operatorUserId,
                  approverUserId: parsed.approverUserId ?? null,
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
                type: 'supply',
                amountCents: parsed.amountCents,
                status: 'confirmed',
                reasonCode: parsed.reasonCode,
                reasonDetail: parsed.reasonDetail ?? null,
                origin: parsed.origin,
                operatorUserId: parsed.operatorUserId,
                approverUserId: parsed.approverUserId ?? null,
                terminalId: parsed.terminalId ?? session.terminalId ?? null,
                denominations: parsed.denominations ?? null,
                receiptPayload: buildCashMovementReceipt({
                  kind: 'supply',
                  movementId,
                  sessionId: session.id,
                  registerCode: register.code,
                  registerName: register.name,
                  amountCents: amount,
                  issuedAt: now,
                  operatorUserId: parsed.operatorUserId,
                  approverUserId: parsed.approverUserId ?? null,
                  denominations: parsed.denominations ?? null,
                  extraLines: [{ label: 'origin', value: parsed.origin }],
                }) as unknown as Record<string, unknown>,
                idempotencyKey: parsed.idempotencyKey,
                syncStatus: 'pending',
                createdAt: now,
                updatedAt: now,
              }),
            )
            session.updatedAt = now
          },
        ],
        { transaction: true, label: 'soanas_cash.supplies.create' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_movements_idempotency_unique')) {
        const again = await forkEm(ctx).findOne(CashMovement, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
        })
        if (again) return { movementId: again.id, approvalId: null }
        throw conflict(translate('soanas_cash.errors.duplicate_supply', 'Duplicate supply'))
      }
      throw err
    }

    await emitSoanasCashEvent('soanas.cash.supply.created', {
      id: movementId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId: parsed.sessionId,
      registerId,
      amountCents: parsed.amountCents,
      origin: parsed.origin,
      operatorUserId: parsed.operatorUserId,
      approverUserId: parsed.approverUserId ?? null,
    })

    return { movementId, approvalId: approvalPersisted ? approvalId : null }
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

    const prior = await findByIdempotencyKey(em, parsed.tenantId, parsed.idempotencyKey)
    if (prior?.reversesMovementId) {
      return { movementId: prior.reversesMovementId, reversalMovementId: prior.id }
    }

    const reversalId = crypto.randomUUID()
    let originalSessionId: string | null = null
    let originalRegisterId: string | null = null

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
                operatorUserId: parsed.operatorUserId,
                approverUserId: parsed.approverUserId ?? null,
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
        const again = await forkEm(ctx).findOne(CashMovement, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
        })
        if (again?.reversesMovementId) {
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
      operatorUserId: parsed.operatorUserId,
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

    const prior = await findByIdempotencyKey(em, parsed.tenantId, parsed.idempotencyKey)
    if (prior) return { movementId: prior.id }

    const movementId = crypto.randomUUID()
    let registerId: string | null = null

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
                operatorUserId: parsed.operatorUserId,
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
        const again = await forkEm(ctx).findOne(CashMovement, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
        })
        if (again) return { movementId: again.id }
        throw conflict(translate('soanas_cash.errors.duplicate_sale', 'Duplicate cash sale'))
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
