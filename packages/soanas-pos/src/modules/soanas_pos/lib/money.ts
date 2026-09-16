/**
 * POS money is always an integer number of centavos carried as a bigint (in memory)
 * or as a decimal-free string (at rest and over the wire). Floats never touch a total.
 */
export type Cents = bigint

const CENTS_PATTERN = /^-?\d+$/
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

export function toCents(value: bigint | number | string): Cents {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`[internal] soanas_pos money expects integer cents, received ${value}`)
    }
    return BigInt(value)
  }
  const trimmed = value.trim()
  if (!CENTS_PATTERN.test(trimmed)) {
    throw new Error(`[internal] soanas_pos money expects an integer cents string, received "${value}"`)
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

export function maxCents(a: bigint | number | string, b: bigint | number | string): Cents {
  const left = toCents(a)
  const right = toCents(b)
  return left > right ? left : right
}

export function minCents(a: bigint | number | string, b: bigint | number | string): Cents {
  const left = toCents(a)
  const right = toCents(b)
  return left < right ? left : right
}

export function clampToZero(value: bigint | number | string): Cents {
  const cents = toCents(value)
  return cents < 0n ? 0n : cents
}

/**
 * Parses a decimal quantity string into a scaled integer plus its scale so quantity math
 * stays exact. `2.5` becomes `{ value: 25n, scale: 1 }`.
 */
export function parseDecimal(value: string | number): { value: bigint; scale: number } {
  const raw = typeof value === 'number' ? String(value) : value.trim()
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new Error(`[internal] soanas_pos expects a decimal string, received "${value}"`)
  }
  const [whole, fraction = ''] = raw.split('.')
  const digits = `${whole}${fraction}`
  return { value: BigInt(digits), scale: fraction.length }
}

/**
 * Multiplies a cents amount by a decimal quantity and rounds half-up to the nearest cent.
 * This is the single rounding point of the cart, so line totals always sum to the cart total.
 */
export function multiplyCentsByQuantity(unitPriceCents: bigint | number | string, quantity: string | number): Cents {
  const price = toCents(unitPriceCents)
  const { value, scale } = parseDecimal(quantity)
  if (scale === 0) return price * value
  const divisor = 10n ** BigInt(scale)
  const product = price * value
  const negative = product < 0n
  const magnitude = negative ? -product : product
  const rounded = (magnitude * 2n + divisor) / (divisor * 2n)
  return negative ? -rounded : rounded
}

/** Converts centavos into the 2-decimal string the Sales/WMS APIs expect ("8250" → "82.50"). */
export function centsToDecimalString(value: bigint | number | string): string {
  const cents = toCents(value)
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  const units = magnitude / 100n
  const fraction = (magnitude % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${units.toString()}.${fraction}`
}

/** Inverse of `centsToDecimalString`; rejects sub-cent precision instead of rounding silently. */
export function decimalStringToCents(value: string | number): Cents {
  const { value: scaled, scale } = parseDecimal(String(value))
  if (scale <= 2) return scaled * 10n ** BigInt(2 - scale)
  const divisor = 10n ** BigInt(scale - 2)
  if (scaled % divisor !== 0n) {
    throw new Error(`[internal] soanas_pos cannot represent "${value}" in whole cents`)
  }
  return scaled / divisor
}

export function formatCentsAsBrl(value: bigint | number | string): string {
  const cents = toCents(value)
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  const units = magnitude / 100n
  const fraction = (magnitude % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${units.toString()},${fraction}`
}
