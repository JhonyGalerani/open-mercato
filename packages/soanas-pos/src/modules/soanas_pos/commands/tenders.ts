import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest, conflict, isUniqueViolation, notFound } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { PaymentTender } from '../data/entities'
import {
  posCashTenderSchema,
  posManualTenderSchema,
  posTenderRemoveSchema,
  type PosCashTenderInput,
  type PosManualTenderInput,
  type PosTenderRemoveInput,
} from '../data/validators'
import { planCashTender } from '../lib/change'
import { normalizeManualTenderType, planManualTender } from '../lib/manualTender'
import { emitSoanasPosEvent } from '../events'
import { forkEm, loadTransactionForUpdate, recalculateTransactionTotals, transitionTo } from './helpers'

type CashTenderResult = {
  tenderId: string
  amountAppliedCents: string
  changeAmountCents: string
  remainingDueCents: string
  status: string
}

type ManualTenderResult = CashTenderResult & { type: string }

async function findTenderByIdempotencyKey(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; idempotencyKey: string },
): Promise<PaymentTender | null> {
  return em.findOne(PaymentTender, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    idempotencyKey: scope.idempotencyKey,
  })
}

/**
 * Unique index is (tenant_id, idempotency_key). Cross-org collisions must conflict.
 * Same-org replay must also belong to the requested transaction.
 */
async function resolveIdempotentTenderOrConflict(
  em: EntityManager,
  scope: {
    tenantId: string
    organizationId: string
    transactionId: string
    idempotencyKey: string
  },
  conflictMessage: string,
): Promise<PaymentTender> {
  const sameOrg = await findTenderByIdempotencyKey(em, scope)
  if (sameOrg) {
    if (sameOrg.posTransactionId !== scope.transactionId) {
      throw conflict(conflictMessage)
    }
    return sameOrg
  }
  const otherOrg = await em.findOne(PaymentTender, {
    tenantId: scope.tenantId,
    idempotencyKey: scope.idempotencyKey,
  })
  if (otherOrg && otherOrg.organizationId !== scope.organizationId) {
    throw conflict(conflictMessage)
  }
  throw conflict(conflictMessage)
}

