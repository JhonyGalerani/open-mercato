import { planLocationDeductions } from '../lib/stockAllocation'

describe('planLocationDeductions', () => {
  it('consumes a single location when it covers the sale', () => {
    const result = planLocationDeductions({
      quantity: '2',
      balances: [
        { locationId: 'loc-a', quantityOnHand: '10', quantityReserved: '0', quantityAllocated: '0' },
      ],
    })
    expect(result.shortfall).toBe('0.0000')
    expect(result.deductions).toEqual([
      { locationId: 'loc-a', quantity: '2.0000', lotId: null, serialNumber: null },
    ])
  })

  it('splits across locations instead of overdrawing the richest bucket (A=3,B=4,sale=5)', () => {
    const result = planLocationDeductions({
      quantity: '5',
      balances: [
        { locationId: 'loc-a', quantityOnHand: '3', quantityReserved: '0', quantityAllocated: '0' },
        { locationId: 'loc-b', quantityOnHand: '4', quantityReserved: '0', quantityAllocated: '0' },
      ],
    })
    expect(result.shortfall).toBe('0.0000')
    expect(result.deductions).toEqual([
      { locationId: 'loc-b', quantity: '4.0000', lotId: null, serialNumber: null },
      { locationId: 'loc-a', quantity: '1.0000', lotId: null, serialNumber: null },
    ])
  })

  it('respects reserved and allocated quantity when computing availability', () => {
    const result = planLocationDeductions({
      quantity: '3',
      balances: [
        {
          locationId: 'loc-a',
          quantityOnHand: '5',
          quantityReserved: '2',
          quantityAllocated: '1',
        },
        { locationId: 'loc-b', quantityOnHand: '10', quantityReserved: '0', quantityAllocated: '0' },
      ],
    })
    expect(result.deductions).toEqual([
      { locationId: 'loc-b', quantity: '3.0000', lotId: null, serialNumber: null },
    ])
  })

  it('preserves lot and serial identity on each bucket', () => {
    const result = planLocationDeductions({
      quantity: '2',
      balances: [
        {
          locationId: 'loc-a',
          quantityOnHand: '1',
          lotId: 'lot-1',
          serialNumber: null,
        },
        {
          locationId: 'loc-a',
          quantityOnHand: '1',
          lotId: null,
          serialNumber: 'SN-9',
        },
      ],
    })
    expect(result.deductions).toEqual([
      { locationId: 'loc-a', quantity: '1.0000', lotId: null, serialNumber: 'SN-9' },
      { locationId: 'loc-a', quantity: '1.0000', lotId: 'lot-1', serialNumber: null },
    ])
  })

  it('reports shortfall when aggregate stock is insufficient and shortage is blocked', () => {
    const result = planLocationDeductions({
      quantity: '10',
      balances: [
        { locationId: 'loc-a', quantityOnHand: '3' },
        { locationId: 'loc-b', quantityOnHand: '4' },
      ],
      allowShortage: false,
    })
    expect(result.shortfall).toBe('3.0000')
    expect(result.deductions).toHaveLength(2)
  })

  it('places remainder on the fallback location when shortage is allowed', () => {
    const result = planLocationDeductions({
      quantity: '10',
      balances: [{ locationId: 'loc-a', quantityOnHand: '3' }],
      fallbackLocationId: 'loc-fallback',
      allowShortage: true,
    })
    expect(result.shortfall).toBe('0.0000')
    expect(result.deductions).toEqual([
      { locationId: 'loc-a', quantity: '3.0000', lotId: null, serialNumber: null },
      { locationId: 'loc-fallback', quantity: '7.0000', lotId: null, serialNumber: null },
    ])
  })

  it('is deterministic for equal available quantities (locationId asc)', () => {
    const balances = [
      { locationId: 'loc-z', quantityOnHand: '2' },
      { locationId: 'loc-a', quantityOnHand: '2' },
    ]
    const first = planLocationDeductions({ quantity: '3', balances })
    const second = planLocationDeductions({ quantity: '3', balances })
    expect(first).toEqual(second)
    expect(first.deductions.map((row) => row.locationId)).toEqual(['loc-a', 'loc-z'])
  })
})
