/**
 * Quantities are decimal strings, never cents and never floats. Arithmetic runs on integers
 * scaled by `QUANTITY_SCALE` so summing cart lines stays exact.
 */
export const QUANTITY_SCALE = 4

const QUANTITY_PATTERN = /^-?\d+(\.\d+)?$/

export function toScaledQuantity(value: unknown): bigint {
  if (value === null || value === undefined) return 0n
  const raw = String(value).trim()
  if (!QUANTITY_PATTERN.test(raw)) return 0n
  const negative = raw.startsWith('-')
  const [whole, fraction = ''] = (negative ? raw.slice(1) : raw).split('.')
  const digits = `${whole}${fraction.padEnd(QUANTITY_SCALE, '0').slice(0, QUANTITY_SCALE)}`
  const magnitude = BigInt(digits)
  return negative ? -magnitude : magnitude
}

export function fromScaledQuantity(value: bigint): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(QUANTITY_SCALE + 1, '0')
  const whole = digits.slice(0, digits.length - QUANTITY_SCALE)
  const fraction = digits.slice(digits.length - QUANTITY_SCALE)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

export type StockDeductionLine = {
  id: string
  catalogVariantId?: string | null
  quantity: string
}

export type StockDeduction = {
  catalogVariantId: string
  quantity: string
  lineIds: string[]
}

/**
 * WMS derives its movement idempotency key from reference + variant + location + quantity, so
 * two cart lines of the same variant would collapse into a single deduction. Summing them per
 * variant up front issues one adjustment per variant and keeps a replay a genuine no-op.
 * Lines without a catalog variant (services, unmanaged SKUs) never reach WMS.
 */
export function planStockDeductions(lines: StockDeductionLine[]): StockDeduction[] {
  const scaledByVariant = new Map<string, bigint>()
  const lineIdsByVariant = new Map<string, string[]>()

  for (const line of lines) {
    const variantId = line.catalogVariantId
    if (!variantId) continue
    scaledByVariant.set(variantId, (scaledByVariant.get(variantId) ?? 0n) + toScaledQuantity(line.quantity))
    lineIdsByVariant.set(variantId, [...(lineIdsByVariant.get(variantId) ?? []), line.id])
  }

  const deductions: StockDeduction[] = []
  for (const [catalogVariantId, scaled] of scaledByVariant) {
    if (scaled <= 0n) continue
    deductions.push({
      catalogVariantId,
      quantity: fromScaledQuantity(scaled),
      lineIds: lineIdsByVariant.get(catalogVariantId) ?? [],
    })
  }
  return deductions
}
