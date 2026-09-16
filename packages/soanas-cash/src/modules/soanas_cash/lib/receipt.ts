export type CashMovementReceiptKind =
  | 'withdrawal'
  | 'supply'
  | 'opening'
  | 'closing'
  | 'reversal'
  | 'cash_sale'

export type CashMovementReceiptMerchant = {
  legalName?: string | null
  tradeName?: string | null
  cnpj?: string | null
  addressLine?: string | null
}

export type CashMovementReceiptLine = {
  label: string
  value: string
}

export type CashMovementReceipt = {
  version: 1
  kind: CashMovementReceiptKind
  /** Non-fiscal document: cash movement vouchers never replace an NFC-e. */
  fiscal: false
  movementId: string | null
  sessionId: string
  registerCode: string | null
  registerName: string | null
  amountCents: string
  issuedAt: string
  operatorUserId: string
  approverUserId: string | null
  merchant: CashMovementReceiptMerchant | null
  lines: CashMovementReceiptLine[]
  denominations: Record<string, number> | null
}

export type BuildCashMovementReceiptArgs = {
  kind: CashMovementReceiptKind
  movementId?: string | null
  sessionId: string
  registerCode?: string | null
  registerName?: string | null
  amountCents: bigint | string
  issuedAt?: Date
  operatorUserId: string
  approverUserId?: string | null
  merchant?: CashMovementReceiptMerchant | null
  denominations?: Record<string, number> | null
  extraLines?: CashMovementReceiptLine[]
}

export function formatCentsAsBrl(amountCents: bigint | string): string {
  const cents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents)
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  const units = magnitude / 100n
  const remainder = magnitude % 100n
  const fraction = remainder.toString().padStart(2, '0')
  return `${negative ? '-' : ''}${units.toString()},${fraction}`
}

/**
 * Abstract, renderer-agnostic voucher payload for a cash movement. Merchant fields are
 * optional so the cash domain stays decoupled from the fiscal establishment module.
 */
export function buildCashMovementReceipt(args: BuildCashMovementReceiptArgs): CashMovementReceipt {
  const issuedAt = args.issuedAt ?? new Date()
  const amountCents =
    typeof args.amountCents === 'bigint' ? args.amountCents.toString() : String(args.amountCents)

  const lines: CashMovementReceiptLine[] = [
    { label: 'amount', value: formatCentsAsBrl(amountCents) },
    { label: 'issuedAt', value: issuedAt.toISOString() },
    { label: 'operator', value: args.operatorUserId },
  ]
  if (args.approverUserId) lines.push({ label: 'approver', value: args.approverUserId })
  if (args.registerCode) lines.push({ label: 'register', value: args.registerCode })
  if (args.extraLines?.length) lines.push(...args.extraLines)

  return {
    version: 1,
    kind: args.kind,
    fiscal: false,
    movementId: args.movementId ?? null,
    sessionId: args.sessionId,
    registerCode: args.registerCode ?? null,
    registerName: args.registerName ?? null,
    amountCents,
    issuedAt: issuedAt.toISOString(),
    operatorUserId: args.operatorUserId,
    approverUserId: args.approverUserId ?? null,
    merchant: args.merchant ?? null,
    lines,
    denominations: args.denominations ?? null,
  }
}
