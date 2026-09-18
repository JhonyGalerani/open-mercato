#!/usr/bin/env node
/**
 * Validates Soanas migrations via ephemeral integration on clean PostgreSQL.
 * Delegates to `yarn soanas:validate-local --full` integration path semantics:
 * specialized Gate 0/1 + manual tenders + E1 config (not RETAIL-001 alone).
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

console.log('[soanas] Gate 0/1 + E1 migration/integration validation')
console.log('[soanas] Expected migrations:', EXPECTED_MIGRATIONS.join(', '))
console.log('[soanas] Delegating to soanas:validate-local --full (includes units/typecheck/build + Gate matrix)')

const result = spawnSync('yarn', ['soanas:validate-local', '--full'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  console.error('[soanas] Failed to spawn validate-local:', result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
