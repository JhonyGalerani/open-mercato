import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalRuntimeConfig } from './localRuntime'
import { probeLocalBoot } from './localBoot'

export type RestartResult = {
  previousPids: number[]
  newPid: number | null
  baseUrl: string
  ready: boolean
  mode: 'sigkill-restart'
  lockCleared: boolean
}

function projectRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../../..')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** PIDs listening on TCP port (Linux ss). Empty if none / unsupported. */
export function findPidsListeningOnPort(port: number): number[] {
  try {
    const output = execFileSync('ss', ['-ltnp'], { encoding: 'utf8' })
    const pids = new Set<number>()
    const portPattern = new RegExp(`:${port}\\b`)
    for (const line of output.split('\n')) {
      if (!portPattern.test(line)) continue
      for (const match of line.matchAll(/pid=(\d+)/g)) {
        const pid = Number(match[1])
        if (Number.isInteger(pid) && pid > 0) pids.add(pid)
      }
    }
    return [...pids]
  } catch {
    return []
  }
}

export function killPids(pids: number[], signal: NodeJS.Signals = 'SIGKILL'): void {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    } catch {
      /* already exited */
    }
  }
}

async function waitForPidsGone(pids: number[], timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const alive = pids.filter((pid) => isPidAlive(pid))
    if (alive.length === 0) return
    await sleep(100)
  }
}

/**
 * Clears apps/mercato/.mercato/server-start.lock when the holder is dead or was just killed.
 * Required after SIGKILL — the lock file otherwise blocks the next `yarn start`.
 */
export function clearServerStartLock(appDirectory: string, killedPids: number[] = []): boolean {
  const lockPath = path.join(appDirectory, '.mercato', 'server-start.lock')
  if (!fs.existsSync(lockPath)) return false
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: number }
    const lockPid = typeof raw.pid === 'number' ? raw.pid : null
    if (lockPid && killedPids.includes(lockPid)) {
      fs.rmSync(lockPath, { force: true })
      return true
    }
    if (lockPid && isPidAlive(lockPid)) {
      killPids([lockPid], 'SIGKILL')
      fs.rmSync(lockPath, { force: true })
      return true
    }
    fs.rmSync(lockPath, { force: true })
    return true
  } catch {
    fs.rmSync(lockPath, { force: true })
    return true
  }
}

/**
 * Abruptly kill the process(es) bound to the local UI port and respawn
 * `yarn start` in apps/mercato with the same DATABASE_URL / BASE_URL / PORT.
 * Postgres must keep running — this is the E1 process-restart proof.
 * Re-instantiating a class is NOT a restart.
 */
export async function restartStoreLocalAppProcess(options?: {
  baseUrl?: string
  databaseUrl?: string
  appDirectory?: string
  readyTimeoutMs?: number
  signal?: NodeJS.Signals
}): Promise<RestartResult> {
  const baseUrl = (options?.baseUrl ?? process.env.BASE_URL ?? process.env.APP_URL ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  )
  const runtime = createLocalRuntimeConfig({ uiOrigin: baseUrl })
  const port = Number(new URL(runtime.uiOrigin).port || runtime.appPort)
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('[internal] soanas-desktop restart requires DATABASE_URL (Postgres must survive)')
  }

  const previousPids = findPidsListeningOnPort(port)
  if (previousPids.length === 0) {
    throw new Error(`[internal] soanas-desktop no process listening on port ${port}`)
  }

  killPids(previousPids, options?.signal ?? 'SIGKILL')
  await waitForPidsGone(previousPids, 15_000)

  const root = projectRootFromHere()
  const appDirectory = options?.appDirectory ?? path.join(root, 'apps/mercato')
  const lockCleared = clearServerStartLock(appDirectory, previousPids)

  const logDir = path.join(root, '.soanas-local', 'restart-logs')
  fs.mkdirSync(logDir, { recursive: true })
  const outPath = path.join(logDir, `app-${Date.now()}.log`)
  const outFd = fs.openSync(outPath, 'a')

  const child: ChildProcess = spawn('yarn', ['start'], {
    cwd: appDirectory,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      BASE_URL: baseUrl,
      APP_URL: baseUrl,
      PORT: String(port),
      HOST: '127.0.0.1',
      HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', outFd, outFd],
    detached: true,
  })
  child.unref()
  fs.closeSync(outFd)

  const readyTimeoutMs = options?.readyTimeoutMs ?? 180_000
  const started = Date.now()
  let ready = false
  while (Date.now() - started < readyTimeoutMs) {
    const listening = findPidsListeningOnPort(port)
    if (listening.length > 0) {
      const probe = await probeLocalBoot(runtime)
      if (probe.loginPage.ok && probe.health.ok) {
        ready = true
        break
      }
    }
    // Fail fast if child exited without binding the port
    if (child.exitCode !== null && findPidsListeningOnPort(port).length === 0) {
      break
    }
    await sleep(2000)
  }

  const newPids = findPidsListeningOnPort(port)
  return {
    previousPids,
    newPid: newPids[0] ?? child.pid ?? null,
    baseUrl,
    ready,
    mode: 'sigkill-restart',
    lockCleared,
  }
}
