-- Record what each parse actually cost.
--
-- The app is live and billing against an Anthropic account with no record of
-- per-receipt spend. The edge function already receives `usage` on every
-- response and was discarding it. Capturing it here means cost data
-- accumulates from real traffic rather than needing a separate measurement
-- exercise later, and makes questions like "is Sonnet good enough" or "should
-- we downscale images" answerable from evidence.
--
-- Token counts rather than a money column on purpose: prices change, and a
-- stored currency amount computed at insert time would quietly go stale.
-- Cost is derived at query time from the model and the counts.

alter table public.receipts
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists parse_ms integer;

comment on column public.receipts.model is
  'Model that produced the parse, e.g. claude-opus-5. Needed to price the token counts.';
comment on column public.receipts.input_tokens is
  'Input tokens including the receipt image, which dominates the count.';
comment on column public.receipts.parse_ms is
  'Wall-clock time of the model call, for latency tracking separate from cost.';
