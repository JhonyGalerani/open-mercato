import { addCents, centsToString, isPositiveCents, subtractCents, toCents } from '../lib/money'

describe('soanas_payments_br money', () => {
  it('parses cents strings and numbers as bigint', () => {
    expect(toCents('1050')).toBe(1050n)
    expect(toCents(1050)).toBe(1050n)
    expect(toCents(1050n)).toBe(1050n)
  })

  it('rejects non-integer numbers and malformed strings', () => {
    expect(() => toCents(10.5)).toThrow()
    expect(() => toCents('10.50')).toThrow()
    expect(() => toCents('abc')).toThrow()
  })

  it('adds and subtracts without floating point drift', () => {
    expect(addCents('1000', '250', 50n)).toBe(1300n)
    expect(subtractCents('1000', '250')).toBe(750n)
  })

  it('round-trips cents to string', () => {
    expect(centsToString(1050n)).toBe('1050')
    expect(centsToString('1050')).toBe('1050')
  })

  it('flags positive amounts', () => {
    expect(isPositiveCents('1')).toBe(true)
    expect(isPositiveCents('0')).toBe(false)
    expect(isPositiveCents('-5')).toBe(false)
  })
})
