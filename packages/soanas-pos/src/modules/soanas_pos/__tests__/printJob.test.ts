import type { EntityManager } from '@mikro-orm/postgresql'
import {
  claimPrintJob,
  enqueueAndAttemptPrint,
  finalizePrintJob,
} from '../lib/printJob'
import { RECEIPT_PRINTER_DI_KEY } from '../di'
import { PosPrintJob, PosTransaction } from '../data/entities'
import { FailOnceReceiptPrinter, buildSaleReceiptDocument, type ReceiptPrinter } from '../lib/receipt'

type JobStore = {
  jobs: PosPrintJob[]
  uniqueViolations: boolean
}

function matchesWhere(job: PosPrintJob, where: Record<string, unknown>): boolean {
  if (where.id !== undefined && job.id !== where.id) return false
  if (where.tenantId !== undefined && job.tenantId !== where.tenantId) return false
  if (where.organizationId !== undefined && job.organizationId !== where.organizationId) return false
  if (where.idempotencyKey !== undefined && job.idempotencyKey !== where.idempotencyKey) return false
  if (where.deletedAt === null && job.deletedAt) return false
  if (where.status !== undefined) {
    const statusFilter = where.status as string | { $in?: string[] }
    if (typeof statusFilter === 'string') {
      if (job.status !== statusFilter) return false
    } else if (statusFilter.$in && !statusFilter.$in.includes(job.status)) {
      return false
    }
  }
  if (where.attempts !== undefined && job.attempts !== where.attempts) return false
  if (where.updatedAt && typeof where.updatedAt === 'object' && '$lt' in (where.updatedAt as object)) {
    const cutoff = (where.updatedAt as { $lt: Date }).$lt
    if (!(job.updatedAt < cutoff)) return false
  }
  return true
}

function createEmStub(store: JobStore): EntityManager {
  return {
    findOne: jest.fn(async (entity, where: Record<string, unknown>) => {
      if (entity !== PosPrintJob) return null
      return store.jobs.find((job) => matchesWhere(job, where)) ?? null
    }),
    create: jest.fn((_entity, data: Partial<PosPrintJob>) => {
      const job = {
        id: `job-${store.jobs.length + 1}`,
        status: data.status ?? 'QUEUED',
        attempts: data.attempts ?? 0,
        deletedAt: null,
        lastError: null,
        printerJobId: null,
        printedAt: null,
        ...data,
      } as PosPrintJob
      return job
    }),
    persist: jest.fn((job: PosPrintJob) => {
      if (!store.jobs.includes(job)) store.jobs.push(job)
    }),
    flush: jest.fn(async () => {
      if (store.uniqueViolations) {
        const err = Object.assign(new Error('unique'), {
          code: '23505',
          constraint: 'soanas_pos_print_jobs_idempotency_unique',
        })
        throw err
      }
      const seen = new Map<string, number>()
      for (let index = 0; index < store.jobs.length; index += 1) {
        const job = store.jobs[index]!
        const key = `${job.tenantId}:${job.idempotencyKey}`
        if (seen.has(key)) {
          store.jobs.splice(index, 1)
          const err = Object.assign(new Error('unique'), {
            code: '23505',
            constraint: 'soanas_pos_print_jobs_idempotency_unique',
          })
          throw err
        }
        seen.set(key, index)
      }
    }),
    nativeUpdate: jest.fn(async (_entity, where: Record<string, unknown>, patch: Partial<PosPrintJob>) => {
      const job = store.jobs.find((candidate) => matchesWhere(candidate, where))
      if (!job) return 0
      Object.assign(job, patch)
      return 1
    }),
  } as unknown as EntityManager
}

