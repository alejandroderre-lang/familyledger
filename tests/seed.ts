/**
 * Creates (or resets) the local E2E accounts and clears their data.
 *
 * Idempotent — safe to run before every test run.
 * Run: npm run test:seed
 */
import { createClient } from '@supabase/supabase-js'
import { LOCAL_SUPABASE, TEST_ADMIN, TEST_USER } from './test-user'

const admin = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function upsertUser(
  account: { email: string; password: string; fullName: string },
  role: 'user' | 'admin',
) {
  const { data: existing } = await admin.auth.admin.listUsers()
  const found = existing?.users.find((u) => u.email === account.email)

  let userId: string
  if (found) {
    userId = found.id
    await admin.auth.admin.updateUserById(userId, { password: account.password })
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    })
    if (error) throw error
    userId = data.user.id
  }

  // handle_new_user() seeds the profile; set the role and name explicitly so a
  // re-run of an existing account converges to the same state.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role, full_name: account.fullName })
    .eq('id', userId)
  if (profileError) throw profileError

  return userId
}

async function clearData(userIds: string[]) {
  // expense_items and expenses cascade from receipts.
  const { error } = await admin.from('receipts').delete().in('user_id', userIds)
  if (error) throw error
  const { error: orphanError } = await admin
    .from('expenses')
    .delete()
    .in('user_id', userIds)
  if (orphanError) throw orphanError
}

async function main() {
  const userId = await upsertUser(TEST_USER, 'user')
  const adminId = await upsertUser(TEST_ADMIN, 'admin')
  await clearData([userId, adminId])
  console.log(`✓ seeded ${TEST_USER.email} (user)`)
  console.log(`✓ seeded ${TEST_ADMIN.email} (admin)`)
  console.log('✓ cleared receipts/expenses for both accounts')
}

main().catch((err) => {
  console.error('seed failed:', err.message ?? err)
  process.exit(1)
})
