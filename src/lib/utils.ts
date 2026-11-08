import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ExpenseCategory } from '@/types'

/** Merge Tailwind class names, resolving conflicts (used by shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a numeric amount as currency, e.g. formatCurrency(12.5, 'EUR') → "€12.50".
 * Falls back gracefully if the currency code is not a valid ISO 4217 code.
 */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const code = (currency || 'EUR').toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(safeAmount)
  } catch {
    // Invalid currency code — fall back to the plain number plus the code.
    return `${safeAmount.toFixed(2)} ${code}`
  }
}

/**
 * Format an ISO date string (YYYY-MM-DD) as a human-readable date,
 * e.g. formatDate('2025-06-15') → "15 Jun 2025".
 */
export function formatDate(dateString: string): string {
  if (!dateString) return ''
  // Treat as a calendar date (avoid timezone shifting a date-only string).
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** Background hex color for a category pill (white text on top). */
const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Groceries: '#16A34A',
  'Dining & Restaurants': '#EA580C',
  'Gas & Petrol': '#7C3AED',
  'Transport & Travel': '#0284C7',
  'Pharmacy & Health': '#DC2626',
  'Clothing & Accessories': '#DB2777',
  Electronics: '#0891B2',
  Entertainment: '#D97706',
  Utilities: '#4B5563',
  Other: '#6B7280',
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as ExpenseCategory] ?? CATEGORY_COLORS.Other
}

/**
 * Desaturates and darkens a hex colour toward the page's neutral register.
 *
 * The category palette is deliberately vivid for pills. Ramp-style surfaces
 * are near-monochrome, so chart fills borrow the hue but drop most of the
 * chroma — enough to distinguish categories, not enough to shout.
 */
export function muteColor(hex: string, saturation = 0.34, lightness = 0.9): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return `hsl(${Math.round(h * 360)} ${Math.round(s * saturation * 100)}% ${Math.round(
    l * lightness * 100,
  )}%)`
}
