# Development Guide — keplo

## Prerequisites

- Node.js ≥ 22
- Supabase project (Auth + Postgres with migrations applied)
- Optional: OpenRouter API key for AI generate
- Optional: Playwright browsers (`npx playwright install`) for e2e

## Setup

```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Set OPENROUTER_API_KEY for AI
npm install
npm run dev
```

Dev server: **http://localhost:3100** (`next dev --port 3100`).

### Operator account

v1 is single-operator. Create the user in **Supabase Dashboard → Authentication → Users**. There is no public sign-up UI.

### Auth bypass (local shell only)

```bash
# .env.local
KEPLO_DEV_BYPASS_AUTH=true
```

Ignored when `NODE_ENV=production`. Never enable on Dokploy.

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next on 3100 |
| `npm run build` / `npm start` | Production build/serve |
| `npm run lint` | ESLint |
| `npm run verify:logic` | Pure-logic Node scripts |
| `npm run verify:rls` | RLS checks (needs `.env.local`) |
| `npm run verify` | logic + rls + lint + build |
| `npm run test:e2e` | Playwright |

### Playwright port

Default `PLAYWRIGHT_BASE_URL` is `http://localhost:3000` while `npm run dev` uses **3100**. Prefer:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run test:e2e
```

Shell e2e needs bypass; planning-flow needs `E2E_OPERATOR_EMAIL` / `E2E_OPERATOR_PASSWORD` (or `SMOKE_OPERATOR_*`).

## Project Layout for Implementers

- Routes: `app/`
- UI: `src/components/`
- Domain + server actions: `src/domain/`
- Clients: `src/lib/`
- Schema: `supabase/migrations/`
- Agent rules: `_bmad-output/project-context.md`

## Implementation Conventions

- Path alias `@/*` → `src/*`
- `"use server"` in `*-actions.ts`
- Russian UI copy; English domain ids
- Extend `scripts/verify-*-logic.mjs` for pure logic; wire into `verify:logic`
- New tables/RLS → new migration file; update `verify-rls-*` when needed
- Read `_bmad-output/project-context.md` before coding

## Story Workflow

Stories live in `_bmad-output/implementation-artifacts/`. Track status in `sprint-status.yaml`. Prefer `npm run verify` (or relevant subset) before moving a story to `review`.
