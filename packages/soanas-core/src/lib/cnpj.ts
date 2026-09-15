/**
 * Brazilian CNPJ as alphanumeric string (NT 2026).
 * Never model CNPJ as a number.
 */

const CNPJ_ALPHANUM_RE = /^[0-9A-Za-z]{14}$/

export function normalizeCnpj(value: string): string {
  return value.replace(/[^0-9A-Za-z]/gi, '').toUpperCase()
}

export function isValidCnpjFormat(value: string): boolean {
  const normalized = normalizeCnpj(value)
  return CNPJ_ALPHANUM_RE.test(normalized)
}

/** Classic numeric CNPJ check digits (when all 14 chars are digits). */
export function isValidNumericCnpjChecksum(value: string): boolean {
  const digits = normalizeCnpj(value)
  if (!/^\d{14}$/.test(digits)) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, factor, index) => acc + Number(base[index]) * factor, 0)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = calc(digits.slice(0, 12) + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return digits.endsWith(`${d1}${d2}`)
}

export function isAcceptableCnpj(value: string): boolean {
  const normalized = normalizeCnpj(value)
  if (!isValidCnpjFormat(normalized)) return false
  if (/^\d{14}$/.test(normalized)) return isValidNumericCnpjChecksum(normalized)
  // Alphanumeric CNPJ (2026): format gate only until full alphabet checksum rules are published in TaxEngine.
  return true
}
