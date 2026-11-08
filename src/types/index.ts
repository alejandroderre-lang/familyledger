export type UserRole = 'admin' | 'user'

export type ReceiptStatus = 'processing' | 'parsed' | 'confirmed' | 'error'

export type ExpenseCategory =
  | 'Groceries'
  | 'Dining & Restaurants'
  | 'Gas & Petrol'
  | 'Transport & Travel'
  | 'Pharmacy & Health'
  | 'Clothing & Accessories'
  | 'Electronics'
  | 'Entertainment'
  | 'Utilities'
  | 'Other'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Groceries',
  'Dining & Restaurants',
  'Gas & Petrol',
  'Transport & Travel',
  'Pharmacy & Health',
  'Clothing & Accessories',
  'Electronics',
  'Entertainment',
  'Utilities',
  'Other',
]

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export interface Receipt {
  id: string
  user_id: string
  image_url: string
  status: ReceiptStatus
  raw_ai_response: string | null
  uploaded_at: string
}

export interface Expense {
  id: string
  receipt_id: string
  user_id: string
  date: string
  amount: number
  currency: string
  store_name: string
  category: ExpenseCategory
  notes: string | null
  created_at: string
  receipt?: Receipt
  items?: ExpenseItem[]
  profile?: Profile
}

export interface ExpenseItem {
  id: string
  expense_id: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface ParsedReceiptData {
  date: string | null
  amount: number | null
  currency: string | null
  store_name: string | null
  category: ExpenseCategory | null
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}
