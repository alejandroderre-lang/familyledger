/**
 * Records the main flow — sign in, dashboard, photograph a receipt, review the
 * parse, confirm — as a webm, for conversion to a README GIF.
 *
 * The parse is NOT mocked: this calls the real edge function and the real
 * model, so the recording shows the app actually working rather than a
 * scripted facsimile.
 *
 * Only the seeded test account and synthetic receipts appear. Nothing here
 * touches the owner's real account or data.
 *
 * Run: npm run demo:record
 */
import { chromium, devices } from '@playwright/test'
import { mkdir, rm, readdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_USER } from './test-user'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'demo')
const BASE = 'http://localhost:5173'
const RECEIPT = join(here, 'fixtures', 'images', 'mercadona-groceries.jpg')

/** Deliberate pauses so a viewer can read the screen before it changes. */
const beat = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    recordVideo: { dir: outDir, size: { width: 412, height: 915 } },
  })
  const page = await context.newPage()

  // ── Sign in ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`)
  await beat(1200)
  await page.getByPlaceholder('Email address').click()
  await page.getByPlaceholder('Email address').type(TEST_USER.email, { delay: 45 })
  await beat(250)
  // Typed with the field masked; the show/hide toggle is never used.
  await page.getByPlaceholder('Password').click()
  await page.getByPlaceholder('Password').type(TEST_USER.password, { delay: 35 })
  await beat(500)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 })
  await beat(2000)

  // ── Dashboard: let the figures and category bars register ──────────────
  await page.mouse.wheel(0, 320)
  await beat(1600)
  await page.mouse.wheel(0, 360)
  await beat(1600)
  await page.mouse.wheel(0, -680)
  await beat(900)

  // ── Add a receipt ──────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForURL(`${BASE}/upload`, { timeout: 10_000 })
  await beat(1400)

  const chooser = page.waitForEvent('filechooser')
  await page.getByText('Upload from Gallery').click()
  await (await chooser).setFiles(RECEIPT)

  // Real parse: the loading state here is the model actually reading the photo.
  await page.waitForURL(/\/review\//, { timeout: 60_000 })
  await beat(2200)

  // ── Review the parsed fields ───────────────────────────────────────────
  await page.mouse.wheel(0, 420)
  await beat(2000)
  await page.mouse.wheel(0, 420)
  await beat(2000)

  const confirm = page.getByRole('button', { name: /confirm & save/i })
  await confirm.scrollIntoViewIfNeeded()
  await beat(800)
  await confirm.click()

  // ── Back on the dashboard with the new expense ─────────────────────────
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 })
  await beat(1500)
  await page.mouse.wheel(0, 700)
  await beat(2400)

  await context.close()
  await browser.close()

  const files = await readdir(outDir)
  const webm = files.find((f) => f.endsWith('.webm'))
  if (!webm) throw new Error('no video produced')
  await rename(join(outDir, webm), join(outDir, 'demo.webm'))
  console.log(`✓ recorded ${join(outDir, 'demo.webm')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
