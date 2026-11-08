import { formatCurrency } from '@/lib/utils'
import { isInMonth, isInYear, sumAmount } from '@/lib/expense-utils'
import type { Expense } from '@/types'
import type { DesignDirection } from '@/design/directions'

interface MetricStripProps {
  expenses: Expense[]
  currency: string
  direction: DesignDirection
}

/**
 * Ramp presents figures in a single bordered strip divided by hairlines rather
 * than as separate shadowed cards — the division between numbers carries the
 * structure, so nothing needs to float. No horizontal scrolling either: every
 * figure is on screen.
 */
export function MetricStrip({ expenses, currency, direction }: MetricStripProps) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const last = new Date(year, month - 1, 1)

  const thisMonth = sumAmount(expenses.filter((e) => isInMonth(e.date, year, month)))
  const lastMonth = sumAmount(
    expenses.filter((e) => isInMonth(e.date, last.getFullYear(), last.getMonth())),
  )
  const thisYear = sumAmount(expenses.filter((e) => isInYear(e.date, year)))

  const delta = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null
  const receipts = expenses.length

  const cells = [
    { label: 'This month', value: formatCurrency(thisMonth, currency), emphasis: true },
    { label: 'Last month', value: formatCurrency(lastMonth, currency) },
    { label: 'This year', value: formatCurrency(thisYear, currency) },
    ...(direction === 'grid'
      ? [{ label: 'Receipts', value: String(receipts) }]
      : []),
  ]

  if (direction === 'statement') {
    return (
      <section className="px-4 pt-2">
        <div className="overflow-hidden rounded-[--radius] bg-hero px-5 py-6 text-hero-foreground">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-60">
            Spent this month
          </p>
          <p className="mt-2 text-[40px] font-semibold leading-none tabular-nums tracking-tight">
            {formatCurrency(thisMonth, currency)}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[13px]">
            {delta !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 tabular-nums">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: delta <= 0 ? 'hsl(var(--accent-mark))' : '#FF8A6A' }}
                />
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(0)}% vs last month
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[--radius] border border-rule bg-card">
          <Cell label="Last month" value={formatCurrency(lastMonth, currency)} />
          <Cell label="This year" value={formatCurrency(thisYear, currency)} divider />
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 pt-2">
      <div
        className={[
          'grid overflow-hidden rounded-[--radius] border border-rule bg-card',
          direction === 'grid' ? 'grid-cols-2' : 'grid-cols-3',
        ].join(' ')}
      >
        {cells.map((cell, i) => (
          <Cell
            key={cell.label}
            label={cell.label}
            value={cell.value}
            emphasis={cell.emphasis}
            divider={direction === 'grid' ? i % 2 === 1 : i > 0}
            topRule={direction === 'grid' && i > 1}
          />
        ))}
      </div>
    </section>
  )
}

function Cell({
  label,
  value,
  emphasis,
  divider,
  topRule,
}: {
  label: string
  value: string
  emphasis?: boolean
  divider?: boolean
  topRule?: boolean
}) {
  return (
    <div
      className={[
        'px-4 py-3.5',
        divider ? 'border-l border-rule' : '',
        topRule ? 'border-t border-rule' : '',
      ].join(' ')}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p
        className={[
          'mt-1.5 tabular-nums tracking-tight text-foreground',
          emphasis ? 'text-[22px] font-semibold' : 'text-[17px] font-medium',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}
