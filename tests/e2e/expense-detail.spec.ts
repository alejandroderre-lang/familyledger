import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { LOCAL_SUPABASE, TEST_USER } from '../test-user'
import { signIn } from './helpers'

const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { persistSession: false },
})

async function createExpense(amount: number, items: [string, number][]) {
  const { data: users } = await admin.auth.admin.listUsers()
  const userId = users?.users.find((u) => u.email === TEST_USER.email)?.id
  if (!userId) throw new Error('test user missing — run `npm run test:seed`')

  const { data: receipt } = await admin
    .from('receipts')
    .insert({ user_id: userId, image_url: `${userId}/detail-spec.jpg`, status: 'confirmed' })
    .select()
    .single()

  const { data: expense } = await admin
    .from('expenses')
    .insert({
      receipt_id: receipt!.id,
      user_id: userId,
      date: '2026-11-14',
      amount,
      currency: 'EUR',
      store_name: 'Bistro Seventeen',
      category: 'Dining & Restaurants',
    })
    .select()
    .single()

  await admin.from('expense_items').insert(
    items.map(([description, price]) => ({
      expense_id: expense!.id,
      description,
      quantity: 1,
      unit_price: price,
      total_price: price,
    })),
  )

  return { receiptId: receipt!.id, expenseId: expense!.id }
}

test.describe('expense detail — items table total', () => {
  const created: string[] = []

  test.afterAll(async () => {
    if (created.length) await admin.from('receipts').delete().in('id', created)
  })

  test('footer sums the line items, not the expense amount', async ({ page }) => {
    // Mirrors the bistro-service-tip eval fixture: a 12.5% service charge is
    // part of the bill but never appears as a line item.
    const { receiptId, expenseId } = await createExpense(92.81, [
      ['SOUP OF THE DAY', 13.0],
      ['RIBEYE 300G', 28.5],
      ['SEA BASS', 22.0],
      ['HOUSE RED 500ML', 19.0],
    ])
    created.push(receiptId)

    await signIn(page)
    await page.goto(`/expenses/${expenseId}`)

    const table = page.locator('table')
    await expect(table).toBeVisible()

    // The sum of the rows above, not the €92.81 receipt total.
    await expect(table).toContainText('Items subtotal')
    await expect(table).toContainText('€82.50')

    // The gap is surfaced rather than silently absorbed.
    await expect(table).toContainText('Not itemised')
    await expect(table).toContainText('€10.31')

    await expect(table).toContainText('Receipt total')
    await expect(table).toContainText('€92.81')
  })

  test('a reconciling receipt shows a single total row', async ({ page }) => {
    const { receiptId, expenseId } = await createExpense(30.0, [
      ['Item A', 10],
      ['Item B', 10],
      ['Item C', 10],
    ])
    created.push(receiptId)

    await signIn(page)
    await page.goto(`/expenses/${expenseId}`)

    const table = page.locator('table')
    await expect(table).toContainText('€30.00')
    // No breakdown when there is nothing to explain.
    await expect(table).not.toContainText('Items subtotal')
    await expect(table).not.toContainText('Not itemised')
  })
})
