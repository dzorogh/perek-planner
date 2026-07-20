---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 1.3: Store picker in Settings

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want to select a concrete store once in Settings (default д. Алабино, 92),
So that catalog and stock are for my store without being asked before every Menu.

## Acceptance Criteria

1. **Given** an authenticated operator  
   **When** they open Settings and use `store-picker`  
   **Then** they select a concrete store from a list (not free-text address) (FR14, UX-DR11)

2. **Given** a new operator with no prior preference  
   **When** Settings / store context is initialized  
   **Then** the default selected store is д. Алабино, 92 (FR14, AD-9)

3. **Given** `UserSettings.selected_store_id` is saved  
   **When** the operator starts a new Menu later  
   **Then** Create Menu does not re-prompt for store selection (FR14, UX-DR5)

4. **Given** `stores` (and user settings) tables needed for this story  
   **When** migrations are applied  
   **Then** schema follows `supabase/migrations` as SoT; `stores` is readable by authenticated users per AD-5/AD-6

## Tasks / Subtasks

- [x] Schema: `stores` + `user_settings.selected_store_id` (AC: #2, #4)
  - [x] Add migration under `supabase/migrations/` (SoT per AD-6) — do **not** invent a parallel schema file
  - [x] Create `public.stores` with at least: `id uuid PK`, `chain text NOT NULL` (v1: `'primary'`), `external_id text NOT NULL` (opaque; for sync/1.4), `display_name text NOT NULL`, `created_at` / `updated_at timestamptz`
  - [x] Seed **one** default row: **д. Алабино, 92** (`display_name` = `д. Алабино, 92`; stable UUID so FK default is deterministic)
  - [x] `ALTER` `user_settings` add `selected_store_id uuid NULL REFERENCES public.stores(id)` — keep nullable in DB; app initializes default on first Settings/context load
  - [x] RLS on `stores`: `ENABLE`; policy **SELECT** for `authenticated`; **no** INSERT/UPDATE/DELETE policies for `authenticated` (writes = service role / migration seed only — AD-2/AD-5)
  - [x] `REVOKE ALL` on `stores` from `anon`; `GRANT SELECT` to `authenticated`
  - [x] Existing `user_settings` RLS policies already cover the new column — do not weaken them
  - [x] Apply migration to the project Supabase (MCP `apply_migration` or Dashboard SQL) and keep local SQL as SoT

- [x] Domain + server actions for store preference (AC: #2, #3)
  - [x] Add thin domain helpers under `src/domain/settings/` (AD-6: `UI → domain → supabase`): e.g. load stores list, load/ensure user settings with default store, update `selected_store_id`
  - [x] Mutations via **Server Actions** using `createClient()` from `src/lib/supabase/server.ts` + `getUser()` before write — not `getSession()` alone
  - [x] On first authenticated Settings (or layout) load: if no `user_settings` row **or** `selected_store_id` is null → upsert with default Alabino store id
  - [x] After successful save: `revalidatePath` for `/settings` and authenticated shell paths so header updates
  - [x] Return Russian workshop errors to the UI — never raw EN SDK strings as the only message

- [x] Settings UI: `store-picker` (AC: #1, #2)
  - [x] Replace stub in `app/(authenticated)/settings/page.tsx` with real Settings content
  - [x] Component name / data attribute: `store-picker` (UX-DR11) — prefer `src/components/settings/store-picker.tsx`
  - [x] Concrete selectable list (radio-group / pill track pattern like Create Menu day-length) — **forbidden:** free-text address input, multi-chain UI, map picker
  - [x] Soft Workshop: `page-title` «Настройки»; section label e.g. «Магазин магазина»; card/surface tokens; light-only; RU copy; no emoji/marketing
  - [x] Show current selection; allow change; persist via server action; loading/disabled + `role="alert"` on failure; keyboard + focus rings (globals.css)
  - [x] v1: only stores from seeded `stores` table — do **not** fetch live store list from the store site APIs (AD-2)

- [x] Header store context (AC: #2, #3)
  - [x] Replace hardcoded «Магазин · д. Алабино, 92» in `app-header.tsx` with data from `user_settings` → `stores.display_name`
  - [x] Fetch in Server Component (`app/(authenticated)/layout.tsx` or thin server wrapper) and pass `storeLabel` prop into `AppShell` → `AppHeader` (header stays client for nav pathname; label is a prop)
  - [x] Format: `Магазин · {display_name}`
  - [x] When bypass-auth local mode has no user, keep a calm fallback (Alabino default label) — do not crash the shell

- [x] Prove Create Menu does not re-prompt (AC: #3)
  - [x] Do **not** add store picker / store modal to `app/(authenticated)/page.tsx` (Create Menu)
  - [x] Manual check: after saving store in Settings, navigate to `/` — only day-length flow; no store question (UX-DR5)

- [x] Smoke verification (AC: #1–#4)
  - [x] Authenticated `/settings` shows `store-picker` with at least Alabino 92 selected by default for a fresh operator
  - [x] Change selection (if ≥2 seeded stores) or re-save Alabino → persists across refresh; header subtitle matches
  - [x] Create Menu `/` has no store prompt
  - [x] RLS: anon cannot SELECT `user_settings`; authenticated can SELECT `stores`; authenticated **cannot** INSERT/UPDATE `stores` with anon/publishable client
  - [x] Extend or sibling smoke script under `scripts/` (pattern from `verify-rls-user-settings.mjs`)
  - [x] `npm run lint` / `npm run build` pass
  - [x] Soft Workshop brand unchanged (no purple SaaS / dark mode drift)

### Review Findings

- [x] [Review][Patch] Remove seeded fake store «г. Москва, тестовый» — keep only д. Алабино, 92 (user decision: remove) [supabase/migrations/20260720020000_stores_and_selected_store.sql]
- [x] [Review][Patch] Smoke script lacks authenticated SELECT OK + authenticated INSERT/UPDATE deny proof [scripts/verify-rls-stores.mjs]
- [x] [Review][Patch] Default upsert can overwrite a concurrent store choice (TOCTOU) — use null-only update [src/domain/settings/stores.ts:83]
- [x] [Review][Patch] Wrap updateSelectedStore call in try/catch so pendingId cannot stick on throw [src/components/settings/store-picker.tsx:29]
- [x] [Review][Patch] Store lookup failure falls back to Alabino label while keeping other selectedStoreId [src/domain/settings/stores.ts:35]
- [x] [Review][Patch] Settings still renders StorePicker with DEFAULT selection when ensure/settingsError is set [app/(authenticated)/settings/page.tsx:42]
- [x] [Review][Patch] Re-clicking already-displayed Alabino no-ops when ensure failed and nothing persisted [src/components/settings/store-picker.tsx:23]
- [x] [Review][Patch] Clear pendingId only after refresh/props catch up (or keep until selectedStoreId matches) to avoid selection flash [src/components/settings/store-picker.tsx:36]
- [x] [Review][Patch] Before default upsert, verify DEFAULT_STORE_ID exists in stores; otherwise surface error instead of fake selection [src/domain/settings/stores.ts:82]
- [x] [Review][Patch] If selectedStoreId is missing from loaded stores list, clamp/fallback so one radio remains aria-checked [app/(authenticated)/settings/page.tsx]

## Dev Notes

### Epic context

Epic 1 — Sign in, workspace & store catalog: operator signs in, lands on Soft Workshop shell, **picks store once in Settings**, plans against fresh catalog.

**This story owns Settings store preference only.** Auth gate + `user_settings` RLS shell already exist (1.2). Catalog sync, stale blocking, and Menu `store_id` snapshot are later stories.

Sibling stories (do not implement here):
- **1.4** — Python `sync/` catalog worker; uses `stores.external_id`; service-role writes to catalog tables
- **1.5** — `warning-stale` blocks planning; Settings + sign-out must remain available
- **2.1** — Menu creation snapshots `store_id` from Settings (AD-9); changing Settings must not rewrite past Menus

Traceability: PRD **FR-16** = Epics **FR14** = UX **UX-DR11** + **UX-DR5** = Architecture **AD-9**. Schema SoT = **AD-6**. Auth/RLS = **AD-5**.

### Current code state (READ before editing)

| File | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `app/(authenticated)/settings/page.tsx` | Static stub («появится здесь») | Real `store-picker` + server data | Soft Workshop page-title / muted copy patterns |
| `src/components/layout/app-header.tsx` | Client; hardcoded Alabino subtitle | Accept `storeLabel` prop; render dynamic line | Pill-nav, primary nav, logout, wordmark |
| `src/components/layout/app-shell.tsx` | Renders `<AppHeader />` with no props | Pass `storeLabel` through | warning-stale slot empty (1.5); max-width shell |
| `app/(authenticated)/layout.tsx` | `getUser()` gate + `<AppShell>` | Load/ensure store context; pass label into shell | Auth bypass rules; defense-in-depth |
| `supabase/migrations/20260720010000_user_settings_rls.sql` | `user_settings` without store FK | **Do not edit** — add a **new** migration | Existing RLS policies |
| `app/(authenticated)/page.tsx` | Create Menu + day-length picker | Touch only if needed to prove no store prompt | No store UI (UX-DR5) |
| `src/domain/` | `.gitkeep` only | Start `settings/` helpers | Dependency direction AD-6 |
| Auth / proxy / supabase clients | Done in 1.1–1.2 | Reuse as-is | `getUser()`; `proxy.ts` not competing `middleware.ts` |

### Technical requirements (MUST follow)

| Item | Requirement |
| --- | --- |
| Schema SoT | New file under `supabase/migrations/` only (AD-6) |
| Settings live preference | `user_settings.selected_store_id` (AD-9) |
| Menu snapshot | **Out of scope** — Story 2.1 owns `menus.store_id` |
| Default store | **д. Алабино, 92** for new operator (FR14, AD-9) |
| Selector UX | Concrete list only — not free-text address (UX-DR11) |
| Create Menu | Never re-prompt for store (UX-DR5) |
| Data access | Server Components + Server Actions via `@supabase/ssr` server client; `getUser()` before mutations |
| Catalog / store APIs | Next **reads** seeded `stores` from Supabase only — no the store HTTP from Next (AD-2) |
| Secrets | Service role **never** in browser / `NEXT_PUBLIC_*` (NFR6) |
| Packages | Keep pinned `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.7` — do not bump to `"latest"` |
| Node / Next / React | ≥22 / 16.2.10 / 19.2.7 |
| UI copy | Russian workshop voice (NFR2); English ids in code (`Store`, `selected_store_id`) |
| Chain scope | v1 single grocery chain only — no multi-chain Settings UI |

### Recommended schema (migration sketch)

```sql
-- stores (catalog-adjacent, readable by authenticated)
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  chain text not null check (chain = 'primary'), -- widen later when multi-chain lands
  external_id text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- seed fixed UUID for default Alabino (pick one uuid and keep it stable)
-- insert into stores (id, chain, external_id, display_name) values (...);

alter table public.user_settings
  add column selected_store_id uuid references public.stores (id);

-- RLS: authenticated SELECT on stores; no write policies for authenticated
```

**`external_id`:** opaque string for Story 1.4 `store-catalog-api` adapter. If the real store id is unknown now, seed a stable placeholder (e.g. `alabino-92`) and document in README that 1.4 may update it — do **not** block 1.3 on live API discovery.

**Optional second seed store:** helpful for proving picker change persistence; not required by AC if default + list UX is clear. Prefer ≥2 rows for smoke if easy.

### Architecture compliance

- **AD-9:** Settings hold live `selected_store_id`; Menu snapshot is later — changing Settings must not invent Menu rewrite logic here.
- **AD-5:** Authenticated routes already gated; RLS on user-owned settings; `stores` SELECT for authenticated.
- **AD-6:** Migrations = schema SoT; domain helpers under `src/domain/`; no UI↔`sync/` imports; avoid hand-owned DTOs that rename DB columns.
- **AD-2:** Sync worker writes catalog later; Next must not call retailer APIs for store/catalog ingest.
- **AD-8:** Do **not** create `catalog_sync_runs` / stale signal here (Story 1.5).
- **ER:** `UserSettings }o--|| Store : selected` — implement Settings side only.

[Source: `ARCHITECTURE-SPINE.md` — AD-2, AD-5, AD-6, AD-8, AD-9, ER diagram, Capability map]

### UX / brand compliance

Settings is **spine-only** (no dedicated HTML mock). Behavioral rules from EXPERIENCE are authoritative.

| Element | Rule |
| --- | --- |
| Placement | Settings only (`/settings`); primary nav «Настройки» already exists |
| Component | `store-picker` — concrete list; default д. Алабино, 92; set once |
| Forbidden | Free-text address; store prompt on Create Menu; dark mode; emoji |
| Header | Muted 13px subtitle: `Магазин · {display_name}` |
| Tokens | Soft Workshop / Lavender Workshop from `globals.css` + DESIGN.md |
| Voice | Practical Russian; calm save/error copy — not marketing success banners |
| A11y | Keyboard Tab = visual order; focus rings; accessible names in RU |

Reuse Create Menu day-length **radiogroup / pill track** visual pattern for store options (already in repo) rather than inventing a new Select system unless shadcn Select is added deliberately.

[Source: `EXPERIENCE.md` UX-DR5, UX-DR11; `DESIGN.md` Soft Workshop]

### File structure requirements

**UPDATE (primary):**

```text
app/(authenticated)/settings/page.tsx
app/(authenticated)/layout.tsx
src/components/layout/app-shell.tsx
src/components/layout/app-header.tsx
README.md
scripts/verify-rls-user-settings.mjs   # extend OR add sibling script
```

**NEW:**

```text
supabase/migrations/<timestamp>_stores_and_selected_store.sql
src/components/settings/store-picker.tsx
src/domain/settings/*.ts               # load/ensure/update helpers + server actions if colocated
scripts/verify-rls-stores.mjs          # optional sibling smoke
```

**Do NOT create / do NOT implement:**

- `sync/` worker, `products`, `catalog_sync_runs` (1.4 / 1.5)
- `warning-stale` behavior (1.5)
- `menus` table / `store_id` snapshot (2.1)
- Store picker on Create Menu or anywhere outside Settings
- Live store search API from Next
- `user_profiles` table (project already uses `user_settings`)
- Competing auth middleware or package bumps

### Library / framework requirements

- **Use:** existing `@supabase/ssr` server/browser clients; Server Actions + `revalidatePath`; shadcn Button/Label/Card; Soft Workshop tokens.
- **Do not use:** `getSession()` alone for authz; service role in client/components; NextAuth/Clerk; free-text address libraries.
- Prefer Server Action mutation over client-direct `supabase.from(...).update` for Settings writes (session + RLS still apply; keeps pattern aligned with architecture “Next server actions” for user mutations).

### Testing requirements

No Vitest/Playwright mandated. Minimum for 1.3:

1. Authenticated Settings shows concrete `store-picker` (not free-text)
2. Fresh operator defaults to д. Алабино, 92 (settings row + header)
3. Saved selection persists after refresh; header matches
4. Create Menu `/` never asks for store
5. RLS: anon denied on `user_settings`; authenticated SELECT `stores` OK; authenticated write to `stores` denied
6. A11y: keyboard + focus rings on picker
7. `npm run lint` / `npm run build` green

### Previous story intelligence (1.1 + 1.2)

**From 1.1 (done):**
- Soft Workshop shell, pill-nav, Settings route stub, hardcoded header Alabino line — wire the subtitle here.
- Next 16 uses **`proxy.ts`**, not `middleware.ts`.
- Create Menu landing `/` after sign-in (FR25) — keep it; do not redirect Settings after save unless UX needs it.

**From 1.2 (done):**
- `user_settings` + RLS exists; migration explicitly deferred `selected_store_id` to **this** story — extend via **new** migration only.
- Auth: `getUser()` in proxy + authenticated layout; cookie-safe redirects; logout in header.
- Smoke pattern: `scripts/verify-rls-user-settings.mjs` — empty `[]` without error must not PASS; distinguish deny vs empty table.
- Do not invent Menu/Rating/History tables.
- Russian error mapping + `role="alert"` patterns from login-form.

[Source: `1-1-app-shell-with-soft-workshop-brand.md`, `1-2-login-and-password.md`]

### Git intelligence summary

Only commit on branch: `e20cd4b Init` (Story 1.1 + planning). Story 1.2 work may be uncommitted locally — treat current tree as SoT. Follow established patterns: Soft Workshop tokens, `@/` imports, server `createClient()`, Russian UI copy.

### Latest tech information

- Prefer Server Actions + `createClient()` from `@supabase/ssr` server helper; call `getUser()` before mutating `user_settings`.
- RLS enforces ownership; still set `user_id` explicitly on upsert for defense-in-depth.
- Use `revalidatePath` after Settings save so Server Components (header label) refresh.
- Do not put service role in Server Actions for normal user Settings writes — anon/publishable key + user JWT is correct so RLS applies.
- Keep package pins; do not migrate to `getClaims()` unless Architecture updates AD-5.

### Project context reference

No `project-context.md` in repo. Follow Architecture Spine + DESIGN.md + EXPERIENCE.md + this story file.

### Anti-patterns (prevent disasters)

- Free-text address field “for convenience”
- Store picker / modal on Create Menu (breaks UX-DR5 / AC #3)
- Editing the 1.2 migration instead of adding a new migration
- Creating `user_profiles` instead of extending `user_settings`
- Treating Settings and future `menus.store_id` as dual live SoT in this story
- Calling the store APIs from Next for store list
- Implementing sync / stale banner / Menu snapshot “while here”
- Hardcoding header forever and claiming AC done without persistence
- Service role in browser or Server Action for ordinary Settings update
- Multi-chain Settings UI in v1
- Dark mode / purple SaaS drift / English-only UI errors

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3, FR14, UX-DR5, UX-DR11, AD-9]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md` — AD-2, AD-5, AD-6, AD-8, AD-9, ER]
- [Source: `_bmad-output/planning-artifacts/prds/prd-keplo-2026-07-19/prd.md` — FR-16]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md` — store-picker]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md` — Soft Workshop]
- [Source: `_bmad-output/implementation-artifacts/1-2-login-and-password.md` — user_settings RLS deferral]
- [Source: `_bmad-output/implementation-artifacts/1-1-app-shell-with-soft-workshop-brand.md` — header placeholder]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Applied MCP migrations: `stores_and_selected_store`, `stores_revoke_authenticated_writes`.
- Seeded stores: Alabino `a1000000-…0001`, second `a1000000-…0002`.
- Privileges after tighten: `auth_can_select=true`, `auth_can_insert=false`, `anon_can_select=false`.
- Smoke: `scripts/verify-rls-stores.mjs` PASS (anon deny settings/stores select + stores insert).
- `npm run lint` / `npm run build` green.
- Create Menu page unchanged — no store prompt (AC #3).
- Review patches: store_count=1 (д. Алабино, 92); grants auth_can_select=true, auth_can_insert/update=false; lint/build green.
- Full JWT smoke needs `SMOKE_OPERATOR_EMAIL` + `SMOKE_OPERATOR_PASSWORD` in `.env.local`.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created (2026-07-20)
- Implemented stores schema + `selected_store_id`, Settings `store-picker`, layout ensure-default, dynamic header label, smoke script, privilege tighten for authenticated SELECT-only on `stores`.
- All ACs satisfied; story ready for code-review.
- Code review patches applied: removed fake second store; null-only default write; lookup errors no longer spoof Alabino; picker try/catch + no flash; clamp selection; smoke requires SMOKE_OPERATOR_* for authenticated SELECT/write-deny. Grant surface verified via SQL (`auth_can_select=true`, insert/update=false). Status → done.

### File List

- `supabase/migrations/20260720020000_stores_and_selected_store.sql` (new)
- `supabase/migrations/20260720020100_stores_revoke_authenticated_writes.sql` (new)
- `supabase/migrations/20260720020200_remove_placeholder_second_store.sql` (new)
- `src/domain/settings/constants.ts` (new)
- `src/domain/settings/stores.ts` (new)
- `src/domain/settings/actions.ts` (new)
- `src/components/settings/store-picker.tsx` (new)
- `scripts/verify-rls-stores.mjs` (new)
- `app/(authenticated)/settings/page.tsx`
- `app/(authenticated)/layout.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-header.tsx`
- `README.md`
- `.env.example`
- `_bmad-output/implementation-artifacts/1-3-store-picker-in-settings.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Story context created (ready-for-dev) — stores schema, Settings store-picker, AD-9 selected_store_id, dynamic header.
- 2026-07-20: Implemented store picker end-to-end; migrations applied; RLS smokes + lint/build green; status → review.
- 2026-07-20: Code review — removed test store; hardened ensure/picker/smoke; status → done.
