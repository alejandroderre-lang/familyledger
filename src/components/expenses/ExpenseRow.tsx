import { formatCurrency, getCategoryColor } from '@/lib/utils'
import type { Expense } from '@/types'

/** Short date for list rows, e.g. "15 Jun". */
function formatShortDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

interface ExpenseRowProps {
  expense: Expense
  onClick?: (expense: Expense) => void
  /** Show the owner's name badge (used in the admin "All users" view). */
  showUser?: boolean
}

/** Shared expense row used in the Dashboard, Expenses list, and Admin panel. */
export function ExpenseRow({ expense, onClick, showUser = false }: ExpenseRowProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(expense)}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">
          {expense.store_name}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {formatShortDate(expense.date)}
        </p>
        {showUser && expense.profile?.full_name && (
          <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {expense.profile.full_name}
          </span>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-base font-bold text-primary">
          {formatCurrency(expense.amount, expense.currency)}
        </span>
        <span
          className="rounded px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: getCategoryColor(expense.category) }}
        >
          {expense.category}
        </span>
      </div>
    </button>
  )
}
