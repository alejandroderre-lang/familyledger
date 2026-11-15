/**
 * Exploratory sweep: walks the app as a user would and records anything that
 * looks like a defect — console errors, failed requests, undersized tap
 * targets, horizontal overflow, dead ends on bad URLs, broken empty states.
 *
 * Reports findings; does not assert. Run: npm run explore
 */
import { chromium, devices, type Page, type ConsoleMessage } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { LOCAL_SUPABASE, TEST_ADMIN, TEST_USER } from './test-user'

const here = dirname(fileURLToPath(import.meta.url))
const shots = join(here, 'screenshots', 'explore')
const BASE = 'http://localhost:5173'

const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { persistSession: false },
})

interface Finding {
  severity: 'high' | 'medium' | 'low'
  where: string
  what: string
  evidence: string
}
const findings: Finding[] = []
const add = (f: Finding) => {
  findings.push(f)
  console.log(`  [${f.severity}] ${f.where}: ${f.what}`)
}

function watch(page: Page, where: () => string) {
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error') return
    const text = m.text()
    // React Router future-flag notices are noise, not defects.
    if (/React Router Future Flag/i.test(text)) return
    add({ severity: 'medium', where: where(), what: 'console error', evidence: text.slice(0, 220) })
  })
  page.on('pageerror', (e) => {
    add({ severity: 'high', where: where(), what: 'uncaught exception', evidence: String(e).slice(0, 220) })
  })
  page.on('response', async (r) => {
    if (r.status() >= 400 && !r.url().includes('/parse-receipt')) {
      add({
        severity: r.status() >= 500 ? 'high' : 'medium',
        where: where(),
        what: `HTTP ${r.status()}`,
        evidence: r.url().replace(LOCAL_SUPABASE.url, '«supabase»').slice(0, 180),
      })
    }
  })
}

/** Interactive elements smaller than the 48px the design system mandates. */
async function checkTapTargets(page: Page, where: string) {
  const small = await page.evaluate(() => {
    const out: { tag: string; label: string; w: number; h: number }[] = []
    document.querySelectorAll('button, a[href], input, select, [role="button"]').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      if (r.height < 44 || r.width < 44) {
        out.push({
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 36),
          w: Math.round(r.width),
          h: Math.round(r.height),
        })
      }
    })
    return out
  })
  for (const s of small) {
    add({
      severity: 'low',
      where,
      what: `tap target ${s.w}x${s.h} is under 44px`,
      evidence: `<${s.tag}> "${s.label}"`,
    })
  }
}

async function checkOverflow(page: Page, where: string) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (over > 2) {
    add({ severity: 'medium', where, what: 'page scrolls horizontally', evidence: `${over}px wider than viewport` })
  }
}

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto(`${BASE}/login`)
  await page.getByPlaceholder('Email address').fill(account.email)
  await page.getByPlaceholder('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 })
}

