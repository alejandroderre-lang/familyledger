import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types'
import { getCategoryColor } from '@/lib/utils'
import { hasActiveFilters, type ExpenseFilters } from '@/lib/expense-utils'

interface ExpenseFilterProps {
  filters: ExpenseFilters
  onChange: (filters: ExpenseFilters) => void
  onClear: () => void
}

export function ExpenseFilter({ filters, onChange, onClear }: ExpenseFilterProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  function toggleCategory(category: ExpenseCategory) {
    const selected = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category]
    onChange({ ...filters, categories: selected })
  }

  const categoryLabel =
    filters.categories.length > 0
      ? `${filters.categories.length} selected`
      : 'All categories'

  return (
    <div className="sticky top-0 z-30 flex flex-col gap-3 border-b border-border bg-card p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by store..."
          className="h-11 pl-10"
        />
      </div>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
            className="h-11"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
            className="h-11"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-11 items-center justify-between rounded-md border border-input bg-background px-3 text-base"
      >
        <span
          className={
            filters.categories.length > 0
              ? 'font-medium text-foreground'
              : 'text-muted-foreground'
          }
        >
          {categoryLabel}
        </span>
      </button>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onClear}
          className="self-start text-sm font-medium text-primary"
        >
          Clear filters
        </button>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Categories</SheetTitle>
          </SheetHeader>
          <ul className="mt-4 flex flex-col gap-1 pb-4">
            {EXPENSE_CATEGORIES.map((category) => {
              const checked = filters.categories.includes(category)
              return (
                <li key={category}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded border"
                      style={{
                        backgroundColor: checked
                          ? getCategoryColor(category)
                          : 'transparent',
                        borderColor: checked
                          ? getCategoryColor(category)
                          : 'hsl(var(--border))',
                      }}
                    >
                      {checked && <Check className="h-4 w-4 text-white" />}
                    </span>
                    <span className="text-base text-foreground">{category}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  )
}
