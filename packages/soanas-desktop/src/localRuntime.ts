import path from 'node:path'
import { assertLocalOrigin } from './localOrigin'

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
  const parsedPort = new URL(uiOrigin).port
  const fromEnv = process.env.SOANAS_LOCAL_APP_PORT
  const appPort = args?.appPort ?? Number(fromEnv || parsedPort || '3000')
  assertLocalOrigin(uiOrigin)
  return {
    dataDir,
    uiOrigin,
    appPort,
    postgresUrlEnv: 'DATABASE_URL',
    allowRemoteCdn: false,
  }
}

export { assertLocalOrigin, isLocalOrPrivateHost, expandIpv6 } from './localOrigin'
