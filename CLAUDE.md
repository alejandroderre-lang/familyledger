# Working in this repo

Mobile-first receipt tracker. A non-technical user photographs a receipt, Claude reads it, the expense lands in a dashboard. Two roles: a standard user and an admin.

Deployed at https://familyledger-two.vercel.app — pushes to `main` auto-deploy.

For what the system does and how it fits together, read [`README.md`](README.md); it carries architecture diagrams generated from the source. The original build brief is at [`docs/original-spec.md`](docs/original-spec.md) and is **historical** — it describes components that no longer exist.

---

## Running it

```bash
supabase start                                   # local stack, applies migrations
supabase functions serve --env-file supabase/.env  # REQUIRED for OCR locally
npm run dev
npm run test:seed && npm run test:seed:data      # test accounts + sample expenses
```

**`supabase start` does not read `supabase/.env`.** Function secrets load only through `functions serve --env-file`. Without that second command the parse silently fails with `missing_api_key`, and the app reports it as a backend fault.

## Testing — two suites, different jobs

| | What it proves |
|---|---|
| `npm run test:e2e` | App behaviour **given** a parse. The model is mocked: deterministic, free, no API key. |
| `npm run test:evals` | OCR quality. Calls the **real** function and model, scores field by field, and reports cost. |

A green E2E run says nothing about recognition, and a green eval run says nothing about the UI. Both run on Chromium and WebKit.

`npm run explore` sweeps for console errors, undersized tap targets and layout overflow. Treat its output as leads, not findings — it has produced false positives (a "near-blank screen" that was a correct not-found state).

### The eval fixtures are synthetic

`tests/fixtures/images/` are HTML renders: flat, evenly lit, perfectly square. **100% there means no regressions on clean input — not that the OCR handles real photographs.** Glare, curl, shadow, motion blur and perspective skew are all untested. Never describe eval results as real-world accuracy.

`tests/fixtures/device/` (generated via `npm run fixtures:device`) does cover genuine HEIC and 12MP photos.

## Conventions

**Design — "Ledger".** Near-monochrome, hairline rules instead of shadows, flat surfaces, tabular figures, small uppercase micro-labels. Colour carries meaning only: category ticks and status. Category bars are greyscale, encoding rank by darkness. Radius comes from `--radius`; separators from `--rule`. There is no card elevation — don't reintroduce `shadow-*` on surfaces.

**Tap targets are 48px minimum.** The user is an older adult on a phone; this is a requirement, not a preference. `npm run explore` checks it.

**Migrations are the source of truth.** Everything the hosted project needs must be a migration. Migrations 002–006 exist precisely because storage buckets, RLS policies and table grants were once dashboard-only state, and a rebuilt backend was missing all of it. Never fix hosted config by clicking in the dashboard.

**Parse quality changes require an eval run.** Touching the prompt, model, schema or image handling means `npm run test:evals` before and after. Prompt ambiguity has twice produced results that flapped between runs — a single pass is not evidence.

## Gotchas that have cost time

- **Editing `tailwind.config.ts` does not regenerate utilities in a running dev server.** A class appears in the DOM with no rule behind it, which reads exactly like a broken token. Restart Vite.
- **`.single()` returns HTTP 406 for zero rows**, and a malformed UUID gives 400. Both are handled in the UI but log console errors on an ordinary path.
- **`supabase db query "..." --linked`** runs SQL against the hosted project without needing the database password.
- **Eval runs share the test account with Playwright.** They clean up after themselves; if that ever stops, E2E assertions about dashboard contents start failing intermittently.
- **`vercel link` appends `.env*` to `.gitignore`**, below the `!.env.example` negation, shadowing it.

## Cost

~**$0.02 per receipt** (`claude-opus-5`, measured). Every parse records `model`, `input_tokens`, `output_tokens` and `parse_ms` on the `receipts` row; `npm run cost` prices them. Image tokens dominate, so cost tracks photo size more than receipt length.

Two settled decisions: **don't downscale images** and **don't switch to Sonnet**. Each saves about a penny per receipt and risks a wrong total the user has to catch. Revisit only if volume changes by an order of magnitude — and only with eval evidence.

## Secrets

`ANTHROPIC_API_KEY` is server-side only, read by the edge function, never in the client bundle. The Supabase publishable key and project URL are public by design and ship in the bundle. `anon` has no table privileges (migration 005); RLS is the gate for everything else.
