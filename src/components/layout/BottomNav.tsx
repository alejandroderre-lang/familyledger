import { NavLink } from 'react-router-dom'
import { Home, List, Shield, User, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/expenses', label: 'Expenses', icon: List },
  { to: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
  { to: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const { profile } = useAuth()
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile?.role === 'admin',
  )

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-app -translate-x-1/2 border-t border-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-16 items-stretch">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-full min-w-[48px] flex-col items-center justify-center gap-1 text-muted-foreground transition-colors',
                  isActive && 'text-primary',
                )
              }
            >
              <Icon className="h-6 w-6" />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
