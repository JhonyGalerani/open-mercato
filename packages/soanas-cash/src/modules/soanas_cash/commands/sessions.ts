import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest, conflict, isUniqueViolation } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  CashApproval,
  CashCount,
  CashMovement,
  CashReconciliation,
  CashSession,
} from '../data/entities'
import {
  cashSessionOpenSchema,
  cashSessionCloseSchema,
  type CashSessionOpenInput,
  type CashSessionCloseInput,
} from '../data/validators'
import { computeDiscrepancy } from '../lib/ledger'
import { validateDenominationsMatchAmount } from '../lib/denominations'
import { resolveDiscrepancyToleranceCents } from '../lib/policy'
import { centsToWire } from '../lib/cents'
import { emitSoanasCashEvent } from '../events'
import { callerCanApprove, forkEm, loadRegisterOrThrow, loadSessionForUpdate, loadSessionTotals } from './helpers'

const ACTIVE_SESSION_STATUSES = ['opening', 'open', 'closing'] as const

type OpenResult = { sessionId: string; alreadyOpen: boolean }

export type CashSessionCloseResult = {
  sessionId: string
  countId: string
  reconciliationId: string
  reconciliationStatus: string
  countedCashCents: string
  toleranceCents: string
  blind: boolean
  approvalId: string | null
  /** Withheld from the operator response while the register uses blind closing. */
  expectedCashCents?: string
  discrepancyCents?: string
}

