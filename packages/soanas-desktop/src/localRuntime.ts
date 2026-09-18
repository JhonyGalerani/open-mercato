import path from 'node:path'

export const DEFAULT_LOCAL_UI_ORIGIN = 'http://127.0.0.1:3000'

export type LocalRuntimeConfig = {
  /** Absolute data directory (separate from binaries). */
  dataDir: string
  /** Local Mercato/Soanas UI origin — must be loopback or store LAN, not cloud SaaS. */
  uiOrigin: string
  /** App/API listen port expectation for health checks. */
  appPort: number
  /** Postgres connection is owned by the store-local stack (E1/E8); DSN never logged. */
  postgresUrlEnv: string
  /** Forbid remote CDN for essential assets in packaged mode. */
  allowRemoteCdn: boolean
}

export function createLocalRuntimeConfig(args?: {
  dataDir?: string
  uiOrigin?: string
  appPort?: number
}): LocalRuntimeConfig {
  const dataDir = args?.dataDir ?? path.join(process.cwd(), '.soanas-local')
  const uiOrigin = (args?.uiOrigin ?? process.env.SOANAS_LOCAL_UI_ORIGIN ?? DEFAULT_LOCAL_UI_ORIGIN).replace(
    /\/$/,
    '',
  )
  const appPort = args?.appPort ?? Number(process.env.SOANAS_LOCAL_APP_PORT || 3000)
  assertLocalOrigin(uiOrigin)
  return {
    dataDir,
    uiOrigin,
    appPort,
    postgresUrlEnv: 'DATABASE_URL',
    allowRemoteCdn: false,
  }
}

export function assertLocalOrigin(origin: string): void {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    throw new Error('[internal] soanas-desktop invalid uiOrigin')
  }
  const host = url.hostname.toLowerCase()
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  if (!local) {
    throw new Error('[internal] soanas-desktop uiOrigin must be loopback or private LAN (ADR-013)')
  }
}
