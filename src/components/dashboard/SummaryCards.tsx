import { formatCurrency } from '@/lib/utils'
import { isInMonth, isInYear, sumAmount } from '@/lib/expense-utils'
import type { Expense } from '@/types'

interface SummaryCardsProps {
  expenses: Expense[]
  currency: string
}

export function SummaryCards({ expenses, currency }: SummaryCardsProps) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastMonthDate = new Date(year, month - 1, 1)
  const lmYear = lastMonthDate.getFullYear()
  const lmMonth = lastMonthDate.getMonth()

  const cards = [
    {
      label: 'This Month',
      amount: sumAmount(expenses.filter((e) => isInMonth(e.date, year, month))),
    },
    {
      label: 'Last Month',
      amount: sumAmount(expenses.filter((e) => isInMonth(e.date, lmYear, lmMonth))),
    },
    {
      label: 'This Year',
      amount: sumAmount(expenses.filter((e) => isInYear(e.date, year))),
    },
  ]

  return (
    // snap-x makes the half-visible third card read as "there is more here"
    // rather than as a clipped layout; scrollbar-none keeps it clean on
    // desktop. scroll-px/pr-4 preserve the 16px gutter at both ends.
    <div className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={[
            'flex w-40 shrink-0 snap-start flex-col rounded-xl border bg-card p-4',
            // The current month is the number that matters most; give it the
            // visual weight instead of three identical cards.
            index === 0
              ? 'border-primary/25 shadow-card ring-1 ring-primary/10'
              : 'border-border shadow-card',
          ].join(' ')}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {card.label}
          </span>
          <span className="mt-2 text-2xl font-bold tabular-nums text-primary">
            {formatCurrency(card.amount, currency)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{currency}</span>
        </div>
      ))}
      {/* Trailing spacer so the last card can snap clear of the right edge. */}
      <div aria-hidden className="w-1 shrink-0" />
    </div>
  )
}
