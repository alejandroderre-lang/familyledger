-- Record why a parse failed, and make failures findable.
--
-- The function had six failure paths and only two wrote anything back to the
-- receipt. The rest returned an error to the browser and left the row sitting
-- at status 'processing' forever — worse than a silent failure, because the
-- row looks like work still in progress rather than something that died.
--
-- With this, every failure writes status 'error' plus a machine-readable
-- reason, so "parsing broke an hour ago" is a query rather than a guess.

alter table public.receipts
  add column if not exists error_code text;

comment on column public.receipts.error_code is
  'Why the parse failed: missing_api_key, unsupported_media_type, max_tokens, refusal, unparseable_response, storage_download_failed, or unexpected_error. Null on success.';

-- A receipt that has sat in 'processing' for more than a few minutes means the
-- function died without recording anything — a crash, a timeout, or a deploy
-- mid-request. Those are invisible to error_code by definition, so surface
-- them by age instead.
create or replace view public.parse_health as
select
  status,
  error_code,
  count(*)                                   as receipts,
  min(uploaded_at)                           as first_seen,
  max(uploaded_at)                           as last_seen,
  count(*) filter (
    where status = 'processing'
      and uploaded_at < now() - interval '5 minutes'
  )                                          as stuck
from public.receipts
group by status, error_code;

comment on view public.parse_health is
  'Parse outcomes grouped by status and reason. `stuck` counts rows left in processing long enough that the function must have died without reporting.';

-- The view aggregates across every user, so it is for operators only. It is
-- not exposed to anon or authenticated; reach it with the service role.
revoke all on public.parse_health from anon, authenticated;
