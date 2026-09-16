import { centsToString, formatCentsAsBrl } from './money'

export type SaleReceiptLine = {
  sku: string
  name: string
  quantity: string
  unitPriceCents: string
  discountAmountCents: string
  lineTotalCents: string
}

export type SaleReceiptTender = {
  type: string
  amountAppliedCents: string
  amountReceivedCents: string | null
  changeAmountCents: string | null
}

export type SaleReceiptDocument = {
  version: 1
  kind: 'pos_sale'
  /** Non-fiscal: this document never replaces an NFC-e (ADR-004). */
  fiscal: false
  transactionId: string
  correlationId: string
  salesOrderId: string | null
  terminalCode: string | null
  terminalName: string | null
  operatorUserId: string
  customerId: string | null
  currencyCode: string
  issuedAt: string
  lines: SaleReceiptLine[]
  tenders: SaleReceiptTender[]
  subtotalCents: string
  discountTotalCents: string
  surchargeTotalCents: string
  taxTotalCents: string
  grandTotalCents: string
  amountPaidCents: string
  changeAmountCents: string
  text: string
}

export type BuildSaleReceiptArgs = {
  transactionId: string
  correlationId: string
  salesOrderId?: string | null
  terminalCode?: string | null
  terminalName?: string | null
  operatorUserId: string
  customerId?: string | null
  currencyCode?: string
  issuedAt?: Date
  lines: SaleReceiptLine[]
  tenders: SaleReceiptTender[]
  subtotalCents: bigint | number | string
  discountTotalCents: bigint | number | string
  surchargeTotalCents: bigint | number | string
  taxTotalCents: bigint | number | string
  grandTotalCents: bigint | number | string
  amountPaidCents: bigint | number | string
  changeAmountCents: bigint | number | string
}

function renderText(document: Omit<SaleReceiptDocument, 'text'>): string {
  const rows: string[] = []
  rows.push(`*** ${document.terminalName ?? 'POS'} ***`)
  rows.push(`NAO FISCAL / NOT A FISCAL DOCUMENT`)
  rows.push(`TX ${document.transactionId}`)
  if (document.salesOrderId) rows.push(`ORDER ${document.salesOrderId}`)
  rows.push(`${document.issuedAt}`)
  rows.push('-'.repeat(32))
  for (const line of document.lines) {
    rows.push(`${line.quantity} x ${line.name} (${line.sku})`)
    rows.push(`  ${formatCentsAsBrl(line.unitPriceCents)} => ${formatCentsAsBrl(line.lineTotalCents)}`)
  }
  rows.push('-'.repeat(32))
  rows.push(`SUBTOTAL ${formatCentsAsBrl(document.subtotalCents)}`)
  rows.push(`DESCONTO ${formatCentsAsBrl(document.discountTotalCents)}`)
  rows.push(`TOTAL    ${formatCentsAsBrl(document.grandTotalCents)}`)
  for (const tender of document.tenders) {
    rows.push(`${tender.type} ${formatCentsAsBrl(tender.amountAppliedCents)}`)
  }
  rows.push(`TROCO    ${formatCentsAsBrl(document.changeAmountCents)}`)
  return rows.join('\n')
}

export function buildSaleReceiptDocument(args: BuildSaleReceiptArgs): SaleReceiptDocument {
  const issuedAt = (args.issuedAt ?? new Date()).toISOString()
  const base: Omit<SaleReceiptDocument, 'text'> = {
    version: 1,
    kind: 'pos_sale',
    fiscal: false,
    transactionId: args.transactionId,
    correlationId: args.correlationId,
    salesOrderId: args.salesOrderId ?? null,
    terminalCode: args.terminalCode ?? null,
    terminalName: args.terminalName ?? null,
    operatorUserId: args.operatorUserId,
    customerId: args.customerId ?? null,
    currencyCode: args.currencyCode ?? 'BRL',
    issuedAt,
    lines: args.lines,
    tenders: args.tenders,
    subtotalCents: centsToString(args.subtotalCents),
    discountTotalCents: centsToString(args.discountTotalCents),
    surchargeTotalCents: centsToString(args.surchargeTotalCents),
    taxTotalCents: centsToString(args.taxTotalCents),
    grandTotalCents: centsToString(args.grandTotalCents),
    amountPaidCents: centsToString(args.amountPaidCents),
    changeAmountCents: centsToString(args.changeAmountCents),
  }
  return { ...base, text: renderText(base) }
}

export type ReceiptPrinter = {
  print(document: SaleReceiptDocument): Promise<{ printed: boolean; jobId: string }>
}

/**
 * Hardware-free printer used until a real ESC/POS driver package exists. It keeps the
 * printed documents in memory so tests and the operator UI can assert on them.
 */
export class MockReceiptPrinter implements ReceiptPrinter {
  private readonly documents: SaleReceiptDocument[] = []

  async print(document: SaleReceiptDocument): Promise<{ printed: boolean; jobId: string }> {
    this.documents.push(document)
    return { printed: true, jobId: `mock:${document.transactionId}` }
  }

  get printed(): SaleReceiptDocument[] {
    return [...this.documents]
  }

  last(): SaleReceiptDocument | null {
    return this.documents.length ? this.documents[this.documents.length - 1] : null
  }

  clear(): void {
    this.documents.length = 0
  }
}

/** Fails once per transaction id, then succeeds — used when `OM_SOANAS_RECEIPT_PRINT_FAIL_ONCE=1`. */
export class FailOnceReceiptPrinter implements ReceiptPrinter {
  private readonly failedTransactionIds = new Set<string>()

  async print(document: SaleReceiptDocument): Promise<{ printed: boolean; jobId: string }> {
    if (!this.failedTransactionIds.has(document.transactionId)) {
      this.failedTransactionIds.add(document.transactionId)
      throw new Error('[internal] simulated receipt printer failure')
    }
    return { printed: true, jobId: `mock-retry:${document.transactionId}` }
  }
}
