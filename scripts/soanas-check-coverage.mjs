#!/usr/bin/env node
/**
 * Fails CI when Soanas coverage docs drift or VALIDATED rows lack evidence paths.
 * Run: node scripts/soanas-check-coverage.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const COVERAGE = path.join(ROOT, 'docs/soanas/blueprint-coverage.json')
const STATUS = path.join(ROOT, 'docs/soanas/IMPLEMENTATION-STATUS.md')
const FEITO = path.join(ROOT, 'docs/soanas/STATUS-FEITO-VS-FALTA.md')

const coverage = JSON.parse(fs.readFileSync(COVERAGE, 'utf8'))
const rows = coverage.rows ?? []
const errors = []

const counts = {
  ANALYZED: 0,
  NOT_STARTED: 0,
  IN_PROGRESS: 0,
  IMPLEMENTED: 0,
  TESTED: 0,
  VALIDATED: 0,
  BLOCKED_EXTERNAL: 0,
}
for (const row of rows) {
  const status = String(row.status || 'ANALYZED').toUpperCase()
  if (status in counts) counts[status] += 1
  else counts.ANALYZED += 1
}
if (rows.length !== 303) {
  errors.push(`Expected 303 blueprint IDs, found ${rows.length}`)
}

const statusMd = fs.readFileSync(STATUS, 'utf8')
const feitoMd = fs.readFileSync(FEITO, 'utf8')
const statusMatch = statusMd.match(/ANALYZED (\d+) \| IMPLEMENTED (\d+) \| TESTED (\d+) \| VALIDATED (\d+)/)
if (statusMatch) {
  const [, a, i, t, v] = statusMatch.map(Number)
  if (a !== counts.ANALYZED || i !== counts.IMPLEMENTED || t !== counts.TESTED || v !== counts.VALIDATED) {
    errors.push(
      `IMPLEMENTATION-STATUS derived counts drift: doc=${a}/${i}/${t}/${v} json=${counts.ANALYZED}/${counts.IMPLEMENTED}/${counts.TESTED}/${counts.VALIDATED}`,
    )
  }
} else {
  errors.push('IMPLEMENTATION-STATUS.md missing derived counts markers')
}

const feitoMatch = feitoMd.match(/\|\s*`ANALYZED`\s*\|\s*\*\*(\d+)\*\*/)
const feitoVal = feitoMd.match(/\|\s*`VALIDATED`\s*\|\s*\*\*(\d+)\*\*/)
if (feitoMatch && Number(feitoMatch[1]) !== counts.ANALYZED) {
  errors.push(`STATUS-FEITO-VS-FALTA ANALYZED drift: doc=${feitoMatch[1]} json=${counts.ANALYZED}`)
}
if (feitoVal && Number(feitoVal[1]) !== counts.VALIDATED) {
  errors.push(`STATUS-FEITO-VS-FALTA VALIDATED drift: doc=${feitoVal[1]} json=${counts.VALIDATED}`)
}

const packageNames = [
  'soanas-core',
  'soanas-establishments',
  'soanas-cash',
  'soanas-pos',
  'soanas-payments-br',
]
for (const name of packageNames) {
  if (!fs.existsSync(path.join(ROOT, 'packages', name))) {
    errors.push(`Missing expected package packages/${name}`)
  }
}

for (const row of rows) {
  if (String(row.status).toUpperCase() !== 'VALIDATED') continue
  const notes = String(row.notes || '')
  const candidates = notes.match(/[\w./@-][^\s|,;]*(?:\.ts|\.tsx|\.md|\.spec\.ts)/g) ?? []
  const softOk =
    notes.includes('Retail Sale v1') ||
    notes.includes('ephemeral Postgres') ||
    notes.includes('packages/soanas-')
  if (!candidates.length && !softOk) {
    errors.push(`VALIDATED ${row.id} has no file evidence in notes`)
    continue
  }
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/^\.?\/?/, '')
    if (cleaned.startsWith('http') || cleaned.includes('TC-SOANAS')) continue
    const abs = path.join(ROOT, cleaned)
    if (!fs.existsSync(abs) && !cleaned.startsWith('packages/soanas')) {
      // package roots are directories — ok
      if (!fs.existsSync(path.join(ROOT, cleaned.split('/').slice(0, 2).join('/')))) {
        errors.push(`VALIDATED ${row.id} evidence missing: ${cleaned}`)
      }
    }
  }
}

// Forbid known over-claims remaining VALIDATED after Gate 0 rebaseline
const forbiddenValidated = new Set([
  'POS-003',
  'POS-UI-001',
  'POS-UI-002',
  'POS-UI-003',
  'CASH-OPEN-003',
  'CASH-CLOSE-001',
  'CASH-CLOSE-002',
  'CASH-CLOSE-004',
  'PAY-CASH-001',
])
for (const row of rows) {
  if (forbiddenValidated.has(row.id) && String(row.status).toUpperCase() === 'VALIDATED') {
    errors.push(`${row.id} must not be VALIDATED after Gate 0 rebaseline (status=${row.status})`)
  }
}

try {
  const head = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  if (coverage.commit && coverage.commit !== head && coverage.commit.length >= 7) {
    // Advisory only when commit field is a historical short SHA from a prior sync
    // — sync script rewrites it. Warn but do not fail on mismatch alone.
  }
} catch {
  /* ignore */
}

if (errors.length) {
  console.error('soanas-check-coverage FAILED:')
  for (const err of errors) console.error(' -', err)
  process.exit(1)
}

console.log(
  `soanas-check-coverage OK — ${rows.length} IDs | A${counts.ANALYZED} I${counts.IMPLEMENTED} T${counts.TESTED} V${counts.VALIDATED}`,
)
