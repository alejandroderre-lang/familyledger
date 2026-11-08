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

-- Admin check helper. SECURITY DEFINER runs with the owner's privileges so the
-- inner query bypasses RLS — this avoids infinite recursion when used inside a
-- policy on the profiles table itself.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Receipts policies
create policy "Users can manage own receipts"
  on public.receipts for all
  using (auth.uid() = user_id);

create policy "Admins can view all receipts"
  on public.receipts for select
  using (public.is_admin());

-- Expenses policies
create policy "Users can manage own expenses"
  on public.expenses for all
  using (auth.uid() = user_id);

create policy "Admins can view all expenses"
  on public.expenses for select
  using (public.is_admin());

-- Expense items policies
create policy "Users can manage own expense items"
  on public.expense_items for all
  using (exists (
    select 1 from public.expenses where id = expense_id and user_id = auth.uid()
  ));

create policy "Admins can view all expense items"
  on public.expense_items for select
  using (public.is_admin());
