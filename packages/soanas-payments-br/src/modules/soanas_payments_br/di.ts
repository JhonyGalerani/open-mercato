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

export function createDefaultPixProvider(): PixProvider {
  return new MockPixProvider()
}

export function register(container: AppContainer): void {
  container.register({
    [PIX_PROVIDER_DI_KEY]: asValue(createDefaultPixProvider()),
  })
}
