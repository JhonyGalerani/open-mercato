import { defineConfig } from '@playwright/test'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const qaTestResultsRoot = path.join(projectRoot, '.ai', 'qa', 'test-results')

/**
 * Gate 0/1 specialized discovery — must include specs outside soanas-pos
 * (cash approval, Pix org scope) as well as retail/concurrency/recovery/
 * multilocation/print/manual tenders.
 */
export default defineConfig({
  testDir: path.join(projectRoot, 'packages'),
  testMatch: [
    '**/soanas_pos/__integration__/TC-SOANAS-RETAIL-001.spec.ts',
    '**/soanas_pos/__integration__/TC-SOANAS-RETAIL-CONCURRENCY.spec.ts',
    '**/soanas_pos/__integration__/TC-SOANAS-RETAIL-RECOVERY.spec.ts',
    '**/soanas_pos/__integration__/TC-SOANAS-POS-MANUAL-TENDERS-001.spec.ts',
    '**/soanas_pos/__integration__/TC-SOANAS-GATE0-MULTILOC-001.spec.ts',
    '**/soanas_pos/__integration__/TC-SOANAS-GATE0-PRINTJOB-001.spec.ts',
    '**/soanas_cash/__integration__/TC-SOANAS-GATE0-CASH-APPROVAL-001.spec.ts',
    '**/soanas_payments_br/__integration__/TC-SOANAS-GATE0-PIX-SCOPE-001.spec.ts',
  ],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  reporter: [['list']],
  outputDir: path.join(qaTestResultsRoot, 'artifacts'),
})
