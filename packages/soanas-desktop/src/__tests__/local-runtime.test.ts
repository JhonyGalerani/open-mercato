import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createLocalRuntimeConfig,
  assertLocalOrigin,
} from '../localRuntime'
import { LocalSaleJournal } from '../localSaleJournal'
import { resolveDesktopShellTarget } from '../shellTarget'

describe('soanas-desktop local runtime (E1 slice)', () => {
  it('rejects cloud SaaS origins for the desktop shell', () => {
    expect(() => assertLocalOrigin('https://app.soanas.example')).toThrow(/loopback or private LAN/)
    expect(() => createLocalRuntimeConfig({ uiOrigin: 'https://pos.cloud.example' })).toThrow()
  })

  it('resolves shell target to local POS sell path', () => {
    const config = createLocalRuntimeConfig({ uiOrigin: 'http://127.0.0.1:3000' })
    expect(resolveDesktopShellTarget(config)).toBe('http://127.0.0.1:3000/backend/soanas/pos/sell')
  })

  it('records a manual sale durably and survives process restart (re-open journal)', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soanas-desktop-'))
    const key = LocalSaleJournal.newIdempotencyKey()
    const first = new LocalSaleJournal(dataDir)
    first.append({
      idempotencyKey: key,
      tenantId: 't1',
      organizationId: 'o1',
      establishmentId: 'e1',
      terminalId: 'term-1',
      operatorUserId: 'op-1',
      grandTotalCents: '1590',
    })

    // Simulate process exit + relaunch: new instance, same data dir
    const second = new LocalSaleJournal(dataDir)
    const rows = second.list()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.idempotencyKey).toBe(key)
    expect(rows[0]?.grandTotalCents).toBe('1590')
    expect(rows[0]?.status).toBe('recorded')

    const replay = second.append({
      idempotencyKey: key,
      tenantId: 't1',
      organizationId: 'o1',
      establishmentId: 'e1',
      terminalId: 'term-1',
      operatorUserId: 'op-1',
      grandTotalCents: '1590',
    })
    expect(replay.idempotencyKey).toBe(key)
    expect(second.list()).toHaveLength(1)
  })

  it('does not allow idempotent replay with conflicting totals', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soanas-desktop-'))
    const journal = new LocalSaleJournal(dataDir)
    const key = LocalSaleJournal.newIdempotencyKey()
    journal.append({
      idempotencyKey: key,
      tenantId: 't1',
      organizationId: 'o1',
      establishmentId: 'e1',
      terminalId: 'term-1',
      operatorUserId: 'op-1',
      grandTotalCents: '1000',
    })
    expect(() =>
      journal.append({
        idempotencyKey: key,
        tenantId: 't1',
        organizationId: 'o1',
        establishmentId: 'e1',
        terminalId: 'term-1',
        operatorUserId: 'op-1',
        grandTotalCents: '2000',
      }),
    ).toThrow(/idempotency conflict/)
  })
})
