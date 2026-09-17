import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { conflict, isUniqueViolation } from '@open-mercato/shared/lib/crud/errors'
import { PosPrintJob, PosTransaction } from '../data/entities'
import { RECEIPT_PRINTER_DI_KEY } from '../di'
import { MockReceiptPrinter, type ReceiptPrinter, type SaleReceiptDocument } from './receipt'

/** Default lease for abandoned PRINTING recovery (ms). Override via SOANAS_PRINT_JOB_LEASE_MS. */
export const DEFAULT_PRINT_JOB_LEASE_MS = 60_000

function resolvePrintJobLeaseMs(): number {
  const raw = process.env.SOANAS_PRINT_JOB_LEASE_MS
  if (!raw) return DEFAULT_PRINT_JOB_LEASE_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_PRINT_JOB_LEASE_MS
  return Math.floor(parsed)
}

function resolveReceiptPrinter(ctx: CommandRuntimeContext): ReceiptPrinter {
  try {
    const printer = ctx.container.resolve(RECEIPT_PRINTER_DI_KEY) as ReceiptPrinter | undefined
    if (printer && typeof printer.print === 'function') return printer
  } catch {
    // Container may not have the registrar in isolated command unit tests.
  }
  return new MockReceiptPrinter()
}

async function findPrintJobByKey(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; idempotencyKey: string },
): Promise<PosPrintJob | null> {
  return em.findOne(PosPrintJob, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    idempotencyKey: scope.idempotencyKey,
    deletedAt: null,
  })
}

/**
 * Unique index is (tenant_id, idempotency_key). Cross-org collisions must conflict,
 * never return another organization's print job.
 */
async function resolveIdempotentPrintJobOrConflict(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string; idempotencyKey: string },
): Promise<PosPrintJob> {
  const sameOrg = await findPrintJobByKey(em, scope)
  if (sameOrg) return sameOrg
  const otherOrg = await em.findOne(PosPrintJob, {
    tenantId: scope.tenantId,
    idempotencyKey: scope.idempotencyKey,
    deletedAt: null,
  })
  if (otherOrg && otherOrg.organizationId !== scope.organizationId) {
    throw conflict('[internal] PrintJob idempotency key already used by another organization')
  }
  throw conflict('[internal] Duplicate PrintJob idempotency key')
}

async function ensurePrintJob(args: {
  em: EntityManager
  transaction: PosTransaction
  receipt: SaleReceiptDocument
  idempotencyKey: string
}): Promise<PosPrintJob> {
  const { em, transaction, receipt, idempotencyKey } = args
  const scope = {
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId,
    idempotencyKey,
  }

  const existing = await findPrintJobByKey(em, scope)
  if (existing) return existing

  const now = new Date()
  const job = em.create(PosPrintJob, {
    tenantId: transaction.tenantId,
    organizationId: transaction.organizationId,
    transactionId: transaction.id,
    kind: 'sale_receipt',
    status: 'QUEUED',
    payload: receipt as unknown as Record<string, unknown>,
    attempts: 0,
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  })
  em.persist(job)
  try {
    await em.flush()
    return job
  } catch (err) {
    if (isUniqueViolation(err, 'soanas_pos_print_jobs_idempotency_unique')) {
      return resolveIdempotentPrintJobOrConflict(em, scope)
    }
    throw err
  }
}

/**
 * Atomic claim: QUEUED|FAILED → PRINTING, or abandoned PRINTING past lease → PRINTING.
 * Returns the fencing token (`attempts`) on success, or null when another worker holds the lease.
 */
