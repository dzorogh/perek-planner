---
project_name: 'keplo'
user_name: 'Sergey'
date: '2026-07-20'
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'testing_rules',
    'code_quality_rules',
    'workflow_rules',
    'dont_miss_rules',
  ]
status: 'complete'
rule_count: 58
optimized_for_llm: true
existing_patterns_found: 12
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Node.js ≥22.0.0 (engines); do not assume Node 18/20 APIs
- Next.js 16.2.10 App Router — session middleware is `proxy.ts` (not a legacy `middleware.ts` assumption)
- React 19.2.7 + React DOM 19.2.7; TypeScript 5.x with `strict: true`
- Tailwind CSS 4.3.3 via `@tailwindcss/postcss` (v4 — not v3 `tailwind.config.js` patterns)
- shadcn/ui: style `new-york`, RSC, aliases `@/components` / `@/lib/utils`
- Supabase: `@supabase/ssr` 0.12.3 + `@supabase/supabase-js` 2.110.7; schema SoT = `supabase/migrations`
- OpenRouter: server-only (`OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL`); never `NEXT_PUBLIC_*` for AI keys
- Dev: `next dev --port 3100`. Playwright default `PLAYWRIGHT_BASE_URL` is `http://localhost:3000` — override when hitting local dev
- No Python `sync/` / live grocery catalog in this repo

## Critical Implementation Rules

### Language-Specific Rules

- Prefer result unions (`{ ok: true } | { ok: false; error: string }`) over throwing across the UI boundary
- Imports: `@/…` for `src/` code; avoid deep `../../../` chains
- `"use server"` only in `*-actions.ts` (or intentional server-action entry files); named exports preferred
- Typed domain errors with machine-readable `reason`/`code`; map to Russian at the UI/action edge (`SUGGESTION_FAIL_RU` pattern)
- Pure domain helpers: no Next/React imports; `revalidatePath` / `redirect` / cookies stay in actions/pages
- Logic verify scripts: plain Node ESM (`.mjs`), no TS compile step

### Framework-Specific Rules

- Server Components by default; `"use client"` only for interactivity
- Planning UI under `app/(authenticated)/…`; protect with layout `getUser()`
- Session refresh: `proxy.ts` → `@/lib/supabase/middleware` (`updateSession`); preserve cookie copy-on-redirect
- Mutations: server actions in `src/domain/**/**-actions.ts` + `revalidatePath` for touched routes
- Deps: `app/` + `src/components/` → `src/domain/` → `src/lib/supabase|openrouter` — never OpenRouter from Client Components
- Browser Supabase client for auth/UI only; data + AI via server client/actions
- UI: Soft Workshop / light-only desktop; Russian copy; English glossary ids in domain (`Menu`, `Recipe`, `Snack`, …)
- Suggestions: invent → persist → assign **persisted ids only**; eligibility = fridge-keep + refusal/dislike hard-suppress
- Shopping list: `buildShoppingList(menuId)` snapshot (ingredient names + snacks); no in-app cart edit

### Testing Rules

- Pure domain logic: `scripts/verify-*-logic.mjs` (PASS/FAIL + non-zero exit) — do not add Jest/Vitest unless asked
- Wire new logic verifiers into `npm run verify:logic`
- RLS changes: matching `scripts/verify-rls-*.mjs` (`.env.local` operator creds) + `npm run verify:rls`
- Gate: `npm run verify` (logic + rls + lint + build) when those surfaces change
- E2E: `e2e/*.spec.ts` — role/accessible-name selectors + existing `data-component` hooks
- Shell tests may use `KEPLO_DEV_BYPASS_AUTH`; planning-flow needs `SMOKE_OPERATOR_*` / `E2E_OPERATOR_*`
- Keep logic verifiers free of network/OpenRouter; mock AI at the boundary or test pure helpers

### Code Quality & Style Rules

- ESLint flat config (`eslint-config-next` vitals + typescript); no Prettier — match surrounding formatting
- Files: kebab-case; React components PascalCase in code
- Layout: `app/` · `src/components/{layout,menu,history,recipes,shopping,settings,ui,feedback}/` · `src/domain/{menu,suggestions,shopping,history,recipes,settings,matching}/` · `src/lib/{supabase,openrouter}/`
- Domain shape: `constants.ts`, pure helpers, `load-*.ts`, `*-actions.ts`; barrels only where already used
- Do not narrate rejected/deferred scope in UI copy (`.cursor/rules/no-negative-feature-copy.mdc`)
- Add `data-component="…"` on new primary interactive widgets
- Comments: intent/why only; story IDs OK for AC ties; lean diffs, no drive-by refactors

### Development Workflow Rules

- Story work: `_bmad-output/implementation-artifacts/` + `sprint-status.yaml` transitions
- Schema: new `supabase/migrations/YYYYMMDDHHMMSS_snake_description.sql` with RLS; never hand-edit prod outside migrations
- Secrets in `.env.local` / host env; document in `.env.example` without values; never commit `.env.local`
- Deploy: Next on Dokploy → Supabase Cloud; never enable `KEPLO_DEV_BYPASS_AUTH` in production
- Commits: descriptive, why-focused; only when the user asks; no force-push `main` / skip-hooks / amend-others
- After domain/RLS changes, run relevant `verify:*` before story → `review`

### Critical Don't-Miss Rules

- **No live catalog:** do not reintroduce `stores` / `products` / `catalog_sync_runs` / `checked_matches`, store picker, or `sync/`
- **Spine drift:** ADOPTED/SUPERSEDED + code win over stale ER diagrams still showing Product/Store/CheckedMatch
- **AI:** never assign unpersisted invented recipes; never ship OpenRouter keys to the browser
- **Hard suppress:** refusal + dislike on every suggest/assign path (generate, resuggest, snacks)
- **Fridge-keep:** `fridge_keep_days >= menu.day_count` (+ suppress); no SKU matching
- **Auth:** session required for planning; bypass ignored when `NODE_ENV=production`
- **Copy:** never advertise cut features («Без X», «MVP without…»)
- **Ports/docs:** prefer `package.json` scripts over README port mentions
- **Tenancy:** RLS/`auth.uid()` for user rows; do not weaken for convenience
- **UJ-1:** shopping handoff blocked until `slot_edit_passed_at` is set

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-07-20
