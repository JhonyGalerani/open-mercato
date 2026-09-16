import { normalizeManualTenderType, planManualTender, sumAppliedTenders } from '../lib/manualTender'

describe('manual tender planning', () => {
  it('applies exact remaining due without change', () => {
    const plan = planManualTender({
      grandTotalCents: '10000',
      alreadyPaidCents: '4000',
      amountAppliedCents: '6000',
    })
    expect(plan.amountAppliedCents).toBe(6000n)
    expect(plan.changeAmountCents).toBe(0n)
    expect(plan.fullySettled).toBe(true)
  })

  it('rejects amounts above the remaining due (no change for non-cash)', () => {
    expect(() =>
      planManualTender({
        grandTotalCents: '10000',
        alreadyPaidCents: '4000',
        amountAppliedCents: '6001',
      }),
    ).toThrow(/exceeds remaining due/)
  })

  it('normalizes legacy type aliases', () => {
    expect(normalizeManualTenderType('PIX')).toBe('PIX_MANUAL')
    expect(normalizeManualTenderType('CARD_DEBIT')).toBe('DEBIT_MANUAL')
    expect(normalizeManualTenderType('CARD_CREDIT')).toBe('CREDIT_MANUAL')
    expect(normalizeManualTenderType('VOUCHER')).toBe('VOUCHER_MANUAL')
  })

  it('sums only captured / captured_manual tenders for settlement', () => {
    expect(
      sumAppliedTenders([
        { amountAppliedCents: '1000', status: 'captured' },
        { amountAppliedCents: '2000', status: 'captured_manual' },
        { amountAppliedCents: '500', status: 'pending' },
        { amountAppliedCents: '700', status: 'reversed' },
      ]),
    ).toBe(3000n)
  })

  it('supports cash + Pix + credit split combinations', () => {
    const afterCash = planManualTender({
      grandTotalCents: '10000',
      alreadyPaidCents: '3000',
      amountAppliedCents: '4000',
    })
    expect(afterCash.remainingDueCents).toBe(3000n)
    const afterPix = planManualTender({
      grandTotalCents: '10000',
      alreadyPaidCents: '7000',
      amountAppliedCents: '3000',
    })
    expect(afterPix.fullySettled).toBe(true)
  })
})
