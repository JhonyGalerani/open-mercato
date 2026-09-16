import { planCashTender } from '../lib/change'

describe('soanas_pos cash change', () => {
  it('returns change for the classic 82,50 / 100,00 sale', () => {
    const plan = planCashTender({ grandTotalCents: '8250', receivedCents: '10000' })
    expect(plan.amountAppliedCents.toString()).toBe('8250')
    expect(plan.changeAmountCents.toString()).toBe('1750')
    expect(plan.remainingDueCents.toString()).toBe('0')
    expect(plan.fullySettled).toBe(true)
  })

  it('applies only what is still due when the customer pays in parts', () => {
    const plan = planCashTender({ grandTotalCents: '8250', alreadyPaidCents: '5000', receivedCents: '2000' })
    expect(plan.amountAppliedCents.toString()).toBe('2000')
    expect(plan.changeAmountCents.toString()).toBe('0')
    expect(plan.remainingDueCents.toString()).toBe('1250')
    expect(plan.fullySettled).toBe(false)
  })

  it('never hands back change on an already settled sale', () => {
    const plan = planCashTender({ grandTotalCents: '8250', alreadyPaidCents: '8250', receivedCents: '1000' })
    expect(plan.amountAppliedCents.toString()).toBe('0')
    expect(plan.changeAmountCents.toString()).toBe('1000')
    expect(plan.fullySettled).toBe(true)
  })

  it('rejects a non-positive received amount', () => {
    expect(() => planCashTender({ grandTotalCents: '100', receivedCents: '0' })).toThrow()
  })
})
