import { resolveDesktopShellTarget } from '../shellTarget'
import { createLocalRuntimeConfig } from '../localRuntime'
import { shouldAllowShellNavigation } from '../navigationGuard'

/**
 * Electron main process stub.
 * Real BrowserWindow must call shouldAllowShellNavigation for:
 * - will-navigate / will-redirect
 * - setWindowOpenHandler
 * - webRequest / session permission checks for remote resources
 *
 * instalador ainda não produzido/validado — see docs/soanas/RELEASE-CHECKLIST.md
 */
export function describeShellLaunch(): { target: string; technology: string } {
  const config = createLocalRuntimeConfig()
  return {
    technology: 'electron',
    target: resolveDesktopShellTarget(config),
  }
}

export function attachNavigationGuards(allowedOrigin: string): {
  allowNavigate: (url: string) => boolean
} {
  return {
    allowNavigate: (url: string) => shouldAllowShellNavigation(url, allowedOrigin),
  }
}
