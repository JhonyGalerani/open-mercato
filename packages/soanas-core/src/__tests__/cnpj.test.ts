import { isAcceptableCnpj, isValidCnpjFormat, normalizeCnpj, isValidNumericCnpjChecksum } from '../lib/cnpj'

describe('CNPJ validators (EST-003 / CAT fiscal)', () => {
  it('normalizes punctuation and lower-case', () => {
    expect(normalizeCnpj('12.345.678/0001-95')).toBe('12345678000195')
    expect(normalizeCnpj('ab.cde.fgh/ijkl-mn')).toBe('ABCDEFGHIJKLMN')
  })

  it('accepts 14-char alphanumeric format', () => {
    expect(isValidCnpjFormat('ABCDEFGHIJKLMN')).toBe(true)
    expect(isValidCnpjFormat('123')).toBe(false)
  })

  it('validates numeric checksum for classic CNPJ', () => {
    expect(isValidNumericCnpjChecksum('11222333000181')).toBe(true)
    expect(isValidNumericCnpjChecksum('11222333000180')).toBe(false)
  })

  it('accepts alphanumeric CNPJ by format (2026)', () => {
    expect(isAcceptableCnpj('12ABC34501DE35')).toBe(true)
  })
})
