import { defineConfig } from '@playwright/test'
import path from 'node:path'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const qaTestResultsRoot = path.join(projectRoot, '.ai', 'qa', 'test-results')

/**
 * Minimal config for Soanas retail browser E2E only.
 * Avoids monorepo-wide discovery (1146 specs) which can busy-loop under load.
 */
export default defineConfig({
  testDir: path.join(
    projectRoot,
    'packages/soanas-pos/src/modules/soanas_pos/__integration__',
  ),
  testMatch: ['TC-SOANAS-RETAIL-UI-001.spec.ts'],
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(qaTestResultsRoot, 'html'), open: 'never' }],
  ],
  outputDir: path.join(qaTestResultsRoot, 'artifacts'),
})
