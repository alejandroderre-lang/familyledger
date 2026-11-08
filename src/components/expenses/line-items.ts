export interface EditableItem {
  key: string
  id?: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

/** Build an editable item, auto-computing total_price from qty × unit_price. */
export function makeItem(partial?: Partial<EditableItem>): EditableItem {
  const quantity = partial?.quantity ?? 1
  const unit_price = partial?.unit_price ?? 0
  return {
    key: crypto.randomUUID(),
    id: partial?.id,
    description: partial?.description ?? '',
    quantity,
    unit_price,
    total_price: partial?.total_price ?? round2(quantity * unit_price),
  }
}

export function lineTotal(quantity: number, unitPrice: number): number {
  return round2(Number(quantity) * Number(unitPrice))
}

export function itemsTotal(items: EditableItem[]): number {
  return round2(items.reduce((sum, it) => sum + Number(it.total_price), 0))
}
