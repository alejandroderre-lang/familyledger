import { expect, test } from '@playwright/test'
import { TEST_ADMIN, TEST_USER } from '../test-user'
import { signIn } from './helpers'

test.describe('authentication', () => {
  test('unauthenticated visit redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'FamilyLedger' })).toBeVisible()
  })

  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email address').fill(TEST_USER.email)
    await page.getByPlaceholder('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/incorrect email or password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('valid credentials land on the dashboard', async ({ page }) => {
    await signIn(page)
    await expect(page.getByText('This Month', { exact: true })).toBeVisible()
  })

  test('session survives a page reload', async ({ page }) => {
    await signIn(page)
    await page.reload()
    // Must not bounce back to /login — the persisted session is restored.
    await expect(page).toHaveURL('/')
    await expect(page.getByText('This Month', { exact: true })).toBeVisible()
  })

  test('standard user does not see the Admin tab', async ({ page }) => {
    await signIn(page, TEST_USER)
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  })

  test('admin user sees the Admin tab', async ({ page }) => {
    await signIn(page, TEST_ADMIN)
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()
  })

  test('sign out returns to login', async ({ page }) => {
    await signIn(page)
    await page.goto('/profile')
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})
