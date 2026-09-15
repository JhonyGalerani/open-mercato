import {
  buildReconciliationTotals,
  computeDiscrepancy,
  computeExpectedCashCents,
  sumDenominationCents,
} from '../lib/ledger'

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

  it('rebuilds every aggregate from zero, ignoring reversed rows', () => {
    const totals = buildReconciliationTotals([
      { type: 'opening', amountCents: 10000n, status: 'confirmed' },
      { type: 'cash_sale', amountCents: 2500n, status: 'confirmed' },
      { type: 'cash_sale', amountCents: 9900n, status: 'reversed' },
      { type: 'supply', amountCents: 4000n, status: 'confirmed' },
      { type: 'withdrawal', amountCents: 3000n, status: 'confirmed' },
      { type: 'cash_refund', amountCents: 250n, status: 'confirmed' },
      { type: 'other_in', amountCents: 100n, status: 'confirmed' },
      { type: 'other_out', amountCents: 50n, status: 'confirmed' },
    ])
    expect(totals.openingCents).toBe(10000n)
    expect(totals.salesCents).toBe(2500n)
    expect(totals.suppliesCents).toBe(4000n)
    expect(totals.withdrawalsCents).toBe(3000n)
    expect(totals.refundsCents).toBe(250n)
    expect(totals.otherInCents).toBe(100n)
    expect(totals.otherOutCents).toBe(50n)
    expect(totals.expectedCashCents).toBe(13300n)
  })

  it('produces the same result whichever order the ledger rows arrive in', () => {
    const rows = [
      { type: 'opening', amountCents: 5000n, status: 'confirmed' },
      { type: 'cash_sale', amountCents: 1234n, status: 'confirmed' },
      { type: 'withdrawal', amountCents: 2000n, status: 'confirmed' },
      { type: 'supply', amountCents: 700n, status: 'confirmed' },
    ]
    const forward = computeExpectedCashCents(rows)
    const reversed = computeExpectedCashCents([...rows].reverse())
    expect(forward).toBe(reversed)
    expect(forward).toBe(4934n)
  })

  it('nets a reversal movement against the original it compensates', () => {
    const totals = buildReconciliationTotals([
      { type: 'opening', amountCents: 10000n, status: 'confirmed' },
      { type: 'withdrawal', amountCents: 2500n, status: 'reversed' },
      { type: 'reversal', amountCents: 2500n, status: 'confirmed' },
    ])
    expect(totals.expectedCashCents).toBe(12500n)
  })

  it('treats a reversal of an inflow as a negative compensation', () => {
    const totals = buildReconciliationTotals([
      { type: 'opening', amountCents: 10000n, status: 'confirmed' },
      { type: 'supply', amountCents: 3000n, status: 'reversed' },
      { type: 'reversal', amountCents: -3000n, status: 'confirmed' },
    ])
    expect(totals.expectedCashCents).toBe(7000n)
  })
})

describe('reconciliation discrepancy', () => {
  it('reports a perfect match', () => {
    const result = computeDiscrepancy({ expectedCents: 50000n, countedCents: 50000n, toleranceCents: 500n })
    expect(result.discrepancyCents).toBe(0n)
    expect(result.outcome).toBe('matched')
  })

  it('treats a shortage inside the tolerance as within_tolerance', () => {
    const result = computeDiscrepancy({ expectedCents: 50000n, countedCents: 49900n, toleranceCents: 500n })
    expect(result.discrepancyCents).toBe(-100n)
    expect(result.outcome).toBe('within_tolerance')
  })

  it('treats a surplus inside the tolerance as within_tolerance', () => {
    const result = computeDiscrepancy({ expectedCents: 50000n, countedCents: 50300n, toleranceCents: 500n })
    expect(result.discrepancyCents).toBe(300n)
    expect(result.outcome).toBe('within_tolerance')
  })

  it('flags a shortage beyond the tolerance as a discrepancy', () => {
    const result = computeDiscrepancy({ expectedCents: 50000n, countedCents: 48000n, toleranceCents: 500n })
    expect(result.discrepancyCents).toBe(-2000n)
    expect(result.outcome).toBe('discrepancy')
  })

  it('defaults to a zero tolerance', () => {
    const result = computeDiscrepancy({ expectedCents: 100n, countedCents: 101n })
    expect(result.toleranceCents).toBe(0n)
    expect(result.outcome).toBe('discrepancy')
  })
})
