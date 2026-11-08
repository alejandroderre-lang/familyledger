/**
 * Seeds a spread of expenses for the test user so screenshots and manual
 * review show populated screens rather than empty states.
 *
 * Run: npm run test:seed:data
 */
import { createClient } from '@supabase/supabase-js'
import { LOCAL_SUPABASE, TEST_USER } from './test-user'

const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const today = new Date()
const daysAgo = (n: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const SAMPLE = [
  { store: 'Mercadona', amount: 64.3, category: 'Groceries', day: 1 },
  { store: 'Repsol', amount: 62.4, category: 'Gas & Petrol', day: 2 },
  { store: 'Farmacia Central', amount: 16.74, category: 'Pharmacy & Health', day: 3 },
  { store: 'Corner Diner', amount: 24.1, category: 'Dining & Restaurants', day: 4 },
  { store: 'Zara', amount: 89.95, category: 'Clothing & Accessories', day: 6 },
  { store: 'Carrefour', amount: 112.4, category: 'Groceries', day: 8 },
  { store: 'Media Markt', amount: 249.0, category: 'Electronics', day: 11 },
  { store: 'Cine Yelmo', amount: 19.8, category: 'Entertainment', day: 14 },
  { store: 'Renfe', amount: 43.5, category: 'Transport & Travel', day: 17 },
  { store: 'Endesa', amount: 78.22, category: 'Utilities', day: 21 },
  { store: 'Mercadona', amount: 51.15, category: 'Groceries', day: 24 },
  { store: 'Bar Pepe', amount: 13.4, category: 'Dining & Restaurants', day: 28 },
]

async function main() {
  const { data: users } = await admin.auth.admin.listUsers()
  const user = users?.users.find((u) => u.email === TEST_USER.email)
  if (!user) throw new Error('test user missing — run `npm run test:seed` first')

  await admin.from('receipts').delete().eq('user_id', user.id)
  await admin.from('expenses').delete().eq('user_id', user.id)

  for (const row of SAMPLE) {
    const { data: receipt, error: rErr } = await admin
      .from('receipts')
      .insert({
        user_id: user.id,
        image_url: `${user.id}/sample-${row.store.toLowerCase().replace(/\W+/g, '-')}-${row.day}.jpg`,
        status: 'confirmed',
      })
      .select()
      .single()
    if (rErr) throw rErr

    const { data: expense, error: eErr } = await admin
      .from('expenses')
      .insert({
        receipt_id: receipt.id,
        user_id: user.id,
        date: daysAgo(row.day),
        amount: row.amount,
        currency: 'EUR',
        store_name: row.store,
        category: row.category,
      })
      .select()
      .single()
    if (eErr) throw eErr

    await admin.from('expense_items').insert([
      {
        expense_id: expense.id,
        description: 'Sample line item',
        quantity: 1,
        unit_price: row.amount,
        total_price: row.amount,
      },
    ])
  }

  console.log(`✓ seeded ${SAMPLE.length} expenses for ${TEST_USER.email}`)
}

main().catch((err) => {
  console.error('seed-expenses failed:', err.message ?? err)
  process.exit(1)
})
