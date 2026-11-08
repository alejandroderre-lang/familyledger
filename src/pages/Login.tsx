import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/layout/LoadingScreen'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Wait for the persisted session check before deciding what to show.
  if (loading) return <LoadingScreen />
  // Already signed in — skip the login screen.
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch {
      setError('Incorrect email or password. Please try again.')
      setSubmitting(false)
    }
  }

  const hasError = Boolean(error)

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-6 flex flex-col items-center text-center">
          <Receipt className="h-10 w-10 text-primary" strokeWidth={2} />
          <h1 className="mt-3 text-[28px] font-bold text-primary">FamilyLedger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Family expense tracking
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn('h-12 text-base', hasError && 'border-destructive')}
            aria-invalid={hasError}
            required
          />

          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn('h-12 pr-12 text-base', hasError && 'border-destructive')}
              aria-invalid={hasError}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-muted-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-lg text-base font-semibold"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
