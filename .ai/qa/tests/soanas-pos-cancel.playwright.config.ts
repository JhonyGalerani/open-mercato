import { defineConfig } from '@playwright/test'
import path from 'node:path'
const projectRoot = path.resolve(__dirname, '..', '..', '..')
export default defineConfig({
  testDir: path.join(projectRoot, 'packages/soanas-pos/src/modules/soanas_pos/__integration__'),
  testMatch: ['TC-SOANAS-POS-CANCEL-001.spec.ts'],
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  use: { baseURL: process.env.BASE_URL || 'http://localhost:3000', headless: true, screenshot: 'only-on-failure', trace: 'off' },
  reporter: [['list']],
})
