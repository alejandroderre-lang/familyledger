import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
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
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type ParsedReceiptData } from '@/types'

interface ReviewData {
  receipt: { id: string; image_url: string; status: string } | null
  expense: (Expense & { items?: EditableItem[] }) | null
}

export default function ReviewReceipt() {
  const { id: receiptId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const parsedFromState =
    (location.state as { parsed?: ParsedReceiptData | null } | null)?.parsed ??
    null

  const { data, isLoading } = useQuery({
    queryKey: ['receipt-review', receiptId],
    enabled: Boolean(receiptId),
    queryFn: async (): Promise<ReviewData> => {
      const { data: receipt } = await supabase
        .from('receipts')
        .select('id, image_url, status')
        .eq('id', receiptId as string)
        .single()
      const { data: expense } = await supabase
        .from('expenses')
        .select('*, items:expense_items(*)')
        .eq('receipt_id', receiptId as string)
        .maybeSingle()
      return { receipt, expense: expense as ReviewData['expense'] }
    },
  })

  // Form state
  const [date, setDate] = useState('')
  const [storeName, setStoreName] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Other')
  const [currency, setCurrency] = useState('EUR')
  const [amount, setAmount] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])
  const [initialised, setInitialised] = useState(false)

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [showImage, setShowImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  // Initialise the form once data is available: prefer an existing expense
  // (created by the parser), otherwise the parsed router state. Seeding form
  // state from async data is the intended use of this effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialised || isLoading) return
    const today = new Date().toISOString().split('T')[0]
    const expense = data?.expense
    if (expense) {
      setDate(expense.date ?? today)
      setStoreName(expense.store_name ?? '')
      setCategory(expense.category ?? 'Other')
      setCurrency(expense.currency ?? 'EUR')
      setAmount(String(expense.amount ?? ''))
      setItems((expense.items ?? []).map((it) => makeItem(it)))
    } else if (parsedFromState) {
      setDate(parsedFromState.date ?? today)
      setStoreName(parsedFromState.store_name ?? '')
      setCategory((parsedFromState.category as ExpenseCategory) ?? 'Other')
      setCurrency(parsedFromState.currency ?? 'EUR')
      setAmount(
        parsedFromState.amount != null ? String(parsedFromState.amount) : '',
      )
      setItems((parsedFromState.items ?? []).map((it) => makeItem(it)))
    } else {
      setDate(today)
    }
    setInitialised(true)
  }, [data, isLoading, initialised, parsedFromState])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fetch a signed URL for the (private) receipt image.
  useEffect(() => {
    const path = data?.receipt?.image_url
    if (!path) return
    supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600)
      .then(({ data: signed }) => setImageUrl(signed?.signedUrl ?? null))
  }, [data?.receipt?.image_url])

  // Keep the total in sync with line items whenever items exist.
  function handleItemsChange(next: EditableItem[]) {
    setItems(next)
    if (next.length > 0) setAmount(itemsTotal(next).toFixed(2))
  }

  async function handleConfirm() {
    const amountNum = parseFloat(amount)
    if (!date || !storeName.trim()) {
      toast.error('Please fill in the date and store name.')
      return
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Please enter a total amount greater than 0.')
      return
    }
    if (!user || !receiptId) return

    setSaving(true)
    try {
      const payload = {
        receipt_id: receiptId,
        user_id: user.id,
        date,
        amount: amountNum,
        currency: currency.toUpperCase() || 'EUR',
        store_name: storeName.trim(),
        category,
      }

      // Update existing expense, or insert one (manual entry).
      let expenseId = data?.expense?.id
      if (expenseId) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expenseId)
        if (error) throw error
      } else {
        const { data: inserted, error } = await supabase
          .from('expenses')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        expenseId = inserted.id
      }

      // Replace line items.
      await supabase.from('expense_items').delete().eq('expense_id', expenseId)
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('expense_items').insert(
          items.map((it) => ({
            expense_id: expenseId,
            description: it.description || 'Item',
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_price: it.total_price,
          })),
        )
        if (itemsError) throw itemsError
      }

      await supabase
        .from('receipts')
        .update({ status: 'confirmed' })
        .eq('id', receiptId)

      queryClient.invalidateQueries({ queryKey: ['expenses', user.id] })
      toast.success('Receipt saved! 🎉')
      navigate('/')
    } catch {
      toast.error('Could not save the receipt. Please try again.')
      setSaving(false)
    }
  }

  async function handleDiscard() {
    if (!receiptId) return
    try {
      const expenseId = data?.expense?.id
      if (expenseId) {
        await supabase.from('expense_items').delete().eq('expense_id', expenseId)
        await supabase.from('expenses').delete().eq('id', expenseId)
      }
      await supabase.from('receipts').delete().eq('id', receiptId)
      if (user) queryClient.invalidateQueries({ queryKey: ['expenses', user.id] })
      navigate('/upload')
    } catch {
      toast.error('Could not discard the receipt.')
    }
  }

  return (
    <div
      className="mx-auto flex min-h-[100svh] w-full max-w-app flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="relative flex items-center justify-center px-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/upload')}
          aria-label="Back"
          className="absolute left-2 flex h-12 w-12 items-center justify-center text-foreground"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Review Receipt</h1>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-4 pb-8">
          {/* Collapsible receipt image */}
          {imageUrl && (
            <div>
              {!showImage ? (
                <button
                  type="button"
                  onClick={() => setShowImage(true)}
                  className="flex items-center gap-3"
                >
                  <img
                    src={imageUrl}
                    alt="Receipt thumbnail"
                    className="h-[60px] w-[60px] rounded-lg object-cover"
                  />
                  <span className="text-sm font-medium text-primary">
                    View receipt image
                  </span>
                </button>
              ) : (
                <div>
                  <div className="overflow-hidden rounded-xl bg-muted">
                    <img
                      src={imageUrl}
                      alt="Receipt"
                      className="mx-auto max-h-[300px] w-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowImage(false)}
                    className="mt-2 text-sm font-medium text-primary"
                  >
                    Hide image
                  </button>
                </div>
              )}
            </div>
          )}

          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
          </Field>

          <Field label="Store Name">
            <Input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Mercadona"
              className="h-11"
            />
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
              placeholder="EUR"
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
              placeholder="0.00"
              className="h-11"
            />
          </Field>

          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Items on this receipt
            </h2>
            <LineItemsEditor items={items} onChange={handleItemsChange} />
          </div>

          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="mt-2 h-12 w-full rounded-lg text-base font-semibold"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm & Save'}
          </Button>

          <button
            type="button"
            onClick={() => setDiscardOpen(true)}
            className="mx-auto text-sm text-muted-foreground"
          >
            Discard receipt
          </button>
        </div>
      )}

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this receipt?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
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
      <label className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
