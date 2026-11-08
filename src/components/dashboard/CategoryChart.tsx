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
            <div className="mt-2 h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
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
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {data.map((entry) => (
                <li key={entry.category} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getCategoryColor(entry.category) }}
                  />
                  <span className="flex-1 truncate text-sm text-foreground">
                    {entry.category}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(entry.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
