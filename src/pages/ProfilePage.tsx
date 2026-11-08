import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const fullName = profile?.full_name?.trim()
  const email = profile?.email ?? user?.email ?? ''
  const initial = (fullName || email || '?').charAt(0).toUpperCase()
  const isAdmin = profile?.role === 'admin'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col px-4 pt-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {initial}
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            {fullName || 'Member'}
          </h1>
          <p className="text-sm text-muted-foreground">{email}</p>
          <span
            className={cn(
              'mt-3 rounded-full px-3 py-1 text-xs font-medium',
              isAdmin
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {isAdmin ? 'Admin' : 'Member'}
          </span>
        </div>

        <div className="my-8 h-px w-full bg-border" />

        <Button
          variant="outline"
          onClick={handleSignOut}
          className="h-12 w-full rounded-lg border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sign out
        </Button>

        <p className="mt-auto py-6 text-center text-xs text-muted-foreground">
          FamilyLedger v1.0
        </p>
      </div>
    </AppShell>
  )
}
