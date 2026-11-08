/**
 * Renders the README's mermaid blocks to PNG so the syntax is verified and
 * the result can be reviewed before committing.
 *
 * Run: npm run diagrams:check
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const outDir = join(here, 'screenshots', 'diagrams')

function extractMermaid(markdown: string): string[] {
  const blocks: string[] = []
  const re = /```mermaid\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) blocks.push(m[1].trim())
  return blocks
}

async function main() {
  const readme = readFileSync(join(repo, 'README.md'), 'utf8')
  const diagrams = extractMermaid(readme)
  if (diagrams.length === 0) throw new Error('no mermaid blocks found in README.md')
  console.log(`found ${diagrams.length} mermaid block(s)`)

  await mkdir(outDir, { recursive: true })
  const mermaidSrc = readFileSync(
    join(repo, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
    'utf8',
  )

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })

  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>body{margin:0;background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}
            .d{padding:28px}</style>
     <div id="out"></div>
     <script>${mermaidSrc}</script>`,
  )

  const errors: string[] = []

  for (const [i, src] of diagrams.entries()) {
    const result = await page.evaluate(
      async ([code, idx]) => {
        // @ts-expect-error mermaid is injected as a global above
        const mermaid = window.mermaid
        mermaid.initialize({ startOnLoad: false, theme: 'neutral' })
        try {
          const { svg } = await mermaid.render(`g${idx}`, code)
          const el = document.createElement('div')
          el.className = 'd'
          el.innerHTML = svg
          document.getElementById('out')!.replaceChildren(el)
          return { ok: true, error: null }
        } catch (e) {
          return { ok: false, error: String(e) }
        }
      },
      [src, String(i)] as [string, string],
    )

    if (!result.ok) {
      errors.push(`block ${i + 1}: ${result.error}`)
      console.error(`✗ block ${i + 1} failed to parse\n  ${result.error}`)
      continue
    }

    const el = page.locator('.d')
    const buf = await el.screenshot()
    await writeFile(join(outDir, `diagram-${i + 1}.png`), buf)
    console.log(`✓ block ${i + 1} rendered (${(buf.length / 1024).toFixed(0)} KB)`)
  }

  await browser.close()

  if (errors.length) {
    console.error(`\n${errors.length} diagram(s) failed to parse`)
    process.exit(1)
  }
  console.log(`\n→ ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
