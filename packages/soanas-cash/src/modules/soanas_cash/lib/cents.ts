/**
 * MikroORM `type: 'bigint'` columns may surface as runtime `bigint` even when the entity
 * field is typed as `string`. JSON responses and audit snapshots must never contain BigInt.
 */
export function centsToWire(value: unknown): string {
  if (value === null || value === undefined) return '0'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.trunc(value)) : '0'
  const raw = String(value).trim()
  if (!raw) return '0'
  return raw
}

export function nullableCentsToWire(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return centsToWire(value)
}
