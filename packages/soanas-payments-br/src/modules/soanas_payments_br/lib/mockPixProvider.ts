import { randomUUID } from 'node:crypto'
import { assertTransition } from './pixStateMachine'
import { addCents, subtractCents, toCents } from './money'
import type {
  CancelPixChargeOutput,
  CreatePixChargeInput,
  CreatePixChargeOutput,
  GetPixChargeOutput,
  PixChargeStatus,
  PixProvider,
  PixWebhookResult,
  RefundPixChargeInput,
  RefundPixChargeOutput,
} from './pixProvider'

const DEFAULT_EXPIRES_IN_SECONDS = 3600

type MockRefund = {
  refundId: string
  amountCents: string
  reason: string | null
  createdAt: Date
}

type MockCharge = {
  txid: string
  amountCents: string
  status: PixChargeStatus
  e2eId: string | null
  paidAt: Date | null
  expiresAt: Date
  refunds: MockRefund[]
  processedWebhookKeys: Set<string>
}

function generateTxid(): string {
  return randomUUID().replace(/-/g, '').slice(0, 26)
}

/**
 * Fake BR Code EMV payload. Real payloads are CRC16-signed and PSP-issued; this is
 * a deterministic-looking placeholder good enough to render a QR / "copia e cola"
 * string in dev and tests, never a real acquirer format.
 */
function buildBrCode(txid: string, amountCents: string): string {
  const amount = (Number(BigInt(amountCents)) / 100).toFixed(2)
  return `00020126580014BR.GOV.BCB.PIX0136${txid}5204000053039865${amount.length
    .toString()
    .padStart(2, '0')}${amount}5802BR6304MOCK`
}

function isPixWebhookPayload(value: unknown): value is { txid: string; status: PixChargeStatus; e2eId?: string | null } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.txid === 'string' && typeof candidate.status === 'string'
}

/**
 * In-memory Pix adapter used as the default `soanas.payments.pixProvider` binding
 * (dev/test). Every instance owns its own store, so tests get full isolation by
 * constructing a fresh `MockPixProvider()` per case.
 */
export class MockPixProvider implements PixProvider {
  private readonly charges = new Map<string, MockCharge>()

  async createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
    const txid = generateTxid()
    const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000)
    const qrCode = buildBrCode(txid, input.amountCents)
    const charge: MockCharge = {
      txid,
      amountCents: toCents(input.amountCents).toString(),
      status: 'WAITING',
      e2eId: null,
      paidAt: null,
      expiresAt,
      refunds: [],
      processedWebhookKeys: new Set(),
    }
    this.charges.set(txid, charge)
    return {
      txid,
      qrCode,
      copiaECola: qrCode,
      expiresAt,
      status: charge.status,
    }
  }

  private requireCharge(txid: string): MockCharge {
    const charge = this.charges.get(txid)
    if (!charge) {
      throw new Error(`[internal] soanas_payments_br mock Pix charge not found: ${txid}`)
    }
    return charge
  }

  private applyLazyExpiry(charge: MockCharge): void {
    if ((charge.status === 'CREATED' || charge.status === 'WAITING') && Date.now() > charge.expiresAt.getTime()) {
      charge.status = 'EXPIRED'
    }
  }

  async getCharge(txid: string): Promise<GetPixChargeOutput> {
    const charge = this.requireCharge(txid)
    this.applyLazyExpiry(charge)
    return {
      txid: charge.txid,
      status: charge.status,
      e2eId: charge.e2eId,
      paidAt: charge.paidAt,
    }
  }

  async cancelCharge(txid: string): Promise<CancelPixChargeOutput> {
    const charge = this.requireCharge(txid)
    this.applyLazyExpiry(charge)
    if (charge.status === 'CANCELLED') {
      return { txid: charge.txid, status: charge.status }
    }
    assertTransition(charge.status, 'CANCELLED')
    charge.status = 'CANCELLED'
    return { txid: charge.txid, status: charge.status }
  }

  async refundCharge(input: RefundPixChargeInput): Promise<RefundPixChargeOutput> {
    const charge = this.requireCharge(input.txid)
    if (charge.status !== 'PAID' && charge.status !== 'PARTIALLY_REFUNDED') {
      throw new Error(
        `[internal] soanas_payments_br cannot refund a Pix charge in status ${charge.status}`,
      )
    }
    const alreadyRefunded = charge.refunds.reduce((sum, refund) => addCents(sum, refund.amountCents), 0n)
    const remaining = subtractCents(charge.amountCents, alreadyRefunded)
    const requested = input.amountCents ? toCents(input.amountCents) : remaining
    if (requested <= 0n || requested > remaining) {
      throw new Error(
        `[internal] soanas_payments_br refund amount out of range: requested=${requested} remaining=${remaining}`,
      )
    }
    const refundId = randomUUID()
    charge.refunds.push({
      refundId,
      amountCents: requested.toString(),
      reason: input.reason ?? null,
      createdAt: new Date(),
    })
    const nextStatus: PixChargeStatus = requested === remaining ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
    assertTransition(charge.status, nextStatus)
    charge.status = nextStatus
    return { refundId, status: charge.status }
  }

  async getPaymentStatus(txid: string): Promise<PixChargeStatus> {
    const charge = this.requireCharge(txid)
    this.applyLazyExpiry(charge)
    return charge.status
  }

  /**
   * Idempotent: the same webhook delivered twice (same txid + status + e2eId) is a
   * no-op the second time — required for at-least-once PSP delivery.
   */
  async handleWebhook(payload: unknown): Promise<PixWebhookResult> {
    if (!isPixWebhookPayload(payload)) {
      throw new Error('[internal] soanas_payments_br invalid Pix webhook payload')
    }
    const charge = this.requireCharge(payload.txid)
    const dedupeKey = `${payload.status}:${payload.e2eId ?? ''}`
    if (charge.processedWebhookKeys.has(dedupeKey)) {
      return { txid: charge.txid, status: charge.status, e2eId: charge.e2eId }
    }
    if (charge.status !== payload.status) {
      assertTransition(charge.status, payload.status)
      charge.status = payload.status
    }
    if (payload.status === 'PAID') {
      charge.e2eId = payload.e2eId ?? charge.e2eId
      charge.paidAt = charge.paidAt ?? new Date()
    }
    charge.processedWebhookKeys.add(dedupeKey)
    return { txid: charge.txid, status: charge.status, e2eId: charge.e2eId }
  }
}
