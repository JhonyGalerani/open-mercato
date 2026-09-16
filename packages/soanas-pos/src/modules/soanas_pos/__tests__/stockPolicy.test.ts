import { evaluateStock } from '../lib/stockPolicy'

describe('soanas_pos stock policy', () => {
  it('allows any policy when there is enough stock', () => {
    for (const policy of ['BLOCK', 'WARN', 'ALLOW'] as const) {
      expect(evaluateStock('10', '3', policy).decision).toBe('allow')
    }
  })

  it('blocks a short sale under BLOCK and reports the shortfall', () => {
    const evaluation = evaluateStock('2', '5', 'BLOCK')
    expect(evaluation.decision).toBe('block')
    expect(evaluation.available).toBe('2')
    expect(evaluation.requested).toBe('5')
    expect(evaluation.shortfall).toBe('3')
  })

  it('warns instead of blocking under WARN', () => {
    expect(evaluateStock('2', '5', 'WARN').decision).toBe('warn')
  })

  it('sells anyway under ALLOW', () => {
    expect(evaluateStock('0', '5', 'ALLOW').decision).toBe('allow')
  })

  it('compares fractional quantities exactly', () => {
    expect(evaluateStock('0.750', '0.75', 'BLOCK').decision).toBe('allow')
    expect(evaluateStock('0.749', '0.75', 'BLOCK').decision).toBe('block')
    expect(evaluateStock('0.749', '0.75', 'BLOCK').shortfall).toBe('0.001')
  })

  it('treats negative availability as a shortage', () => {
    expect(evaluateStock('-3', '1', 'BLOCK').decision).toBe('block')
  })
})
