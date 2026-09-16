import { centsToWire, nullableCentsToWire } from '../lib/cents'

describe('centsToWire', () => {
  it('serializes runtime bigint without throwing', () => {
    expect(centsToWire(8250n)).toBe('8250')
    expect(JSON.stringify({ amount: centsToWire(8250n) })).toBe('{"amount":"8250"}')
  })

  it('passes through decimal-free strings', () => {
    expect(centsToWire('28250')).toBe('28250')
    expect(nullableCentsToWire(null)).toBeNull()
  })
})
