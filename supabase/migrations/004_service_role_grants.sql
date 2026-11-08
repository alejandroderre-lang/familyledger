-- Table privileges for the service_role.
--
-- 003 granted the authenticated role but not service_role. service_role
-- bypasses RLS, but RLS bypass is not a table privilege — without these GRANTs
-- it still fails with "permission denied for table ...".
--
-- This affects the parse-receipt edge function, which connects with the
-- service role key to insert the parsed expense and its line items. It would
-- have failed on the first successful parse.

grant usage on schema public to service_role;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.receipts to service_role;
grant select, insert, update, delete on public.expenses to service_role;
grant select, insert, update, delete on public.expense_items to service_role;
