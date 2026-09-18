#!/usr/bin/env node
/**
 * Coordinates Soanas local validation suites available in this repo.
 * Fails correctly when prerequisites are missing (does not invent success).
 *
 * Usage:
 *   yarn soanas:validate-local           # quick matrix
 *   yarn soanas:validate-local --full    # includes migrations + Gate suites when Docker OK
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const full = process.argv.includes('--full')
const started = Date.now()

function run(label, command, args, opts = {}) {
  console.log(`\n==> ${label}\n$ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: false,
    ...opts,
  })
  const code = result.status ?? 1
  if (code !== 0) {
    console.error(`\n[FAIL] ${label} exit=${code}`)
    process.exit(code)
  }
  console.log(`[PASS] ${label}`)
  return code
}

function hasDocker() {
  const result = spawnSync('docker', ['info'], { cwd: ROOT, stdio: 'ignore' })
  return (result.status ?? 1) === 0
}

let sha = 'unknown'
try {
  sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
} catch {
  /* ignore */
}

console.log(
  JSON.stringify(
    {
      suite: full ? 'soanas:validate-local:full' : 'soanas:validate-local:quick',
      sha,
      node: process.version,
      cwd: ROOT,
      docker: hasDocker(),
    },
    null,
    2,
  ),
)

run('check-coverage', process.execPath, [path.join(ROOT, 'scripts/soanas-check-coverage.mjs')])
run('check-stages', process.execPath, [path.join(ROOT, 'scripts/soanas-check-stages.mjs')])

const unitPackages = ['soanas-pos', 'soanas-cash', 'soanas-payments-br', 'soanas-core', 'soanas-establishments']
for (const name of unitPackages) {
  const pkg = path.join(ROOT, 'packages', name)
  if (!fs.existsSync(pkg)) {
    console.error(`[FAIL] missing package ${name}`)
    process.exit(1)
  }
  run(`unit @open-mercato/${name}`, 'yarn', ['workspace', `@open-mercato/${name}`, 'test'])
}

const localRuntimeTest = path.join(ROOT, 'packages/soanas-desktop/src/__tests__/local-runtime.test.ts')
if (fs.existsSync(localRuntimeTest)) {
  run('unit @open-mercato/soanas-desktop', 'yarn', ['workspace', '@open-mercato/soanas-desktop', 'test'])
} else {
  console.log('[SKIP] soanas-desktop unit — package not present yet')
}

if (full) {
  if (!hasDocker()) {
    console.error('[FAIL] --full requires Docker for ephemeral Postgres; docker info failed')
    process.exit(1)
  }
  run('validate-migrations', process.execPath, [path.join(ROOT, 'scripts/soanas-validate-migrations.mjs')])
} else {
  console.log('[SKIP] migrations/Gate E2E — pass --full when Docker ephemeral Postgres is required')
}

const durationMs = Date.now() - started
console.log(
  `\nsoanas:validate-local OK durationMs=${durationMs} sha=${sha} mode=${full ? 'full' : 'quick'}`,
)
console.log(
  'NOTE: local Cloud green does not prove offline-first; see E3 + RELEASE-CHECKLIST.',
)
