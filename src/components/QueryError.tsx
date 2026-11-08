import { Button } from '@/components/ui/button'

/** Friendly inline error for failed data fetches, with a retry action. */
export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <span className="text-3xl">⚠️</span>
      <p className="text-base font-semibold text-foreground">
        Couldn't load your data
      </p>
      <p className="text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button variant="outline" onClick={onRetry} className="mt-2 rounded-lg">
        Retry
      </Button>
    </div>
  )
}
