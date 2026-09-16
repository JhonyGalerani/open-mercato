import { validateDenominationsMatchAmount } from '../lib/denominations'

describe('denomination validation', () => {
  it('accepts an absent map as "not provided"', () => {
    const result = validateDenominationsMatchAmount(null, 12345n)
    expect(result.ok).toBe(true)
    expect(result.provided).toBe(false)
  })

  it('accepts an empty map as "not provided"', () => {
    const result = validateDenominationsMatchAmount({}, 12345n)
    expect(result.ok).toBe(true)
    expect(result.provided).toBe(false)
  })

  it('accepts a map whose face values sum to the declared amount', () => {
    const result = validateDenominationsMatchAmount({ '100': 2, '50': 1, '0.25': 4 }, 25100n)
    expect(result.ok).toBe(true)
    expect(result.sumCents).toBe(25100n)
  })

  it('rejects a map that does not sum to the declared amount', () => {
    const result = validateDenominationsMatchAmount({ '100': 2 }, 25100n)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.sumCents).toBe(20000n)
      expect(result.expectedCents).toBe(25100n)
    }
  })

  it('handles centavo denominations without floating point drift', () => {
    const result = validateDenominationsMatchAmount({ '0.05': 3, '0.1': 7 }, 85n)
    expect(result.ok).toBe(true)
    expect(result.sumCents).toBe(85n)
  })
})
