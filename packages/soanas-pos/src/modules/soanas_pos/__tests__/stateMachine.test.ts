import {
  assertTransition,
  canTransition,
  isEditableState,
  isTerminalState,
  POS_TRANSITIONS,
  PosTransitionError,
} from '../lib/stateMachine'

describe('soanas_pos state machine', () => {
  it('allows the happy retail path', () => {
    expect(canTransition('DRAFT', 'CHECKOUT')).toBe(true)
    expect(canTransition('CHECKOUT', 'PAYMENT_PENDING')).toBe(true)
    expect(canTransition('PAYMENT_PENDING', 'PAID')).toBe(true)
    expect(canTransition('PAID', 'COMPLETING')).toBe(true)
    expect(canTransition('COMPLETING', 'COMPLETED')).toBe(true)
  })

  it('allows the recovery path after a mid-saga failure', () => {
    expect(canTransition('COMPLETING', 'FAILED_RECOVERABLE')).toBe(true)
    expect(canTransition('FAILED_RECOVERABLE', 'COMPLETING')).toBe(true)
  })

  it('rejects illegal jumps', () => {
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false)
    expect(canTransition('DRAFT', 'PAID')).toBe(false)
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false)
    expect(canTransition('CANCELLED', 'DRAFT')).toBe(false)
    expect(canTransition('PAYMENT_PENDING', 'COMPLETED')).toBe(false)
  })

  it('throws a typed error on an illegal transition', () => {
    expect(() => assertTransition('COMPLETED', 'DRAFT')).toThrow(PosTransitionError)
    expect(() => assertTransition('PAID', 'COMPLETING')).not.toThrow()
  })

  it('knows terminal and editable states', () => {
    expect(isTerminalState('COMPLETED')).toBe(true)
    expect(isTerminalState('CANCELLED')).toBe(true)
    expect(isTerminalState('PAID')).toBe(false)
    expect(isEditableState('DRAFT')).toBe(true)
    expect(isEditableState('CHECKOUT')).toBe(true)
    expect(isEditableState('PAID')).toBe(false)
  })

  it('does not model FISCAL_PENDING yet', () => {
    expect(Object.keys(POS_TRANSITIONS)).not.toContain('FISCAL_PENDING')
  })
})
