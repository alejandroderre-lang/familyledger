/**
 * Parse health: how many receipts succeeded, how many failed and why.
 *
 *   npm run health            local stack
 *   npm run health -- hosted  the deployed project
 *
 * Exists because a failed parse used to be visible only on the user's screen,
 * as "couldn't read this receipt". The intended user will not report that —
 * she will try once and stop using the app — so a silent failure mode is
 * indistinguishable from the app simply not being useful.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { LOCAL_SUPABASE } from './test-user'

const run = promisify(execFile)

interface Row {
  status: string
  error_code: string | null
  receipts: number
  first_seen: string | null
  last_seen: string | null
  stuck: number
}

/** What each code means, in terms of what to actually do about it. */
const MEANING: Record<string, string> = {
  missing_api_key: 'ANTHROPIC_API_KEY is not set on the project — nothing will parse',
  unsupported_media_type: 'Image reached the function as HEIC or similar; client-side conversion failed',
  max_tokens: 'Response truncated before the receipt was fully read — raise max_tokens',
  refusal: 'The model declined the image',
  unparseable_response: 'Model returned something the schema could not parse',
  unexpected_error: 'Unhandled fault — check the function logs',
}

async function hosted(): Promise<Row[]> {
  const { stdout } = await run('supabase', [
    'db', 'query', 'select * from parse_health order by status, error_code', '--linked',
  ])
  return JSON.parse(stdout.slice(stdout.indexOf('{'))).rows as Row[]
}

async function local(): Promise<Row[]> {
  const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
    auth: { persistSession: false },
  })
  const { data, error } = await admin.from('parse_health').select('*')
  if (error) throw error
  return (data ?? []) as Row[]
}

async function main() {
  const isHosted = process.argv.includes('hosted')
  const rows = await (isHosted ? hosted() : local())

  console.log(`\nparse health · ${isHosted ? 'hosted' : 'local'}\n`)

  if (rows.length === 0) {
    console.log('  No receipts yet.\n')
    return
  }

  const total = rows.reduce((n, r) => n + Number(r.receipts), 0)
  const failed = rows.filter((r) => r.status === 'error')
  const stuck = rows.reduce((n, r) => n + Number(r.stuck ?? 0), 0)

  console.log('  status       reason                      count   last seen')
  console.log('  ' + '─'.repeat(64))
  for (const r of rows) {
    console.log(
      `  ${r.status.padEnd(12)} ${(r.error_code ?? '—').padEnd(26)} ` +
        `${String(r.receipts).padStart(5)}   ${(r.last_seen ?? '').slice(0, 16)}`,
    )
  }
  console.log('  ' + '─'.repeat(64))

  const failedCount = failed.reduce((n, r) => n + Number(r.receipts), 0)
  const rate = total > 0 ? ((failedCount / total) * 100).toFixed(0) : '0'
  console.log(`  ${total} receipt(s), ${failedCount} failed (${rate}%)\n`)

  if (failed.length > 0) {
    console.log('  What the failures mean:')
    for (const r of failed) {
      const why = MEANING[r.error_code ?? ''] ?? 'Unrecognised code'
      console.log(`    ${r.error_code}: ${why}`)
    }
    console.log()
  }

  if (stuck > 0) {
    console.log(
      `  ⚠ ${stuck} receipt(s) stuck in processing for over 5 minutes.\n` +
        `    The function died without recording anything — a crash, a timeout,\n` +
        `    or a deploy mid-request. These never get an error_code, so they are\n` +
        `    only findable by age.\n`,
    )
  }

  // Non-zero exit so this can gate something later if it ever needs to.
  if (failedCount > 0 || stuck > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
