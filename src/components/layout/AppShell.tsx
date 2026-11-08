import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

/**
 * Wraps authenticated pages: a 430px-wide centered column with a scrollable
 * content area and a fixed BottomNav. Each page renders its own header.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative mx-auto flex min-h-[100svh] w-full max-w-app flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Scrollable content area; pb-20 keeps content clear of the BottomNav. */}
      <main className="flex flex-1 flex-col overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
