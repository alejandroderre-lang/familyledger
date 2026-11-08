-- Table privileges for the PostgREST roles.
--
-- RLS policies only filter which rows a role may touch; they grant nothing on
-- their own. Without these GRANTs every API request fails with
-- "permission denied for table ..." before any policy is evaluated.
--
-- The original hosted project ran on older Supabase defaults that granted these
-- implicitly to anon/authenticated, so it was never captured in a migration.
-- Current Supabase does not, so a rebuilt backend had tables no one could read.

grant usage on schema public to anon, authenticated;

-- Authenticated users reach their own rows through the RLS policies in 001.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.receipts to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_items to authenticated;

-- anon is deliberately left without table access: the only unauthenticated
-- surface in this app is the login form, which goes through the auth schema.
