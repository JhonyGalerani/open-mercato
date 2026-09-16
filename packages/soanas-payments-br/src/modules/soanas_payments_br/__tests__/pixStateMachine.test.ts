import {
  assertTransition,
  canTransition,
  isPayableState,
  isTerminalState,
  PIX_TRANSITIONS,
  PixTransitionError,
} from '../lib/pixStateMachine'

describe('soanas_payments_br Pix state machine', () => {
  it('allows the happy charge path', () => {
    expect(canTransition('CREATED', 'WAITING')).toBe(true)
    expect(canTransition('WAITING', 'PAID')).toBe(true)
    expect(canTransition('PAID', 'REFUNDED')).toBe(true)
  })

  it('allows partial refunds before a full refund', () => {
    expect(canTransition('PAID', 'PARTIALLY_REFUNDED')).toBe(true)
    expect(canTransition('PARTIALLY_REFUNDED', 'PARTIALLY_REFUNDED')).toBe(true)
    expect(canTransition('PARTIALLY_REFUNDED', 'REFUNDED')).toBe(true)
  })

  it('allows expiry and cancellation while waiting for payment', () => {
    expect(canTransition('CREATED', 'CANCELLED')).toBe(true)
    expect(canTransition('CREATED', 'EXPIRED')).toBe(true)
    expect(canTransition('WAITING', 'EXPIRED')).toBe(true)
    expect(canTransition('WAITING', 'CANCELLED')).toBe(true)
  })

  it('allows UNKNOWN to resolve into any live state', () => {
    expect(canTransition('WAITING', 'UNKNOWN')).toBe(true)
    expect(canTransition('UNKNOWN', 'PAID')).toBe(true)
    expect(canTransition('UNKNOWN', 'WAITING')).toBe(true)
    expect(canTransition('UNKNOWN', 'CANCELLED')).toBe(true)
  })

  it('rejects illegal jumps', () => {
    expect(canTransition('CREATED', 'PAID')).toBe(false)
    expect(canTransition('CREATED', 'REFUNDED')).toBe(false)
    expect(canTransition('PAID', 'WAITING')).toBe(false)
    expect(canTransition('CANCELLED', 'WAITING')).toBe(false)
    expect(canTransition('EXPIRED', 'PAID')).toBe(false)
    expect(canTransition('REFUNDED', 'PAID')).toBe(false)
  })

  it('treats a same-state transition as a no-op, not an error', () => {
    expect(() => assertTransition('PAID', 'PAID')).not.toThrow()
    expect(() => assertTransition('CANCELLED', 'CANCELLED')).not.toThrow()
  })

  it('throws a typed error on an illegal transition', () => {
    expect(() => assertTransition('CANCELLED', 'PAID')).toThrow(PixTransitionError)
    expect(() => assertTransition('WAITING', 'PAID')).not.toThrow()
  })

  it('knows terminal and payable states', () => {
    expect(isTerminalState('EXPIRED')).toBe(true)
    expect(isTerminalState('CANCELLED')).toBe(true)
    expect(isTerminalState('REFUNDED')).toBe(true)
    expect(isTerminalState('PAID')).toBe(false)
    expect(isPayableState('CREATED')).toBe(true)
    expect(isPayableState('WAITING')).toBe(true)
    expect(isPayableState('PAID')).toBe(false)
  })

  it('never lets a terminal state transition anywhere', () => {
    for (const state of ['EXPIRED', 'CANCELLED', 'REFUNDED'] as const) {
      expect(PIX_TRANSITIONS[state]).toEqual([])
    }
  })
})
