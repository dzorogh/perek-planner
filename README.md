# Keplo

Personal batch-cooking meal planner (Soft Workshop / Lavender Workshop).  
Plans menus and ingredient shopping lists — **no live grocery-store catalog**.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS 4 + shadcn/ui
- Supabase Auth (`@supabase/ssr`) + Postgres RLS
- OpenRouter (server-only) for recipe invent + slot assignment

## Setup

Requires Node.js ≥ 22.

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# set OPENROUTER_API_KEY for AI generate
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visits to planning routes redirect to `/auth/login`.

### Operator account (single user)

v1 is single-operator. Create the account in **Supabase Dashboard → Authentication → Users → Add user** (email + password). There is no public sign-up UI.

After sign-in you land on Create Menu (`/`). Use **Выйти** in the header to end the session.

### Database migrations

Schema SoT is `supabase/migrations/`. Apply migrations to your Supabase project (CLI `supabase db push`, or run the SQL in the Dashboard SQL editor).

Catalog / store sync was removed (`20260720120000_drop_catalog_buyability.sql`): no `stores`, `products`, `catalog_sync_runs`, or `checked_matches`. Shopping list lines are ingredient names from `critical_ingredients` + free-text snacks.

### App surfaces

| Route | Purpose |
|-------|---------|
| `/` | Create Menu (1–4 days) + AI generate |
| `/plan/menu` | Slot edit, generated per-day snacks, UJ-1 continue |
| `/plan/portions` | Redirects to shopping list (people count set at create) |
| `/plan/shopping-list` | Ingredient list + copy |
| `/settings` | Session / logout |
| `/history` | Past menus, ratings, recipe text |

Server-only AI: set `OPENROUTER_API_KEY` in `.env.local` (never `NEXT_PUBLIC_*`).

Eligibility for suggestions: **fridge-keep** + **Refusal/dislike** hard-suppress. AI may invent recipes into the shared library, then assign only persisted ids.

Smoke (after migrations applied):

```bash
npm run verify
# or separately:
npm run verify:logic
npm run verify:rls   # needs .env.local
```

### E2E (Playwright)

```bash
npm run test:e2e
```

Authenticated planning flow needs `E2E_OPERATOR_EMAIL` / `E2E_OPERATOR_PASSWORD` (or defaults used in local smoke) and `OPENROUTER_API_KEY`.

## Deploy notes

- Dokploy hosts the Next app.
- No Python catalog sync container.
- Soft Workshop tokens live in `app/globals.css` (`--workshop-*`).
