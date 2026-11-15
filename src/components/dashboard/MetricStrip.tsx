import { formatCurrency } from '@/lib/utils'
import { isInMonth, isInYear, sumAmount } from '@/lib/expense-utils'
import type { Expense } from '@/types'

interface MetricStripProps {
  expenses: Expense[]
  currency: string
}

/**
 * Ramp presents figures in a single bordered strip divided by hairlines rather
 * than as separate shadowed cards — the division between numbers carries the
 * structure, so nothing needs to float. No horizontal scrolling either: every
 * figure is on screen.
 */
export function MetricStrip({ expenses, currency }: MetricStripProps) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const last = new Date(year, month - 1, 1)

  const thisMonth = sumAmount(expenses.filter((e) => isInMonth(e.date, year, month)))
  const lastMonth = sumAmount(
    expenses.filter((e) => isInMonth(e.date, last.getFullYear(), last.getMonth())),
  )
  const thisYear = sumAmount(expenses.filter((e) => isInYear(e.date, year)))


  const cells = [
    { label: 'This month', value: formatCurrency(thisMonth, currency), emphasis: true },
    { label: 'Last month', value: formatCurrency(lastMonth, currency) },
    { label: 'This year', value: formatCurrency(thisYear, currency) },
  ]


  return (
    <section className="px-4 pt-2">
      <div className="grid grid-cols-3 overflow-hidden rounded-[--radius] border border-rule bg-card">
        {cells.map((cell, i) => (
          <Cell
            key={cell.label}
            label={cell.label}
            value={cell.value}
            emphasis={cell.emphasis}
            divider={i > 0}
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
}: {
  label: string
  value: string
  emphasis?: boolean
  divider?: boolean
}) {
  return (
    <div
      className={[
        'px-4 py-3.5',
        divider ? 'border-l border-rule' : '',
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
