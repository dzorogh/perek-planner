# Source Tree Analysis — keplo

Annotated tree of critical paths (exhaustive scan). Excludes `node_modules/`, `.next/`, `_bmad/` skill internals.

```
keplo/
├── app/                          # Next.js App Router (RU UI)
│   ├── layout.tsx                # Root HTML, Geist, metadata
│   ├── globals.css               # Soft Workshop tokens / Tailwind
│   ├── auth/login/page.tsx       # Public login
│   └── (authenticated)/          # Auth-gated shell (no URL segment)
│       ├── layout.tsx            # getUser + AppShell
│       ├── page.tsx              # → /history
│       ├── history/page.tsx
│       ├── settings/page.tsx
│       └── plan/
│           ├── menu/page.tsx     # Composition + slot edit
│           ├── portions/page.tsx # Legacy redirect → shopping-list
│           └── shopping-list/page.tsx
├── src/
│   ├── components/               # Soft Workshop UI (see component-inventory.md)
│   ├── domain/                   # Server orchestration (see architecture.md)
│   │   ├── menu/
│   │   ├── suggestions/          # OpenRouter invent/assign/snacks
│   │   ├── shopping/
│   │   ├── history/
│   │   ├── recipes/
│   │   ├── settings/
│   │   └── matching/             # Fridge-keep only
│   └── lib/
│       ├── supabase/             # browser / server / middleware clients
│       ├── openrouter/           # Server-only AI client
│       └── utils.ts
├── proxy.ts                      # Session refresh + auth redirects (Next 16)
├── supabase/migrations/          # Schema SoT (32 SQL files)
├── scripts/                      # verify-*-logic.mjs + verify-rls-*.mjs
├── e2e/                          # Playwright specs
├── docs/                         # This documentation set
├── _bmad-output/                 # PRD, UX, stories, project-context.md
├── package.json                  # Scripts; dev on port 3100
├── playwright.config.ts
├── next.config.ts
├── tsconfig.json                 # @/* → src/*
└── .env.example
```

## Entry Points

| Kind | Path |
|------|------|
| HTTP UI | `app/**/page.tsx` |
| Session gate | `proxy.ts` → `src/lib/supabase/middleware.ts` |
| Mutations | `src/domain/**/**-actions.ts` + `menu/actions.ts` |
| AI | `src/lib/openrouter/client.ts` ← suggestions modules |
| Schema | `supabase/migrations/*.sql` |

## Critical Folders

| Folder | Purpose |
|--------|---------|
| `src/domain/suggestions/` | Largest domain surface — invent, variety, suppress, resuggest |
| `supabase/migrations/` | Never bypass; drop-catalog migration is the SoT for “no SKU” |
| `scripts/` | Pure-logic + RLS smoke; wire into `npm run verify:*` |
| `e2e/` | Shell bypass + full planning flow |

## Non-goals in tree

- No `sync/` Python worker
- No `app/**/route.ts` REST layer
- No classic `middleware.ts` filename (use `proxy.ts`)