const openSessionCommand: CommandHandler<CashSessionOpenInput, OpenResult> = {
  id: 'soanas_cash.sessions.open',
  async execute(input, ctx) {
    const parsed = cashSessionOpenSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()

    const openingFloat = BigInt(parsed.openingFloatCents)
    const denominationCheck = validateDenominationsMatchAmount(parsed.openingDenominations, openingFloat)
    if (!denominationCheck.ok) {
      throw badRequest(
        translate(
          'soanas_cash.errors.denominations_mismatch',
          'Counted denominations do not match the declared amount',
        ),
      )
    }

    const register = await loadRegisterOrThrow(em, {
      id: parsed.registerId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })

    const priorByKey = await em.findOne(CashSession, {
      tenantId: parsed.tenantId,
      idempotencyKey: parsed.idempotencyKey,
      deletedAt: null,
    })
    if (priorByKey) return { sessionId: priorByKey.id, alreadyOpen: true }

    const existingOpen = await em.findOne(CashSession, {
      registerId: parsed.registerId,
      tenantId: parsed.tenantId,
      status: { $in: [...ACTIVE_SESSION_STATUSES] },
      deletedAt: null,
    })
    if (existingOpen) {
      throw conflict(
        translate(
          'soanas_cash.errors.register_already_open',
          'Register already has an active cash session',
        ),
      )
    }

    const now = new Date()
    const sessionId = crypto.randomUUID()
    const session = em.create(CashSession, {
      id: sessionId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      establishmentId: parsed.establishmentId ?? register.establishmentId ?? null,
      registerId: parsed.registerId,
      terminalId: parsed.terminalId ?? register.terminalId ?? null,
      operatorUserId: parsed.operatorUserId,
      status: 'open',
      openingFloatCents: parsed.openingFloatCents,
      openingDenominations: parsed.openingDenominations ?? null,
      notes: parsed.notes ?? null,
      closingBlind: register.blindClosing,
      openedAtServer: now,
      openedAtLocal: parsed.openedAtLocal ?? null,
      idempotencyKey: parsed.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })

    const openingMovement = em.create(CashMovement, {
      id: crypto.randomUUID(),
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId,
      registerId: parsed.registerId,
      type: 'opening',
      amountCents: parsed.openingFloatCents,
      status: 'confirmed',
      operatorUserId: parsed.operatorUserId,
      terminalId: parsed.terminalId ?? register.terminalId ?? null,
      denominations: parsed.openingDenominations ?? null,
      idempotencyKey: `${parsed.idempotencyKey}:opening`,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })

    try {
      await withAtomicFlush(
        em,
        [
          () => {
            em.persist(session)
            em.persist(openingMovement)
          },
        ],
        { transaction: true, label: 'soanas_cash.sessions.open' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_cash_sessions_idempotency_unique')) {
        const again = await forkEm(ctx).findOne(CashSession, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
          deletedAt: null,
        })
        if (again) return { sessionId: again.id, alreadyOpen: true }
      }
      if (isUniqueViolation(err, 'soanas_cash_sessions_register_open_unique')) {
        throw conflict(
          translate('soanas_cash.errors.register_already_open', 'Register already has an active cash session'),
        )
      }
      if (isUniqueViolation(err)) {
        throw conflict(translate('soanas_cash.errors.duplicate_open', 'Duplicate cash session open'))
      }
      throw err
    }

    await emitSoanasCashEvent('soanas.cash.session.opened', {
      id: session.id,
      registerId: session.registerId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      operatorUserId: session.operatorUserId,
      openingFloatCents: session.openingFloatCents,
    })

    return { sessionId: session.id, alreadyOpen: false }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const session = await em.findOne(CashSession, { id: result.sessionId })
    if (!session) return null
    return {
      id: session.id,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      registerId: session.registerId,
      operatorUserId: session.operatorUserId,
      status: session.status,
      openingFloatCents: centsToWire(session.openingFloatCents),
      openedAtServer: session.openedAtServer.toISOString(),
    }
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as { id: string; tenantId: string; organizationId: string } | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.session_open', 'Open cash session'),
      resourceKind: 'soanas_cash.cash_session',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const closeSessionCommand: CommandHandler<CashSessionCloseInput, CashSessionCloseResult> = {
  id: 'soanas_cash.sessions.close',
  async execute(input, ctx) {
    const parsed = cashSessionCloseSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()

    const countedCash = BigInt(parsed.countedCashCents)
    const denominationCheck = validateDenominationsMatchAmount(parsed.denominations, countedCash)
    if (!denominationCheck.ok) {
      throw badRequest(
        translate(
          'soanas_cash.errors.denominations_mismatch',
          'Counted denominations do not match the declared amount',
        ),
      )
    }

    let count: CashCount | null = null
    let reconciliation: CashReconciliation | null = null
    let approval: CashApproval | null = null
    let session: CashSession | null = null
    let blind = false
    let discrepancy = computeDiscrepancy({ expectedCents: 0n, countedCents: 0n })

    await withAtomicFlush(
      em,
      [
        async () => {
          session = await loadSessionForUpdate(em, {
            sessionId: parsed.sessionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
          if (session.status === 'closed') {
            throw conflict(
              translate('soanas_cash.errors.session_already_closed', 'Cash session is already closed'),
            )
          }
          const register = await loadRegisterOrThrow(
            em,
            {
              id: session.registerId,
              tenantId: session.tenantId,
              organizationId: session.organizationId,
            },
            { requireActive: false },
          )
          blind = session.closingBlind || register.blindClosing

          const { totals } = await loadSessionTotals(em, session)
          discrepancy = computeDiscrepancy({
            expectedCents: totals.expectedCashCents,
            countedCents: countedCash,
            toleranceCents: resolveDiscrepancyToleranceCents(register),
          })

          const now = new Date()
          count = em.create(CashCount, {
            id: crypto.randomUUID(),
            tenantId: session.tenantId,
            organizationId: session.organizationId,
            sessionId: session.id,
            registerId: session.registerId,
            kind: 'closing',
            denominations: parsed.denominations ?? null,
            totalCountedCents: countedCash.toString(),
            operatorUserId: parsed.operatorUserId,
            notes: parsed.notes ?? null,
            blindMode: blind,
            createdAt: now,
            updatedAt: now,
          })
          em.persist(count)
        },
        async () => {
          const currentSession = session
          const currentCount = count
          if (!currentSession || !currentCount) {
            throw badRequest(translate('soanas_cash.errors.close_failed', 'Failed to close cash session'))
          }
          const now = new Date()
          const needsApproval = discrepancy.outcome === 'discrepancy'
          const sessionApproverId = ctx.auth?.sub ?? null
          const approverIsValid =
            !!sessionApproverId &&
            sessionApproverId !== parsed.operatorUserId &&
            (await callerCanApprove(ctx))

          if (needsApproval) {
            approval = em.create(CashApproval, {
              id: crypto.randomUUID(),
              tenantId: currentSession.tenantId,
              organizationId: currentSession.organizationId,
              sessionId: currentSession.id,
              kind: 'discrepancy',
              requesterUserId: parsed.operatorUserId,
              approverUserId: approverIsValid ? sessionApproverId : null,
              status: approverIsValid ? 'approved' : 'pending',
              reason: parsed.reason ?? null,
              createdAt: now,
              updatedAt: now,
            })
            em.persist(approval)
          }

          const reconciliationStatus = needsApproval
            ? approverIsValid
              ? 'approved'
              : 'discrepancy'
            : discrepancy.outcome

          reconciliation = em.create(CashReconciliation, {
            id: crypto.randomUUID(),
            tenantId: currentSession.tenantId,
            organizationId: currentSession.organizationId,
            sessionId: currentSession.id,
            countId: currentCount.id,
            expectedCashCents: discrepancy.expectedCents.toString(),
            countedCashCents: discrepancy.countedCents.toString(),
            discrepancyCents: discrepancy.discrepancyCents.toString(),
            toleranceCents: discrepancy.toleranceCents.toString(),
            status: reconciliationStatus,
            reason: parsed.reason ?? null,
            approvalId: approval?.id ?? null,
            operatorUserId: parsed.operatorUserId,
            createdAt: now,
            updatedAt: now,
          })
          em.persist(reconciliation)

          currentSession.status = reconciliationStatus === 'discrepancy' ? 'reconciliation_required' : 'closed'
          currentSession.closedAtServer = now
          currentSession.closedAtLocal = parsed.closedAtLocal ?? null
          if (parsed.notes !== undefined) currentSession.notes = parsed.notes ?? null
          currentSession.updatedAt = now
        },
      ],
      { transaction: true, label: 'soanas_cash.sessions.close' },
    )

    const closedSession = session as CashSession | null
    const closedCount = count as CashCount | null
    const closedReconciliation = reconciliation as CashReconciliation | null
    if (!closedSession || !closedCount || !closedReconciliation) {
      throw badRequest(translate('soanas_cash.errors.close_failed', 'Failed to close cash session'))
    }
    const closedApproval = approval as CashApproval | null

    await emitSoanasCashEvent('soanas.cash.count.recorded', {
      id: closedCount.id,
      sessionId: closedSession.id,
      tenantId: closedSession.tenantId,
      organizationId: closedSession.organizationId,
      kind: 'closing',
      totalCountedCents: closedCount.totalCountedCents,
    })
    await emitSoanasCashEvent('soanas.cash.session.closed', {
      id: closedSession.id,
      tenantId: closedSession.tenantId,
      organizationId: closedSession.organizationId,
      registerId: closedSession.registerId,
      status: closedSession.status,
      reconciliationId: closedReconciliation.id,
    })
    if (discrepancy.outcome === 'discrepancy') {
      await emitSoanasCashEvent('soanas.cash.discrepancy.detected', {
        id: closedSession.id,
        tenantId: closedSession.tenantId,
        organizationId: closedSession.organizationId,
        reconciliationId: closedReconciliation.id,
        discrepancyCents: closedReconciliation.discrepancyCents,
        approvalId: closedApproval?.id ?? null,
      })
    }

    // Blind closing: the operator never sees the system expectation, even after counting.
    // A caller holding an approval feature (supervisor path) always gets the full figures.
    const revealExpected = !blind || (await callerCanApprove(ctx))
    return {
      sessionId: closedSession.id,
      countId: closedCount.id,
      reconciliationId: closedReconciliation.id,
      reconciliationStatus: closedReconciliation.status,
      countedCashCents: closedReconciliation.countedCashCents,
      toleranceCents: closedReconciliation.toleranceCents,
      blind,
      approvalId: closedApproval?.id ?? null,
      ...(revealExpected
        ? {
            expectedCashCents: closedReconciliation.expectedCashCents,
            discrepancyCents: closedReconciliation.discrepancyCents,
          }
        : {}),
    }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const session = await em.findOne(CashSession, { id: result.sessionId })
    if (!session) return null
    return {
      id: session.id,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      registerId: session.registerId,
      status: session.status,
      reconciliationId: result.reconciliationId,
      countId: result.countId,
      countedCashCents: result.countedCashCents,
    }
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as { id: string; tenantId: string; organizationId: string } | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.session_close', 'Close cash session'),
      resourceKind: 'soanas_cash.cash_session',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

registerCommand(openSessionCommand)
registerCommand(closeSessionCommand)
