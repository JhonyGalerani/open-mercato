import { createLocalRuntimeConfig, type LocalRuntimeConfig } from './localRuntime'

/**
 * Where the Electron (or other) shell should navigate on launch.
 * Cloud SaaS URLs are rejected by createLocalRuntimeConfig.
 */
export function resolveDesktopShellTarget(config?: LocalRuntimeConfig): string {
  const runtime = config ?? createLocalRuntimeConfig()
  return `${runtime.uiOrigin}/backend/soanas/pos/sell`
}

/**
 * Placeholder Electron main entry contract. Real BrowserWindow wiring lands with E8 packaging.
 * This module must remain free of cloud-only defaults.
 */
export const ELECTRON_MAIN_CONTRACT = {
  technology: 'electron',
  loads: 'local-ui-origin',
  installer: 'not-produced-yet',
  adr: 'ADR-013',
} as const
