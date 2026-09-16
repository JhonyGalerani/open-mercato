import {
  addCents,
  centsToDecimalString,
  decimalStringToCents,
  formatCentsAsBrl,
  multiplyCentsByQuantity,
} from '../lib/money'

describe('soanas_pos money', () => {
  it('adds cents without float drift', () => {
    // 0.1 + 0.2 in reais is exactly 0.30 when handled as centavos.
    expect(addCents('10', '20').toString()).toBe('30')
    expect(centsToDecimalString(addCents('10', '20'))).toBe('0.30')
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('converts centavos to the decimal strings the Sales APIs expect', () => {
    expect(centsToDecimalString('8250')).toBe('82.50')
    expect(centsToDecimalString('5')).toBe('0.05')
    expect(centsToDecimalString('0')).toBe('0.00')
    expect(centsToDecimalString('-1750')).toBe('-17.50')
  })

  it('round-trips decimal strings back into centavos', () => {
    expect(decimalStringToCents('82.50').toString()).toBe('8250')
    expect(decimalStringToCents('0.1').toString()).toBe('10')
    expect(decimalStringToCents('3').toString()).toBe('300')
  })

  it('rejects sub-cent amounts instead of silently rounding', () => {
    expect(() => decimalStringToCents('1.005')).toThrow()
  })

  it('multiplies by decimal quantities with half-up rounding', () => {
    expect(multiplyCentsByQuantity('1000', '3').toString()).toBe('3000')
    expect(multiplyCentsByQuantity('1999', '0.5').toString()).toBe('1000')
    expect(multiplyCentsByQuantity('333', '0.333').toString()).toBe('111')
    expect(multiplyCentsByQuantity('1000', '2.75').toString()).toBe('2750')
  })

  it('rejects non-integer cents input', () => {
    expect(() => addCents(12.5 as unknown as number)).toThrow()
    expect(() => addCents('12.50')).toThrow()
  })

  it('formats BRL for receipts', () => {
    expect(formatCentsAsBrl('8250')).toBe('82,50')
    expect(formatCentsAsBrl('-5')).toBe('-0,05')
  })
})
