import { evaluateStock } from '../lib/stockPolicy'
import { planStockDeductions } from '../lib/quantity'

/**
 * Concurrency contract for Retail Vertical Slice v1 (prompt §23):
 * saldo=1, two terminals each try to sell 1 → under BLOCK, at most one may succeed
 * at the evaluation layer. The command layer additionally uses pessimistic locks on
 * the PosTransaction; WMS adjust is idempotent by reference. This test locks the
 * deterministic policy math that both terminals share.
 */
describe('soanas_pos stock concurrency contract', () => {
  it('BLOCK rejects the second claim when only one unit remains', () => {
    const available = '1'
    const first = evaluateStock(available, '1', 'BLOCK')
    expect(first.decision).toBe('allow')

    // After the first sale commits, remaining on-hand is 0 for the competing terminal.
    const remainingAfterFirst = '0'
    const second = evaluateStock(remainingAfterFirst, '1', 'BLOCK')
    expect(second.decision).toBe('block')
    expect(second.shortfall).toBe('1')
  })

  it('ALLOW lets both terminals proceed (business accepts negative)', () => {
    expect(evaluateStock('1', '1', 'ALLOW').decision).toBe('allow')
    expect(evaluateStock('0', '1', 'ALLOW').decision).toBe('allow')
  })

  it('WARN surfaces shortfall for approval gating', () => {
    const evaluation = evaluateStock('1', '2', 'WARN')
    expect(evaluation.decision).toBe('warn')
    expect(evaluation.shortfall).toBe('1')
  })

  it('aggregates duplicate variant lines before WMS so concurrent carts stay deterministic', () => {
    const deductions = planStockDeductions([
      { id: 'a', catalogVariantId: 'v1', quantity: '1' },
      { id: 'b', catalogVariantId: 'v1', quantity: '1' },
    ])
    expect(deductions).toEqual([
      { catalogVariantId: 'v1', quantity: '2.0000', lineIds: ['a', 'b'] },
    ])
  })
})
