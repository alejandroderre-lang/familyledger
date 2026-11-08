import { PieChart as PieChartIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { formatCurrency, getCategoryColor } from '@/lib/utils'
import { groupByCategory, isInMonth } from '@/lib/expense-utils'
import type { Expense } from '@/types'

interface CategoryChartProps {
  expenses: Expense[]
  currency: string
}

export function CategoryChart({ expenses, currency }: CategoryChartProps) {
  const now = new Date()
  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(now)

  const monthExpenses = expenses.filter((e) =>
    isInMonth(e.date, now.getFullYear(), now.getMonth()),
  )
  const data = groupByCategory(monthExpenses)
  const monthTotal = data.reduce((sum, entry) => sum + entry.total, 0)

  return (
    <section className="mt-6 px-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="text-base font-semibold text-foreground">
          Spending by category
        </h2>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>

        {data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <PieChartIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No expenses this month yet
            </p>
          </div>
        ) : (
          <>
            {/* The donut's hole is the most prominent empty space on the
                screen; the month total is the number people look for first. */}
            <div className="relative mt-2 h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={getCategoryColor(entry.category)}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(monthTotal, currency)}
                </span>
              </div>
            </div>

            <ul className="mt-5 flex flex-col">
              {data.map((entry) => {
                const share = monthTotal > 0 ? (entry.total / monthTotal) * 100 : 0
                return (
                  <li
                    key={entry.category}
                    className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getCategoryColor(entry.category) }}
                    />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {entry.category}
                    </span>
                    {/* Tabular numerals so the amounts form a clean column. */}
                    <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">
                      {share.toFixed(0)}%
                    </span>
                    <span className="w-20 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(entry.total, currency)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
