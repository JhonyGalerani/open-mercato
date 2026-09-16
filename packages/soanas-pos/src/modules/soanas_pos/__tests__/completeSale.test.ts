import { planCompleteSale } from '../lib/completeSale'

const BASE = {
  warehouseId: 'wh-1',
  lineCount: 2,
  cashSessionId: 'session-1',
  hasCashTender: true,
}

describe('soanas_pos completeSale planner', () => {
  it('runs every step on a first attempt', () => {
    const plan = planCompleteSale({ ...BASE })
    expect(plan.steps).toEqual(['sales', 'wms', 'cash', 'complete'])
    expect(plan.createSalesOrder).toBe(true)
  })

  it('skips the steps a previous attempt already finished', () => {
    const plan = planCompleteSale({
      ...BASE,
      recovery: { lastStep: 'wms', salesOrderId: 'order-1', wmsMovementId: 'mv-1' },
    })
    expect(plan.steps).toEqual(['cash', 'complete'])
    expect(plan.skipped).toEqual([
      { step: 'sales', reason: 'already_done' },
      { step: 'wms', reason: 'already_done' },
    ])
  })

  it('does not skip WMS when only a partial location movement was checkpointed', () => {
    const plan = planCompleteSale({
      ...BASE,
      recovery: { lastStep: 'sales', salesOrderId: 'order-1', wmsMovementId: 'mv-partial' },
    })
    expect(plan.steps).toContain('wms')
  })

  it('is idempotent: replaying a finished saga leaves nothing but the final mark', () => {
    const plan = planCompleteSale({
      ...BASE,
      recovery: {
        lastStep: 'cash',
        salesOrderId: 'order-1',
        wmsMovementId: 'mv-1',
        cashMovementId: 'cash-1',
      },
    })
    expect(plan.steps).toEqual(['complete'])
  })

  it('replays the sales step without recreating an order that already exists', () => {
    const plan = planCompleteSale({ ...BASE, salesOrderId: 'order-1' })
    expect(plan.steps).toContain('sales')
    expect(plan.createSalesOrder).toBe(false)
  })

  it('skips WMS without a warehouse and cash without a session', () => {
    const plan = planCompleteSale({ ...BASE, warehouseId: null, cashSessionId: null })
    expect(plan.steps).toEqual(['sales', 'complete'])
    expect(plan.skipped).toContainEqual({ step: 'wms', reason: 'no_warehouse' })
    expect(plan.skipped).toContainEqual({ step: 'cash', reason: 'no_cash_session' })
  })

  it('skips cash when the sale was paid without any cash tender', () => {
    const plan = planCompleteSale({ ...BASE, hasCashTender: false })
    expect(plan.steps).toEqual(['sales', 'wms', 'complete'])
    expect(plan.skipped).toContainEqual({ step: 'cash', reason: 'no_cash_tender' })
  })

  it('skips WMS for a cart without lines', () => {
    const plan = planCompleteSale({ ...BASE, lineCount: 0 })
    expect(plan.skipped).toContainEqual({ step: 'wms', reason: 'no_lines' })
  })

  it('leaves nothing to do once the saga reached the complete checkpoint', () => {
    const plan = planCompleteSale({ ...BASE, recovery: { lastStep: 'complete' } })
    expect(plan.steps).toEqual([])
  })
})
