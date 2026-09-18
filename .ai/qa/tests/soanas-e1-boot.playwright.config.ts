import { defineConfig } from '@playwright/test'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const qaTestResultsRoot = path.join(projectRoot, '.ai', 'qa', 'test-results')

/** E1 process-restart suite — run after Gate 0/1 API matrix (kills/rebinds the app). */
export default defineConfig({
  testDir: path.join(projectRoot, 'packages'),
  testMatch: ['**/soanas_pos/__integration__/TC-SOANAS-E1-LOCAL-BOOT-001.spec.ts'],
  timeout: 420_000,
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
