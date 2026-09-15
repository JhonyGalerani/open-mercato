import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest, conflict, isUniqueViolation } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PaymentTender } from '../data/entities'
import { posCashTenderSchema, type PosCashTenderInput } from '../data/validators'
import { planCashTender } from '../lib/change'
import { emitSoanasPosEvent } from '../events'
import { forkEm, loadTransactionForUpdate, recalculateTransactionTotals, transitionTo } from './helpers'

type CashTenderResult = {
  tenderId: string
  amountAppliedCents: string
  changeAmountCents: string
  remainingDueCents: string
  status: string
}

const addCashTenderCommand: CommandHandler<PosCashTenderInput, CashTenderResult> = {
  id: 'soanas_pos.transactions.add_tender_cash',
  async execute(input, ctx) {
    const parsed = posCashTenderSchema.parse(input)
    const em = forkEm(ctx)
    const { translate } = await resolveTranslations()

    const prior = await em.findOne(PaymentTender, {
      tenantId: parsed.tenantId,
      idempotencyKey: parsed.idempotencyKey,
    })
    if (prior) {
      const transaction = await loadTransactionForUpdate(em, {
        transactionId: parsed.transactionId,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
      })
      return {
        tenderId: prior.id,
        amountAppliedCents: prior.amountAppliedCents,
        changeAmountCents: prior.changeAmountCents ?? '0',
        remainingDueCents: (
          BigInt(transaction.grandTotalCents) - BigInt(transaction.amountPaidCents)
        ).toString(),
        status: transaction.status,
      }
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
            // Totals are recomputed from the lines so a tender can never settle a
            // browser-supplied amount.
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
        const again = await forkEm(ctx).findOne(PaymentTender, {
          tenantId: parsed.tenantId,
          idempotencyKey: parsed.idempotencyKey,
        })
        if (again) {
          return {
            tenderId: again.id,
            amountAppliedCents: again.amountAppliedCents,
            changeAmountCents: again.changeAmountCents ?? '0',
            remainingDueCents: '0',
            status: 'PAYMENT_PENDING',
          }
        }
        throw conflict(translate('soanas_pos.errors.duplicate_tender', 'Duplicate POS tender'))
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

registerCommand(addCashTenderCommand)