function buildReceipt(transactionId: string) {
  return buildSaleReceiptDocument({
    transactionId,
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
}

function countingPrinter(): ReceiptPrinter & { calls: number } {
  const printer = {
    calls: 0,
    async print() {
      printer.calls += 1
      return { printed: true, jobId: `mock-${printer.calls}` }
    },
  }
  return printer
}

describe('enqueueAndAttemptPrint (Gate 0 / ADR-011 concurrency)', () => {
  const transaction = {
    id: 'tx-1',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
  } as PosTransaction

  it('marks FAILED when the printer throws and succeeds on retry', async () => {
    const store: JobStore = { jobs: [], uniqueViolations: false }
    const em = createEmStub(store)
    const printer = new FailOnceReceiptPrinter()
    const ctx = {
      container: {
        resolve: (key: string) => (key === RECEIPT_PRINTER_DI_KEY ? printer : undefined),
      },
    } as never

    const first = await enqueueAndAttemptPrint({
      em,
      ctx,
      transaction,
      receipt: buildReceipt(transaction.id),
    })
    expect(first.status).toBe('FAILED')
    expect(store.jobs[0]?.attempts).toBe(1)

    const second = await enqueueAndAttemptPrint({
      em,
      ctx,
      transaction,
      receipt: buildReceipt(transaction.id),
    })
    expect(second.status).toBe('PRINTED')
    expect(store.jobs[0]?.attempts).toBe(2)
  })

  it('allows only one of two concurrent callers to invoke the printer', async () => {
    const store: JobStore = { jobs: [], uniqueViolations: false }
    const em = createEmStub(store)
    const printer = countingPrinter()
    const ctx = {
      container: {
        resolve: (key: string) => (key === RECEIPT_PRINTER_DI_KEY ? printer : undefined),
      },
    } as never
    const receipt = buildReceipt(transaction.id)

    const [first, second] = await Promise.all([
      enqueueAndAttemptPrint({ em, ctx, transaction, receipt }),
      enqueueAndAttemptPrint({ em, ctx, transaction, receipt }),
    ])

    expect(printer.calls).toBe(1)
    expect([first.status, second.status].sort()).toEqual(['PRINTED', 'PRINTED'].sort())
    // One caller owns the claim; the other observes the finalized (or in-flight) status.
    expect(store.jobs).toHaveLength(1)
  })

  it('does not print again when job is already PRINTED', async () => {
    const store: JobStore = {
      jobs: [
        {
          id: 'job-printed',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          transactionId: 'tx-1',
          kind: 'sale_receipt',
          status: 'PRINTED',
          payload: {},
          attempts: 1,
          idempotencyKey: 'sale_receipt:tx-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as PosPrintJob,
      ],
      uniqueViolations: false,
    }
    const em = createEmStub(store)
    const printer = countingPrinter()
    const ctx = {
      container: {
        resolve: (key: string) => (key === RECEIPT_PRINTER_DI_KEY ? printer : undefined),
      },
    } as never

    const result = await enqueueAndAttemptPrint({
      em,
      ctx,
      transaction,
      receipt: buildReceipt(transaction.id),
    })
    expect(result.status).toBe('PRINTED')
    expect(printer.calls).toBe(0)
  })

  it('recovers an abandoned PRINTING job after the lease expires', async () => {
    const stale = new Date(Date.now() - 120_000)
    const store: JobStore = {
      jobs: [
        {
          id: 'job-stale',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          transactionId: 'tx-1',
          kind: 'sale_receipt',
          status: 'PRINTING',
          payload: {},
          attempts: 1,
          idempotencyKey: 'sale_receipt:tx-1',
          createdAt: stale,
          updatedAt: stale,
          deletedAt: null,
        } as PosPrintJob,
      ],
      uniqueViolations: false,
    }
    const em = createEmStub(store)
    const printer = countingPrinter()
    const ctx = {
      container: {
        resolve: (key: string) => (key === RECEIPT_PRINTER_DI_KEY ? printer : undefined),
      },
    } as never

    const result = await enqueueAndAttemptPrint({
      em,
      ctx,
      transaction,
      receipt: buildReceipt(transaction.id),
      leaseMs: 30_000,
    })
    expect(result.status).toBe('PRINTED')
    expect(printer.calls).toBe(1)
    expect(store.jobs[0]?.attempts).toBe(2)
  })

  it('rejects cross-organization idempotency collisions', async () => {
    const store: JobStore = {
      jobs: [
        {
          id: 'job-other-org',
          tenantId: 'tenant-1',
          organizationId: 'org-B',
          transactionId: 'tx-other',
          kind: 'sale_receipt',
          status: 'QUEUED',
          payload: {},
          attempts: 0,
          idempotencyKey: 'sale_receipt:tx-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as PosPrintJob,
      ],
      uniqueViolations: true,
    }
    const em = createEmStub(store)
    // After unique violation, findOne by org returns null; tenant-only find returns other org.
    ;(em.findOne as jest.Mock).mockImplementation(async (_entity, where: Record<string, unknown>) => {
      if (where.organizationId === 'org-1') return null
      return store.jobs[0] ?? null
    })
    const ctx = { container: { resolve: () => undefined } } as never

    await expect(
      enqueueAndAttemptPrint({
        em,
        ctx,
        transaction,
        receipt: buildReceipt(transaction.id),
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('stale worker finalize is ignored after a newer claim', async () => {
    const store: JobStore = {
      jobs: [
        {
          id: 'job-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          transactionId: 'tx-1',
          kind: 'sale_receipt',
          status: 'PRINTING',
          payload: {},
          attempts: 2,
          idempotencyKey: 'sale_receipt:tx-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as PosPrintJob,
      ],
      uniqueViolations: false,
    }
    const em = createEmStub(store)
    const job = store.jobs[0]!

    const staleOk = await finalizePrintJob({
      em,
      job,
      fencingToken: 1,
      outcome: 'FAILED',
      lastError: 'stale',
    })
    expect(staleOk).toBe(false)
    expect(job.status).toBe('PRINTING')

    const freshOk = await finalizePrintJob({
      em,
      job,
      fencingToken: 2,
      outcome: 'PRINTED',
      printerJobId: 'p-2',
    })
    expect(freshOk).toBe(true)
    expect(job.status).toBe('PRINTED')
  })

  it('claimPrintJob refuses a fresh PRINTING lease', async () => {
    const store: JobStore = {
      jobs: [
        {
          id: 'job-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          transactionId: 'tx-1',
          kind: 'sale_receipt',
          status: 'PRINTING',
          payload: {},
          attempts: 1,
          idempotencyKey: 'sale_receipt:tx-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } as PosPrintJob,
      ],
      uniqueViolations: false,
    }
    const em = createEmStub(store)
    const token = await claimPrintJob({ em, job: store.jobs[0]!, leaseMs: 60_000 })
    expect(token).toBeNull()
  })
})
