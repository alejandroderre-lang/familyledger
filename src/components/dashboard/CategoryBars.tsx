import { formatCurrency, getCategoryColor, muteColor } from '@/lib/utils'
import { groupByCategory, isInMonth } from '@/lib/expense-utils'
import type { Expense } from '@/types'
import type { DesignDirection } from '@/design/directions'

/**
 * How much colour each direction spends on the bars — the one axis where the
 * three genuinely disagree.
 *
 *   ledger    monochrome; rank is encoded by weight alone, as Ramp does
 *   statement monochrome, with the lime accent reserved for the top category
 *   grid      muted category hues, kept well below pill saturation
 */
function barFill(direction: DesignDirection, category: string, rank: number): string {
  if (direction === 'grid') return muteColor(getCategoryColor(category))
  if (direction === 'statement' && rank === 0) return 'hsl(var(--accent-mark))'
  // Each step down the ranking lightens the bar; floor keeps the tail visible.
  const lightness = Math.min(78, 14 + rank * 15)
  return `hsl(0 0% ${lightness}%)`
}

interface CategoryBarsProps {
  expenses: Expense[]
  currency: string
  direction: DesignDirection
}

/**
 * Horizontal share bars rather than a donut.
 *
 * A donut makes you compare arc lengths and jump to a legend; a sorted bar
 * list puts rank, share, and amount on one line each. It is the chart Ramp
 * reaches for in spend breakdowns, and it reads at a glance on a phone.
 */
export function CategoryBars({ expenses, currency, direction }: CategoryBarsProps) {
  const now = new Date()
  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(now)

  const monthExpenses = expenses.filter((e) =>
    isInMonth(e.date, now.getFullYear(), now.getMonth()),
  )
  const data = groupByCategory(monthExpenses)
  const total = data.reduce((sum, d) => sum + d.total, 0)
  const max = data.reduce((m, d) => Math.max(m, d.total), 0)

  return (
    <section className="mt-5">
      <header className="flex items-baseline justify-between border-b border-rule px-4 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          By category
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {monthLabel}
        </span>
      </header>

      {data.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No expenses this month yet
        </p>
      ) : (
        <ul className="px-4">
          {data.map((entry, rank) => {
            const share = total > 0 ? (entry.total / total) * 100 : 0
            // Bars scale against the largest category, not the total, so small
            // categories stay visible instead of collapsing to a sliver.
            const width = max > 0 ? (entry.total / max) * 100 : 0
            return (
              <li
                key={entry.category}
                className="border-b border-rule py-2.5 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {entry.category}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums tracking-tight text-foreground">
                    {formatCurrency(entry.total, currency)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div
                    className={[
                      'h-[5px] flex-1 overflow-hidden bg-muted',
                      direction === 'grid' ? 'rounded-none' : 'rounded-sm',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'h-full',
                        direction === 'grid' ? 'rounded-none' : 'rounded-sm',
                      ].join(' ')}
                      style={{
                        width: `${width}%`,
                        background: barFill(direction, entry.category, rank),
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {share.toFixed(0)}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
