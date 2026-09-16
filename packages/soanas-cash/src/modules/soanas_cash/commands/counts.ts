import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CashCount } from '../data/entities'
import { cashCountCreateSchema, type CashCountCreateInput } from '../data/validators'
import { validateDenominationsMatchAmount } from '../lib/denominations'
import { computeDiscrepancy } from '../lib/ledger'
import { resolveDiscrepancyToleranceCents } from '../lib/policy'
import { emitSoanasCashEvent } from '../events'
import { callerCanApprove, forkEm, loadRegisterOrThrow, loadSessionForUpdate, loadSessionTotals } from './helpers'
import { centsToWire } from '../lib/cents'

export type CashCountCreateResult = {
  countId: string
  sessionId: string
  totalCountedCents: string
  blind: boolean
  /** Withheld while the register uses blind counting and the caller is not a supervisor. */
  expectedCashCents?: string
  discrepancyCents?: string
}

const createCountCommand: CommandHandler<CashCountCreateInput, CashCountCreateResult> = {
  id: 'soanas_cash.counts.create',
  async execute(input, ctx) {
    const parsed = cashCountCreateSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()

    const counted = BigInt(parsed.totalCountedCents)
    const denominationCheck = validateDenominationsMatchAmount(parsed.denominations, counted)
    if (!denominationCheck.ok) {
      throw badRequest(
        translate(
          'soanas_cash.errors.denominations_mismatch',
          'Counted denominations do not match the declared amount',
        ),
      )
    }

    const countId = crypto.randomUUID()
    let blind = false
    let discrepancy = computeDiscrepancy({ expectedCents: 0n, countedCents: counted })

    await withAtomicFlush(
      em,
      [
        async () => {
          const session = await loadSessionForUpdate(em, {
            sessionId: parsed.sessionId,
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
          })
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
            countedCents: counted,
            toleranceCents: resolveDiscrepancyToleranceCents(register),
          })

          const now = new Date()
          em.persist(
            em.create(CashCount, {
              id: countId,
              tenantId: session.tenantId,
              organizationId: session.organizationId,
              sessionId: session.id,
              registerId: session.registerId,
              kind: parsed.kind,
              denominations: parsed.denominations ?? null,
              totalCountedCents: parsed.totalCountedCents,
              operatorUserId: parsed.operatorUserId,
              notes: parsed.notes ?? null,
              blindMode: blind,
              createdAt: now,
              updatedAt: now,
            }),
          )
        },
      ],
      { transaction: true, label: 'soanas_cash.counts.create' },
    )

    await emitSoanasCashEvent('soanas.cash.count.recorded', {
      id: countId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      sessionId: parsed.sessionId,
      kind: parsed.kind,
      totalCountedCents: parsed.totalCountedCents,
    })

    const revealExpected = !blind || (await callerCanApprove(ctx))
    return {
      countId,
      sessionId: parsed.sessionId,
      totalCountedCents: parsed.totalCountedCents,
      blind,
      ...(revealExpected
        ? {
            expectedCashCents: discrepancy.expectedCents.toString(),
            discrepancyCents: discrepancy.discrepancyCents.toString(),
          }
        : {}),
    }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(CashCount, { id: result.countId })
    if (!record) return null
    return {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      sessionId: record.sessionId,
      registerId: record.registerId,
      kind: record.kind,
      totalCountedCents: centsToWire(record.totalCountedCents),
      blindMode: record.blindMode,
    }
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as { id: string; tenantId: string; organizationId: string } | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_cash.audit.count_create', 'Record cash count'),
      resourceKind: 'soanas_cash.cash_count',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

registerCommand(createCountCommand)
