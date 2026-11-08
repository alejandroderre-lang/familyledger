import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config.
 *
 * Requires the local Supabase stack to be up (`supabase start`) and the test
 * accounts seeded (`npm run test:seed`). The dev server is started for you.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests share the seeded accounts and their data
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // SLOW_MO=500 pauses between actions so a headed run is followable by eye.
    launchOptions: process.env.SLOW_MO
      ? { slowMo: Number(process.env.SLOW_MO) }
      : {},
  },

  projects: [
    {
      name: 'mobile-chrome',
      // The app is mobile-first with a 430px max content width; test at the
      // viewport it was designed for rather than a desktop default.
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
