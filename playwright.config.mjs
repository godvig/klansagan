import { defineConfig, devices } from '@playwright/test';

/** Browser tests: they drive the real app in Chromium against a static server. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.mjs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8123',
    trace: 'retain-on-failure',
    launchOptions: {
      // PW_CHROME lets a machine without Playwright's own browser use an installed Chrome
      executablePath: process.env.PW_CHROME || undefined,
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, testIgnore: '**/mobile.e2e.mjs' },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: '**/mobile.e2e.mjs' },
  ],
  webServer: { command: 'python3 -m http.server 8123', port: 8123, reuseExistingServer: !process.env.CI },
});
