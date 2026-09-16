import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { badRequest, conflict, isUniqueViolation } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PixCharge } from '../data/entities'
import {
  pixApplyWebhookSchema,
  pixCancelSchema,
  pixCreateSchema,
  pixGetSchema,
  pixRefundSchema,
  type PixApplyWebhookInput,
  type PixCancelInput,
  type PixCreateInput,
  type PixGetInput,
  type PixRefundInput,
} from '../data/validators'
import { emitSoanasPaymentsBrEvent } from '../events'
import { isPayableState } from '../lib/pixStateMachine'
import { forkEm, loadPixChargeOrThrow, resolvePixProvider } from './helpers'

export type PixChargeSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  terminalId: string | null
  posTransactionId: string | null
  salesOrderId: string | null
  txid: string
  status: string
  amountCents: string
  qrCode: string
  copiaECola: string
  expiresAt: string
  e2eId: string | null
  paidAt: string | null
  provider: string
  updatedAt: string
}

function toSnapshot(record: PixCharge): PixChargeSnapshot {
  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    terminalId: record.terminalId ?? null,
    posTransactionId: record.posTransactionId ?? null,
    salesOrderId: record.salesOrderId ?? null,
    txid: record.txid,
    status: record.status,
    amountCents: record.amountCents,
    qrCode: record.qrCode,
    copiaECola: record.copiaECola,
    expiresAt: record.expiresAt.toISOString(),
    e2eId: record.e2eId ?? null,
    paidAt: record.paidAt ? record.paidAt.toISOString() : null,
    provider: record.provider,
    updatedAt: record.updatedAt.toISOString(),
  }
}

const createPixChargeCommand: CommandHandler<PixCreateInput, { chargeId: string; txid: string }> = {
  id: 'soanas_payments_br.pix.create',
  async execute(input, ctx) {
    const parsed = pixCreateSchema.parse(input)
    const em = forkEm(ctx)

    if (parsed.idempotencyKey) {
      const existing = await em.findOne(PixCharge, {
        tenantId: parsed.tenantId,
        idempotencyKey: parsed.idempotencyKey,
        deletedAt: null,
      })
      if (existing) return { chargeId: existing.id, txid: existing.txid }
    }

    const provider = resolvePixProvider(ctx)
    const charge = await provider.createCharge({
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      amountCents: parsed.amountCents,
      description: parsed.description ?? null,
      payerDocument: parsed.payerDocument ?? null,
      payerName: parsed.payerName ?? null,
      expiresInSeconds: parsed.expiresInSeconds,
      idempotencyKey: parsed.idempotencyKey ?? null,
    })

    const now = new Date()
    const record = em.create(PixCharge, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      terminalId: parsed.terminalId ?? null,
      posTransactionId: parsed.posTransactionId ?? null,
      salesOrderId: parsed.salesOrderId ?? null,
      txid: charge.txid,
      status: charge.status,
      amountCents: parsed.amountCents,
      qrCode: charge.qrCode,
      copiaECola: charge.copiaECola,
      expiresAt: charge.expiresAt,
      provider: 'mock',
      idempotencyKey: parsed.idempotencyKey ?? null,
      metadata: parsed.description ? { description: parsed.description } : null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    try {
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_payments_br.pix.create',
      })
    } catch (err) {
      if (isUniqueViolation(err, 'soanas_payments_br_pix_charges_txid_unique')) {
        const { translate } = await resolveTranslations()
        throw conflict(translate('soanas_payments_br.errors.txid_taken', 'A Pix charge with this txid already exists'))
      }
      throw err
    }

    await emitSoanasPaymentsBrEvent('soanas.payments.pix.created', {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      txid: record.txid,
    })

    return { chargeId: record.id, txid: record.txid }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = forkEm(ctx)
    const record = await em.findOne(PixCharge, { id: result.chargeId, deletedAt: null })
    return record ? toSnapshot(record) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as PixChargeSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('soanas_payments_br.audit.pix_create', 'Create Pix charge'),
      resourceKind: 'soanas_payments_br.pix_charge',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
    }
  },
}

const getPixChargeCommand: CommandHandler<PixGetInput, PixChargeSnapshot> = {
  id: 'soanas_payments_br.pix.get',
  async execute(input, ctx) {
    const parsed = pixGetSchema.parse(input)
    const em = forkEm(ctx)
    const charge = await loadPixChargeOrThrow(em, { tenantId: parsed.tenantId, txid: parsed.txid })

    const provider = resolvePixProvider(ctx)
    const remoteStatus = await provider.getPaymentStatus(charge.txid)
    if (remoteStatus !== charge.status) {
      charge.status = remoteStatus
      charge.updatedAt = new Date()
      await withAtomicFlush(em, [() => undefined], {
        transaction: true,
        label: 'soanas_payments_br.pix.get',
      })
      if (remoteStatus === 'EXPIRED') {
        await emitSoanasPaymentsBrEvent('soanas.payments.pix.expired', {
          id: charge.id,
          tenantId: charge.tenantId,
          organizationId: charge.organizationId,
          txid: charge.txid,
        })
      }
    }
    return toSnapshot(charge)
  },
}

