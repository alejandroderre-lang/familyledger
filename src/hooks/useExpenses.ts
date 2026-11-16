import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/utils'
import type { Expense } from '@/types'

/** Fetch all expenses for a user, most recent first. */
async function fetchExpenses(userId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []) as Expense[]
}

/** All expenses for the current user. Query key: ['expenses', userId]. */
export function useExpenses(userId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', userId],
    queryFn: () => fetchExpenses(userId as string),
    enabled: Boolean(userId),
  })
}

/** Fetch a single expense with its receipt + line items. */
async function fetchExpense(expenseId: string): Promise<Expense | null> {
  // A hand-edited URL would otherwise reach Postgres as a malformed uuid and
  // come back 400. Not found is the honest answer and costs no round trip.
  if (!isUuid(expenseId)) return null

  const { data, error } = await supabase
    .from('expenses')
    .select('*, receipt:receipts(*), items:expense_items(*)')
    .eq('id', expenseId)
    // maybeSingle rather than single: zero rows is an ordinary outcome here,
    // and single() raises 406 for it, logging an error on a normal path.
    .maybeSingle()

  if (error) throw error
  return (data as Expense) ?? null
}

/** A single expense with items. Query key: ['expense', expenseId]. */
export function useExpense(expenseId: string | undefined) {
  return useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => fetchExpense(expenseId as string),
    enabled: Boolean(expenseId),
  })
}
