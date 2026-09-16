import {
  fromScaledQuantity,
  planStockDeductions,
  toScaledQuantity,
} from '../lib/quantity'

describe('scaled quantity arithmetic', () => {
  it('round-trips decimal strings without float drift', () => {
    expect(fromScaledQuantity(toScaledQuantity('2.5'))).toBe('2.5000')
    expect(fromScaledQuantity(toScaledQuantity('0.0001'))).toBe('0.0001')
    expect(fromScaledQuantity(toScaledQuantity('1000'))).toBe('1000.0000')
  })

  it('sums the classic 0.1 + 0.2 case exactly', () => {
    const sum = toScaledQuantity('0.1') + toScaledQuantity('0.2')
    expect(fromScaledQuantity(sum)).toBe('0.3000')
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('treats unparseable input as zero instead of NaN', () => {
    expect(toScaledQuantity(null)).toBe(0n)
    expect(toScaledQuantity('abc')).toBe(0n)
  })
})

describe('planStockDeductions', () => {
  it('merges repeated variants into a single deduction', () => {
    const deductions = planStockDeductions([
      { id: 'line-1', catalogVariantId: 'variant-a', quantity: '1' },
      { id: 'line-2', catalogVariantId: 'variant-a', quantity: '1' },
      { id: 'line-3', catalogVariantId: 'variant-b', quantity: '2.5' },
    ])

    expect(deductions).toEqual([
      { catalogVariantId: 'variant-a', quantity: '2.0000', lineIds: ['line-1', 'line-2'] },
      { catalogVariantId: 'variant-b', quantity: '2.5000', lineIds: ['line-3'] },
    ])
  })

  it('skips lines without a catalog variant', () => {
    const deductions = planStockDeductions([
      { id: 'line-1', catalogVariantId: null, quantity: '3' },
      { id: 'line-2', quantity: '1' },
    ])
    expect(deductions).toEqual([])
  })

  it('is stable across replays so a retry produces the same WMS request', () => {
    const lines = [
      { id: 'line-1', catalogVariantId: 'variant-a', quantity: '1.2' },
      { id: 'line-2', catalogVariantId: 'variant-a', quantity: '0.8' },
    ]
    expect(planStockDeductions(lines)).toEqual(planStockDeductions(lines))
    expect(planStockDeductions(lines)[0].quantity).toBe('2.0000')
  })
})
