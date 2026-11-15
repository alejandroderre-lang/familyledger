import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { ExpenseFilter } from '@/components/expenses/ExpenseFilter'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { QueryError } from '@/components/QueryError'
import { useAuth } from '@/hooks/useAuth'
import { useExpenses } from '@/hooks/useExpenses'
import {
  emptyFilters,
  filterExpenses,
  hasActiveFilters,
  type ExpenseFilters,
} from '@/lib/expense-utils'

export default function ExpensesList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: expenses = [], isLoading, isError, refetch } = useExpenses(user?.id)
  const [filters, setFilters] = useState<ExpenseFilters>(emptyFilters)

  const filtered = filterExpenses(expenses, filters)
  const filtersActive = hasActiveFilters(filters)

  return (
    <AppShell>
      {/* Same header shape as the dashboard, so the add action is in the same
          place on both screens rather than only on one. */}
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 pb-4 pt-6">
        <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
          Expenses
        </h1>
        <button
          type="button"
          onClick={() => navigate('/upload')}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-[--radius] bg-primary pl-2.5 pr-3.5 text-[13px] font-medium text-primary-foreground transition-opacity active:opacity-80"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add
        </button>
      </header>

      <ExpenseFilter
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(emptyFilters)}
      />

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
              onClick={(e) => navigate(`/expenses/${e.id}`)}
            />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-16 text-center">
          <span className="text-4xl">🧾</span>
          <p className="mt-2 text-base font-semibold text-foreground">
            No receipts yet!
          </p>
          <p className="text-sm text-muted-foreground">
            Photograph one and it will show up here
          </p>
          {/* The primary action on a first-time user's screen: a real button
              at the 48px minimum, not a text link. */}
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="mt-4 flex h-12 items-center gap-2 rounded-[--radius] bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-opacity active:opacity-80"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add a receipt
          </button>
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
          {filtersActive && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="mt-2 text-sm font-medium text-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </AppShell>
  )
}
