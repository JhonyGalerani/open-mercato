import { buildSaleReceiptDocument, MockReceiptPrinter } from '../lib/receipt'

const ARGS = {
  transactionId: 'tx-1',
  correlationId: 'corr-1',
  salesOrderId: 'order-1',
  terminalCode: 'PDV-01',
  terminalName: 'Caixa 1',
  operatorUserId: 'user-1',
  issuedAt: new Date('2026-09-15T12:00:00.000Z'),
  lines: [
    {
      sku: 'SKU-1',
      name: 'Cafe 500g',
      quantity: '2',
      unitPriceCents: '2500',
      discountAmountCents: '0',
      lineTotalCents: '5000',
    },
    {
      sku: 'SKU-2',
      name: 'Filtro',
      quantity: '1',
      unitPriceCents: '3250',
      discountAmountCents: '0',
      lineTotalCents: '3250',
    },
  ],
  tenders: [
    {
      type: 'CASH',
      amountAppliedCents: '8250',
      amountReceivedCents: '10000',
      changeAmountCents: '1750',
    },
  ],
  subtotalCents: '8250',
  discountTotalCents: '0',
  surchargeTotalCents: '0',
  taxTotalCents: '0',
  grandTotalCents: '8250',
  amountPaidCents: '8250',
  changeAmountCents: '1750',
}

describe('soanas_pos receipt', () => {
  it('builds a non-fiscal sale document with every total as cents strings', () => {
    const receipt = buildSaleReceiptDocument(ARGS)
    expect(receipt.kind).toBe('pos_sale')
    expect(receipt.fiscal).toBe(false)
    expect(receipt.grandTotalCents).toBe('8250')
    expect(receipt.changeAmountCents).toBe('1750')
    expect(receipt.issuedAt).toBe('2026-09-15T12:00:00.000Z')
    expect(receipt.lines).toHaveLength(2)
  })

  it('renders printable text with BRL amounts', () => {
    const receipt = buildSaleReceiptDocument(ARGS)
    expect(receipt.text).toContain('TOTAL    82,50')
    expect(receipt.text).toContain('TROCO    17,50')
    expect(receipt.text).toContain('Cafe 500g')
    expect(receipt.text).toContain('NAO FISCAL')
  })

  it('keeps printed documents in the mock printer', async () => {
    const printer = new MockReceiptPrinter()
    const receipt = buildSaleReceiptDocument(ARGS)
    const job = await printer.print(receipt)
    expect(job.printed).toBe(true)
    expect(job.jobId).toBe('mock:tx-1')
    expect(printer.last()?.transactionId).toBe('tx-1')
    printer.clear()
    expect(printer.printed).toHaveLength(0)
  })
})
