import { defineConfig } from '@playwright/test'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const qaTestResultsRoot = path.join(projectRoot, '.ai', 'qa', 'test-results')

export default defineConfig({
  testDir: path.join(projectRoot, 'packages/soanas-pos/src/modules/soanas_pos/__integration__'),
  testMatch: [
    'TC-SOANAS-RETAIL-001.spec.ts',
    'TC-SOANAS-RETAIL-CONCURRENCY.spec.ts',
    'TC-SOANAS-RETAIL-RECOVERY.spec.ts',
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
