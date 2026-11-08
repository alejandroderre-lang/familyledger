# FamilyLedger — Project Specification

## What this is
A mobile-first receipt tracking and expense dashboard app. A non-technical adult woman photographs receipts on her phone; AI extracts the structured data; it all lives in a clean dashboard. There are two roles: a standard user (the mother) and an admin (her son, Alejandro).

## Core tech stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v3
- **UI components**: shadcn/ui (use `npx shadcn@latest add` for all components)
- **Routing**: React Router v6
- **Data fetching**: TanStack Query v5 (@tanstack/react-query)
- **Charts**: Recharts
- **Backend**: Supabase (auth, Postgres database, storage, edge functions)
- **AI**: Anthropic claude-sonnet-4-6 via a Supabase Edge Function (NEVER call Anthropic API client-side)
- **Deployment**: Vercel (free tier)

## Repo structure to build
```
familyledger/
├── CLAUDE.md
├── .env.local                        # Never commit this
├── .env.example
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client singleton
│   │   └── utils.ts                  # cn() helper + formatters
│   ├── types/
│   │   └── index.ts                  # All shared TypeScript types
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useExpenses.ts
│   │   └── useReceipts.ts
│   ├── components/
│   │   ├── ui/                       # shadcn components live here
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   └── AppShell.tsx
│   │   ├── dashboard/
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── CategoryChart.tsx
│   │   │   └── RecentExpenses.tsx
│   │   ├── expenses/
│   │   │   ├── ExpenseRow.tsx
│   │   │   ├── ExpenseFilter.tsx
│   │   │   └── ExpenseDetail.tsx
│   │   ├── upload/
│   │   │   ├── UploadScreen.tsx
│   │   │   └── ReviewForm.tsx
│   │   └── admin/
│   │       └── AdminPanel.tsx
│   └── pages/
│       ├── Login.tsx
│       ├── Dashboard.tsx
│       ├── ExpensesList.tsx
│       ├── UploadReceipt.tsx
│       ├── ReviewReceipt.tsx
│       ├── ProfilePage.tsx
│       └── AdminPage.tsx
└── supabase/
    ├── config.toml
    ├── migrations/
    │   └── 001_initial_schema.sql
    └── functions/
        └── parse-receipt/
            └── index.ts
```

## Environment variables needed
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=        # Set in Supabase dashboard secrets only, NOT in .env
```

---

## Database schema

Create this as `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Receipts table (tracks upload + parsing lifecycle)
create table public.receipts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  image_url text not null,
  status text not null default 'processing' check (status in ('processing', 'parsed', 'confirmed', 'error')),
  raw_ai_response text,
  uploaded_at timestamptz default now()
);

-- Expenses table (one per receipt, after parsing)
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid references public.receipts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  amount numeric(10,2) not null,
  currency text not null default 'EUR',
  store_name text not null,
  category text not null check (category in (
    'Groceries',
    'Dining & Restaurants',
    'Gas & Petrol',
    'Transport & Travel',
    'Pharmacy & Health',
    'Clothing & Accessories',
    'Electronics',
    'Entertainment',
    'Utilities',
    'Other'
  )),
  notes text,
  created_at timestamptz default now()
);

-- Line items table (breakdown of items on the receipt)
create table public.expense_items (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.receipts enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Receipts policies
create policy "Users can manage own receipts"
  on public.receipts for all
  using (auth.uid() = user_id);

create policy "Admins can view all receipts"
  on public.receipts for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Expenses policies
create policy "Users can manage own expenses"
  on public.expenses for all
  using (auth.uid() = user_id);

create policy "Admins can view all expenses"
  on public.expenses for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Expense items policies
create policy "Users can manage own expense items"
  on public.expense_items for all
  using (exists (
    select 1 from public.expenses where id = expense_id and user_id = auth.uid()
  ));

create policy "Admins can view all expense items"
  on public.expense_items for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));
