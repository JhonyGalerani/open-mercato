/**
 * Electron main process stub (not executed in unit tests).
 * Packaged builds will use this pattern: create window → load local UI origin.
 *
 * instalador ainda não produzido/validado — see docs/soanas/RELEASE-CHECKLIST.md
 */
import { resolveDesktopShellTarget } from '../shellTarget'
import { createLocalRuntimeConfig } from '../localRuntime'

export function describeShellLaunch(): { target: string; technology: string } {
  const config = createLocalRuntimeConfig()
  return {
    technology: 'electron',
    target: resolveDesktopShellTarget(config),
  }
}