async function replayTenderResult(
  em: EntityManager,
  prior: PaymentTender,
  scope: { transactionId: string; tenantId: string; organizationId: string },
): Promise<CashTenderResult & { type?: string }> {
  if (prior.posTransactionId !== scope.transactionId) {
    const { translate } = await resolveTranslations()
    throw conflict(translate('soanas_pos.errors.duplicate_tender', 'Duplicate POS tender'))
  }
  const transaction = await loadTransactionForUpdate(em, {
    transactionId: scope.transactionId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  return {
    tenderId: prior.id,
    type: prior.type,
    amountAppliedCents: prior.amountAppliedCents,
    changeAmountCents: prior.changeAmountCents ?? '0',
    remainingDueCents: (
      BigInt(transaction.grandTotalCents) - BigInt(transaction.amountPaidCents)
    ).toString(),
    status: transaction.status,
  }
}

const addCashTenderCommand: CommandHandler<PosCashTenderInput, CashTenderResult> = {
  id: 'soanas_pos.transactions.add_tender_cash',
  async execute(input, ctx) {
    const parsed = posCashTenderSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()
    const idempotencyScope = {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      transactionId: parsed.transactionId,
      idempotencyKey: parsed.idempotencyKey,
    }

    const prior = await findTenderByIdempotencyKey(em, idempotencyScope)
    if (prior) {
      const replayed = await replayTenderResult(em, prior, idempotencyScope)
      return {
        tenderId: replayed.tenderId,
        amountAppliedCents: replayed.amountAppliedCents,
        changeAmountCents: replayed.changeAmountCents,
        remainingDueCents: replayed.remainingDueCents,
        status: replayed.status,
      }
    }
    const crossOrg = await em.findOne(PaymentTender, {
      tenantId: parsed.tenantId,
      idempotencyKey: parsed.idempotencyKey,
    })
    if (crossOrg && crossOrg.organizationId !== parsed.organizationId) {
      throw conflict(
        translate(
          'soanas_pos.errors.idempotency_org_mismatch',
          'Idempotency key already used by another organization',
        ),
      )
    }

    const tenderId = crypto.randomUUID()
    let result: CashTenderResult = {
      tenderId,
      amountAppliedCents: '0',
      changeAmountCents: '0',
      remainingDueCents: '0',
      status: 'PAYMENT_PENDING',
    }

    try {
      await withAtomicFlush(
        em,
        [
          async () => {
            const transaction = await loadTransactionForUpdate(em, {
              transactionId: parsed.transactionId,
              tenantId: parsed.tenantId,
              organizationId: parsed.organizationId,
            })
            if (transaction.status !== 'PAYMENT_PENDING' && transaction.status !== 'CHECKOUT') {
              throw badRequest(
                translate(
                  'soanas_pos.errors.transaction_not_payable',
                  'This POS transaction is not accepting payments',
                ),
              )
            }
            await recalculateTransactionTotals(em, transaction)
            if (transaction.status === 'CHECKOUT') {
              await transitionTo(em, transaction, 'PAYMENT_PENDING', {
                trigger: 'soanas_pos.transactions.add_tender_cash',
                actorId: parsed.operatorUserId,
              })
            }

            const plan = planCashTender({
              grandTotalCents: transaction.grandTotalCents,
              alreadyPaidCents: transaction.amountPaidCents,
              receivedCents: parsed.amountReceivedCents,
            })

            const now = new Date()
            em.persist(
              em.create(PaymentTender, {
                id: tenderId,
                posTransactionId: transaction.id,
                tenantId: transaction.tenantId,
                organizationId: transaction.organizationId,
                type: 'CASH',
                amountAppliedCents: plan.amountAppliedCents.toString(),
                amountReceivedCents: plan.amountReceivedCents.toString(),
                changeAmountCents: plan.changeAmountCents.toString(),
                status: 'captured',
                confirmedByUserId: parsed.operatorUserId,
                confirmedAt: now,
                idempotencyKey: parsed.idempotencyKey,
                createdAt: now,
                updatedAt: now,
              }),
            )

            transaction.amountPaidCents = (
              BigInt(transaction.amountPaidCents) + plan.amountAppliedCents
            ).toString()
            transaction.changeAmountCents = (
              BigInt(transaction.changeAmountCents) + plan.changeAmountCents
            ).toString()
            transaction.updatedAt = now

            if (plan.fullySettled) {
              await transitionTo(em, transaction, 'PAID', {
                trigger: 'soanas_pos.transactions.add_tender_cash',
                actorId: parsed.operatorUserId,
                metadata: { tenderId, amountAppliedCents: plan.amountAppliedCents.toString() },
              })
            }

            result = {
              tenderId,
              amountAppliedCents: plan.amountAppliedCents.toString(),
              changeAmountCents: plan.changeAmountCents.toString(),
              remainingDueCents: plan.remainingDueCents.toString(),
              status: transaction.status,
            }
          },
        ],
        { transaction: true, label: 'soanas_pos.transactions.add_tender_cash' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_pos_payment_tenders_idempotency_unique')) {
        const again = await resolveIdempotentTenderOrConflict(
          forkEm(ctx),
          idempotencyScope,
          translate('soanas_pos.errors.duplicate_tender', 'Duplicate POS tender'),
        )
        const transaction = await loadTransactionForUpdate(forkEm(ctx), {
          transactionId: parsed.transactionId,
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
        })
        return {
          tenderId: again.id,
          amountAppliedCents: again.amountAppliedCents,
          changeAmountCents: again.changeAmountCents ?? '0',
          remainingDueCents: (
            BigInt(transaction.grandTotalCents) - BigInt(transaction.amountPaidCents)
          ).toString(),
          status: transaction.status,
        }
      }
      throw err
    }

    await emitSoanasPosEvent('soanas.pos.tender.added', {
      id: result.tenderId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      posTransactionId: parsed.transactionId,
      type: 'CASH',
      amountAppliedCents: result.amountAppliedCents,
    })
    return result
  },
}

const addManualTenderCommand: CommandHandler<PosManualTenderInput, ManualTenderResult> = {
  id: 'soanas_pos.transactions.add_tender_manual',
  async execute(input, ctx) {
    const parsed = posManualTenderSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()
    const tenderType = normalizeManualTenderType(parsed.type)
    const idempotencyScope = {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      transactionId: parsed.transactionId,
      idempotencyKey: parsed.idempotencyKey,
    }

    const prior = await findTenderByIdempotencyKey(em, idempotencyScope)
    if (prior) {
      const replayed = await replayTenderResult(em, prior, idempotencyScope)
      return {
        tenderId: replayed.tenderId,
        type: prior.type,
        amountAppliedCents: replayed.amountAppliedCents,
        changeAmountCents: '0',
        remainingDueCents: replayed.remainingDueCents,
        status: replayed.status,
      }
    }
    const crossOrg = await em.findOne(PaymentTender, {
      tenantId: parsed.tenantId,
      idempotencyKey: parsed.idempotencyKey,
    })
    if (crossOrg && crossOrg.organizationId !== parsed.organizationId) {
      throw conflict(
        translate(
          'soanas_pos.errors.idempotency_org_mismatch',
          'Idempotency key already used by another organization',
        ),
      )
    }

    const tenderId = crypto.randomUUID()
    let result: ManualTenderResult = {
      tenderId,
      type: tenderType,
      amountAppliedCents: '0',
      changeAmountCents: '0',
      remainingDueCents: '0',
      status: 'PAYMENT_PENDING',
    }

    try {
      await withAtomicFlush(
        em,
        [
          async () => {
            const transaction = await loadTransactionForUpdate(em, {
              transactionId: parsed.transactionId,
              tenantId: parsed.tenantId,
              organizationId: parsed.organizationId,
            })
            if (transaction.status !== 'PAYMENT_PENDING' && transaction.status !== 'CHECKOUT') {
              throw badRequest(
                translate(
                  'soanas_pos.errors.transaction_not_payable',
                  'This POS transaction is not accepting payments',
                ),
              )
            }
            await recalculateTransactionTotals(em, transaction)
            if (transaction.status === 'CHECKOUT') {
              await transitionTo(em, transaction, 'PAYMENT_PENDING', {
                trigger: 'soanas_pos.transactions.add_tender_manual',
                actorId: parsed.operatorUserId,
              })
            }

            let plan
            try {
              plan = planManualTender({
                grandTotalCents: transaction.grandTotalCents,
                alreadyPaidCents: transaction.amountPaidCents,
                amountAppliedCents: parsed.amountAppliedCents,
              })
            } catch {
              throw badRequest(
                translate(
                  'soanas_pos.errors.manual_tender_exceeds_due',
                  'Manual tender amount exceeds the remaining balance (non-cash tenders cannot generate change)',
                ),
              )
            }

            const now = new Date()
            em.persist(
              em.create(PaymentTender, {
                id: tenderId,
                posTransactionId: transaction.id,
                tenantId: transaction.tenantId,
                organizationId: transaction.organizationId,
                type: tenderType,
                amountAppliedCents: plan.amountAppliedCents.toString(),
                amountReceivedCents: plan.amountAppliedCents.toString(),
                changeAmountCents: '0',
                status: 'captured_manual',
                brand: parsed.brand ?? null,
                installments: parsed.installments ?? null,
                nsu: parsed.nsu ?? null,
                authorizationCode: parsed.authorizationCode ?? null,
                acquirer: parsed.acquirer ?? null,
                externalTerminal: parsed.externalTerminal ?? null,
                externalReference: parsed.externalReference ?? null,
                notes: parsed.notes ?? null,
                confirmedByUserId: parsed.operatorUserId,
                confirmedAt: now,
                idempotencyKey: parsed.idempotencyKey,
                createdAt: now,
                updatedAt: now,
              }),
            )

            transaction.amountPaidCents = (
              BigInt(transaction.amountPaidCents) + plan.amountAppliedCents
            ).toString()
            transaction.updatedAt = now

            if (plan.fullySettled) {
              await transitionTo(em, transaction, 'PAID', {
                trigger: 'soanas_pos.transactions.add_tender_manual',
                actorId: parsed.operatorUserId,
                metadata: {
                  tenderId,
                  type: tenderType,
                  amountAppliedCents: plan.amountAppliedCents.toString(),
                },
              })
            }

            result = {
              tenderId,
              type: tenderType,
              amountAppliedCents: plan.amountAppliedCents.toString(),
              changeAmountCents: '0',
              remainingDueCents: plan.remainingDueCents.toString(),
              status: transaction.status,
            }
          },
        ],
        { transaction: true, label: 'soanas_pos.transactions.add_tender_manual' },
      )
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_pos_payment_tenders_idempotency_unique')) {
        const again = await resolveIdempotentTenderOrConflict(
          forkEm(ctx),
          idempotencyScope,
          translate('soanas_pos.errors.duplicate_tender', 'Duplicate POS tender'),
        )
        const transaction = await loadTransactionForUpdate(forkEm(ctx), {
          transactionId: parsed.transactionId,
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
        })
        return {
          tenderId: again.id,
          type: again.type,
          amountAppliedCents: again.amountAppliedCents,
          changeAmountCents: '0',
          remainingDueCents: (
            BigInt(transaction.grandTotalCents) - BigInt(transaction.amountPaidCents)
          ).toString(),
          status: transaction.status,
        }
      }
      throw err
    }

    await emitSoanasPosEvent('soanas.pos.tender.added', {
      id: result.tenderId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      posTransactionId: parsed.transactionId,
      type: result.type,
      amountAppliedCents: result.amountAppliedCents,
    })
    return result
  },
}

const removeTenderCommand: CommandHandler<PosTenderRemoveInput, { tenderId: string; status: string }> = {
  id: 'soanas_pos.transactions.remove_tender',
  async execute(input, ctx) {
    const parsed = posTenderRemoveSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()
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
          if (!['CHECKOUT', 'PAYMENT_PENDING', 'PAID'].includes(transaction.status)) {
            throw badRequest(
              translate(
                'soanas_pos.errors.tender_not_removable',
                'Tenders can only be removed before the sale is completed',
              ),
            )
          }
          const tender = await em.findOne(PaymentTender, {
            id: parsed.tenderId,
            posTransactionId: transaction.id,
            tenantId: transaction.tenantId,
            organizationId: transaction.organizationId,
          })
          if (!tender) {
            throw notFound(translate('soanas_pos.errors.tender_not_found', 'Payment tender not found'))
          }
          if (tender.status === 'reversed' || tender.status === 'cancelled') {
            throw badRequest(
              translate('soanas_pos.errors.tender_already_inactive', 'This tender is already inactive'),
            )
          }

          const applied = BigInt(tender.amountAppliedCents)
          const change = BigInt(tender.changeAmountCents ?? '0')
          transaction.amountPaidCents = (BigInt(transaction.amountPaidCents) - applied).toString()
          if (change > 0n) {
            transaction.changeAmountCents = (BigInt(transaction.changeAmountCents) - change).toString()
          }
          if (BigInt(transaction.amountPaidCents) < 0n) transaction.amountPaidCents = '0'
          if (BigInt(transaction.changeAmountCents) < 0n) transaction.changeAmountCents = '0'
          transaction.updatedAt = new Date()

          em.remove(tender)

          if (transaction.status === 'PAID') {
            await transitionTo(em, transaction, 'PAYMENT_PENDING', {
              trigger: 'soanas_pos.transactions.remove_tender',
              actorId: parsed.operatorUserId,
              metadata: { tenderId: tender.id },
            })
          }
          status = transaction.status
        },
      ],
      { transaction: true, label: 'soanas_pos.transactions.remove_tender' },
    )

    return { tenderId: parsed.tenderId, status }
  },
}

registerCommand(addCashTenderCommand)
registerCommand(addManualTenderCommand)
registerCommand(removeTenderCommand)
