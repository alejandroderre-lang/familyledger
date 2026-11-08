import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** Catches render errors and shows a friendly card instead of a white screen. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <span className="text-4xl">😕</span>
          <div>
            <p className="text-base font-bold text-foreground">
              Something went wrong
            </p>
            <p className="text-sm text-muted-foreground">
              Please reload the app to continue.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} className="h-12 rounded-lg">
            Reload
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
