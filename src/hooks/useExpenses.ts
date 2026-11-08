import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
  const { data, error } = await supabase
    .from('expenses')
    .select('*, receipt:receipts(*), items:expense_items(*)')
    .eq('id', expenseId)
    .single()

  if (error) throw error
  return data as Expense
}

/** A single expense with items. Query key: ['expense', expenseId]. */
export function useExpense(expenseId: string | undefined) {
  return useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => fetchExpense(expenseId as string),
    enabled: Boolean(expenseId),
  })
}
