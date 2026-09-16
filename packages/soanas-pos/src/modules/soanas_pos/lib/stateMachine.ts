import type { PosTransactionStatus } from '../data/entities'

/**
 * Allowed POS lifecycle edges (ADR-002/007). Anything not listed here is a bug and is
 * rejected before it can reach the database.
 */
export const POS_TRANSITIONS: Record<PosTransactionStatus, PosTransactionStatus[]> = {
  DRAFT: ['DRAFT', 'HELD', 'CHECKOUT', 'CANCELLED', 'CANCEL_PENDING'],
  HELD: ['DRAFT', 'CANCELLED'],
  CHECKOUT: ['DRAFT', 'PAYMENT_PENDING', 'CANCELLED', 'CANCEL_PENDING'],
  PAYMENT_PENDING: ['PAYMENT_PENDING', 'PAID', 'PAYMENT_UNKNOWN', 'CHECKOUT', 'CANCELLED', 'CANCEL_PENDING'],
  PAID: ['COMPLETING', 'CANCEL_PENDING'],
  COMPLETING: ['COMPLETED', 'FAILED_RECOVERABLE', 'SYNC_PENDING', 'PAYMENT_UNKNOWN'],
  COMPLETED: ['REVERSED'],
  REVERSED: [],
  PAYMENT_UNKNOWN: ['PAID', 'PAYMENT_PENDING', 'FAILED_RECOVERABLE', 'CANCEL_PENDING'],
  SYNC_PENDING: ['COMPLETING', 'COMPLETED', 'FAILED_RECOVERABLE'],
  CANCEL_PENDING: ['CANCELLED', 'FAILED_RECOVERABLE'],
  FAILED_RECOVERABLE: ['COMPLETING', 'CANCEL_PENDING', 'FAILED_RECOVERABLE'],
  CANCELLED: [],
}

/** Statuses from which no further transition is possible. */
export const POS_TERMINAL_STATES: PosTransactionStatus[] = ['COMPLETED', 'CANCELLED', 'REVERSED']

export function canTransition(from: PosTransactionStatus, to: PosTransactionStatus): boolean {
  return (POS_TRANSITIONS[from] ?? []).includes(to)
}

export class PosTransitionError extends Error {
  readonly from: PosTransactionStatus
  readonly to: PosTransactionStatus

  constructor(from: PosTransactionStatus, to: PosTransactionStatus) {
    super(`[internal] soanas_pos illegal transition ${from} -> ${to}`)
    this.name = 'PosTransitionError'
    this.from = from
    this.to = to
  }
}

export function assertTransition(from: PosTransactionStatus, to: PosTransactionStatus): void {
  if (!canTransition(from, to)) throw new PosTransitionError(from, to)
}

export function isTerminalState(status: PosTransactionStatus): boolean {
  return POS_TERMINAL_STATES.includes(status)
}

/** Statuses a sale can be mutated from (lines, discounts, customer). */
export function isEditableState(status: PosTransactionStatus): boolean {
  return status === 'DRAFT' || status === 'CHECKOUT'
}
