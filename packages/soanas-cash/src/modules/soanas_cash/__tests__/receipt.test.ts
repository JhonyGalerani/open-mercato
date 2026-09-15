import { buildCashMovementReceipt, formatCentsAsBrl } from '../lib/receipt'

const baseArgs = {
  kind: 'withdrawal' as const,
  movementId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  amountCents: 25000n,
  issuedAt: new Date('2026-09-15T12:00:00.000Z'),
  operatorUserId: '33333333-3333-4333-8333-333333333333',
}

describe('formatCentsAsBrl', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatCentsAsBrl(0n)).toBe('0,00')
    expect(formatCentsAsBrl(5n)).toBe('0,05')
    expect(formatCentsAsBrl(25000n)).toBe('250,00')
    expect(formatCentsAsBrl('100000000')).toBe('1000000,00')
  })

  it('keeps the sign of a negative compensation', () => {
    expect(formatCentsAsBrl(-2500n)).toBe('-25,00')
  })
})

describe('buildCashMovementReceipt', () => {
  it('builds a non-fiscal voucher with the core lines', () => {
    const receipt = buildCashMovementReceipt(baseArgs)
    expect(receipt.version).toBe(1)
    expect(receipt.fiscal).toBe(false)
    expect(receipt.kind).toBe('withdrawal')
    expect(receipt.amountCents).toBe('25000')
    expect(receipt.issuedAt).toBe('2026-09-15T12:00:00.000Z')
    expect(receipt.lines).toEqual([
      { label: 'amount', value: '250,00' },
      { label: 'issuedAt', value: '2026-09-15T12:00:00.000Z' },
      { label: 'operator', value: baseArgs.operatorUserId },
    ])
  })

  it('leaves merchant data null when the caller does not supply it', () => {
    expect(buildCashMovementReceipt(baseArgs).merchant).toBeNull()
  })

  it('carries merchant, approver, register and extra lines when provided', () => {
    const receipt = buildCashMovementReceipt({
      ...baseArgs,
      registerCode: 'PDV-01',
      registerName: 'Front desk',
      approverUserId: '44444444-4444-4444-8444-444444444444',
      merchant: { legalName: 'Soanas LTDA', cnpj: '12ABC34501DE35' },
      denominations: { '100': 2, '50': 1 },
      extraLines: [{ label: 'destination', value: 'safe' }],
    })
    expect(receipt.merchant?.cnpj).toBe('12ABC34501DE35')
    expect(receipt.registerCode).toBe('PDV-01')
    expect(receipt.denominations).toEqual({ '100': 2, '50': 1 })
    expect(receipt.lines.map((line) => line.label)).toEqual([
      'amount',
      'issuedAt',
      'operator',
      'approver',
      'register',
      'destination',
    ])
  })
})
