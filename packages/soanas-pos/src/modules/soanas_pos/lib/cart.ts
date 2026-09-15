import { addCents, clampToZero, multiplyCentsByQuantity, toCents } from './money'

export type CartLineInput = {
  id?: string
  quantity: string
  unitPriceCents: bigint | number | string
  discountAmountCents?: bigint | number | string | null
  surchargeAmountCents?: bigint | number | string | null
  taxAmountCents?: bigint | number | string | null
}

export type CartLineTotals = {
  grossCents: bigint
  discountAmountCents: bigint
  surchargeAmountCents: bigint
  taxAmountCents: bigint
  lineTotalCents: bigint
}

export type CartTotals = {
  subtotalCents: bigint
  discountTotalCents: bigint
  surchargeTotalCents: bigint
  taxTotalCents: bigint
  grandTotalCents: bigint
}

export type CartRecalculation = CartTotals & {
  lines: (CartLineTotals & { id?: string })[]
}

/**
 * A line total never goes below zero: a discount larger than the line gross is capped so a
 * single generous discount cannot turn the cart into a payout.
 */
export function recalculateLine(line: CartLineInput): CartLineTotals {
  const grossCents = multiplyCentsByQuantity(line.unitPriceCents, line.quantity)
  const requestedDiscount = clampToZero(line.discountAmountCents ?? 0n)
  const discountAmountCents = requestedDiscount > grossCents ? grossCents : requestedDiscount
  const surchargeAmountCents = clampToZero(line.surchargeAmountCents ?? 0n)
  const taxAmountCents = clampToZero(line.taxAmountCents ?? 0n)
  const lineTotalCents = grossCents - discountAmountCents + surchargeAmountCents
  return { grossCents, discountAmountCents, surchargeAmountCents, taxAmountCents, lineTotalCents }
}

export type CartDiscountInput = {
  /** Cart-level (not line-level) discount in centavos. */
  amountCents?: bigint | number | string | null
}

/**
 * Recalculates the whole cart from its lines. The server calls this on every mutation —
 * totals sent by a browser are never trusted.
 */
export function recalculateCart(lines: CartLineInput[], cartDiscount: CartDiscountInput = {}): CartRecalculation {
  const lineTotals = lines.map((line) => ({ id: line.id, ...recalculateLine(line) }))
  const subtotalCents = addCents(...lineTotals.map((line) => line.grossCents))
  const lineDiscountCents = addCents(...lineTotals.map((line) => line.discountAmountCents))
  const surchargeTotalCents = addCents(...lineTotals.map((line) => line.surchargeAmountCents))
  const taxTotalCents = addCents(...lineTotals.map((line) => line.taxAmountCents))
  const lineTotalSum = addCents(...lineTotals.map((line) => line.lineTotalCents))

  const requestedCartDiscount = clampToZero(cartDiscount.amountCents ?? 0n)
  const cartDiscountCents = requestedCartDiscount > lineTotalSum ? lineTotalSum : requestedCartDiscount

  const grandTotalCents = lineTotalSum - cartDiscountCents + taxTotalCents
  return {
    lines: lineTotals,
    subtotalCents,
    discountTotalCents: lineDiscountCents + cartDiscountCents,
    surchargeTotalCents,
    taxTotalCents,
    grandTotalCents: grandTotalCents < 0n ? 0n : grandTotalCents,
  }
}

/** Remaining amount due after the tenders already applied. */
export function remainingDueCents(
  grandTotalCents: bigint | number | string,
  amountPaidCents: bigint | number | string,
): bigint {
  return clampToZero(toCents(grandTotalCents) - toCents(amountPaidCents))
}
