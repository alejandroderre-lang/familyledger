import { Loader2 } from 'lucide-react'

/** Full-screen centered spinner used while auth state is resolving. */
export function LoadingScreen() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  )
}
