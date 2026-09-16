import type { EntityManager } from '@mikro-orm/postgresql'
import { enqueueAndAttemptPrint } from '../lib/printJob'
import { RECEIPT_PRINTER_DI_KEY } from '../di'
import { PosPrintJob, PosTransaction } from '../data/entities'
import { FailOnceReceiptPrinter, buildSaleReceiptDocument } from '../lib/receipt'

function createEmStub(jobs: PosPrintJob[]): EntityManager {
  return {
    findOne: jest.fn(async (entity, where: { idempotencyKey?: string }) => {
      if (entity === PosPrintJob) {
        return jobs.find((job) => job.idempotencyKey === where.idempotencyKey) ?? null
      }
      return null
    }),
    create: jest.fn((_entity, data: Partial<PosPrintJob>) => {
      const job = { ...data, id: 'job-1', status: data.status ?? 'QUEUED', attempts: data.attempts ?? 0 } as PosPrintJob
      jobs.push(job)
      return job
    }),
    persist: jest.fn(),
    flush: jest.fn(async () => undefined),
  } as unknown as EntityManager
}

describe('enqueueAndAttemptPrint (Gate 0 / ADR-011)', () => {
  it('marks FAILED when the printer throws and succeeds on retry', async () => {
    const jobs: PosPrintJob[] = []
    const em = createEmStub(jobs)
    const transaction = {
      id: 'tx-1',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
    } as PosTransaction
    const receipt = buildSaleReceiptDocument({
      transactionId: transaction.id,
      correlationId: 'corr-1',
      operatorUserId: 'operator-1',
      terminalCode: 'POS-1',
      lines: [],
      tenders: [],
      subtotalCents: '1000',
      discountTotalCents: '0',
      surchargeTotalCents: '0',
      taxTotalCents: '0',
      grandTotalCents: '1000',
      amountPaidCents: '1000',
      changeAmountCents: '0',
    })
    const printer = new FailOnceReceiptPrinter()
    const ctx = {
      container: {
        resolve: (key: string) => (key === RECEIPT_PRINTER_DI_KEY ? printer : undefined),
      },
    } as never

    const first = await enqueueAndAttemptPrint({ em, ctx, transaction, receipt })
    expect(first.status).toBe('FAILED')

    const second = await enqueueAndAttemptPrint({ em, ctx, transaction, receipt })
    expect(second.status).toBe('PRINTED')
  })
})
