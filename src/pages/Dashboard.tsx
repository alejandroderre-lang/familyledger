import { useNavigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
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

  return (
    <AppShell>
      <header className="px-4 pt-6">
        <h1 className="text-[28px] font-bold text-foreground">
          {firstName ? `Hi, ${firstName}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground">Here's your spending</p>
      </header>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : (
          <>
            <SummaryCards expenses={expenses} currency={currency} />
            <CategoryChart expenses={expenses} currency={currency} />
            <RecentExpenses expenses={expenses} />
          </>
        )}
      </div>

      {/* FAB — anchored to the bottom-right of the 430px column on all sizes. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app">
        <button
          type="button"
          onClick={() => navigate('/upload')}
          aria-label="Add receipt"
          className="pointer-events-auto absolute bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-fab"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </AppShell>
  )
}
