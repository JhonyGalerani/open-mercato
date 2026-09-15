import { sumDenominationCents } from './ledger'

export type DenominationValidation =
  | { ok: true; sumCents: bigint; provided: boolean }
  | { ok: false; sumCents: bigint; provided: true; expectedCents: bigint }

/**
 * A denomination map is optional; when supplied its face-value sum must equal the
 * declared amount to the centavo. Face keys are BRL units ("100", "0.5").
 */
export function validateDenominationsMatchAmount(
  denominations: Record<string, number> | null | undefined,
  expectedCents: bigint,
): DenominationValidation {
  if (!denominations || Object.keys(denominations).length === 0) {
    return { ok: true, sumCents: 0n, provided: false }
  }
  const sumCents = sumDenominationCents(denominations)
  if (sumCents !== expectedCents) {
    return { ok: false, sumCents, provided: true, expectedCents }
  }
  return { ok: true, sumCents, provided: true }
}

export { sumDenominationCents }
