#!/usr/bin/env node
/**
 * Validates Soanas Gate 0/1 migrations via ephemeral integration (clean PostgreSQL).
 * Requires Docker/testcontainers — same runtime as `yarn test:integration:ephemeral`.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const EXPECTED_MIGRATIONS = [
  'Migration20260916120000_soanas_payments_pix_idempotency',
  'Migration20260916130000_soanas_pos_gate0',
  'Migration20260916140000_soanas_pos_manual_tenders',
]

console.log('[soanas] Gate 0/1 migration validation')
console.log('[soanas] Expected migrations:', EXPECTED_MIGRATIONS.join(', '))
console.log('[soanas] Bootstrapping ephemeral Postgres and running retail smoke test...')

const result = spawnSync('yarn', ['test:integration:ephemeral', '--', 'TC-SOANAS-RETAIL-001'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('[soanas] Migration validation finished successfully.')
