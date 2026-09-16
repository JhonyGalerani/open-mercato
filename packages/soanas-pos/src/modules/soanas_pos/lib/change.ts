import { clampToZero, minCents, toCents } from './money'

export type CashTenderPlan = {
  /** Part of the received cash that settles the sale. */
  amountAppliedCents: bigint
  amountReceivedCents: bigint
  changeAmountCents: bigint
  remainingDueCents: bigint
  fullySettled: boolean
}

/**
 * Cash tender math: the applied amount is capped at what is still due, and everything
 * above it is change handed back to the customer.
 */
export function planCashTender(args: {
  grandTotalCents: bigint | number | string
  alreadyPaidCents?: bigint | number | string | null
  receivedCents: bigint | number | string
}): CashTenderPlan {
  const grandTotal = toCents(args.grandTotalCents)
  const alreadyPaid = clampToZero(args.alreadyPaidCents ?? 0n)
  const received = toCents(args.receivedCents)
  if (received <= 0n) {
    throw new Error('[internal] soanas_pos cash tender requires a positive received amount')
  }
  const due = clampToZero(grandTotal - alreadyPaid)
  const amountAppliedCents = minCents(due, received)
  const changeAmountCents = received - amountAppliedCents
  const remaining = due - amountAppliedCents
  return {
    amountAppliedCents,
    amountReceivedCents: received,
    changeAmountCents,
    remainingDueCents: remaining,
    fullySettled: remaining === 0n,
  }
}
