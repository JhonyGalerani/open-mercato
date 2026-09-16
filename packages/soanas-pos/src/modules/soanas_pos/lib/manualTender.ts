import { clampToZero, toCents } from './money'

export const MANUAL_TENDER_TYPES = [
  'PIX_MANUAL',
  'DEBIT_MANUAL',
  'CREDIT_MANUAL',
  'VOUCHER_MANUAL',
  'STORE_CREDIT',
  'OTHER',
  // legacy aliases still accepted on the wire
  'PIX',
  'CARD_DEBIT',
  'CARD_CREDIT',
  'VOUCHER',
] as const

export type ManualTenderType = (typeof MANUAL_TENDER_TYPES)[number]

export function normalizeManualTenderType(type: string): ManualTenderType {
  switch (type) {
    case 'PIX':
      return 'PIX_MANUAL'
    case 'CARD_DEBIT':
      return 'DEBIT_MANUAL'
    case 'CARD_CREDIT':
      return 'CREDIT_MANUAL'
    case 'VOUCHER':
      return 'VOUCHER_MANUAL'
    default:
      return type as ManualTenderType
  }
}

/**
 * Non-cash manual tenders never generate change. Applied amount must be positive and
 * cannot exceed the remaining due.
 */
export function planManualTender(args: {
  grandTotalCents: bigint | number | string
  alreadyPaidCents?: bigint | number | string | null
  amountAppliedCents: bigint | number | string
}): {
  amountAppliedCents: bigint
  changeAmountCents: bigint
  remainingDueCents: bigint
  fullySettled: boolean
} {
  const grandTotal = toCents(args.grandTotalCents)
  const alreadyPaid = clampToZero(args.alreadyPaidCents ?? 0n)
  const applied = toCents(args.amountAppliedCents)
  if (applied <= 0n) {
    throw new Error('[internal] soanas_pos manual tender requires a positive applied amount')
  }
  const due = clampToZero(grandTotal - alreadyPaid)
  if (applied > due) {
    throw new Error('[internal] soanas_pos manual tender exceeds remaining due')
  }
  const remaining = due - applied
  return {
    amountAppliedCents: applied,
    changeAmountCents: 0n,
    remainingDueCents: remaining,
    fullySettled: remaining === 0n,
  }
}

export function sumAppliedTenders(
  tenders: Array<{ amountAppliedCents: string | number | bigint; status: string }>,
): bigint {
  return tenders
    .filter((tender) => tender.status === 'captured' || tender.status === 'captured_manual')
    .reduce((sum, tender) => sum + toCents(tender.amountAppliedCents), 0n)
}
