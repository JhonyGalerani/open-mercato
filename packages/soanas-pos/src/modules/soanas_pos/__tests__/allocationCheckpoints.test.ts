import { allocationPlanComplete } from '../lib/allocationCheckpoints'

describe('allocation checkpoints', () => {
  it('treats a frozen plan as incomplete until every location step is COMPLETED', () => {
    expect(
      allocationPlanComplete([
        {
          catalogVariantId: 'v1',
          locationId: 'B',
          lotId: null,
          serialNumber: null,
          plannedQuantity: '4.0000',
          movementId: 'm1',
          status: 'COMPLETED',
          idempotencyKey: 'k1',
        },
        {
          catalogVariantId: 'v1',
          locationId: 'A',
          lotId: null,
          serialNumber: null,
          plannedQuantity: '1.0000',
          movementId: null,
          status: 'PENDING',
          idempotencyKey: 'k2',
        },
      ]),
    ).toBe(false)
  })

  it('is complete only when all steps finished', () => {
    expect(
      allocationPlanComplete([
        {
          catalogVariantId: 'v1',
          locationId: 'B',
          lotId: null,
          serialNumber: null,
          plannedQuantity: '4.0000',
          movementId: 'm1',
          status: 'COMPLETED',
          idempotencyKey: 'k1',
        },
        {
          catalogVariantId: 'v1',
          locationId: 'A',
          lotId: null,
          serialNumber: null,
          plannedQuantity: '1.0000',
          movementId: 'm2',
          status: 'COMPLETED',
          idempotencyKey: 'k2',
        },
      ]),
    ).toBe(true)
  })
})
