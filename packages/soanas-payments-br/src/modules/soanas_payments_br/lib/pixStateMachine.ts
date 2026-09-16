import type { PixChargeStatus } from './pixProvider'

/**
 * Allowed Pix lifecycle edges. Anything not listed here is a bug and is rejected
 * before it can reach the database. `UNKNOWN` is a recoverable state reached when a
 * PSP status check fails to classify the charge; it can resolve into any live state.
 */
export const PIX_TRANSITIONS: Record<PixChargeStatus, PixChargeStatus[]> = {
  CREATED: ['WAITING', 'CANCELLED', 'EXPIRED', 'UNKNOWN'],
  WAITING: ['PAID', 'EXPIRED', 'CANCELLED', 'UNKNOWN'],
  PAID: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  EXPIRED: [],
  CANCELLED: [],
  REFUNDED: [],
  UNKNOWN: ['WAITING', 'PAID', 'EXPIRED', 'CANCELLED'],
}

/** Statuses from which no further transition is possible. */
export const PIX_TERMINAL_STATES: PixChargeStatus[] = ['EXPIRED', 'CANCELLED', 'REFUNDED']

export function canTransition(from: PixChargeStatus, to: PixChargeStatus): boolean {
  return (PIX_TRANSITIONS[from] ?? []).includes(to)
}

export class PixTransitionError extends Error {
  readonly from: PixChargeStatus
  readonly to: PixChargeStatus

  constructor(from: PixChargeStatus, to: PixChargeStatus) {
    super(`[internal] soanas_payments_br illegal Pix transition ${from} -> ${to}`)
    this.name = 'PixTransitionError'
    this.from = from
    this.to = to
  }
}

export function assertTransition(from: PixChargeStatus, to: PixChargeStatus): void {
  if (from === to) return
  if (!canTransition(from, to)) throw new PixTransitionError(from, to)
}

export function isTerminalState(status: PixChargeStatus): boolean {
  return PIX_TERMINAL_STATES.includes(status)
}

/** Charges a payer can still pay against (never yet settled or closed out). */
export function isPayableState(status: PixChargeStatus): boolean {
  return status === 'CREATED' || status === 'WAITING'
}
