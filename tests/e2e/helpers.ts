import { expect, type Page, type Route } from '@playwright/test'
import { join } from 'node:path'
import { TEST_USER } from '../test-user'
import type { ReceiptFixture } from '../fixtures/receipts'

export const FIXTURE_IMAGE_DIR = join(import.meta.dirname, '..', 'fixtures', 'images')

export function fixtureImagePath(fixture: ReceiptFixture): string {
  return join(FIXTURE_IMAGE_DIR, `${fixture.id}.jpg`)
}

export async function signIn(
  page: Page,
  account: { email: string; password: string } = TEST_USER,
) {
  await page.goto('/login')
  await page.getByPlaceholder('Email address').fill(account.email)
  await page.getByPlaceholder('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })
}

/**
 * Intercept the parse-receipt edge function.
 *
 * E2E runs must not hit the real model: it costs money, needs a key, and
 * returns different values every run. The fixture's `expected` block stands in
 * as the response, so these tests assert the app's behaviour given a parse —
 * never the quality of the parse itself. That belongs in evals.
 */
export async function mockParseReceipt(page: Page, fixture: ReceiptFixture) {
  await page.route('**/functions/v1/parse-receipt', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, parsed: fixture.expected }),
    })
  })
}

/** Simulate the function failing with a specific error code. */
export async function mockParseFailure(
  page: Page,
  code: string,
  status = 500,
  error = 'simulated failure',
) {
  await page.route('**/functions/v1/parse-receipt', async (route: Route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error, code }),
    })
  })
}

/** Pick a file through the hidden input behind the "Upload from Gallery" card. */
export async function uploadReceiptImage(page: Page, imagePath: string) {
  await page.goto('/upload')
  const chooser = page.waitForEvent('filechooser')
  await page.getByText('Upload from Gallery').click()
  await (await chooser).setFiles(imagePath)
}
