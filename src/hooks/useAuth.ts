import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to load profile:', error.message)
    return null
  }
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Guards against state updates after unmount.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    // Apply a session (or lack of one) to local state, loading its profile.
    async function applySession(session: Session | null) {
      const nextUser = session?.user ?? null
      const nextProfile = nextUser ? await fetchProfile(nextUser.id) : null
      if (!mounted.current) return
      setUser(nextUser)
      setProfile(nextProfile)
      setLoading(false)
    }

    // Restore any persisted session on mount. If Supabase is unreachable the
    // request rejects — fall through to the login screen instead of spinning.
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch((error: unknown) => {
        console.error('Failed to restore session:', error)
        applySession(null)
      })

    // Keep state in sync with auth changes (login, logout, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => {
      mounted.current = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = { user, profile, loading, signIn, signOut }

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
