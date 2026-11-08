/**
 * Captures each key screen to tests/screenshots/<label>/.
 *
 * Used to produce before/after comparisons when changing the UI.
 * Run: npm run screenshots -- before
 */
import { chromium, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_USER } from './test-user'

const label = process.argv[2] ?? 'current'
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots', label)
const BASE = 'http://localhost:5173'

const SCREENS: { name: string; path: string; waitFor?: string }[] = [
  { name: '1-login', path: '/login', waitFor: 'text=Family expense tracking' },
  { name: '2-dashboard', path: '/', waitFor: 'text=Spending by category' },
  { name: '3-expenses', path: '/expenses', waitFor: 'text=Search by store' },
  { name: '4-upload', path: '/upload', waitFor: 'text=Take a Photo' },
  { name: '5-profile', path: '/profile', waitFor: 'text=Sign out' },
]

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await context.newPage()

  // Sign in once; the session persists across navigations in this context.
  await page.goto(`${BASE}/login`)
  await page.getByPlaceholder('Email address').fill(TEST_USER.email)
  await page.getByPlaceholder('Password').fill(TEST_USER.password)

  await page.screenshot({ path: join(outDir, '0-login-filled.png') })

  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 })

  for (const screen of SCREENS) {
    if (screen.path === '/login') continue // captured above, pre-auth
    await page.goto(`${BASE}${screen.path}`)
    if (screen.waitFor) {
      await page.locator(screen.waitFor).first().waitFor({ timeout: 15_000 }).catch(() => {})
    }
    // Recharts animates pies over 1500ms; capture only after it settles.
    await page.waitForTimeout(2200)
    // Viewport first. A fullPage shot resizes the viewport, which makes
    // ResponsiveContainer re-measure and restart the animation — anything
    // captured straight after catches the chart mid-transition.
    await page.screenshot({ path: join(outDir, `${screen.name}-viewport.png`) })
    await page.waitForTimeout(2200)
    await page.screenshot({ path: join(outDir, `${screen.name}.png`), fullPage: true })
    console.log(`✓ ${screen.name}`)
  }

  // Login screen, signed out
  await context.clearCookies()
  await page.goto(`${BASE}/login`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(outDir, '1-login.png') })
  console.log('✓ 1-login')

  await browser.close()
  console.log(`\nscreenshots → ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
