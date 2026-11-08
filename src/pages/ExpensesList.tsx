import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
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
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-[28px] font-bold text-foreground">Expenses</h1>
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
            Tap + to add your first one
          </p>
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="mt-2 text-sm font-medium text-primary"
          >
            Add a receipt →
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
