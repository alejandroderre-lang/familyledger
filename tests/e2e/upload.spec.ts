import { expect, test } from '@playwright/test'
import { RECEIPT_FIXTURES } from '../fixtures/receipts'
import {
  fixtureImagePath,
  mockParseFailure,
  mockParseReceipt,
  signIn,
  uploadReceiptImage,
} from './helpers'

const mercadona = RECEIPT_FIXTURES.find((f) => f.id === 'mercadona-groceries')!
const diner = RECEIPT_FIXTURES.find((f) => f.id === 'diner-usd-discount')!

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test.describe('receipt upload', () => {
  test('parsed receipt lands on the review screen with its values', async ({ page }) => {
    await mockParseReceipt(page, mercadona)
    await uploadReceiptImage(page, fixtureImagePath(mercadona))

    await expect(page).toHaveURL(/\/review\//, { timeout: 20_000 })
    await expect(page.getByPlaceholder('e.g. Mercadona')).toHaveValue('Mercadona')
    await expect(page.getByPlaceholder('0.00')).toHaveValue('15.43')
    await expect(page.getByPlaceholder('EUR')).toHaveValue('EUR')
    await expect(page.locator('input[type="date"]')).toHaveValue('2026-03-14')
  })

  test('every parsed line item is rendered for editing', async ({ page }) => {
    await mockParseReceipt(page, mercadona)
    await uploadReceiptImage(page, fixtureImagePath(mercadona))
    await expect(page).toHaveURL(/\/review\//, { timeout: 20_000 })

    const descriptions = page.getByPlaceholder('Item name')
    await expect(descriptions).toHaveCount(mercadona.expected.items.length)

    for (const [index, item] of mercadona.expected.items.entries()) {
      await expect(descriptions.nth(index)).toHaveValue(item.description)
      await expect(page.getByLabel('Quantity').nth(index)).toHaveValue(
        String(item.quantity),
      )
      await expect(page.getByLabel('Unit price').nth(index)).toHaveValue(
        String(item.unit_price),
      )
    }
  })

  test('a negative discount line survives the round trip', async ({ page }) => {
    await mockParseReceipt(page, diner)
    await uploadReceiptImage(page, fixtureImagePath(diner))
    await expect(page).toHaveURL(/\/review\//, { timeout: 20_000 })

    const discountRow = diner.expected.items.findIndex((i) => i.total_price < 0)
    await expect(page.getByPlaceholder('Item name').nth(discountRow)).toHaveValue(
      'LOYALTY -10%',
    )
    await expect(page.getByLabel('Unit price').nth(discountRow)).toHaveValue('-1.9')
  })

  test('confirming saves the expense and it appears on the dashboard', async ({ page }) => {
    await mockParseReceipt(page, mercadona)
    await uploadReceiptImage(page, fixtureImagePath(mercadona))
    await expect(page).toHaveURL(/\/review\//, { timeout: 20_000 })

    await page.getByRole('button', { name: /confirm & save/i }).click()

    await expect(page).toHaveURL('/', { timeout: 15_000 })
    await expect(page.getByText('Mercadona').first()).toBeVisible()
  })

  test('a parse failure offers manual entry rather than dead-ending', async ({ page }) => {
    await mockParseFailure(page, 'unreadable', 422)
    await uploadReceiptImage(page, fixtureImagePath(mercadona))

    await expect(page.getByText(/couldn't read this receipt/i)).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: /enter manually/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('a backend fault is not blamed on the photo', async ({ page }) => {
    // Regression guard: every failure used to render "blurry or too dark",
    // which sent users to retake photos that were never the problem.
    await mockParseFailure(page, 'missing_api_key', 500)
    await uploadReceiptImage(page, fixtureImagePath(mercadona))

    await expect(page.getByText(/receipt scanning is unavailable/i)).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(/blurry or too dark/i)).toHaveCount(0)
  })
})
