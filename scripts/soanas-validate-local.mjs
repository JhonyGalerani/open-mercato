#!/usr/bin/env node
/**
 * Coordinates Soanas local validation suites available in this repo.
 * Fails correctly when prerequisites are missing (does not invent success).
 *
 * Usage:
 *   yarn soanas:validate-local           # quick matrix (units + coverage)
 *   yarn soanas:validate-local --full    # + typecheck/build + Gate 0/1 + manual tenders + E1
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const full = process.argv.includes('--full')
const started = Date.now()
const EPHEMERAL_ENV = path.join(ROOT, '.ai', 'qa', 'ephemeral-env.json')
const SPECIALIZED_CONFIG = '.ai/qa/tests/soanas-retail-api.playwright.config.ts'
const E1_CONFIG = '.ai/qa/tests/soanas-e1-boot.playwright.config.ts'

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
    env: opts.env ?? process.env,
    shell: false,
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

function sleepSync(ms) {
  spawnSync('sleep', [String(Math.ceil(ms / 1000))], { stdio: 'ignore' })
}

function readEphemeralState() {
  try {
    return JSON.parse(fs.readFileSync(EPHEMERAL_ENV, 'utf8'))
  } catch {
    return null
  }
}

function stopProcessTree(child) {
  if (!child.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
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
  ]

  console.log('\n==> playwright --list (Gate 0/1 + manual tenders)')
  const listResult = spawnSync(
    'yarn',
    ['playwright', 'test', '--config', SPECIALIZED_CONFIG, '--list'],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  )
  const listE1 = spawnSync(
    'yarn',
    ['playwright', 'test', '--config', E1_CONFIG, '--list'],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  )
  const listOut = `${listResult.stdout || ''}${listResult.stderr || ''}\n${listE1.stdout || ''}${listE1.stderr || ''}`
  console.log(listOut)
  const listed = [...listOut.matchAll(/TC-SOANAS-[A-Z0-9-]+/g)].map((match) => match[0])
  const uniqueListed = [...new Set(listed)]
  console.log(`[info] discovered test ids in --list: ${uniqueListed.length} → ${uniqueListed.join(', ') || '(none)'}`)
  record(
    'playwright-list',
    listResult.status === 0 && listE1.status === 0 ? 'pass' : 'fail',
    `ids=${uniqueListed.length}`,
  )
  if (listResult.status !== 0 || listE1.status !== 0) {
    printReport()
    process.exit(listResult.status || listE1.status || 1)
  }
  for (const required of [...gateFilters, 'TC-SOANAS-E1-LOCAL-BOOT-001']) {
    if (!uniqueListed.includes(required)) {
      console.error(`[FAIL] required suite missing from discovery: ${required}`)
      record('matrix-discovery', 'fail', `missing ${required}`)
      printReport()
      process.exit(1)
    }
  }

  try {
    fs.rmSync(path.join(ROOT, 'apps/mercato/.mercato/server-start.lock'), { force: true })
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(EPHEMERAL_ENV, { force: true })
  } catch {
    /* ignore */
  }

  console.log('\n==> start ephemeral Postgres+app (yarn mercato test:ephemeral --no-reuse-env)')
  const bootStartedAt = Date.now()
  const ephemeralChild = spawn(
    'yarn',
    ['mercato', 'test:ephemeral', '--no-reuse-env', '--no-screenshots'],
    {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  )
  ephemeralChild.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  ephemeralChild.stderr?.on('data', (chunk) => process.stderr.write(chunk))

  const bootDeadline = Date.now() + 900_000
  let ephemeral = null
  while (Date.now() < bootDeadline) {
    if (ephemeralChild.exitCode !== null) {
      record('ephemeral-boot', 'fail', `exited ${ephemeralChild.exitCode}`)
      console.error(`[FAIL] ephemeral process exited before ready (code ${ephemeralChild.exitCode})`)
      printReport()
      process.exit(ephemeralChild.exitCode || 1)
    }
    ephemeral = readEphemeralState()
    if (
      ephemeral?.status === 'running' &&
      ephemeral.baseUrl &&
      ephemeral.databaseUrl &&
      ephemeral.startedAt &&
      Date.parse(ephemeral.startedAt) >= bootStartedAt - 5_000
    ) {
      // Confirm the HTTP port actually accepts connections (reject stale env files).
      const probe = spawnSync(
        process.execPath,
        [
          '-e',
          `fetch(process.argv[1]+'/login',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status?0:1)).catch(()=>process.exit(1))`,
          ephemeral.baseUrl,
        ],
        { cwd: ROOT, stdio: 'ignore' },
      )
      if (probe.status === 0) break
    }
    ephemeral = null
    sleepSync(2000)
  }
  if (!ephemeral?.baseUrl) {
    stopProcessTree(ephemeralChild)
    record('ephemeral-boot', 'fail', 'timeout')
    console.error('[FAIL] timed out waiting for .ai/qa/ephemeral-env.json')
    printReport()
    process.exit(1)
  }
  record('ephemeral-boot', 'pass', ephemeral.baseUrl)
  console.log(`[PASS] ephemeral-boot ${ephemeral.baseUrl}`)

  const pwEnv = {
    ...process.env,
    BASE_URL: ephemeral.baseUrl,
    APP_URL: ephemeral.baseUrl,
    DATABASE_URL: ephemeral.databaseUrl,
    JWT_SECRET: 'om-ephemeral-integration-jwt-secret',
    OM_INIT_ADMIN_PASSWORD: 'secret',
    OM_INIT_EMPLOYEE_PASSWORD: 'secret',
    OM_INTEGRATION_TEST: 'true',
    OM_TEST_MODE: '1',
    PW_CAPTURE_SCREENSHOTS: '0',
  }

  try {
    run('integration Gate0/1 + manual tenders + retail (specialized config)', 'yarn', [
      'playwright',
      'test',
      '--config',
      SPECIALIZED_CONFIG,
    ], { env: pwEnv })
    run('integration E1 local boot + process restart', 'yarn', [
      'playwright',
      'test',
      '--config',
      E1_CONFIG,
    ], { env: pwEnv })
  } finally {
    console.log('\n==> stopping ephemeral environment')
    stopProcessTree(ephemeralChild)
    sleepSync(2000)
    try {
      fs.rmSync(path.join(ROOT, 'apps/mercato/.mercato/server-start.lock'), { force: true })
    } catch {
      /* ignore */
    }
  }
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
