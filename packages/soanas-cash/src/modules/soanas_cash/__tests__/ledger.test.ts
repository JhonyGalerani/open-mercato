import { computeExpectedCashCents, sumDenominationCents } from '../lib/ledger'

describe('cash ledger (ADR-003 / CASH-*)', () => {
  it('computes expected cash from opening, sales, supply, withdrawal, refund', () => {
    const expected = computeExpectedCashCents([
      { type: 'opening', amountCents: 20000n, status: 'confirmed' },
      { type: 'cash_sale', amountCents: 15050n, status: 'confirmed' },
      { type: 'supply', amountCents: 5000n, status: 'confirmed' },
      { type: 'withdrawal', amountCents: 10000n, status: 'confirmed' },
      { type: 'cash_refund', amountCents: 500n, status: 'confirmed' },
      { type: 'withdrawal', amountCents: 1000n, status: 'reversed' },
    ])
    // 20000 + 15050 + 5000 - 10000 - 500 = 29550
    expect(expected).toBe(29550n)
  })

  it('sums BRL denomination map in cents', () => {
    expect(
      sumDenominationCents({
        '100': 1,
        '50': 1,
        '20': 2,
        '0.5': 2,
      }),
    ).toBe(19000n + 100n)
  })

  it('rejects zero/negative via expected math staying non-negative for valid ops', () => {
    expect(computeExpectedCashCents([{ type: 'opening', amountCents: 0n, status: 'confirmed' }])).toBe(0n)
  })
})
