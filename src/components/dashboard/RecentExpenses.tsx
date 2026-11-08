import { useNavigate } from 'react-router-dom'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import type { Expense } from '@/types'

interface RecentExpensesProps {
  expenses: Expense[]
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  const navigate = useNavigate()
  const recent = expenses.slice(0, 10)

  return (
    <section className="mt-6">
      {/* pr-20 keeps "See all" clear of the floating action button, which is
          fixed 16px from the right edge and would otherwise sit on top of it. */}
      <div className="flex items-center justify-between px-4 pr-20">
        <h2 className="text-base font-semibold text-foreground">Recent</h2>
        <button
          type="button"
          onClick={() => navigate('/expenses')}
          // -mr-2/px-2 keep the text optically aligned while the tap target
          // meets the 48px minimum the design system requires.
          className="-mr-2 flex min-h-[48px] items-center rounded-lg px-2 text-sm font-medium text-primary active:bg-primary/5"
        >
          See all →
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <span className="text-4xl">🧾</span>
          <p className="mt-2 text-base font-semibold text-foreground">
            No receipts yet!
          </p>
          <p className="text-sm text-muted-foreground">
            Tap + to add your first one
          </p>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {recent.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onClick={(e) => navigate(`/expenses/${e.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
