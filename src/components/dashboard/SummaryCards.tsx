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
    <div className="flex gap-3 overflow-x-auto px-4 pb-1">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex w-40 shrink-0 flex-col rounded-xl border border-border bg-card p-4 shadow-card"
        >
          <span className="text-xs text-muted-foreground">{card.label}</span>
          <span className="mt-2 text-2xl font-bold text-primary">
            {formatCurrency(card.amount, currency)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{currency}</span>
        </div>
      ))}
    </div>
  )
}
