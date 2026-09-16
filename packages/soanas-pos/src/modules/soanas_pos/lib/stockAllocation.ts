import { fromScaledQuantity, toScaledQuantity } from './quantity'

/**
 * Retail v1 multi-location consumption (ADR-008).
 *
 * WMS `inventory.adjust` is one location per call. Given several balance buckets
 * whose *aggregate* covers the sale, we must never overdraw a single location
 * (e.g. A=3, B=4, sale=5 must become B:-4 + A:-1, never B:-5).
 *
 * Strategy (deterministic):
 * 1. Prefer buckets with positive available qty (onHand − reserved − allocated).
 * 2. Sort by available desc, then locationId asc (stable tie-break).
 * 3. Greedily take min(remaining, available) from each bucket.
 * 4. If still short and `allowShortage` (stockPolicy ALLOW/WARN already approved),
 *    put the remainder on the first fallback location so the sale can still settle.
 */

export type StockBalanceBucket = {
  locationId: string
  quantityOnHand: string
  quantityReserved?: string | null
  quantityAllocated?: string | null
  lotId?: string | null
  serialNumber?: string | null
}

export type LocationDeduction = {
  locationId: string
  quantity: string
  lotId: string | null
  serialNumber: string | null
}

export type PlanLocationDeductionsResult = {
  deductions: LocationDeduction[]
  shortfall: string
}

function availableScaled(bucket: StockBalanceBucket): bigint {
  return (
    toScaledQuantity(bucket.quantityOnHand) -
    toScaledQuantity(bucket.quantityReserved) -
    toScaledQuantity(bucket.quantityAllocated)
  )
}

export function planLocationDeductions(args: {
  quantity: string
  balances: StockBalanceBucket[]
  fallbackLocationId?: string | null
  allowShortage?: boolean
}): PlanLocationDeductionsResult {
  let remaining = toScaledQuantity(args.quantity)
  if (remaining <= 0n) {
    return { deductions: [], shortfall: '0.0000' }
  }

  const positive = args.balances
    .map((bucket) => ({
      locationId: bucket.locationId,
      available: availableScaled(bucket),
      lotId: bucket.lotId ?? null,
      serialNumber: bucket.serialNumber ?? null,
    }))
    .filter((row) => row.locationId && row.available > 0n)
    .sort((left, right) => {
      if (left.available !== right.available) {
        return left.available > right.available ? -1 : 1
      }
      const byLocation = left.locationId.localeCompare(right.locationId)
      if (byLocation !== 0) return byLocation
      const byLot = (left.lotId ?? '').localeCompare(right.lotId ?? '')
      if (byLot !== 0) return byLot
      return (left.serialNumber ?? '').localeCompare(right.serialNumber ?? '')
    })

  const deductions: LocationDeduction[] = []
  for (const row of positive) {
    if (remaining <= 0n) break
    const take = row.available < remaining ? row.available : remaining
    deductions.push({
      locationId: row.locationId,
      quantity: fromScaledQuantity(take),
      lotId: row.lotId,
      serialNumber: row.serialNumber,
    })
    remaining -= take
  }

  if (remaining > 0n && args.allowShortage) {
    const fallback =
      args.fallbackLocationId ??
      positive[0]?.locationId ??
      args.balances.find((bucket) => bucket.locationId)?.locationId ??
      null
    if (fallback) {
      const existing = deductions.find((row) => row.locationId === fallback && !row.lotId && !row.serialNumber)
      if (existing) {
        existing.quantity = fromScaledQuantity(toScaledQuantity(existing.quantity) + remaining)
      } else {
        deductions.push({
          locationId: fallback,
          quantity: fromScaledQuantity(remaining),
          lotId: null,
          serialNumber: null,
        })
      }
      remaining = 0n
    }
  }

  return {
    deductions,
    shortfall: fromScaledQuantity(remaining < 0n ? 0n : remaining),
  }
}
