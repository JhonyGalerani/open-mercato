import { asValue } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { FailOnceReceiptPrinter, MockReceiptPrinter, type ReceiptPrinter } from './lib/receipt'

/**
 * DI key: `receiptPrinter` (ADR-009).
 * Default = MockReceiptPrinter (dev/test). Hardware Agent / ESC-POS packages re-register
 * the same key with a real adapter; the completion saga never hard-codes a driver.
 */
export const RECEIPT_PRINTER_DI_KEY = 'receiptPrinter' as const

export function createDefaultReceiptPrinter(): ReceiptPrinter {
  if (process.env.OM_SOANAS_RECEIPT_PRINT_FAIL_ONCE === '1') {
    return new FailOnceReceiptPrinter()
  }
  return new MockReceiptPrinter()
}

export function register(container: AppContainer): void {
  container.register({
    [RECEIPT_PRINTER_DI_KEY]: asValue(createDefaultReceiptPrinter()),
  })
}