const cancelPixChargeCommand: CommandHandler<PixCancelInput, { chargeId: string; status: string }> = {
  id: 'soanas_payments_br.pix.cancel',
  async execute(input, ctx) {
    const parsed = pixCancelSchema.parse(input)
    const em = forkEm(ctx)
    const charge = await loadPixChargeOrThrow(em, { tenantId: parsed.tenantId, txid: parsed.txid })

    if (charge.status === 'CANCELLED') {
      return { chargeId: charge.id, status: charge.status }
    }
    if (!isPayableState(charge.status)) {
      const { translate } = await resolveTranslations()
      throw badRequest(
        translate(
          'soanas_payments_br.errors.cancel_not_payable',
          'Only a Pix charge waiting for payment can be cancelled',
        ),
      )
    }

    const provider = resolvePixProvider(ctx)
    const cancelled = await provider.cancelCharge(charge.txid)
    charge.status = cancelled.status
    charge.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_payments_br.pix.cancel',
    })

    await emitSoanasPaymentsBrEvent('soanas.payments.pix.cancelled', {
      id: charge.id,
      tenantId: charge.tenantId,
      organizationId: charge.organizationId,
      txid: charge.txid,
    })

    return { chargeId: charge.id, status: charge.status }
  },
}

const refundPixChargeCommand: CommandHandler<PixRefundInput, { chargeId: string; refundId: string; status: string }> = {
  id: 'soanas_payments_br.pix.refund',
  async execute(input, ctx) {
    const parsed = pixRefundSchema.parse(input)
    const em = forkEm(ctx)
    const charge = await loadPixChargeOrThrow(em, { tenantId: parsed.tenantId, txid: parsed.txid })

    if (charge.status !== 'PAID' && charge.status !== 'PARTIALLY_REFUNDED') {
      const { translate } = await resolveTranslations()
      throw badRequest(
        translate('soanas_payments_br.errors.refund_not_paid', 'Only a paid Pix charge can be refunded'),
      )
    }

    const provider = resolvePixProvider(ctx)
    const refunded = await provider.refundCharge({
      txid: charge.txid,
      amountCents: parsed.amountCents,
      reason: parsed.reason ?? undefined,
    })
    charge.status = refunded.status
    charge.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_payments_br.pix.refund',
    })

    await emitSoanasPaymentsBrEvent('soanas.payments.pix.refunded', {
      id: charge.id,
      tenantId: charge.tenantId,
      organizationId: charge.organizationId,
      txid: charge.txid,
    })

    return { chargeId: charge.id, refundId: refunded.refundId, status: charge.status }
  },
}

const applyPixWebhookCommand: CommandHandler<PixApplyWebhookInput, { chargeId: string; status: string; applied: boolean }> = {
  id: 'soanas_payments_br.pix.apply_webhook',
  async execute(input, ctx) {
    const parsed = pixApplyWebhookSchema.parse(input)
    const em = forkEm(ctx)
    const charge = await loadPixChargeOrThrow(em, { tenantId: parsed.tenantId, txid: parsed.payload.txid })

    const previousStatus = charge.status
    const previousE2eId = charge.e2eId ?? null

    const provider = resolvePixProvider(ctx)
    const result = await provider.handleWebhook(parsed.payload)

    const alreadyApplied = previousStatus === result.status && previousE2eId === (result.e2eId ?? null)
    if (alreadyApplied) {
      return { chargeId: charge.id, status: charge.status, applied: false }
    }

    charge.status = result.status
    if (result.status === 'PAID') {
      charge.e2eId = result.e2eId ?? charge.e2eId
      charge.paidAt = charge.paidAt ?? new Date()
    }
    charge.updatedAt = new Date()
    await withAtomicFlush(em, [() => undefined], {
      transaction: true,
      label: 'soanas_payments_br.pix.apply_webhook',
    })

    const eventPayload = {
      id: charge.id,
      tenantId: charge.tenantId,
      organizationId: charge.organizationId,
      txid: charge.txid,
    }
    if (result.status === 'PAID') {
      await emitSoanasPaymentsBrEvent('soanas.payments.pix.paid', eventPayload)
    } else if (result.status === 'EXPIRED') {
      await emitSoanasPaymentsBrEvent('soanas.payments.pix.expired', eventPayload)
    } else if (result.status === 'CANCELLED') {
      await emitSoanasPaymentsBrEvent('soanas.payments.pix.cancelled', eventPayload)
    } else if (result.status === 'REFUNDED') {
      await emitSoanasPaymentsBrEvent('soanas.payments.pix.refunded', eventPayload)
    }

    return { chargeId: charge.id, status: charge.status, applied: true }
  },
}

registerCommand(createPixChargeCommand)
registerCommand(getPixChargeCommand)
registerCommand(cancelPixChargeCommand)
registerCommand(refundPixChargeCommand)
registerCommand(applyPixWebhookCommand)
