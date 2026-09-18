#!/usr/bin/env node
/**
 * Validates Soanas migrations via ephemeral integration on clean PostgreSQL.
 * Runs the Gate 0/1 + retail + E1 filter set — NOT RETAIL-001 alone.
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

const FILTER = 'TC-SOANAS'

console.log('[soanas] Gate 0/1 + E1 migration/integration validation')
console.log('[soanas] Expected migrations:', EXPECTED_MIGRATIONS.join(', '))
console.log(
  '[soanas] Filter path substring TC-SOANAS (Gate0 + manual tenders + retail + concurrency + recovery + E1; not RETAIL-001 alone)',
)
console.log('[soanas] Filter:', FILTER)

const result = spawnSync(
  'yarn',
  ['test:integration:ephemeral', '--filter', FILTER, '--no-screenshots'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ENABLE_CRUD_API_CACHE: process.env.ENABLE_CRUD_API_CACHE ?? 'true',
    },
  },
)

if (result.error) {
  console.error('[soanas] Failed to spawn integration runner:', result.error.message)
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('[soanas] Migration + Gate 0/1 + E1 validation finished successfully.')
