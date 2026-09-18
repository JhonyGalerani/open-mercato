import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

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
}

export type JournalAppendInput = Omit<JournalSaleRecord, 'status' | 'createdAt'> & {
  createdAt?: string
}

/**
 * Append-only local sale journal used by E1 to prove durable recording across process restart.
 * E3 replaces/extends this with transactional Postgres outbox — this file-backed journal is not
 * the production sync transport.
 */
export class LocalSaleJournal {
  readonly filePath: string

  constructor(dataDir: string, fileName = 'sale-journal.jsonl') {
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
        throw new Error('[internal] soanas-desktop journal idempotency conflict')
      }
      return duplicate
    }
    const record: JournalSaleRecord = {
      ...input,
      status: 'recorded',
      createdAt: input.createdAt ?? new Date().toISOString(),
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
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JournalSaleRecord)
  }

  static newIdempotencyKey(): string {
    return crypto.randomUUID()
  }
}
