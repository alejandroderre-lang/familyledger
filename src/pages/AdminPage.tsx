import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Shield } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { ExpenseFilter } from '@/components/expenses/ExpenseFilter'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { QueryError } from '@/components/QueryError'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatCurrency, getCategoryColor } from '@/lib/utils'
import {
  dominantCurrency,
  emptyFilters,
  filterExpenses,
  groupByCategory,
  sumAmount,
  type ExpenseFilters,
} from '@/lib/expense-utils'
import type { Expense } from '@/types'

type Mode = 'mine' | 'all'

async function fetchAdminExpenses(mode: Mode, userId: string): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*, profile:profiles(*)')
    .order('date', { ascending: false })
  if (mode === 'mine') query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Expense[]
}

async function fetchReceiptCount(mode: Mode, userId: string): Promise<number> {
  let query = supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
  if (mode === 'mine') query = query.eq('user_id', userId)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('mine')
  const [filters, setFilters] = useState<ExpenseFilters>(emptyFilters)

  const {
    data: expenses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-expenses', mode, user?.id],
    queryFn: () => fetchAdminExpenses(mode, user!.id),
    enabled: Boolean(user?.id),
  })

  const { data: receiptCount = 0 } = useQuery({
    queryKey: ['admin-receipt-count', mode, user?.id],
    queryFn: () => fetchReceiptCount(mode, user!.id),
    enabled: Boolean(user?.id),
  })

  const currency = dominantCurrency(expenses)
  const allTimeSpend = sumAmount(expenses)
  const topCategory = groupByCategory(expenses)[0]?.category ?? null
  const filtered = filterExpenses(expenses, filters)

  return (
    <AppShell>
      <header className="flex items-center gap-2 px-4 pt-6 pb-4">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-[28px] font-bold text-foreground">Admin</h1>
      </header>

      {/* My / All users toggle */}
      <div className="px-4">
        <div className="flex rounded-lg border border-border bg-card p-1">
          {(['mine', 'all'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'h-10 flex-1 rounded-md text-sm font-medium transition-colors',
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {m === 'mine' ? 'My expenses' : 'All users'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <StatCard label="Total Receipts" value={String(receiptCount)} />
        <StatCard
          label="All-time Spend"
          value={formatCurrency(allTimeSpend, currency)}
        />
        <StatCard
          label="Top Category"
          value={
            topCategory ? (
              <span
                className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: getCategoryColor(topCategory) }}
              >
                {topCategory}
              </span>
            ) : (
              '—'
            )
          }
        />
      </div>

      <div className="mt-4">
        <ExpenseFilter
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(emptyFilters)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : filtered.length > 0 ? (
        <div className="divide-y divide-border">
          {filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              showUser={mode === 'all'}
              onClick={(e) => navigate(`/expenses/${e.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 px-4 py-16 text-center">
          <span className="text-4xl">🔍</span>
          <p className="mt-2 text-base font-semibold text-foreground">
            No expenses found
          </p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters
          </p>
        </div>
      )}
    </AppShell>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex w-40 shrink-0 flex-col rounded-xl border border-border bg-card p-4 shadow-card">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="mt-2 text-xl font-bold text-primary">{value}</span>
    </div>
  )
}
