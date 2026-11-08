import { DESIGN_DIRECTIONS, DIRECTION_META, type DesignDirection } from '@/design/directions'

interface DesignSwitcherProps {
  active: DesignDirection
  onChange: (next: DesignDirection) => void
}

/**
 * Review-only control for comparing the three directions in a running app.
 * Sits above the bottom navigation and is excluded from E2E assertions;
 * remove it once a direction is chosen.
 */
export function DesignSwitcher({ active, onChange }: DesignSwitcherProps) {
  return (
    <div
      data-testid="design-switcher"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto max-w-app"
    >
      <div className="pointer-events-auto absolute bottom-[88px] left-4 flex items-center gap-0.5 rounded-full border border-rule-strong bg-card/95 p-0.5 shadow-sm backdrop-blur">
        {DESIGN_DIRECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active === id}
            title={DIRECTION_META[id].tagline}
            className={[
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              active === id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {DIRECTION_META[id].name}
          </button>
        ))}
      </div>
    </div>
  )
}