```

---

## Supabase Edge Function: parse-receipt

Create this file at `supabase/functions/parse-receipt/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0"

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { receipt_id, image_url } = await req.json()

    // Fetch image from Supabase Storage and convert to base64
    const { data: imageData, error: imageError } = await supabase
      .storage
      .from("receipts")
      .download(image_url)

    if (imageError) throw imageError

    const arrayBuffer = await imageData.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const mimeType = imageData.type || "image/jpeg"

    // Call Claude with vision
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `You are a receipt parsing assistant. Analyze this receipt image carefully and return ONLY a valid JSON object with no markdown, no backticks, no explanation — just raw JSON.

Use exactly this structure:
{
  "date": "YYYY-MM-DD",
  "amount": 0.00,
  "currency": "EUR",
  "store_name": "Store name as printed on receipt",
  "category": "Groceries",
  "items": [
    {
      "description": "Item name",
      "quantity": 1,
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ]
}

Rules:
- date: use the date printed on the receipt in YYYY-MM-DD format. If unclear, use today's date.
- amount: the final TOTAL amount paid (after tax, discounts). Numeric only, no currency symbols.
- currency: ISO 4217 code. Infer from symbols (€=EUR, $=USD, £=GBP) or country context. Default to EUR.
- store_name: exact name as printed, title case.
- category: must be exactly one of: Groceries, Dining & Restaurants, Gas & Petrol, Transport & Travel, Pharmacy & Health, Clothing & Accessories, Electronics, Entertainment, Utilities, Other. Infer from the store name and items.
- items: every line item visible on the receipt. If items are not legible, return an empty array [].
- If any field is genuinely unreadable, use null for that field.`,
            },
          ],
        },
      ],
    })

    const rawResponse = message.content[0].type === "text" ? message.content[0].text : ""

    // Parse AI response
    let parsed
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      await supabase
        .from("receipts")
        .update({ status: "error", raw_ai_response: rawResponse })
        .eq("id", receipt_id)

      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: rawResponse }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get user_id from receipt
    const { data: receipt } = await supabase
      .from("receipts")
      .select("user_id")
      .eq("id", receipt_id)
      .single()

    // Insert expense row
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        receipt_id,
        user_id: receipt.user_id,
        date: parsed.date || new Date().toISOString().split("T")[0],
        amount: parsed.amount || 0,
        currency: parsed.currency || "EUR",
        store_name: parsed.store_name || "Unknown Store",
        category: parsed.category || "Other",
      })
      .select()
      .single()

    if (expenseError) throw expenseError

    // Insert line items
    if (parsed.items && parsed.items.length > 0) {
      const items = parsed.items.map((item: any) => ({
        expense_id: expense.id,
        description: item.description || "Unknown item",
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
      }))
      await supabase.from("expense_items").insert(items)
    }

    // Update receipt status
    await supabase
      .from("receipts")
      .update({ status: "parsed", raw_ai_response: rawResponse })
      .eq("id", receipt_id)

    return new Response(
      JSON.stringify({ success: true, expense_id: expense.id, parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
```

---

## TypeScript types — src/types/index.ts

```typescript
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
```

---

## Design system tokens

Apply these consistently across ALL components. Never hardcode colors — always use these values.

```
COLORS
  Primary:      #1B2A4A   (deep navy — headers, primary buttons, active nav)
  Accent:       #22C55E   (green — FAB, success states, positive numbers)
  Destructive:  #EF4444   (red — delete buttons, error states)
  Warning:      #F59E0B   (amber — processing status)
  Background:   #F8FAFC   (off-white — app background)
  Card:         #FFFFFF   (pure white — card surfaces)
  Border:       #E2E8F0   (light gray — dividers, input borders)
  Text:         #0F172A   (near-black — primary text)
  Muted:        #64748B   (gray — labels, secondary text, placeholders)

TYPOGRAPHY
  Font family: Inter (import from Google Fonts in index.html)
  Minimum body size: 16px (non-technical older adult user — never go below this)
  Heading sizes: 28px (page titles), 20px (section titles), 16px (card titles)
  Font weights: 700 for headings, 600 for labels, 400 for body

SPACING
  Card padding: 16px
  Section gap: 24px
  Border radius: 12px (cards), 8px (inputs/buttons), 24px (category pills)
  Page horizontal padding: 16px

TAP TARGETS
  Minimum 48x48px for ALL interactive elements (strict mobile accessibility)
  FAB: 56x56px circle, fixed bottom-right, 80px from bottom, 16px from right edge

SHADOWS
  Card shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)

MOBILE LAYOUT
  Max content width: 430px, centered horizontally
  On desktop: show #F8FAFC background outside the 430px column
  Bottom nav height: 64px
  Bottom nav: add padding-bottom: env(safe-area-inset-bottom) for iOS notch

CATEGORY COLOR PILLS (background color, white text)
  Groceries:              #16A34A
  Dining & Restaurants:   #EA580C
  Gas & Petrol:           #7C3AED
  Transport & Travel:     #0284C7
  Pharmacy & Health:      #DC2626
  Clothing & Accessories: #DB2777
  Electronics:            #0891B2
  Entertainment:          #D97706
  Utilities:              #4B5563
  Other:                  #6B7280

STATUS PILL COLORS
  confirmed:  green (#16A34A background)
  processing: amber (#D97706 background)
  parsed:     blue (#0284C7 background)
  error:      red (#DC2626 background)
```

---

## Screen-by-screen spec

### LOGIN PAGE — /login
- Vertically and horizontally centered card on full viewport
- App logo: Lucide `Receipt` icon, 40px, Primary color (#1B2A4A)
- App name: "FamilyLedger" — 28px, font-weight 700, Primary color
- Subtitle: "Family expense tracking" — 14px, Muted color
- Email input: full width, placeholder "Email address"
- Password input: full width, placeholder "Password", show/hide toggle button (Lucide Eye/EyeOff icon)
- "Sign in" button: full width, 48px height, Primary background, white text, 8px border-radius
- Error state: red border on both inputs + red error message text below password field
- No sign-up link (accounts are pre-created in Supabase dashboard by admin)
- On successful login: redirect to /
- Session persists — user must NOT be asked to re-login on page refresh (use Supabase onAuthStateChange)

---

### DASHBOARD — /
AppShell wrapper with BottomNav visible.

**SUMMARY CARDS** — horizontal scrollable row, 16px padding, 12px gap between cards:
- 3 cards: "This Month", "Last Month", "This Year"
- Each card: 160px wide, white background, 12px border-radius, card shadow
- Inside each card: period label (12px, Muted, top), large amount (24px, bold, Primary, middle), currency code (12px, Muted, next to amount)
- Data: sum of expenses.amount WHERE user_id = current user, filtered by date range
- Show 0.00 if no expenses exist yet — never show loading skeleton for more than 2 seconds

**CATEGORY CHART** — full width card, 24px margin-top:
- Card title: "Spending by category" (16px, semibold, left)
- Subtitle: current month name + year, e.g. "June 2025" (14px, Muted, left)
- Recharts PieChart, donut style: innerRadius={60} outerRadius={90}, centered
- Colors: use the category color map defined above
- Legend below chart: each category as a flex row — colored dot (10px circle) + category name + amount right-aligned
- Only show categories that have at least 1 expense this month
- Empty state: "No expenses this month yet" with a small chart icon

**RECENT EXPENSES** — full width, 24px margin-top:
- Row header: "Recent" (16px, semibold, left) + "See all →" link (14px, Primary, right) → navigates to /expenses
- Last 10 expenses for current user, ordered by date DESC
- Each row: ExpenseRow component (see below)
- Tapping any row navigates to /expenses/:id
- Empty state: 🧾 emoji centered, "No receipts yet!", subtext "Tap + to add your first one"

**FLOATING ACTION BUTTON (FAB)**:
- Fixed position: bottom 80px, right 16px
- 56px circle, Accent (#22C55E) background, white Lucide `Plus` icon (24px)
- Box shadow: 0 4px 12px rgba(34,197,94,0.4)
- On tap: navigate to /upload

---

### UPLOAD RECEIPT — /upload
Full screen, NO BottomNav. Back arrow (Lucide `ArrowLeft`, 24px) top-left → navigates to /.

**Header**: "Add Receipt" — centered, 20px, bold

**Upload options** — two large tappable cards, stacked vertically, 16px gap:
- Card 1: Camera icon (Lucide `Camera`, 32px, Primary) + "Take a Photo" (18px, bold) + "Use your camera" (14px, Muted)
  - Hidden input: `<input type="file" accept="image/*" capture="environment" />`
- Card 2: Image icon (Lucide `Image`, 32px, Primary) + "Upload from Gallery" (18px, bold) + "Choose an existing photo" (14px, Muted)
  - Hidden input: `<input type="file" accept="image/jpeg,image/png,image/heic,image/webp" />`
- Each card: full width, 96px height, white background, 12px border-radius, border: 1.5px solid #E2E8F0
- Cards trigger click on their hidden inputs via useRef

**AFTER FILE SELECTED — processing flow**:
1. Compress image client-side using `browser-image-compression`: maxSizeMB: 1, maxWidthOrHeight: 1920
2. If HEIC format detected (file.type === 'image/heic'), convert to JPEG using `heic2any` before compressing
3. Show image preview: full width, max-height 280px, object-fit: contain, 12px border-radius, gray background
4. Show loading card below preview:
   - Spinner (animated, Accent color)
   - "Analysing your receipt..." (16px, bold)
   - "Our AI is reading the details" (14px, Muted)
   - This can take up to 10 seconds — show a subtle progress indicator
5. Upload compressed image to Supabase Storage bucket `receipts` at path: `{user_id}/{uuid}.{ext}`
6. Insert row into receipts table: { user_id, image_url: storagePath, status: 'processing' }
7. Call Supabase Edge Function `parse-receipt` with { receipt_id, image_url: storagePath }
8. On success: navigate to /review/:receipt_id, passing parsed data via React Router state
9. On error: show error card:
   - Red X icon
   - "Couldn't read this receipt" (16px, bold)
   - "The image may be blurry or too dark. You can enter the details manually." (14px, Muted)
   - Two buttons: "Try again" (retriggers upload) and "Enter manually" (navigates to /review/:receipt_id with empty data)

**OFFLINE CHECK**: Before attempting upload, check `navigator.onLine`. If false, show toast: "No internet connection. Please try again when you're online."

---

### REVIEW & CONFIRM — /review/:receipt_id
Full screen, NO BottomNav. Back arrow top-left → /upload.

**Header**: "Review Receipt" — centered, 20px, bold

**RECEIPT IMAGE** — collapsible section:
- Default state: collapsed. Shows small thumbnail (60x60px) + "View receipt image" text link → expands
- Expanded: full width image, max-height 300px, object-fit: contain, gray background, 12px border-radius
- "Hide image" link below when expanded

**EDITABLE FORM** — all fields pre-populated from AI parsing (or empty if manual entry):

Each field is a card row with label above and input below:

- **Date**: `<input type="date" />` — styled to match design system
- **Store Name**: text input, placeholder "e.g. Mercadona"
- **Category**: native `<select>` with all 10 categories as options (native select = best UX on mobile)
- **Currency**: text input, maxLength=3, forced uppercase, placeholder "EUR"
- **Total Amount**: number input, step="0.01", min="0", placeholder "0.00"

**LINE ITEMS SECTION** — "Items on this receipt" (16px, semibold):
- Each item row (flex, gap 8px):
  - Description input (flex-grow, placeholder "Item name")
  - Qty input (64px wide, type="number", min="0.01", step="0.01")
  - Unit price input (80px wide, type="number", step="0.01")
  - Total (80px wide, gray background, read-only, bold — auto-calculated as qty × unit_price)
  - Trash icon button (Lucide `Trash2`, 20px, red, 44x44px tap target) to delete row
- When qty or unit_price changes: recalculate total_price for that row AND update the Total Amount field to be the sum of all item totals
- "Add item" button: full width, outlined style, Lucide `Plus` icon + "Add item" text
- If no items: show soft message "No items detected — add them manually if needed" in Muted color

**CONFIRM BUTTON**: full width, 48px, Primary background, white text, "Confirm & Save"
- On click:
  1. Validate: date and store_name must not be empty, amount must be > 0
  2. Update expenses row with all edited values
  3. Delete all existing expense_items for this expense_id, then insert new ones
  4. Update receipts.status to 'confirmed'
  5. Show success toast: "Receipt saved! 🎉" (green, bottom of screen, 3 seconds)
  6. Navigate to /

**DISCARD LINK**: small centered text link below button, gray color, "Discard receipt"
- On click: show confirmation dialog — "Delete this receipt? This cannot be undone."
- On confirm: delete from expense_items, expenses, receipts tables; navigate to /upload

---

### EXPENSES LIST — /expenses
AppShell with BottomNav.

**FILTER BAR** — sticky below header, white background, border-bottom, 16px padding, 12px gap:
- **Search**: text input with Lucide `Search` icon left, placeholder "Search by store...", filters store_name (case-insensitive, client-side)
- **Date range**: two compact date inputs ("From" and "To"), side by side
- **Category**: custom dropdown showing "All categories" by default; opens a bottom sheet on mobile with checkboxes for all 10 categories; shows count of selected as pill when active
- **"Clear filters"** text link (Primary color, 14px) — only visible when any filter is active

**EXPENSES LIST** — full width, no card wrapper, divider lines between rows:
- All expenses for current user matching filters, ordered by date DESC
- ExpenseRow component for each row (same as Dashboard)
- Tap row → /expenses/:id
- **Empty state** (no results): centered, 🔍 emoji, "No expenses found", "Try adjusting your filters"
- **Empty state** (no expenses at all): centered, 🧾 emoji, "No receipts yet!", "Tap + to add your first one", link to /upload

---

### EXPENSE DETAIL — /expenses/:id
Full screen, NO BottomNav. Back arrow top-left → /expenses. "Edit" button top-right (Lucide `Pencil` icon + "Edit" text, Primary color).

**RECEIPT IMAGE** — thumbnail at top (full width, 120px height, object-fit: cover, tappable):
- Tap → opens full-screen lightbox: black overlay, image centered and scaled to fit, tap overlay to close
- If no image available: show gray placeholder with receipt icon

**EXPENSE FIELDS** — displayed as labeled card rows:
- Date (formatted as "15 June 2025")
- Store Name (bold, larger)
- Category (colored pill)
- Currency
- Total Amount (large, 24px, bold, Primary color)
- Notes (if present; editable textarea in edit mode)

**EDIT MODE** — triggered by "Edit" button:
- All fields become editable inputs (same styles as Review form)
- "Edit" button becomes "Save" (Primary filled button, top-right)
- "Cancel" text link appears below Save
- On Save: validate, update expenses + expense_items rows, show success toast, return to view mode

**LINE ITEMS TABLE**:
- Column headers: Item | Qty | Unit Price | Total
- Each data row: alternating background (#F8FAFC on even rows)
- Bold "Total" row at bottom with sum of all item totals
- In edit mode: rows become editable (same as Review form), with add/delete row functionality

**DELETE BUTTON** — at bottom of page:
- Full width, 48px, red outlined style, Lucide `Trash2` icon + "Delete Receipt"
- On click: confirmation dialog — "Delete this receipt and all its data? This cannot be undone."
- On confirm: delete expense_items, expenses, receipts rows; navigate to /expenses

---

### ADMIN PANEL — /admin (only visible to role = 'admin')
AppShell with BottomNav (shield icon tab only rendered if profile.role === 'admin').

**HEADER**: "Admin" with Lucide `Shield` icon (24px, Primary)

**USER TOGGLE** — segmented control, full width:
- "My expenses" | "All users"
- Default: "My expenses"
- When "All users" selected: fetch all expenses joined with profiles, show all users' data

**SUMMARY STATS** — 3 stat cards (same style as Dashboard summary cards):
- "Total Receipts" — count of all receipts (or current user's if "My expenses" selected)
- "All-time Spend" — sum of all expenses.amount (formatted with currency)
- "Top Category" — category name with highest total spend (show its colored pill)

**EXPENSES TABLE** — same list as /expenses:
- When "All users" mode: each ExpenseRow gets an extra user badge showing profile.full_name
- User badge style: small pill, gray background, 12px text, shown below store name
- All other filtering (search, date, category) still works in admin view

---

### PROFILE PAGE — /profile
AppShell with BottomNav.

- User avatar: large circle (72px), Primary background, white initials (first letter of full_name)
- Full name (20px, bold, centered)
- Email (14px, Muted, centered)
- Role badge: "Admin" (Primary) or "Member" (gray) pill, centered
- Divider
- "Sign out" button: full width, 48px, red outlined style, Lucide `LogOut` icon
  - On click: call supabase.auth.signOut(), navigate to /login
- App version: small centered text at bottom "FamilyLedger v1.0" in Muted color

---

## Reusable components

### ExpenseRow component
Used in Dashboard recent list, Expenses list, and Admin panel.

```
Layout: flex row, 64px min-height, 16px horizontal padding, 12px vertical padding
Left side (flex-grow):
  - Store name: 16px, font-weight 600, text-color Text (#0F172A)
  - Date: 13px, Muted color, below store name (formatted as "15 Jun")
Right side:
  - Amount: 16px, bold, Primary color, right-aligned
  - Category pill: 12px, white text, colored background, 4px border-radius, right-aligned below amount
Divider: 1px border-bottom (#E2E8F0) except on last item
Tap: entire row is tappable (min 64px height satisfies 48px tap target rule)
```

### AppShell component
Wraps all authenticated pages.

```
- Full height flex column
- Top: page-specific header (each page renders its own)
- Middle: scrollable content area (flex-grow, overflow-y: auto)
- Bottom: fixed BottomNav (64px + safe area inset)
- Content area has padding-bottom: 80px to avoid content hiding behind BottomNav
```

### BottomNav component
```
Fixed bottom, full width, white background, border-top (#E2E8F0), 64px height + safe area inset.
4 tabs (or 3 if not admin):
  - 🏠 Home icon (Lucide `Home`) + "Home" label → /
  - 📋 List icon (Lucide `List`) + "Expenses" label → /expenses
  - 🛡️ Shield icon (Lucide `Shield`) + "Admin" label → /admin (ONLY rendered if role === 'admin')
  - 👤 User icon (Lucide `User`) + "Profile" label → /profile
Active tab: Primary color icon + label. Inactive: Muted color.
Each tab: minimum 48px wide, flex column, centered icon + label (11px)
```

---

## Auth and routing

```typescript
// Auth context (src/hooks/useAuth.ts):
// - Call supabase.auth.getSession() on mount to restore session
// - Subscribe to supabase.auth.onAuthStateChange for real-time state updates
// - Fetch profile from profiles table after auth to get role
// - Expose: user, profile, loading, signIn(email, password), signOut()

// Protected route wrapper:
// - If loading: show full-screen spinner (Primary color)
// - If not authenticated: <Navigate to="/login" replace />
// - If authenticated: render children

// Admin route wrapper (extends protected):
// - If profile.role !== 'admin': <Navigate to="/" replace />
// - Otherwise: render children

// Route map (src/App.tsx):
// /login          → <Login />                              (public)
// /               → <ProtectedRoute><Dashboard /></ProtectedRoute>
// /upload         → <ProtectedRoute><UploadReceipt /></ProtectedRoute>
// /review/:id     → <ProtectedRoute><ReviewReceipt /></ProtectedRoute>
// /expenses       → <ProtectedRoute><ExpensesList /></ProtectedRoute>
// /expenses/:id   → <ProtectedRoute><ExpenseDetail /></ProtectedRoute>
// /admin          → <AdminRoute><AdminPage /></AdminRoute>
// /profile        → <ProtectedRoute><ProfilePage /></ProtectedRoute>
// *               → <Navigate to="/" replace />
```

---

## Implementation notes

1. **Image compression**: use `browser-image-compression` before upload. Config: `{ maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }`. Always compress before checking HEIC.

2. **HEIC handling**: detect with `file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')`. Convert with `heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })` before compressing.

3. **Edge function latency**: cold starts take 2-4 seconds. Always show a loading state for at least 3 seconds minimum on the upload screen so UX doesn't feel broken.

4. **TanStack Query keys**: use consistent query keys across the app:
   - `['expenses', userId]` for the full list
   - `['expenses', userId, 'recent']` for dashboard recent
   - `['expense', expenseId]` for single expense detail
   - `['profile', userId]` for profile
   - Always call `queryClient.invalidateQueries({ queryKey: ['expenses', userId] })` after any mutation

5. **Supabase Storage bucket setup**:
   - Bucket name: `receipts`
   - Public access: false (private)
   - File size limit: 10MB
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/heic

6. **iOS Safari camera**: `capture="environment"` works on iOS but the input MUST be triggered by a real user gesture (onClick). Never trigger it programmatically on page load.

7. **Bottom nav safe area**: always include `paddingBottom: 'env(safe-area-inset-bottom)'` on the BottomNav container to handle iPhone home indicator.

8. **Toast notifications**: use a lightweight toast library (e.g. `react-hot-toast` or `sonner`). Position: bottom-center. Duration: 3000ms. Success: green. Error: red.

9. **Error boundaries**: wrap each page in a React error boundary that shows a friendly error card with a "Reload" button instead of a white screen.

10. **Date formatting**: always display dates in human-readable format ("15 Jun 2025") but store and query using ISO format (YYYY-MM-DD).

---

## Build order — follow this exactly, do not skip steps

1. Scaffold project with `npm create vite@latest . -- --template react-ts`
2. Install dependencies: `npm install react-router-dom @supabase/supabase-js @tanstack/react-query recharts lucide-react browser-image-compression heic2any clsx tailwind-merge react-hot-toast`
3. Install dev dependencies: `npm install -D tailwindcss postcss autoprefixer @types/node`
4. Run `npx tailwindcss init -p` and configure tailwind.config.ts
5. Add Inter font to index.html via Google Fonts link tag
6. Initialise shadcn/ui: `npx shadcn@latest init` (default style, slate base color, CSS variables yes)
7. Add shadcn components: `npx shadcn@latest add button input label select dialog sheet toast card badge separator`
8. Create `.env.example` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
9. Create `src/lib/supabase.ts` — Supabase client singleton
10. Create `src/lib/utils.ts` — cn() helper, formatCurrency(), formatDate(), getCategoryColor()
11. Create `src/types/index.ts` — all TypeScript types and constants
12. Write `supabase/migrations/001_initial_schema.sql` — full schema from spec
13. Create `supabase/functions/parse-receipt/index.ts` — full edge function from spec
14. Create `src/hooks/useAuth.ts` — auth context with session persistence
15. Create `src/components/layout/AppShell.tsx` and `BottomNav.tsx`
16. Create protected route wrappers in `src/App.tsx`
17. Build `src/pages/Login.tsx`
18. Build `src/components/expenses/ExpenseRow.tsx` (shared component, needed by Dashboard and List)
19. Build `src/pages/Dashboard.tsx` — SummaryCards, CategoryChart, RecentExpenses, FAB
20. Build `src/pages/UploadReceipt.tsx` — camera/gallery inputs, compression, edge function call
21. Build `src/pages/ReviewReceipt.tsx` — editable form, line items, confirm/discard
22. Build `src/pages/ExpensesList.tsx` — filter bar, full list
23. Build `src/pages/ExpenseDetail.tsx` — detail view, edit mode, lightbox, delete
24. Build `src/pages/AdminPage.tsx` — user toggle, summary stats, cross-user list
25. Build `src/pages/ProfilePage.tsx` — name, email, role, sign out
26. Final pass: empty states on all list views, error states on all async operations, loading skeletons, mobile safe area insets, test on 375px viewport width
