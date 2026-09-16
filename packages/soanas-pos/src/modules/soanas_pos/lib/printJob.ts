import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { PosPrintJob, PosTransaction } from '../data/entities'
import { RECEIPT_PRINTER_DI_KEY } from '../di'
import { MockReceiptPrinter, type ReceiptPrinter, type SaleReceiptDocument } from './receipt'

function resolveReceiptPrinter(ctx: CommandRuntimeContext): ReceiptPrinter {
  try {
    const printer = ctx.container.resolve(RECEIPT_PRINTER_DI_KEY) as ReceiptPrinter | undefined
    if (printer && typeof printer.print === 'function') return printer
  } catch {
    // Container may not have the registrar in isolated command unit tests.
  }
  return new MockReceiptPrinter()
}

/** Persist a PrintJob before invoking the printer; failures never roll back COMPLETED sales (ADR-011). */
export async function enqueueAndAttemptPrint(args: {
  em: EntityManager
  ctx: CommandRuntimeContext
  transaction: PosTransaction
  receipt: SaleReceiptDocument
}): Promise<{ jobId: string; status: string }> {
  const { em, ctx, transaction, receipt } = args
  const idempotencyKey = `sale_receipt:${transaction.id}`
  let job = await em.findOne(PosPrintJob, {
    tenantId: transaction.tenantId,
    idempotencyKey,
    deletedAt: null,
  })
  if (!job) {
    job = em.create(PosPrintJob, {
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      transactionId: transaction.id,
      kind: 'sale_receipt',
      status: 'QUEUED',
      payload: receipt as unknown as Record<string, unknown>,
      attempts: 0,
      idempotencyKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(job)
    await em.flush()
  }

  if (job.status === 'PRINTED') {
    return { jobId: job.id, status: job.status }
  }

  job.status = 'PRINTING'
  job.attempts = (job.attempts ?? 0) + 1
  job.updatedAt = new Date()
  await em.flush()

  try {
    const receiptPrinter = resolveReceiptPrinter(ctx)
    const printed = await receiptPrinter.print(receipt)
    job.status = 'PRINTED'
    job.printerJobId = printed.jobId
    job.printedAt = new Date()
    job.lastError = null
    job.updatedAt = new Date()
    await em.flush()
    return { jobId: job.id, status: job.status }
  } catch (err) {
    job.status = 'FAILED'
    job.lastError = err instanceof Error ? err.message : String(err)
    job.updatedAt = new Date()
    await em.flush()
    return { jobId: job.id, status: job.status }
  }
}
