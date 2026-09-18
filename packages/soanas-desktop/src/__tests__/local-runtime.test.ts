import {
  assertLocalOrigin,
  createLocalRuntimeConfig,
  isLocalOrPrivateHost,
} from '../localRuntime'
import { decideShellNavigation } from '../navigationGuard'
import { LocalSaleJournalPrototype } from '../prototype/localSaleJournalPrototype'
import { resolveDesktopShellTarget } from '../shellTarget'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('assertLocalOrigin (strict)', () => {
  it('accepts only http/https loopback and private literals', () => {
    expect(() => assertLocalOrigin('http://127.0.0.1:3000')).not.toThrow()
    expect(() => assertLocalOrigin('https://localhost')).not.toThrow()
    expect(() => assertLocalOrigin('http://[::1]:3000')).not.toThrow()
    expect(() => assertLocalOrigin('http://10.0.0.5:3000')).not.toThrow()
    expect(() => assertLocalOrigin('http://192.168.1.10')).not.toThrow()
    expect(() => assertLocalOrigin('http://172.16.0.1')).not.toThrow()
    expect(() => assertLocalOrigin('http://172.31.255.255')).not.toThrow()
  })

  it('rejects non-http(s) protocols', () => {
    expect(() => assertLocalOrigin('file:///tmp')).toThrow(/http or https/)
    expect(() => assertLocalOrigin('ftp://127.0.0.1')).toThrow(/http or https/)
  })

  it('rejects credentials and non-origin components', () => {
    expect(() => assertLocalOrigin('http://user:pass@127.0.0.1:3000')).toThrow(/credentials/)
    expect(() => assertLocalOrigin('http://127.0.0.1:3000/backend')).toThrow(/path, query, or hash/)
    expect(() => assertLocalOrigin('http://127.0.0.1:3000?x=1')).toThrow(/path, query, or hash/)
    expect(() => assertLocalOrigin('http://127.0.0.1:3000#frag')).toThrow(/path, query, or hash/)
  })

  it('rejects public IPs, cloud hosts, and domains that imitate private IPs', () => {
    expect(() => assertLocalOrigin('https://app.soanas.example')).toThrow(/loopback or private/)
    expect(() => assertLocalOrigin('http://8.8.8.8')).toThrow(/loopback or private/)
    expect(() => assertLocalOrigin('http://10.0.0.1.evil.example')).toThrow(/loopback or private/)
    expect(() => assertLocalOrigin('http://192.168.1.1.attacker.test')).toThrow(/loopback or private/)
    expect(() => assertLocalOrigin('http://127.0.0.1.nip.io')).toThrow(/loopback or private/)
    expect(isLocalOrPrivateHost('10.0.0.1.evil.example')).toBe(false)
    expect(isLocalOrPrivateHost('172.32.0.1')).toBe(false)
  })

  it('treats IPv6 loopback and ULA correctly without string prefix tricks', () => {
    expect(isLocalOrPrivateHost('::1')).toBe(true)
    expect(isLocalOrPrivateHost('fc00::1')).toBe(true)
    expect(isLocalOrPrivateHost('fd12:3456:789a::1')).toBe(true)
    expect(isLocalOrPrivateHost('fe80::1')).toBe(true)
    expect(isLocalOrPrivateHost('2001:db8::1')).toBe(false)
  })
})

describe('navigationGuard', () => {
  const origin = 'http://127.0.0.1:3000'

  it('allows same-origin POS paths and blocks external navigations/windows', () => {
    expect(decideShellNavigation('http://127.0.0.1:3000/backend/soanas/pos/sell', origin).allow).toBe(true)
    expect(decideShellNavigation('about:blank', origin).allow).toBe(true)
    expect(decideShellNavigation('https://evil.example/', origin).allow).toBe(false)
    expect(decideShellNavigation('http://192.168.0.1:3000/', origin).allow).toBe(false)
    expect(decideShellNavigation('http://user:pass@127.0.0.1:3000/', origin).allow).toBe(false)
  })
})

describe('shell target', () => {
  it('resolves shell target to local POS sell path', () => {
    const config = createLocalRuntimeConfig({ uiOrigin: 'http://127.0.0.1:3000' })
    expect(resolveDesktopShellTarget(config)).toBe('http://127.0.0.1:3000/backend/soanas/pos/sell')
  })
})

describe('LocalSaleJournalPrototype (non-operational)', () => {
  it('is explicitly marked prototype and must not be used as sale authority', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soanas-proto-'))
    const journal = new LocalSaleJournalPrototype(dataDir)
    expect(journal.isPrototype).toBe(true)
    const key = LocalSaleJournalPrototype.newIdempotencyKey()
    const row = journal.append({
      idempotencyKey: key,
      tenantId: 't1',
      organizationId: 'o1',
      establishmentId: 'e1',
      terminalId: 'term-1',
      operatorUserId: 'op-1',
      grandTotalCents: '100',
    })
    expect(row.prototype).toBe(true)
  })
})
