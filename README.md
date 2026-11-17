# FamilyLedger

A mobile-first receipt tracker. Photograph a receipt, Claude reads it, the expense lands in a dashboard.

Built for two people: a standard user who photographs receipts on her phone, and an admin who can see across accounts. The interface targets a 430px column and assumes the person using it is not technical — minimum 16px body text, 48px tap targets, no jargon.

---

## Demo

<img src="docs/demo.gif" alt="Signing in, adding a receipt, reviewing the parsed fields, and saving it" width="300">

Twenty-three seconds, recorded with Playwright against the local stack:

1. **Sign in** — accounts are created by an admin; there is no sign-up.
2. **Dashboard** — month/last month/year figures, then categories as ranked share bars.
3. **Add a receipt** — pick a photo; it is converted from HEIC if needed and compressed to 1MB before upload.
4. **Parse** — the "Analysing your receipt" state is the real edge function calling Claude. Nothing is mocked here: the line items you see appear because the model read them off the image.
5. **Review** — every field is editable. Note `LECHE` came through as quantity 2 at 1.50, folded from the receipt's separate `2 x 1,50` row, and `TOMAT` as 0.68 kg at 3.99.
6. **Save** — the expense lands on the dashboard.

See [Design](#design) for the conventions the interface follows.

> Recorded with the seeded test account and a synthetic receipt. No real account, email, or expense data appears, and the password field is never unmasked.

---

## Architecture

Everything below is what the code actually does today — local only, nothing deployed.

The browser holds the **anon** key and is confined by row-level security. The **service role** key and the **Anthropic** key exist only inside the edge function. The two never meet: the browser uploads an image and asks for a parse, but it is the function that reads the image back out of storage and talks to Anthropic.

```mermaid
flowchart LR
    subgraph browser["Browser · localhost:5173"]
        direction TB
        spa["React 19 SPA<br/>Vite · TanStack Query"]
        prep["prepareImage<br/>HEIC to JPEG, 1MB cap"]
        sdk["supabase-js<br/>ANON key"]
        spa --> prep --> sdk
    end

    subgraph stack["Supabase · Docker, :54321"]
        direction TB
        auth["GoTrue"]
        rest["PostgREST"]
        store["Storage<br/>receipts, private"]
        edge["parse-receipt<br/>Deno · SERVICE ROLE"]
    end

    db[("Postgres<br/>profiles, receipts,<br/>expenses, expense_items<br/>RLS on all four")]
    anthropic["api.anthropic.com<br/>claude-opus-5"]

    sdk -->|"sign in"| auth
    sdk -->|"CRUD · RLS applies"| rest
    sdk -->|"upload jpg<br/>read via 1h signed URL"| store
    sdk -->|"invoke"| edge

    rest --> db
    edge -->|"read image"| store
    edge -->|"image + schema"| anthropic
    edge -->|"write · bypasses RLS"| db

    classDef secret fill:#111,color:#fff,stroke:#111,stroke-width:1px
    class edge,anthropic secret
```

The two black nodes are the only places a privileged key exists. The browser's anon key can reach `rest`, `store` and `auth`, and nothing it holds can bypass row-level security.

### The parse path, step by step

The non-obvious part is that the image makes two trips: the browser puts it into storage, and the function fetches it back out. The browser never sends image bytes to the function — only a row id and a storage path.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant B as Browser
    participant S as Storage
    participant F as parse-receipt
    participant A as Anthropic
    participant P as Postgres

    U->>B: picks a photo
    B->>B: HEIC to JPEG, compress to 1MB
    B->>S: upload user_id/uuid.jpg
    B->>P: insert receipt, status processing
    B->>F: invoke with receipt_id + image_url
    F->>S: download image
    F->>A: image + prompt, json_schema output
    A-->>F: structured parse
    F->>P: insert expense + line items
    F->>P: set receipts.status parsed
    F-->>B: parsed fields
    B->>S: createSignedUrl, 1h, to show the photo
    B->>U: Review screen, pre-filled and editable
    U->>B: confirms
    B->>P: upsert expense, delete and re-insert items
    B->>P: set receipts.status confirmed
```

If any step after the upload fails, the receipt row still exists, so the UI offers manual entry rather than losing the photo.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 3 |
| UI primitives | shadcn/ui (Radix) |
| Data | TanStack Query 5 |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions |
| Receipt parsing | Claude Opus 5 vision, via a Deno edge function |
| Tests | Playwright (E2E) + a scored eval harness for OCR |

The edge function is TypeScript on Deno, not Node — it uses URL and `npm:` imports and `Deno.env.get()`.

---

## Running it locally

**Prerequisites:** Node 20+, Docker (or OrbStack), the [Supabase CLI](https://supabase.com/docs/guides/cli), and an Anthropic API key.

```bash
git clone https://github.com/alejandroderre-lang/familyledger.git
cd familyledger
npm install
```

**1. Start the local Supabase stack.** Migrations in `supabase/migrations/` apply automatically.

```bash
supabase start
```

**2. Point the app at it.** Copy the API URL and anon key printed by `supabase start`:

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

**3. Give the edge function an Anthropic key.**

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > supabase/.env
```

> `supabase start` does **not** read `supabase/.env`. Function secrets only load when you serve functions explicitly with `--env-file`, which is what the next step does.

**4. Run the app and the function.** Two terminals:

```bash
npm run dev
supabase functions serve --env-file supabase/.env
```

**5. Create a user.** There is no sign-up screen — accounts are created by an admin. Open Studio at `http://127.0.0.1:54323` → Authentication → Add user, tick *Auto Confirm*. To make someone an admin:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

The app runs at `http://localhost:5173`.

---

## Testing

Two suites with different jobs.

### End-to-end (`npm run test:e2e`)

Playwright against a Pixel 7 viewport. **The receipt parse is mocked** — these assert the app's behaviour given a parse, never the quality of the parse. Deterministic, free, no API key needed.

```bash
npm run test:seed      # create/reset the local test accounts
npm run test:e2e       # 13 tests, ~25s
npm run test:e2e:ui    # interactive runner with a timeline
npm run test:e2e:headed  # watch it drive a visible browser
```

### OCR evals (`npm run test:evals`)

Uploads each synthetic receipt to storage, calls the **real** edge function, and scores the result field by field against known-good values. Money compares to the cent; descriptions case-insensitively. This is the only thing that tests recognition quality.

```bash
npm run test:evals
```

Ten fixtures covering comma decimals, separate quantity rows, weighed items, a printed total that exceeds the item sum, `CHANGE` lines that must not be read as the total, negative discount lines, multi-buy savings, German receipt vocabulary, a formal A4 invoice, a hotel folio, and an 18-item receipt.

> **These fixtures are synthetic HTML renders** — flat, evenly lit, perfectly square. They say nothing about real phone photos with glare, curl, shadow, motion blur, or perspective skew. A passing eval run means no regressions on clean renders, not that the OCR handles real-world photographs.

Regenerate the fixture images after editing `tests/fixtures/receipts.ts`:

```bash
npm run fixtures:generate
```

---

## Design

Built in Ramp's register: hairline rules rather than shadows, flat surfaces, tabular figures, near-monochrome, small uppercase micro-labels.

Three directions were built and compared side by side — `ledger`, `statement` and `grid`. **Ledger shipped** and is now the only one; the other two and the switcher that toggled them are gone.

What that means in practice:

- **No card elevation.** Surfaces separate with a hairline (`--rule`), never a shadow. Radius comes from `--radius`.
- **Colour carries meaning only** — category ticks and status. Category bars are greyscale, encoding rank by darkness rather than hue, with the amount and share printed on every row so nothing depends on telling the shades apart.
- **48px minimum tap targets**, checked by `npm run explore`. The intended user is an older adult on a phone; this is a requirement rather than a preference.

---

## Other docs

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Working conventions and the gotchas that have cost time — read before changing the design, the parse prompt, or anything touching migrations |
| [`docs/original-spec.md`](docs/original-spec.md) | The original build brief. **Historical** — it describes a donut chart and components that no longer exist |

---

## Layout

```
src/
  components/
    dashboard/     MetricStrip, CategoryBars, RecentExpenses
    expenses/      ExpenseRow, filters, line-item editor
    layout/        AppShell, BottomNav
    ui/            shadcn primitives
  hooks/           useAuth, useExpenses, useReceipts
  lib/             Supabase client, formatters, expense maths
  pages/           one per route
supabase/
  migrations/      001–007, see below
  functions/
    parse-receipt/ the vision call (Deno)
tests/
  e2e/             Playwright specs (Chromium + WebKit)
  evals/           scored OCR runs against the live model
  fixtures/        synthetic receipts + expected parses
  health.ts        parse failures by reason
  cost-report.ts   spend per receipt
  explore.ts       exploratory sweep for console errors and tap targets
docs/
  demo.gif         the recorded main flow
  original-spec.md the historical build brief
```

### Migrations worth knowing about

`001` is the original schema. Everything after it exists because something
that should have been in version control wasn't — most of it discovered by
deploying, not by testing.

| | |
|---|---|
| **002** | The `receipts` storage bucket and its RLS policies. Previously hand-made dashboard state, so a rebuilt backend had no bucket at all. |
| **003** | Table grants for `authenticated`. RLS filters rows a role may already touch; without the grant every request fails `permission denied`. |
| **004** | The same for `service_role`, which the edge function uses to write parsed expenses. |
| **005** | Revokes `anon`'s table privileges. `003` claimed anon had none — true on a current local stack, false on hosted, where Supabase grants them before any migration runs. |
| **006** | Per-parse token usage on `receipts`, so cost is measured rather than estimated. |
| **007** | `error_code` plus a `parse_health` view. The function had six failure paths and only two recorded anything; the rest left rows stuck at `processing`. |

`001` also had to change to deploy at all: it used `uuid_generate_v4()`, which
is not on the search path on hosted Supabase, so every table creation failed.
It now uses `gen_random_uuid()`.

### Operational

```bash
npm run health          # parse failures by reason; add `-- hosted` for production
npm run cost            # spend per receipt from recorded token usage
npm run explore         # sweep for console errors, tap targets, overflow
```

`npm run health` exits non-zero when anything failed, and flags receipts stuck
in `processing` past five minutes — a function that crashes never writes an
`error_code`, so those are findable only by age.

---

## Security notes

- `anon` has no table privileges. Authenticated users reach only their own rows via RLS.
- Admin checks go through a `security definer` helper (`public.is_admin()`) so the policy on `profiles` doesn't recurse into itself.
- `ANTHROPIC_API_KEY` is only ever read server-side in the edge function. It is never exposed to the browser.
- `.env`, `.env.local` and `supabase/.env` are gitignored.

---

## Known gaps

- **Not deployed.** Runs locally only; the original hosted Supabase project was deleted. Spec targets Vercel + hosted Supabase.
- **Real-photo OCR is untested.** See the eval caveat above.
- **The design rework stops at the dashboard.**
- **The design switcher ships in the UI** and should be removed once a direction is settled.
