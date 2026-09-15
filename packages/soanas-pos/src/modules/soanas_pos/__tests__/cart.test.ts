import { recalculateCart, recalculateLine, remainingDueCents } from '../lib/cart'

describe('soanas_pos cart recalculation', () => {
  it('computes a line total from quantity, price, discount and surcharge', () => {
    const line = recalculateLine({
      quantity: '3',
      unitPriceCents: '1500',
      discountAmountCents: '500',
      surchargeAmountCents: '200',
    })
    expect(line.grossCents.toString()).toBe('4500')
    expect(line.lineTotalCents.toString()).toBe('4200')
  })

  it('caps a line discount at the line gross', () => {
    const line = recalculateLine({ quantity: '1', unitPriceCents: '1000', discountAmountCents: '5000' })
    expect(line.discountAmountCents.toString()).toBe('1000')
    expect(line.lineTotalCents.toString()).toBe('0')
  })

  it('sums the cart and applies the cart-level discount after the lines', () => {
    const totals = recalculateCart(
      [
        { id: 'a', quantity: '2', unitPriceCents: '2500' },
        { id: 'b', quantity: '1', unitPriceCents: '3750', discountAmountCents: '250' },
      ],
      { amountCents: '750' },
    )
    expect(totals.subtotalCents.toString()).toBe('8750')
    expect(totals.discountTotalCents.toString()).toBe('1000')
    expect(totals.grandTotalCents.toString()).toBe('7750')
    expect(totals.lines.map((line) => line.lineTotalCents.toString())).toEqual(['5000', '3500'])
  })

  it('adds taxes on top of the discounted lines', () => {
    const totals = recalculateCart([{ id: 'a', quantity: '1', unitPriceCents: '10000', taxAmountCents: '1800' }])
    expect(totals.taxTotalCents.toString()).toBe('1800')
    expect(totals.grandTotalCents.toString()).toBe('11800')
  })

  it('keeps fractional quantities exact', () => {
    const totals = recalculateCart([{ id: 'a', quantity: '0.750', unitPriceCents: '4990' }])
    expect(totals.grandTotalCents.toString()).toBe('3743')
  })

  it('never produces a negative grand total', () => {
    const totals = recalculateCart([{ id: 'a', quantity: '1', unitPriceCents: '1000' }], { amountCents: '99999' })
    expect(totals.grandTotalCents.toString()).toBe('0')
  })

  it('reports the remaining amount due', () => {
    expect(remainingDueCents('8250', '5000').toString()).toBe('3250')
    expect(remainingDueCents('8250', '9000').toString()).toBe('0')
  })
})
