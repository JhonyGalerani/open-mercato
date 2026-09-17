import { asValue } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { MockPixProvider } from './lib/mockPixProvider'
import type { PixProvider } from './lib/pixProvider'

/**
 * DI key: `soanas.payments.pixProvider`.
 * Default = MockPixProvider (dev/test). A real PSP integration package re-registers
 * the same key with a live adapter; commands never hard-code a driver.
 */
export const PIX_PROVIDER_DI_KEY = 'soanas.payments.pixProvider' as const

/**
 * Request containers call `register()` per request. The mock adapter is stateful
 * (in-memory charges), so the default binding must be process-scoped — otherwise
 * create→get round-trips lose the charge between requests.
 */
let sharedMockPixProvider: PixProvider | null = null

export function createDefaultPixProvider(): PixProvider {
  if (!sharedMockPixProvider) {
    sharedMockPixProvider = new MockPixProvider()
  }
  return sharedMockPixProvider
}

export function register(container: AppContainer): void {
  container.register({
    [PIX_PROVIDER_DI_KEY]: asValue(createDefaultPixProvider()),
  })
}
