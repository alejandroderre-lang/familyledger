import type { Expense, ExpenseCategory } from '@/types'

export interface ExpenseFilters {
  search: string
  from: string
  to: string
  categories: ExpenseCategory[]
}

export const emptyFilters: ExpenseFilters = {
  search: '',
  from: '',
  to: '',
  categories: [],
}

export function hasActiveFilters(f: ExpenseFilters): boolean {
  return Boolean(f.search || f.from || f.to || f.categories.length > 0)
}

/** Apply search / date-range / category filters (client-side). */
export function filterExpenses(
  expenses: Expense[],
  f: ExpenseFilters,
): Expense[] {
  const search = f.search.trim().toLowerCase()
  const categorySet = new Set(f.categories)
  return expenses.filter((e) => {
    if (search && !e.store_name.toLowerCase().includes(search)) return false
    if (f.from && e.date < f.from) return false
    if (f.to && e.date > f.to) return false
    if (categorySet.size > 0 && !categorySet.has(e.category)) return false
    return true
  })
}

/** Parse a date-only string (YYYY-MM-DD) as a local calendar date. */
export function parseDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`)
}

export function sumAmount(expenses: Expense[]): number {
  return expenses.reduce((total, e) => total + Number(e.amount), 0)
}

/** The currency code used by the most expenses (defaults to EUR). */
export function dominantCurrency(expenses: Expense[]): string {
  if (expenses.length === 0) return 'EUR'
  const counts = new Map<string, number>()
  for (const e of expenses) {
    const code = e.currency || 'EUR'
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  let best = 'EUR'
  let bestCount = -1
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code
      bestCount = count
    }
  }
  return best
}

export function isInMonth(dateString: string, year: number, month: number): boolean {
  const d = parseDate(dateString)
  return d.getFullYear() === year && d.getMonth() === month
}

export function isInYear(dateString: string, year: number): boolean {
  return parseDate(dateString).getFullYear() === year
}

export interface CategoryTotal {
  category: ExpenseCategory
  total: number
}

/** Totals per category, descending, excluding categories with no spend. */
export function groupByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, number>()
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount))
  }
  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
}
