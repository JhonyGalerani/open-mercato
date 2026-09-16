/**
 * Brazilian Pix lifecycle status (Bacen "cobrança" model plus the states this saga
 * needs for reconciliation). Never widen this union without updating
 * `pixStateMachine.ts` in the same change.
 */
export type PixChargeStatus =
  | 'CREATED'
  | 'WAITING'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'UNKNOWN'

export type CreatePixChargeInput = {
  tenantId: string
  organizationId: string
  amountCents: string
  description?: string | null
  payerDocument?: string | null
  payerName?: string | null
  expiresInSeconds?: number
  idempotencyKey?: string | null
}

export type CreatePixChargeOutput = {
  txid: string
  qrCode: string
  copiaECola: string
  expiresAt: Date
  status: PixChargeStatus
}

export type GetPixChargeOutput = {
  txid: string
  status: PixChargeStatus
  e2eId?: string | null
  paidAt?: Date | null
}

export type CancelPixChargeOutput = {
  txid: string
  status: PixChargeStatus
}

export type RefundPixChargeInput = {
  txid: string
  amountCents?: string
  reason?: string
}

export type RefundPixChargeOutput = {
  refundId: string
  status: PixChargeStatus
}

export type PixWebhookResult = {
  txid: string
  status: PixChargeStatus
  e2eId?: string | null
}

/**
 * Port every Pix PSP adapter (mock, real gateway) must implement. Commands and API
 * routes only ever depend on this interface — never on a concrete provider — so the
 * mock can be swapped for a real PSP through the `soanas.payments.pixProvider` DI key
 * without touching the saga.
 */
export interface PixProvider {
  createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput>
  getCharge(txid: string): Promise<GetPixChargeOutput>
  cancelCharge(txid: string): Promise<CancelPixChargeOutput>
  refundCharge(input: RefundPixChargeInput): Promise<RefundPixChargeOutput>
  getPaymentStatus(txid: string): Promise<PixChargeStatus>
  handleWebhook(payload: unknown): Promise<PixWebhookResult>
}
