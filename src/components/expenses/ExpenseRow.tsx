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
      className="flex min-h-[60px] w-full items-center gap-3 border-b border-rule px-4 py-3 text-left transition-colors last:border-b-0 active:bg-muted"
    >
      {/* A 2px colour tick instead of a filled pill: category is still legible
          at a glance, but the row stays monochrome the way Ramp's tables do. */}
      <span
        aria-hidden
        className="h-7 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: getCategoryColor(expense.category) }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-tight text-foreground">
          {expense.store_name}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
          {formatShortDate(expense.date)} · {expense.category}
          {showUser && expense.profile?.full_name
            ? ` · ${expense.profile.full_name}`
            : ''}
        </p>
      </div>

      <span className="shrink-0 text-[15px] font-semibold tabular-nums tracking-tight text-foreground">
        {formatCurrency(expense.amount, expense.currency)}
      </span>
    </button>
  )
}
