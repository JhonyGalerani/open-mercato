export type LedgerMovementInput = {
  type: string
  amountCents: bigint
  status: string
}

/**
 * Expected cash in drawer (centavos) from confirmed movements.
 * opening + cash_sale + supply + other_in - withdrawal - cash_refund - other_out
 * Reversal rows carry compensating signed amounts and are included when confirmed.
 */
export function computeExpectedCashCents(movements: LedgerMovementInput[]): bigint {
  let total = 0n
  for (const movement of movements) {
    if (movement.status !== 'confirmed') continue
    const amount = movement.amountCents
    switch (movement.type) {
      case 'opening':
      case 'cash_sale':
      case 'supply':
      case 'other_in':
      case 'reversal':
        total += amount
        break
      case 'withdrawal':
      case 'cash_refund':
      case 'other_out':
        total -= absBigInt(amount)
        break
      default:
        break
    }
  }
  return total
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
