#!/usr/bin/env node
/**
 * Coordinates Soanas local validation suites available in this repo.
 * Fails correctly when prerequisites are missing (does not invent success).
 *
 * Usage:
 *   yarn soanas:validate-local           # quick matrix (units + coverage)
 *   yarn soanas:validate-local --full    # + typecheck/build + Gate 0/1 + manual tenders + E1 boot
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const full = process.argv.includes('--full')
const started = Date.now()

/** @type {{ label: string, status: 'pass'|'fail'|'skip', detail?: string }[]} */
const report = []

function record(label, status, detail) {
  report.push({ label, status, detail })
}

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
    record(label, 'fail', `exit=${code}`)
    console.error(`\n[FAIL] ${label} exit=${code}`)
    printReport()
    process.exit(code)
  }
  record(label, 'pass')
  console.log(`[PASS] ${label}`)
  return code
}

function hasDocker() {
  const result = spawnSync('docker', ['info'], { cwd: ROOT, stdio: 'ignore' })
  return (result.status ?? 1) === 0
}

function printReport() {
  const passed = report.filter((row) => row.status === 'pass').length
  const failed = report.filter((row) => row.status === 'fail').length
  const skipped = report.filter((row) => row.status === 'skip').length
  console.log(
    `\n--- soanas:validate-local report ---\n` +
      JSON.stringify(
        {
          discoveredSteps: report.length,
          executed: passed + failed,
          passed,
          failed,
          skipped,
          steps: report,
        },
        null,
        2,
      ),
  )
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

const unitPackages = [
  'soanas-pos',
  'soanas-cash',
  'soanas-payments-br',
  'soanas-core',
  'soanas-establishments',
  'soanas-desktop',
]
for (const name of unitPackages) {
  const pkg = path.join(ROOT, 'packages', name)
  if (!fs.existsSync(pkg)) {
    record(`unit @open-mercato/${name}`, 'fail', 'missing package')
    console.error(`[FAIL] missing package ${name}`)
    printReport()
    process.exit(1)
  }
  run(`unit @open-mercato/${name}`, 'yarn', ['workspace', `@open-mercato/${name}`, 'test'])
}

if (full) {
  if (!hasDocker()) {
    record('docker', 'fail', 'required for --full')
    console.error('[FAIL] --full requires Docker for ephemeral Postgres; docker info failed')
    printReport()
    process.exit(1)
  }

  for (const name of unitPackages) {
    run(`typecheck @open-mercato/${name}`, 'yarn', ['workspace', `@open-mercato/${name}`, 'typecheck'])
  }
  for (const name of unitPackages) {
    run(`build @open-mercato/${name}`, 'yarn', ['workspace', `@open-mercato/${name}`, 'build'])
  }

  const gateFilters = [
    'TC-SOANAS-GATE0-CASH-APPROVAL-001',
    'TC-SOANAS-GATE0-PIX-SCOPE-001',
    'TC-SOANAS-GATE0-MULTILOC-001',
    'TC-SOANAS-GATE0-PRINTJOB-001',
    'TC-SOANAS-POS-MANUAL-TENDERS-001',
    'TC-SOANAS-RETAIL-001',
    'TC-SOANAS-RETAIL-CONCURRENCY',
    'TC-SOANAS-RETAIL-RECOVERY',
    'TC-SOANAS-E1-LOCAL-BOOT-001',
  ]

  console.log('\n==> playwright --list (Gate 0/1 + manual tenders + E1)')
  const listResult = spawnSync(
    'yarn',
    [
      'playwright',
      'test',
      '--config',
      '.ai/qa/tests/soanas-retail-api.playwright.config.ts',
      '--list',
    ],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  )
  const listOut = `${listResult.stdout || ''}${listResult.stderr || ''}`
  console.log(listOut)
  const listed = [...listOut.matchAll(/TC-SOANAS-[A-Z0-9-]+/g)].map((match) => match[0])
  const uniqueListed = [...new Set(listed)]
  console.log(`[info] discovered test ids in --list: ${uniqueListed.length} → ${uniqueListed.join(', ') || '(none)'}`)
  record('playwright-list', listResult.status === 0 ? 'pass' : 'fail', `ids=${uniqueListed.length}`)

  // Playwright file filters are path substrings (not regex). Use shared TC-SOANAS prefix
  // so Gate 0/1, manual tenders, retail, recovery, concurrency, and E1 all run in one ephemeral boot.
  // Discovery list above enumerates the specialized Gate matrix explicitly.
  const filterPattern = 'TC-SOANAS'
  console.log(`\n[info] ephemeral integration filter (path substring): ${filterPattern}`)
  console.log(`[info] required matrix includes: ${gateFilters.join(', ')}`)
  run(
    'integration Gate0/1 + manual tenders + E1 (ephemeral Postgres)',
    'yarn',
    ['test:integration:ephemeral', '--filter', filterPattern, '--no-screenshots'],
  )
} else {
  record('integration Gate0/1 + E1', 'skip', 'pass --full when Docker ephemeral Postgres is required')
  console.log('[SKIP] Gate 0/1 + E1 integration — pass --full when Docker ephemeral Postgres is required')
  record('typecheck/build soanas packages', 'skip', 'quick mode')
}

const durationMs = Date.now() - started
printReport()
console.log(
  `\nsoanas:validate-local OK durationMs=${durationMs} sha=${sha} mode=${full ? 'full' : 'quick'}`,
)
console.log(
  'NOTE: local Cloud green does not prove Windows installer or physical hardware; see RELEASE-CHECKLIST.',
)