async function main() {
  await mkdir(shots, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await context.newPage()
  let current = 'startup'
  watch(page, () => current)

  // ── 1. Empty states: a brand-new account has no data at all ───────────
  console.log('\n1. empty states')
  const { data: users } = await admin.auth.admin.listUsers()
  const uid = users?.users.find((u) => u.email === TEST_USER.email)?.id
  if (uid) {
    await admin.from('receipts').delete().eq('user_id', uid)
    await admin.from('expenses').delete().eq('user_id', uid)
  }
  await signIn(page, TEST_USER)
  for (const [route, label] of [
    ['/', 'dashboard-empty'],
    ['/expenses', 'expenses-empty'],
    ['/profile', 'profile'],
    ['/upload', 'upload'],
  ] as const) {
    current = `${route} (no data)`
    await page.goto(`${BASE}${route}`)
    await page.waitForTimeout(1400)
    await checkOverflow(page, current)
    await checkTapTargets(page, current)
    await page.screenshot({ path: join(shots, `${label}.png`) })
  }

  // ── 2. Bad deep links: does a wrong id dead-end? ──────────────────────
  console.log('\n2. invalid deep links')
  for (const route of ['/expenses/00000000-0000-0000-0000-000000000000', '/review/00000000-0000-0000-0000-000000000000', '/expenses/not-a-uuid', '/nope']) {
    current = route
    await page.goto(`${BASE}${route}`)
    await page.waitForTimeout(1800)
    const body = (await page.locator('body').innerText()).trim()
    const hasWayOut = await page
      .getByRole('button')
      .or(page.getByRole('link'))
      .count()
    await page.screenshot({ path: join(shots, `deep${route.replace(/\W+/g, '-')}.png`) })
    if (body.length < 40) {
      add({ severity: 'high', where: route, what: 'renders a near-blank screen', evidence: `body text: "${body.slice(0, 60)}"` })
    }
    if (hasWayOut === 0) {
      add({ severity: 'high', where: route, what: 'no control to navigate away', evidence: 'zero buttons or links on the page' })
    }
  }

  // ── 3. Review validation with data restored ──────────────────────────
  console.log('\n3. review-screen validation')
  const { data: receipt } = await admin
    .from('receipts')
    .insert({ user_id: uid, image_url: `${uid}/explore.jpg`, status: 'processing' })
    .select()
    .single()
  if (receipt) {
    current = '/review/:id (manual entry)'
    await page.goto(`${BASE}/review/${receipt.id}`)
    await page.waitForTimeout(1800)
    await checkOverflow(page, current)
    await page.screenshot({ path: join(shots, 'review-manual.png'), fullPage: true })

    const confirm = page.getByRole('button', { name: /confirm & save/i })
    if ((await confirm.count()) > 0) {
      await confirm.first().scrollIntoViewIfNeeded()
      await confirm.first().click()
      await page.waitForTimeout(1600)
      const stillHere = page.url().includes('/review/')
      const err = await page.locator('text=/required|must|invalid|enter/i').count()
      if (!stillHere) {
        add({ severity: 'high', where: current, what: 'saved an empty expense', evidence: 'confirm succeeded with no store name, date or amount' })
      } else if (err === 0) {
        add({ severity: 'medium', where: current, what: 'blocked save with no visible reason', evidence: 'stayed on the page but showed no validation message' })
      }
      await page.screenshot({ path: join(shots, 'review-empty-submit.png'), fullPage: true })
    }
    await admin.from('receipts').delete().eq('id', receipt.id)
  }

  // ── 4. Admin view ─────────────────────────────────────────────────────
  console.log('\n4. admin')
  await context.clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})
  await signIn(page, TEST_ADMIN)
  current = '/admin'
  await page.goto(`${BASE}/admin`)
  await page.waitForTimeout(1800)
  await checkOverflow(page, current)
  await checkTapTargets(page, current)
  await page.screenshot({ path: join(shots, 'admin.png'), fullPage: true })

  // ── 5. Offline behaviour ──────────────────────────────────────────────
  console.log('\n5. offline')
  current = 'offline dashboard'
  await context.setOffline(true)
  await page.goto(`${BASE}/`).catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(shots, 'offline.png') })
  const offlineText = (await page.locator('body').innerText()).toLowerCase()
  if (!/offline|connection|network|try again|retry/.test(offlineText)) {
    add({
      severity: 'medium',
      where: 'offline',
      what: 'no offline messaging',
      evidence: 'nothing on screen mentions connection, offline, or retry',
    })
  }
  await context.setOffline(false)

  await browser.close()

  console.log(`\n${'─'.repeat(56)}`)
  console.log(`${findings.length} finding(s)`)
  const byWhere = new Map<string, Finding[]>()
  for (const f of findings) {
    byWhere.set(f.where, [...(byWhere.get(f.where) ?? []), f])
  }
  for (const [where, fs] of byWhere) {
    console.log(`\n${where}`)
    for (const f of fs) console.log(`  [${f.severity}] ${f.what} — ${f.evidence}`)
  }
  console.log(`\nscreenshots → ${shots}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
