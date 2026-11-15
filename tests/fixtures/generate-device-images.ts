/**
 * Produces the device-realistic fixtures the synthetic set never covered:
 * a genuine HEIC (the iPhone default) and a full-resolution photo.
 *
 * HEIC is produced with macOS `sips`, which emits real HEVC-in-ISO-Media —
 * not a renamed JPEG. That matters: the point is to exercise heic2any's
 * actual decoder.
 *
 * Run: npm run fixtures:device
 */
import { execFile } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'device')
const source = join(here, 'images', 'mercadona-groceries.jpg')

async function main() {
  await mkdir(outDir, { recursive: true })

  // 1. A real HEIC, as an iPhone camera would produce.
  const heic = join(outDir, 'receipt.heic')
  await run('sips', ['-s', 'format', 'heic', source, '--out', heic])

  // 2. A full-resolution photo: 4032x3024 is the iPhone main camera (12MP).
  //    The synthetic fixtures are ~800px, so nothing has ever pushed the
  //    client-side compression path with a real payload.
  const large = join(outDir, 'receipt-12mp.jpg')
  await run('sips', [
    '-z', '3024', '4032',
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', '95',
    source, '--out', large,
  ])

  // 3. The same at full resolution in HEIC — the realistic worst case.
  const largeHeic = join(outDir, 'receipt-12mp.heic')
  await run('sips', ['-s', 'format', 'heic', large, '--out', largeHeic])

  for (const f of [heic, large, largeHeic]) {
    const { size } = await stat(f)
    const { stdout } = await run('file', ['-b', f])
    console.log(`✓ ${f.split('/').pop()}  ${(size / 1024).toFixed(0)}KB  ${stdout.trim().slice(0, 60)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
