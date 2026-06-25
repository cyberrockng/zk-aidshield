import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'env -u NO_COLOR npm run build && env -u NO_COLOR npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      ADMIN_API_SECRET: 'playwright-admin-secret',
      LEDGER_HMAC_SECRET: 'playwright-ledger-secret',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
