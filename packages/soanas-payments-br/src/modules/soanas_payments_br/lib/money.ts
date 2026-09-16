/**
 * Pix amounts are always an integer number of centavos carried as a bigint (in
 * memory) or as a decimal-free string (at rest and over the wire). Floats never
 * touch a total.
 */
export type Cents = bigint

const CENTS_PATTERN = /^-?\d+$/

export function toCents(value: bigint | number | string): Cents {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`[internal] soanas_payments_br money expects integer cents, received ${value}`)
    }
    return BigInt(value)
  }
  const trimmed = value.trim()
  if (!CENTS_PATTERN.test(trimmed)) {
    throw new Error(`[internal] soanas_payments_br money expects an integer cents string, received "${value}"`)
  }
  return BigInt(trimmed)
}

export function centsToString(value: bigint | number | string): string {
  return toCents(value).toString()
}

export function addCents(...values: (bigint | number | string)[]): Cents {
  return values.reduce<Cents>((sum, value) => sum + toCents(value), 0n)
}

export function subtractCents(minuend: bigint | number | string, subtrahend: bigint | number | string): Cents {
  return toCents(minuend) - toCents(subtrahend)
}

export function isPositiveCents(value: bigint | number | string): boolean {
  return toCents(value) > 0n
}
