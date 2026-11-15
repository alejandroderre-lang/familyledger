/**
 * Reports what parses have actually cost, from the usage recorded by the
 * edge function.
 *
 *   npm run cost            local stack
 *   npm run cost -- hosted  the deployed project
 *
 * Prices live here rather than in the database on purpose: they change, and a
 * money column computed at insert time would quietly go stale. Token counts
 * are the durable fact; cost is derived.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { LOCAL_SUPABASE } from './test-user'

const run = promisify(execFile)

/** USD per million tokens. Source: platform.claude.com/docs/en/pricing */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

interface Row {
  status: string
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  parse_ms: number | null
}

function costOf(row: Row): number | null {
  if (!row.model || row.input_tokens == null || row.output_tokens == null) return null
  const p = PRICING[row.model]
  if (!p) return null
  return (row.input_tokens / 1e6) * p.input + (row.output_tokens / 1e6) * p.output
}

async function hostedRows(): Promise<Row[]> {
  const { stdout } = await run('supabase', [
    'db', 'query',
    'select status, model, input_tokens, output_tokens, parse_ms from receipts order by uploaded_at',
    '--linked',
  ])
  const json = stdout.slice(stdout.indexOf('{'))
  return JSON.parse(json).rows as Row[]
}

async function localRows(): Promise<Row[]> {
  const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
    auth: { persistSession: false },
  })
  const { data, error } = await admin
    .from('receipts')
    .select('status, model, input_tokens, output_tokens, parse_ms')
    .order('uploaded_at')
  if (error) throw error
  return (data ?? []) as Row[]
}

async function main() {
  const hosted = process.argv.includes('hosted')
  const rows = hosted ? await hostedRows() : await localRows()
  const priced = rows.filter((r) => costOf(r) !== null)

  console.log(`\n${hosted ? 'hosted' : 'local'} · ${rows.length} receipt(s), ${priced.length} with usage recorded\n`)

  if (priced.length === 0) {
    console.log('No usage data yet. Parses recorded before migration 006 have no token counts;')
    console.log('every parse from now on does.')
    return
  }

  console.log('  status      model             in      out     cost      time')
  console.log('  ' + '─'.repeat(62))
  let total = 0
  for (const r of priced) {
    const c = costOf(r)!
    total += c
    console.log(
      `  ${r.status.padEnd(11)} ${(r.model ?? '').padEnd(16)} ` +
        `${String(r.input_tokens).padStart(6)}  ${String(r.output_tokens).padStart(6)}  ` +
        `$${c.toFixed(4)}  ${((r.parse_ms ?? 0) / 1000).toFixed(1)}s`,
    )
  }

  const avg = total / priced.length
  console.log('  ' + '─'.repeat(62))
  console.log(`  total $${total.toFixed(4)}   mean $${avg.toFixed(4)} per receipt\n`)
  console.log(`  At this mean: 10/month ≈ $${(avg * 10).toFixed(2)}, 50 ≈ $${(avg * 50).toFixed(2)}, 200 ≈ $${(avg * 200).toFixed(2)}`)
  console.log(`  Image tokens dominate the input count, so cost tracks photo size more than receipt length.\n`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
