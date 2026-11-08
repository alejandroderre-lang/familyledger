/**
 * Captures the dashboard in every design direction.
 *
 * Run: npm run design:shots [label]
 */
import { chromium, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DESIGN_DIRECTIONS } from '../src/design/directions'
import { TEST_USER } from './test-user'

const label = process.argv[2] ?? 'ramp'
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots', label)
const BASE = 'http://localhost:5173'

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await context.newPage()

  await page.goto(`${BASE}/login`)
  await page.getByPlaceholder('Email address').fill(TEST_USER.email)
  await page.getByPlaceholder('Password').fill(TEST_USER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 })

  for (const direction of DESIGN_DIRECTIONS) {
    await page.goto(`${BASE}/?design=${direction}`)
    await page.locator('text=By category').first().waitFor({ timeout: 15_000 })
    await page.waitForTimeout(600)

    await page.screenshot({ path: join(outDir, `${direction}.png`) })
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(outDir, `${direction}-full.png`), fullPage: true })
    console.log(`✓ ${direction}`)
  }

  await browser.close()
  console.log(`\n→ ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
