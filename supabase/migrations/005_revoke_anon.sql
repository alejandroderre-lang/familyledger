-- Revoke table privileges from the anon role.
--
-- 003 granted `authenticated` and noted that anon was "deliberately left
-- without table access". That was true on a current local stack, where
-- Supabase ships stricter defaults — and false on the hosted project, which
-- applies `GRANT ALL ON ALL TABLES TO anon` from its default privileges
-- before any migration runs. Deploying surfaced the gap.
--
-- Row-level security was still doing the real work: an anonymous request
-- returns an empty set because no policy matches a null auth.uid(), and
-- writes fail the same WITH CHECK. So this is defence in depth rather than a
-- live hole. But a role that cannot reach these tables at all is a smaller
-- blast radius than one relying solely on every policy being correct, and
-- nothing in the app reads or writes these tables as anon — sign-in happens
-- through the auth endpoints, and every data path requires a session.

revoke all on public.profiles from anon;
revoke all on public.receipts from anon;
revoke all on public.expenses from anon;
revoke all on public.expense_items from anon;

-- Future tables in this schema should not quietly reacquire them either.
alter default privileges in schema public revoke all on tables from anon;
