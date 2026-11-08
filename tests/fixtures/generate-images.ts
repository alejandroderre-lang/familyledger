/**
 * Renders each synthetic receipt to a JPEG under tests/fixtures/images/.
 *
 * Run: npm run fixtures:generate
 *
 * JPEG rather than PNG on purpose — it is what phone cameras produce and what
 * the upload path compresses to, so the fixtures exercise the same decode path
 * as a real photo.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RECEIPT_FIXTURES, fixtureHtml } from './receipts'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'images')

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 400, height: 700 },
    deviceScaleFactor: 2, // ~800px wide — comparable to a downscaled phone photo
  })

  for (const fixture of RECEIPT_FIXTURES) {
    await page.setContent(fixtureHtml(fixture))
    const receipt = page.locator('.receipt')
    const buffer = await receipt.screenshot({ type: 'jpeg', quality: 88 })
    const path = join(outDir, `${fixture.id}.jpg`)
    await writeFile(path, buffer)
    console.log(`✓ ${fixture.id}.jpg  (${(buffer.length / 1024).toFixed(1)} KB) — ${fixture.tests}`)
  }

  await browser.close()
  console.log(`\n${RECEIPT_FIXTURES.length} fixtures written to ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
