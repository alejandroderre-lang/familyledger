import { useNavigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { MetricStrip } from '@/components/dashboard/MetricStrip'
import { CategoryBars } from '@/components/dashboard/CategoryBars'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { DesignSwitcher } from '@/components/DesignSwitcher'
import { useDesign } from '@/design/useDesign'
import { QueryError } from '@/components/QueryError'
import { useAuth } from '@/hooks/useAuth'
import { useExpenses } from '@/hooks/useExpenses'
import { dominantCurrency } from '@/lib/expense-utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { data: expenses = [], isLoading, isError, refetch } = useExpenses(user?.id)

  const currency = dominantCurrency(expenses)
  const firstName = profile?.full_name?.split(' ')[0]
  const [direction, setDirection] = useDesign()

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <AppShell>
      {/* Micro-label above the title, action aligned to the baseline on the
          right. Putting the primary action in the header is Ramp's pattern and
          it stops a floating button from covering transaction rows. */}
      <header className="flex items-start justify-between gap-3 border-b border-rule px-4 pb-4 pt-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {today}
          </p>
          <h1 className="mt-1.5 truncate text-[24px] font-semibold tracking-tight text-foreground">
            {firstName ? `Hi, ${firstName}` : 'Dashboard'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/upload')}
          className="mt-1 flex h-11 shrink-0 items-center gap-1.5 rounded-[--radius] bg-primary pl-2.5 pr-3.5 text-[13px] font-medium text-primary-foreground transition-opacity active:opacity-80"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add
        </button>
      </header>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <>
            <MetricStrip
              expenses={expenses}
              currency={currency}
              direction={direction}
            />
            <CategoryBars
              expenses={expenses}
              currency={currency}
              direction={direction}
            />
            <RecentExpenses expenses={expenses} />
          </>
        )}
      </div>

      <DesignSwitcher active={direction} onChange={setDirection} />

    </AppShell>
  )
}