export async function claimPrintJob(args: {
  em: EntityManager
  job: PosPrintJob
  leaseMs?: number
  now?: Date
}): Promise<number | null> {
  const { em, job } = args
  const now = args.now ?? new Date()
  const leaseMs = args.leaseMs ?? resolvePrintJobLeaseMs()
  const leaseCutoff = new Date(now.getTime() - leaseMs)
  const currentAttempts = job.attempts ?? 0
  const fencingToken = currentAttempts + 1

  const claimedQueuedOrFailed = await em.nativeUpdate(
    PosPrintJob,
    {
      id: job.id,
      tenantId: job.tenantId,
      organizationId: job.organizationId,
      deletedAt: null,
      status: { $in: ['QUEUED', 'FAILED'] },
      attempts: currentAttempts,
    },
    {
      status: 'PRINTING',
      attempts: fencingToken,
      updatedAt: now,
      lastError: null,
    },
  )
  if (claimedQueuedOrFailed > 0) {
    job.status = 'PRINTING'
    job.attempts = fencingToken
    job.updatedAt = now
    job.lastError = null
    return fencingToken
  }

  const claimedAbandoned = await em.nativeUpdate(
    PosPrintJob,
    {
      id: job.id,
      tenantId: job.tenantId,
      organizationId: job.organizationId,
      deletedAt: null,
      status: 'PRINTING',
      attempts: currentAttempts,
      updatedAt: { $lt: leaseCutoff },
    },
    {
      status: 'PRINTING',
      attempts: fencingToken,
      updatedAt: now,
      lastError: null,
    },
  )
  if (claimedAbandoned > 0) {
    job.status = 'PRINTING'
    job.attempts = fencingToken
    job.updatedAt = now
    job.lastError = null
    return fencingToken
  }

  return null
}

/** Finalize only when the worker still owns the fencing token (attempts). */
export async function finalizePrintJob(args: {
  em: EntityManager
  job: PosPrintJob
  fencingToken: number
  outcome: 'PRINTED' | 'FAILED'
  printerJobId?: string | null
  lastError?: string | null
  now?: Date
}): Promise<boolean> {
  const { em, job, fencingToken, outcome } = args
  const now = args.now ?? new Date()
  const patch =
    outcome === 'PRINTED'
      ? {
          status: 'PRINTED' as const,
          printerJobId: args.printerJobId ?? null,
          printedAt: now,
          lastError: null,
          updatedAt: now,
        }
      : {
          status: 'FAILED' as const,
          lastError: args.lastError ?? null,
          updatedAt: now,
        }

  const affected = await em.nativeUpdate(
    PosPrintJob,
    {
      id: job.id,
      tenantId: job.tenantId,
      organizationId: job.organizationId,
      deletedAt: null,
      status: 'PRINTING',
      attempts: fencingToken,
    },
    patch,
  )
  if (affected > 0) {
    Object.assign(job, patch)
    return true
  }
  return false
}

/**
 * Persist a PrintJob before invoking the printer; failures never roll back COMPLETED sales (ADR-011).
 * Concurrent callers share one atomic claim; only the fencing-token owner may finalize.
 */
export async function enqueueAndAttemptPrint(args: {
  em: EntityManager
  ctx: CommandRuntimeContext
  transaction: PosTransaction
  receipt: SaleReceiptDocument
  leaseMs?: number
}): Promise<{ jobId: string; status: string; attempts?: number }> {
  const { em, ctx, transaction, receipt } = args
  const idempotencyKey = `sale_receipt:${transaction.id}`
  const job = await ensurePrintJob({ em, transaction, receipt, idempotencyKey })

  if (job.status === 'PRINTED') {
    return { jobId: job.id, status: job.status, attempts: job.attempts }
  }

  const fencingToken = await claimPrintJob({
    em,
    job,
    leaseMs: args.leaseMs,
  })
  if (fencingToken === null) {
    const latest = await findPrintJobByKey(em, {
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      idempotencyKey,
    })
    if (latest) {
      return { jobId: latest.id, status: latest.status, attempts: latest.attempts }
    }
    return { jobId: job.id, status: job.status, attempts: job.attempts }
  }

  try {
    const receiptPrinter = resolveReceiptPrinter(ctx)
    const printed = await receiptPrinter.print(receipt)
    await finalizePrintJob({
      em,
      job,
      fencingToken,
      outcome: 'PRINTED',
      printerJobId: printed.jobId,
    })
    return { jobId: job.id, status: job.status, attempts: job.attempts }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await finalizePrintJob({
      em,
      job,
      fencingToken,
      outcome: 'FAILED',
      lastError: message,
    })
    return { jobId: job.id, status: job.status, attempts: job.attempts }
  }
}
