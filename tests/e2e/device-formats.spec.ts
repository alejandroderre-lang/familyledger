import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { join } from 'node:path'
import { RECEIPT_FIXTURES } from '../fixtures/receipts'
import { LOCAL_SUPABASE, TEST_USER } from '../test-user'
import { mockParseReceipt, signIn } from './helpers'

/**
 * The formats a phone actually produces.
 *
 * Every other spec feeds the app a ~45KB synthetic JPEG. These use a genuine
 * HEVC-encoded HEIC — the iPhone camera default — and a 12MP photo, so the
 * HEIC decode and the client-side compression run on realistic input rather
 * than on something that never needed either.
 *
 * The parse is still mocked: what is under test is everything that happens
 * before the upload, not the model.
 */

const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { persistSession: false },
})

const deviceDir = join(import.meta.dirname, '..', 'fixtures', 'device')
const fixture = RECEIPT_FIXTURES[0]

async function latestUpload(): Promise<{ name: string; size: number } | null> {
  const { data: users } = await admin.auth.admin.listUsers()
  const userId = users?.users.find((u) => u.email === TEST_USER.email)?.id
  if (!userId) return null
  const { data } = await admin.storage
    .from('receipts')
    .list(userId, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } })
  const file = data?.[0]
  if (!file) return null
  return { name: file.name, size: (file.metadata?.size as number) ?? 0 }
}

test.describe('device formats', () => {
  test('a real HEIC is converted and uploaded as JPEG', async ({ page }) => {
    await mockParseReceipt(page, fixture)
    await signIn(page)

    await page.goto('/upload')
    const chooser = page.waitForEvent('filechooser')
    await page.getByText('Upload from Gallery').click()
    await (await chooser).setFiles(join(deviceDir, 'receipt.heic'))

    // heic2any decodes in the browser; allow for the WASM path being slow.
    await expect(page).toHaveURL(/\/review\//, { timeout: 60_000 })

    const uploaded = await latestUpload()
    expect(uploaded).not.toBeNull()
    // The stored object must be a JPEG — the vision API rejects HEIC outright.
    expect(uploaded!.name).toMatch(/\.jpg$/)
    expect(uploaded!.size).toBeGreaterThan(0)
  })

  test('a 12MP photo compresses to under the 1MB upload cap', async ({ page }) => {
    await mockParseReceipt(page, fixture)
    await signIn(page)

    await page.goto('/upload')
    const chooser = page.waitForEvent('filechooser')
    await page.getByText('Upload from Gallery').click()
    await (await chooser).setFiles(join(deviceDir, 'receipt-12mp.jpg'))

    await expect(page).toHaveURL(/\/review\//, { timeout: 60_000 })

    const uploaded = await latestUpload()
    expect(uploaded).not.toBeNull()
    expect(uploaded!.size).toBeLessThanOrEqual(1024 * 1024)
  })

  test('a full-resolution HEIC survives both conversion and compression', async ({
    page,
  }) => {
    await mockParseReceipt(page, fixture)
    await signIn(page)

    await page.goto('/upload')
    const chooser = page.waitForEvent('filechooser')
    await page.getByText('Upload from Gallery').click()
    await (await chooser).setFiles(join(deviceDir, 'receipt-12mp.heic'))

    await expect(page).toHaveURL(/\/review\//, { timeout: 90_000 })

    const uploaded = await latestUpload()
    expect(uploaded).not.toBeNull()
    expect(uploaded!.name).toMatch(/\.jpg$/)
    expect(uploaded!.size).toBeLessThanOrEqual(1024 * 1024)
  })
})
