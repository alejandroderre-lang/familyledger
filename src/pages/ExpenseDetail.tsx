import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Pencil, Receipt as ReceiptIcon, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useExpense } from '@/hooks/useExpenses'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LineItemsEditor } from '@/components/expenses/LineItemsEditor'
import {
  itemsTotal,
  makeItem,
  type EditableItem,
} from '@/components/expenses/line-items'
import { formatCurrency, getCategoryColor } from '@/lib/utils'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types'

function formatLongDate(dateString: string): string {
  if (!dateString) return ''
  const d = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: expense, isLoading } = useExpense(id)

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Editable form state
  const [date, setDate] = useState('')
  const [storeName, setStoreName] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Other')
  const [currency, setCurrency] = useState('EUR')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])

  // Seed form state from the loaded expense.
  function seedForm() {
    if (!expense) return
    setDate(expense.date)
    setStoreName(expense.store_name)
    setCategory(expense.category)
    setCurrency(expense.currency)
    setAmount(String(expense.amount))
    setNotes(expense.notes ?? '')
    setItems((expense.items ?? []).map((it) => makeItem(it)))
  }

  // Seed editable form state from the loaded expense (intended effect use).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    seedForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch signed URL for the private receipt image.
  useEffect(() => {
    const path = expense?.receipt?.image_url
    if (!path) return
    supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600)
      .then(({ data }) => setImageUrl(data?.signedUrl ?? null))
  }, [expense?.receipt?.image_url])

  function handleItemsChange(next: EditableItem[]) {
    setItems(next)
    if (next.length > 0) setAmount(itemsTotal(next).toFixed(2))
  }

  function startEdit() {
    seedForm()
    setEditMode(true)
  }

  function cancelEdit() {
    seedForm()
    setEditMode(false)
  }

  async function handleSave() {
    if (!expense || !user) return
    const amountNum = parseFloat(amount)
    if (!date || !storeName.trim()) {
      toast.error('Please fill in the date and store name.')
      return
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Please enter a total amount greater than 0.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          date,
          store_name: storeName.trim(),
          category,
          currency: currency.toUpperCase() || 'EUR',
          amount: amountNum,
          notes: notes.trim() || null,
        })
        .eq('id', expense.id)
      if (error) throw error

      await supabase.from('expense_items').delete().eq('expense_id', expense.id)
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('expense_items').insert(
          items.map((it) => ({
            expense_id: expense.id,
            description: it.description || 'Item',
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_price: it.total_price,
          })),
        )
        if (itemsError) throw itemsError
      }

      queryClient.invalidateQueries({ queryKey: ['expense', expense.id] })
      queryClient.invalidateQueries({ queryKey: ['expenses', user.id] })
      toast.success('Changes saved!')
      setEditMode(false)
    } catch {
      toast.error('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!expense) return
    try {
      await supabase.from('expense_items').delete().eq('expense_id', expense.id)
      await supabase.from('expenses').delete().eq('id', expense.id)
      await supabase.from('receipts').delete().eq('id', expense.receipt_id)
      if (user) queryClient.invalidateQueries({ queryKey: ['expenses', user.id] })
      toast.success('Receipt deleted')
      navigate('/expenses')
    } catch {
      toast.error('Could not delete the receipt.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="mx-auto flex min-h-[100svh] w-full max-w-app flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-base font-semibold text-foreground">
          Expense not found
        </p>
        <Button variant="outline" onClick={() => navigate('/expenses')}>
          Back to expenses
        </Button>
      </div>
    )
  }

  const displayTotal = formatCurrency(Number(amount || expense.amount), currency)

  return (
    <div
      className="mx-auto flex min-h-[100svh] w-full max-w-app flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="relative flex items-center justify-between px-2 py-4">
        <button
          type="button"
          onClick={() => navigate('/expenses')}
          aria-label="Back"
          className="flex h-12 w-12 items-center justify-center text-foreground"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        {!editMode ? (
          <button
            type="button"
            onClick={startEdit}
            className="flex h-12 items-center gap-1 px-3 font-medium text-primary"
          >
            <Pencil className="h-5 w-5" />
            Edit
          </button>
        ) : (
          <Button onClick={handleSave} disabled={saving} className="mr-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save'}
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-8">
        {/* Receipt image thumbnail */}
        {imageUrl ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="overflow-hidden rounded-xl"
          >
            <img
              src={imageUrl}
              alt="Receipt"
              className="h-[120px] w-full object-cover"
            />
          </button>
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-xl bg-muted">
            <ReceiptIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {editMode ? (
          <>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
            </Field>
            <Field label="Store Name">
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="h-11" />
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <Input
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="h-11 uppercase"
              />
            </Field>
            <Field label="Total Amount">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note (optional)"
                className="min-h-[80px] w-full rounded-md border border-input bg-background p-3 text-base"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Date">
              <p className="text-base text-foreground">{formatLongDate(expense.date)}</p>
            </Field>
            <Field label="Store Name">
              <p className="text-xl font-bold text-foreground">{expense.store_name}</p>
            </Field>
            <Field label="Category">
              <span
                className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: getCategoryColor(expense.category) }}
              >
                {expense.category}
              </span>
            </Field>
            <Field label="Currency">
              <p className="text-base text-foreground">{expense.currency}</p>
            </Field>
            <Field label="Total Amount">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(expense.amount, expense.currency)}
              </p>
            </Field>
            {expense.notes && (
              <Field label="Notes">
                <p className="text-base text-foreground">{expense.notes}</p>
              </Field>
            )}
          </>
        )}

        {/* Line items */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Items on this receipt
          </h2>
          {editMode ? (
            <LineItemsEditor items={items} onChange={handleItemsChange} />
          ) : expense.items && expense.items.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card text-left text-muted-foreground">
                    <th className="p-2 font-medium">Item</th>
                    <th className="p-2 text-right font-medium">Qty</th>
                    <th className="p-2 text-right font-medium">Unit Price</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expense.items.map((it, idx) => (
                    <tr key={it.id} className={idx % 2 === 1 ? 'bg-background' : 'bg-card'}>
                      <td className="p-2 text-foreground">{it.description}</td>
                      <td className="p-2 text-right text-foreground">{it.quantity}</td>
                      <td className="p-2 text-right text-foreground">
                        {Number(it.unit_price).toFixed(2)}
                      </td>
                      <td className="p-2 text-right text-foreground">
                        {Number(it.total_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-card font-bold">
                    <td className="p-2 text-foreground" colSpan={3}>
                      Total
                    </td>
                    <td className="p-2 text-right text-foreground">
                      {displayTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No items on this receipt.</p>
          )}
        </div>

        {editMode && (
          <button
            type="button"
            onClick={cancelEdit}
            className="mx-auto text-sm text-muted-foreground"
          >
            Cancel
          </button>
        )}

        {!editMode && (
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="mt-2 h-12 w-full rounded-lg border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-2 h-5 w-5" />
            Delete Receipt
          </Button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && imageUrl && (
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          aria-label="Close image"
        >
          <img src={imageUrl} alt="Receipt" className="max-h-full max-w-full object-contain" />
        </button>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this receipt and all its data?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="mb-2 text-sm font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
