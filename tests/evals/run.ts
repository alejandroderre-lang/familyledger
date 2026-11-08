/**
 * Runs every synthetic receipt through the real parse-receipt function and
 * scores the result against the fixture's expected values.
 *
 * Unlike the Playwright suite, this one DOES call the model — it is the only
 * thing that tests OCR quality. Needs ANTHROPIC_API_KEY available to the
 * function (supabase functions serve --env-file supabase/.env).
 *
 * Run: npm run test:evals
 */
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RECEIPT_FIXTURES, type ExpectedParse, type ReceiptFixture } from '../fixtures/receipts'
import { LOCAL_SUPABASE, TEST_USER } from '../test-user'

const here = dirname(fileURLToPath(import.meta.url))
const imageDir = join(here, '..', 'fixtures', 'images')

const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MONEY_TOLERANCE = 0.011 // a cent, with float slack

interface FieldResult {
  field: string
  pass: boolean
  expected: unknown
  actual: unknown
}

function compare(expected: ExpectedParse, actual: Partial<ExpectedParse>): FieldResult[] {
  const results: FieldResult[] = []

  const near = (a: unknown, b: unknown) =>
    typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= MONEY_TOLERANCE

  results.push({
    field: 'date',
    pass: actual.date === expected.date,
    expected: expected.date,
    actual: actual.date,
  })
  results.push({
    field: 'amount',
    pass: near(actual.amount, expected.amount),
    expected: expected.amount,
    actual: actual.amount,
  })
  results.push({
    field: 'currency',
    pass: actual.currency === expected.currency,
    expected: expected.currency,
    actual: actual.currency,
  })
  results.push({
    field: 'store_name',
    pass:
      typeof actual.store_name === 'string' &&
      actual.store_name.toLowerCase() === expected.store_name.toLowerCase(),
    expected: expected.store_name,
    actual: actual.store_name,
  })
  results.push({
    field: 'category',
    pass: actual.category === expected.category,
    expected: expected.category,
    actual: actual.category,
  })
  results.push({
    field: 'item_count',
    pass: (actual.items?.length ?? -1) === expected.items.length,
    expected: expected.items.length,
    actual: actual.items?.length ?? 0,
  })

  // Line items matched by position; descriptions compared case-insensitively
  // since casing is cosmetic, amounts to the cent.
  expected.items.forEach((item, i) => {
    const got = actual.items?.[i]
    const descOk =
      typeof got?.description === 'string' &&
      got.description.trim().toLowerCase() === item.description.toLowerCase()
    results.push({
      field: `item[${i}].description`,
      pass: descOk,
      expected: item.description,
      actual: got?.description,
    })
    results.push({
      field: `item[${i}].total_price`,
      pass: near(got?.total_price, item.total_price),
      expected: item.total_price,
      actual: got?.total_price,
    })
  })

  return results
}

async function runFixture(fixture: ReceiptFixture, userId: string) {
  const bytes = await readFile(join(imageDir, `${fixture.id}.jpg`))
  const path = `${userId}/eval-${fixture.id}-${Date.now()}.jpg`

  const { error: uploadError } = await admin.storage
    .from('receipts')
    .upload(path, bytes, { contentType: 'image/jpeg' })
  if (uploadError) throw new Error(`upload failed: ${uploadError.message}`)

  const { data: receipt, error: receiptError } = await admin
    .from('receipts')
    .insert({ user_id: userId, image_url: path, status: 'processing' })
    .select()
    .single()
  if (receiptError) throw new Error(`receipt insert failed: ${receiptError.message}`)

  const started = Date.now()
  const { data, error } = await admin.functions.invoke('parse-receipt', {
    body: { receipt_id: receipt.id, image_url: path },
  })
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)

  // Evals and the Playwright suite share the test account. Leaving these rows
  // behind changes what the dashboard renders and breaks E2E assertions, so
  // clean up regardless of outcome. expenses/expense_items cascade.
  await admin.from('receipts').delete().eq('id', receipt.id)
  await admin.storage.from('receipts').remove([path])

  if (error) {
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx?.json) {
      try {
        detail = JSON.stringify(await ctx.json())
      } catch {
        /* keep original */
      }
    }
    return { fixture, elapsed, failed: detail, results: [] as FieldResult[] }
  }

  return { fixture, elapsed, failed: null, results: compare(fixture.expected, data.parsed ?? {}) }
}

async function main() {
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users?.users.find((u) => u.email === TEST_USER.email)
  if (!user) throw new Error('test user missing — run `npm run test:seed` first')

  let totalFields = 0
  let passedFields = 0
  const failures: string[] = []

  for (const fixture of RECEIPT_FIXTURES) {
    process.stdout.write(`\n── ${fixture.id}\n   ${fixture.tests}\n`)
    const { elapsed, failed, results } = await runFixture(fixture, user.id)

    if (failed) {
      console.log(`   ✗ FUNCTION ERROR (${elapsed}s): ${failed}`)
      failures.push(`${fixture.id}: function error`)
      continue
    }

    const passed = results.filter((r) => r.pass).length
    totalFields += results.length
    passedFields += passed

    console.log(`   ${passed}/${results.length} fields correct  (${elapsed}s)`)
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`   ✗ ${r.field}: expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.actual)}`)
      failures.push(`${fixture.id} ${r.field}`)
    }
  }

  const pct = totalFields ? ((passedFields / totalFields) * 100).toFixed(1) : '0.0'
  console.log(`\n${'─'.repeat(52)}`)
  console.log(`${passedFields}/${totalFields} fields correct across ${RECEIPT_FIXTURES.length} receipts (${pct}%)`)
  if (failures.length) {
    console.log(`${failures.length} failing field(s)`)
    process.exitCode = 1
  } else {
    console.log('all fields correct')
  }
}

main().catch((err) => {
  console.error('eval run failed:', err.message ?? err)
  process.exit(1)
})
