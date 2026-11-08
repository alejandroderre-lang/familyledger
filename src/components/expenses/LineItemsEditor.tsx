import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { lineTotal, makeItem, type EditableItem } from './line-items'

interface LineItemsEditorProps {
  items: EditableItem[]
  onChange: (items: EditableItem[]) => void
}

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  function updateItem(key: string, patch: Partial<EditableItem>) {
    onChange(
      items.map((it) => {
        if (it.key !== key) return it
        const next = { ...it, ...patch }
        // Recalculate the row total whenever qty or unit price changes.
        next.total_price = lineTotal(next.quantity, next.unit_price)
        return next
      }),
    )
  }

  function removeItem(key: string) {
    onChange(items.filter((it) => it.key !== key))
  }

  function addItem() {
    onChange([...items, makeItem()])
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No items detected — add them manually if needed
        </p>
      )}

      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-2">
          <Input
            className="h-11 flex-1"
            placeholder="Item name"
            value={it.description}
            onChange={(e) => updateItem(it.key, { description: e.target.value })}
          />
          <Input
            className="h-11 w-16 px-2"
            type="number"
            min="0.01"
            step="0.01"
            value={it.quantity}
            onChange={(e) =>
              updateItem(it.key, { quantity: Number(e.target.value) })
            }
            aria-label="Quantity"
          />
          <Input
            className="h-11 w-20 px-2"
            type="number"
            min="0"
            step="0.01"
            value={it.unit_price}
            onChange={(e) =>
              updateItem(it.key, { unit_price: Number(e.target.value) })
            }
            aria-label="Unit price"
          />
          <Input
            className="h-11 w-20 bg-muted px-2 font-bold"
            value={it.total_price.toFixed(2)}
            readOnly
            tabIndex={-1}
            aria-label="Line total"
          />
          <button
            type="button"
            onClick={() => removeItem(it.key)}
            aria-label="Delete item"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addItem}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add item
      </Button>
    </div>
  )
}
