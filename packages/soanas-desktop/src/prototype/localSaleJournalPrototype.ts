import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * PROTOTYPE ONLY — NOT operational POS persistence and NOT a transactional outbox.
 *
 * ADR-013 / ADR-005 require store-local PostgreSQL as the sale authority.
 * This JSONL helper must never be treated as proof of atomic sale+effects.
 * Prefer Postgres-backed POS transactions (`soanas-pos` saga) for E1 durability.
 *
 * @deprecated Do not wire into completePosSale or sync. Kept for isolated unit demos.
 */
export type JournalSaleRecord = {
  idempotencyKey: string
  tenantId: string
  organizationId: string
  establishmentId: string
  terminalId: string
  operatorUserId: string
  grandTotalCents: string
  status: 'recorded'
  createdAt: string
  prototype: true
}

export type JournalAppendInput = Omit<JournalSaleRecord, 'status' | 'createdAt' | 'prototype'> & {
  createdAt?: string
}

/** @deprecated Prototype — see file header. */
export class LocalSaleJournalPrototype {
  readonly filePath: string
  readonly isPrototype = true as const

  constructor(dataDir: string, fileName = 'PROTOTYPE-sale-journal.jsonl') {
    this.filePath = path.join(dataDir, fileName)
  }

  ensure(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8')
    }
  }

  append(input: JournalAppendInput): JournalSaleRecord {
    this.ensure()
    const existing = this.list()
    const duplicate = existing.find((row) => row.idempotencyKey === input.idempotencyKey)
    if (duplicate) {
      if (
        duplicate.tenantId !== input.tenantId ||
        duplicate.organizationId !== input.organizationId ||
        duplicate.grandTotalCents !== input.grandTotalCents
      ) {
        throw new Error('[internal] soanas-desktop prototype journal idempotency conflict')
      }
      return duplicate
    }
    const record: JournalSaleRecord = {
      ...input,
      status: 'recorded',
      createdAt: input.createdAt ?? new Date().toISOString(),
      prototype: true,
    }
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, 'utf8')
    return record
  }

  list(): JournalSaleRecord[] {
    this.ensure()
    const raw = fs.readFileSync(this.filePath, 'utf8')
    if (!raw.trim()) return []
    return raw
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => JSON.parse(line) as JournalSaleRecord)
  }

  static newIdempotencyKey(): string {
    return crypto.randomUUID()
  }
}

/** @deprecated Alias kept so old imports fail loudly in review — prefer LocalSaleJournalPrototype. */
export const LocalSaleJournal = LocalSaleJournalPrototype
