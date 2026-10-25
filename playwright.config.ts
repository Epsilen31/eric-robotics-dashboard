import { defineConfig } from '@playwright/test';
const { browserOptions } = require('./tools/browser.cjs');
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4201',
    viewport: { width: 1280, height: 800 },
    launchOptions: browserOptions(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx nx serve insight-io --host=127.0.0.1 --port=4201',
      url: 'http://127.0.0.1:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: 120000,
    },
    {
      command: 'node tools/mock-ros.cjs --port 19090',
      url: 'http://127.0.0.1:19090/health',
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
