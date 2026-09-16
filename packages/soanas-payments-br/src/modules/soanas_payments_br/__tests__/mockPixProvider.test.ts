import { MockPixProvider } from '../lib/mockPixProvider'

describe('soanas_payments_br MockPixProvider', () => {
  it('creates a charge with a dynamic QR code and copia-e-cola', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({
      tenantId: 't1',
      organizationId: 'o1',
      amountCents: '1500',
    })
    expect(charge.txid).toHaveLength(26)
    expect(charge.status).toBe('WAITING')
    expect(charge.qrCode).toContain(charge.txid)
    expect(charge.copiaECola).toBe(charge.qrCode)
    expect(charge.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('generates a distinct txid per charge', async () => {
    const provider = new MockPixProvider()
    const a = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '100' })
    const b = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '100' })
    expect(a.txid).not.toBe(b.txid)
  })

  it('marks a charge PAID via webhook and is idempotent for repeated deliveries', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '1500' })

    const first = await provider.handleWebhook({ txid: charge.txid, status: 'PAID', e2eId: 'E2E123' })
    expect(first.status).toBe('PAID')
    expect(first.e2eId).toBe('E2E123')

    const paidAtFirst = (await provider.getCharge(charge.txid)).paidAt

    // Same webhook delivered twice (at-least-once PSP delivery) must not duplicate side effects.
    const second = await provider.handleWebhook({ txid: charge.txid, status: 'PAID', e2eId: 'E2E123' })
    expect(second.status).toBe('PAID')
    expect(second.e2eId).toBe('E2E123')

    const paidAtSecond = (await provider.getCharge(charge.txid)).paidAt
    expect(paidAtSecond).toEqual(paidAtFirst)
  })

  it('cancels a waiting charge and is idempotent on repeat cancellation', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '1500' })

    const first = await provider.cancelCharge(charge.txid)
    expect(first.status).toBe('CANCELLED')

    const second = await provider.cancelCharge(charge.txid)
    expect(second.status).toBe('CANCELLED')
  })

  it('rejects cancelling a paid charge', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '1500' })
    await provider.handleWebhook({ txid: charge.txid, status: 'PAID', e2eId: 'E2E1' })
    await expect(provider.cancelCharge(charge.txid)).rejects.toThrow()
  })

  it('fully refunds a paid charge', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '1500' })
    await provider.handleWebhook({ txid: charge.txid, status: 'PAID', e2eId: 'E2E1' })

    const refund = await provider.refundCharge({ txid: charge.txid })
    expect(refund.status).toBe('REFUNDED')
    expect(await provider.getPaymentStatus(charge.txid)).toBe('REFUNDED')
  })

  it('partially refunds a paid charge and allows a second partial refund up to the remainder', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '1000' })
    await provider.handleWebhook({ txid: charge.txid, status: 'PAID', e2eId: 'E2E1' })

    const firstRefund = await provider.refundCharge({ txid: charge.txid, amountCents: '400' })
    expect(firstRefund.status).toBe('PARTIALLY_REFUNDED')

    const secondRefund = await provider.refundCharge({ txid: charge.txid, amountCents: '600' })
    expect(secondRefund.status).toBe('REFUNDED')
  })

  it('rejects a refund that exceeds the remaining balance', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({ tenantId: 't1', organizationId: 'o1', amountCents: '1000' })
    await provider.handleWebhook({ txid: charge.txid, status: 'PAID', e2eId: 'E2E1' })
    await provider.refundCharge({ txid: charge.txid, amountCents: '400' })

    await expect(provider.refundCharge({ txid: charge.txid, amountCents: '700' })).rejects.toThrow()
  })

  it('lazily expires a charge past its expiry time', async () => {
    const provider = new MockPixProvider()
    const charge = await provider.createCharge({
      tenantId: 't1',
      organizationId: 'o1',
      amountCents: '1500',
      expiresInSeconds: 1,
    })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(await provider.getPaymentStatus(charge.txid)).toBe('EXPIRED')
  })
})
