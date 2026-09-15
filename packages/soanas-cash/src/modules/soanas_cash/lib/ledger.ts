export type LedgerMovementInput = {
  type: string
  amountCents: bigint
  status: string
}

export type ReconciliationTotals = {
  openingCents: bigint
  salesCents: bigint
  suppliesCents: bigint
  withdrawalsCents: bigint
  refundsCents: bigint
  otherInCents: bigint
  otherOutCents: bigint
  reversalsCents: bigint
  expectedCashCents: bigint
}

export type DiscrepancyOutcome = 'matched' | 'within_tolerance' | 'discrepancy'

export type DiscrepancyResult = {
  expectedCents: bigint
  countedCents: bigint
  discrepancyCents: bigint
  toleranceCents: bigint
  outcome: DiscrepancyOutcome
}

/**
 * Expected cash in drawer (centavos) from confirmed movements.
 * opening + cash_sale + supply + other_in - withdrawal - cash_refund - other_out
 * Reversal rows carry compensating signed amounts and are included when confirmed.
 */
export function computeExpectedCashCents(movements: LedgerMovementInput[]): bigint {
  return buildReconciliationTotals(movements).expectedCashCents
}

/**
 * Rebuilds every ledger aggregate from zero over the confirmed movement set.
 * Never reads a stored balance — the ledger is the single source of truth (ADR-003).
 */
export function buildReconciliationTotals(movements: LedgerMovementInput[]): ReconciliationTotals {
  const totals: ReconciliationTotals = {
    openingCents: 0n,
    salesCents: 0n,
    suppliesCents: 0n,
    withdrawalsCents: 0n,
    refundsCents: 0n,
    otherInCents: 0n,
    otherOutCents: 0n,
    reversalsCents: 0n,
    expectedCashCents: 0n,
  }

  for (const movement of movements) {
    if (movement.status !== 'confirmed') continue
    const amount = movement.amountCents
    switch (movement.type) {
      case 'opening':
        totals.openingCents += amount
        totals.expectedCashCents += amount
        break
      case 'cash_sale':
        totals.salesCents += amount
        totals.expectedCashCents += amount
        break
      case 'supply':
        totals.suppliesCents += amount
        totals.expectedCashCents += amount
        break
      case 'other_in':
        totals.otherInCents += amount
        totals.expectedCashCents += amount
        break
      case 'reversal':
        totals.reversalsCents += amount
        totals.expectedCashCents += amount
        break
      case 'withdrawal':
        totals.withdrawalsCents += absBigInt(amount)
        totals.expectedCashCents -= absBigInt(amount)
        break
      case 'cash_refund':
        totals.refundsCents += absBigInt(amount)
        totals.expectedCashCents -= absBigInt(amount)
        break
      case 'other_out':
        totals.otherOutCents += absBigInt(amount)
        totals.expectedCashCents -= absBigInt(amount)
        break
      default:
        break
    }
  }

  return totals
}

/**
 * counted - expected. Negative means missing cash (quebra), positive means surplus (sobra).
 */
export function computeDiscrepancy(args: {
  expectedCents: bigint
  countedCents: bigint
  toleranceCents?: bigint
}): DiscrepancyResult {
  const tolerance = absBigInt(args.toleranceCents ?? 0n)
  const discrepancy = args.countedCents - args.expectedCents
  const magnitude = absBigInt(discrepancy)
  const outcome: DiscrepancyOutcome =
    magnitude === 0n ? 'matched' : magnitude <= tolerance ? 'within_tolerance' : 'discrepancy'
  return {
    expectedCents: args.expectedCents,
    countedCents: args.countedCents,
    discrepancyCents: discrepancy,
    toleranceCents: tolerance,
    outcome,
  }
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value
}

export function sumDenominationCents(denominations: Record<string, number> | null | undefined): bigint {
  if (!denominations) return 0n
  let total = 0n
  for (const [key, count] of Object.entries(denominations)) {
    if (!Number.isFinite(count) || count < 0) continue
    const face = Number(key)
    if (!Number.isFinite(face) || face <= 0) continue
    total += BigInt(Math.round(face * 100)) * BigInt(Math.trunc(count))
  }
  return total
}
