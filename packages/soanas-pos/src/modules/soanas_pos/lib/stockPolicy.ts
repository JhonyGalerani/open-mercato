import type { PosStockPolicy } from '../data/entities'
import { parseDecimal } from './money'

export type StockDecision = 'allow' | 'block' | 'warn'

export type StockEvaluation = {
  decision: StockDecision
  available: string
  requested: string
  shortfall: string
}

function compareDecimals(left: string, right: string): number {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  const scale = Math.max(a.scale, b.scale)
  const scaledA = a.value * 10n ** BigInt(scale - a.scale)
  const scaledB = b.value * 10n ** BigInt(scale - b.scale)
  if (scaledA === scaledB) return 0
  return scaledA > scaledB ? 1 : -1
}

function subtractDecimals(left: string, right: string): string {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  const scale = Math.max(a.scale, b.scale)
  const diff = a.value * 10n ** BigInt(scale - a.scale) - b.value * 10n ** BigInt(scale - b.scale)
  if (scale === 0) return diff.toString()
  const negative = diff < 0n
  const magnitude = (negative ? -diff : diff).toString().padStart(scale + 1, '0')
  const whole = magnitude.slice(0, magnitude.length - scale)
  const fraction = magnitude.slice(magnitude.length - scale)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/**
 * Decides whether a requested quantity may be sold. Quantities are decimal strings so a
 * 0.750 kg cheese sale is exact.
 */
export function evaluateStock(
  available: string | number,
  requested: string | number,
  policy: PosStockPolicy,
): StockEvaluation {
  const availableValue = String(available)
  const requestedValue = String(requested)
  const sufficient = compareDecimals(availableValue, requestedValue) >= 0
  const shortfall = sufficient ? '0' : subtractDecimals(requestedValue, availableValue)
  if (sufficient) {
    return { decision: 'allow', available: availableValue, requested: requestedValue, shortfall: '0' }
  }
  const decision: StockDecision = policy === 'ALLOW' ? 'allow' : policy === 'WARN' ? 'warn' : 'block'
  return { decision, available: availableValue, requested: requestedValue, shortfall }
}
