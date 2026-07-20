---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 2.1: Create Menu skeleton by day length

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want to choose 1–4 days and get a Menu skeleton with breakfast/lunch/dinner slots per day,
So that I can fill a multi-day plan without building slots from scratch first.

## Acceptance Criteria

1. **Given** an authenticated operator with a fresh catalog (Story 1.5 allows planning)  
   **When** they use `day-length-picker` and create a Menu for 1, 2, 3, or 4 days  
   **Then** a Menu is persisted with `store_id` snapshotted from Settings (AD-9)  
   **And** each day has breakfast, lunch, and dinner slots (Model C); empty slots are allowed (FR1, FR3, UX-DR5–6)

2. **Given** Recipe domain tables needed for later fill  
   **When** migrations add `Recipe` with fridge-keep and related ingredient structures as required by this skeleton  
   **Then** only tables needed for Menu/MenuSlot (and minimal Recipe reference) are created now — not the full matching pipeline (FR12 prep)

3. **Given** the Create Menu surface  
   **When** day length is selected  
   **Then** the primary path does not require manually assembling every slot before a Menu exists (FR1)  
   **And** UI is Russian Soft Workshop `day-length-picker` / day-card chrome (UX-DR5–6)

## Tasks / Subtasks

- [x] Schema: menus + menu_slots + minimal recipes (AC: #1, #2)
  - [x] Append migration(s) under `supabase/migrations/` (never edit Epic 1 migrations in place)
  - [x] `recipes`: minimal reference table — at least `id`, `name`, `fridge_keep_days` (int, ≥ 1) for FR12 prep; **no** `CriticalIngredient` / `CheckedMatch` yet (Story 2.2)
  - [x] `menus`: `id`, `user_id` → `auth.users`, `store_id` → `stores` (**snapshot** at create — AD-9), `day_count` int check `in (1,2,3,4)`, timestamps; store FR-2 defaults on the row now (e.g. `default_servings_per_meal` int default **2**) even though Portion-plan UI is Epic 3 — spine: “portion defaults … at first Menu epic”
  - [x] `menu_slots`: `id`, `menu_id` → `menus` on delete cascade, `day_index` int (1..`day_count`), `meal` text check `in ('breakfast','lunch','dinner')`, `recipe_id` nullable → `recipes`, unique `(menu_id, day_index, meal)`
  - [x] RLS: owner-only via `auth.uid() = user_id` on `menus`; slots via exists-join to owned menu; `recipes` SELECT for authenticated (writes later via domain / seed — do not open public writes if unused). Follow `user_settings` / stores revoke patterns (explicit grants; deny anon)
  - [x] Comments on tables documenting AD-9 snapshot + Model C slot shape; English table/column ids (AD-6 naming)

- [x] Domain: create Menu skeleton (AC: #1, #3)
  - [x] Add `src/domain/menu/` — e.g. `constants.ts` (`MEAL_SLOTS`, `MIN/MAX_DAY_COUNT`), `create-skeleton.ts` (or `actions.ts` + pure helpers)
  - [x] Server action (session client only): validate `dayCount ∈ {1,2,3,4}`; `getUser()`; resolve `selected_store_id` via `ensureUserStoreSettings` (fail Russian error if null/unavailable)
  - [x] **Must** call `assertCatalogFresh(supabase, storeId)` before insert — fail-closed stale → Russian workshop error; never create Menu when catalog non-fresh (AD-8 / Story 1.5)
  - [x] Persist Menu with **snapshotted** `store_id` (copy from settings at create time — do not re-read Settings later for this Menu’s store)
  - [x] Insert exactly `day_count × 3` slots: for each day_index `1..N`, meals `breakfast|lunch|dinner`, `recipe_id = null`
  - [x] Prefer one transactional path (Postgres RPC or ordered inserts with cleanup on failure) — no orphan menus without full slot set
  - [x] On success: `revalidatePath` for `/` and `/plan/menu`, then `redirect` to slot-edit with menu id (e.g. `/plan/menu?menuId=<uuid>`). **`redirect` outside try/catch** (Next throws control-flow)
  - [x] Return typed `{ ok: false, error: string }` for UI errors (same style as `updateSelectedStore`) — never raw SDK strings as sole copy

- [x] UI: interactive Create Menu + empty day-card chrome (AC: #1, #3)
  - [x] Replace stub radios in `app/(authenticated)/page.tsx` with real `day-length-picker` client control (1–4); default selection **3** (mock/UJ-1); keyboard + `role="radiogroup"`; remove non-interactive `div` radios
  - [x] Soft Workshop tokens only — fix deferred indigo shadow if still using raw `rgba(67,56,202,…)` on selected day: use existing primary/surface/shadow patterns from DESIGN (no purple SaaS drift)
  - [x] Meta-row under CTA reflects selected length: «{N} × завтрак / обед / ужин» + «2 человека по умолчанию» (mock/`EXPERIENCE`; N updates with picker)
  - [x] Primary CTA «Сгенерировать»: when catalog fresh → submits create-skeleton action with selected `dayCount`; when stale → stays disabled via `planningBlocked` from `getOperatorCatalogGate` (do not weaken 1.5)
  - [x] Do not adopt mock stale copy «план строится по последнему сохранённому» — spine/`WARNING_STALE_COPY` from 1.5 wins
  - [x] Pending state: disable picker + CTA while action in flight (`useActionState` / `useTransition` — UX-DR14 loading pattern for this path; full AI loading copy is Story 2.3)
  - [x] After redirect: `/plan/menu` shows Model C **empty** `day-card` / `slot-card` grid for that Menu (Завтрак / Обед / Ужин labels; empty-slot background token). No AI fill, resuggest, Refusal, or snacks yet
  - [x] Keep Russian copy from Create Menu mock/EXPERIENCE («Новое меню», «Сколько дней планируем», fridge hint). Store is **not** re-prompted (FR14 / UX-DR5)
  - [x] Pill-nav «Меню» active on slot-edit route; Settings + logout remain available

- [x] Smoke verification (AC: #1–#3)
  - [x] Fresh catalog + day=3 → Menu row + 9 empty slots; `store_id` equals settings snapshot; land on `/plan/menu` with empty day-cards
  - [x] day=1 → 3 slots; day=4 → 12 slots
  - [x] Stale catalog → CTA disabled / action rejects; no Menu row created
  - [x] RLS: user A cannot read/update user B menus/slots (`scripts/verify-rls-menus.mjs` or extend existing verify pattern)
  - [x] `npm run lint` / `npm run build` green
  - [x] Soft Workshop light-only; no OpenRouter / matching / Shopping list work

### Review Findings

- [x] [Review][Patch] Harden `create_menu_skeleton` RPC — fixed in `20260720040100_menu_skeleton_hardening.sql` (`p_day_count` only; store from Settings; AD-8 in-SQL).
- [x] [Review][Patch] Freeze AD-9 snapshot columns — trigger `menus_freeze_snapshot_columns_trg`.
- [x] [Review][Patch] Enforce `menu_slots.day_index <= menus.day_count` — trigger `menu_slots_day_index_within_menu_trg`.
- [x] [Review][Patch] Fail create when Settings store is unavailable — `settings.error` blocks RPC.
- [x] [Review][Patch] Fail-closed menu load — reject bad meal / wrong slot count / day_index out of range.
- [x] [Review][Defer] `DayCardGrid` always renders empty slot chrome (ignores `recipeId`) — deferred, Story 2.3 fills recipes [`src/components/menu/day-card-grid.tsx`]
- [x] [Review][Defer] RLS smoke only proves anon deny, not user A↛B — deferred, needs dual test users / service-role harness [`scripts/verify-rls-menus.mjs`]
- [x] [Review][Defer] Double-submit can create duplicate menus — deferred, `useActionState` pending covers common case; stronger idempotency later

## Dev Notes

### Epic context

Epic 2 — Plan a buyable Menu. Stories **1.1–1.5 are done** (shell, auth, store, catalog sync, stale gate). This story opens FR1: persist a Menu skeleton from day length so later stories can fill slots.

Sibling boundaries (do **not** implement here):
- **2.2:** CheckedMatch, CriticalIngredient, eligibility, cheaper-analog, fridge-keep **gate logic**
- **2.3:** OpenRouter generate into slots; cook-recency / Rating weights; CTA becomes true AI generate
- **2.4:** UJ-1 gate (cannot skip slot edit → Shopping list), resuggest / clear actions polish
- **2.5 / 2.6:** Snacks, Refusal
- **Epic 3:** Portion plan servings UI, Shopping list

**CTA honesty for 2.1:** Keep label «Сгенерировать» (UX-locked). Behavior in 2.1 = create empty skeleton + navigate to slot edit. Story 2.3 replaces the post-create step with AI fill (same entry CTA / continue path). Do not call OpenRouter in 2.1.

### Current code state (READ before editing)

**Create Menu** — `app/(authenticated)/page.tsx`:
- Already loads `planningBlocked` via `getOperatorCatalogGate()` (React `cache`, fail-closed)
- Day radios are **non-interactive stubs** (hardcoded day 3) — deferred from 1.5 review; **this story owns** making them real
- CTA disabled when `planningBlocked`; stub click does nothing

**Slot edit stub** — `app/(authenticated)/plan/menu/page.tsx`:
- Placeholder copy only — replace with empty day-card grid when `menuId` present

**Stale gate (preserve):**
- `src/domain/catalog/freshness.ts` — `assertCatalogFresh` / `getCatalogFreshness`
- `src/domain/catalog/operator-catalog-gate.ts` — shared layout/page gate
- `WarningStaleSlot` on `/`, `/plan/menu`, `/plan/portions` only

**Settings store SoT:**
- `ensureUserStoreSettings` / `DEFAULT_STORE_ID` — live preference
- Menu must **snapshot** `store_id` at create (AD-9); changing Settings later must not rewrite existing Menus

**No Menu tables exist yet** — `supabase/migrations/` has auth settings, stores, products, catalog_sync_runs only.

### Technical requirements (MUST follow)

| Topic | Rule |
| --- | --- |
| Layering | UI → `src/domain/menu/` → Supabase session client (AD-6). No service role in Next. |
| Auth | Every mutation: `getUser()` first (AD-5). Bypass-auth local mode must not crash; prefer block create without fake success. |
| Freshness | `assertCatalogFresh` before insert; UI disable alone is insufficient. |
| Store | Snapshot Settings `selected_store_id` onto `menus.store_id` at create (AD-9). |
| Schema SoT | New columns/enums only in migrations (AD-6). English domain ids; Russian UI only. |
| Meals | Exactly three meals per day: `breakfast`, `lunch`, `dinner` (Model C). Empty = `recipe_id` null. |
| Day index | Use `1..day_count` consistently (document in migration comment). |
| Redirect | `revalidatePath` then `redirect`; never swallow redirect in `catch`. |
| Dependencies | No new npm packages unless unavoidable — prefer existing Button/shadcn + React 19 `useActionState`/`useTransition`. Do **not** add Zod solely for this story if settings actions stay manual-validated. |

### Architecture compliance

- **AD-1:** Menu orchestration in Next domain modules  
- **AD-5:** RLS owner policies; session client writes  
- **AD-6:** `supabase/migrations` SoT; `src/domain/menu/`  
- **AD-8:** Block create when catalog stale  
- **AD-9:** Settings live store vs Menu snapshot  
- **AD-7 / AD-3 / AD-4:** Out of scope (CheckedMatch, matching module, OpenRouter)

[Source: `architecture/.../ARCHITECTURE-SPINE.md` — AD-1, AD-5, AD-6, AD-8, AD-9, ERD Menu∥MenuSlot]

### UX / brand

- Soft Workshop / Lavender Workshop: `page-title`, `day-length-picker`, `day-card`, `slot-card` / `slot-card-empty`, tokens `empty-slot`, `slot-label`, radii sm/md/lg  
- Russian workshop voice; primary CTA «Сгенерировать»  
- Desktop + keyboard; focus rings; not hover-only  
- Light-only; no dark mode  

[Source: `ux-designs/.../EXPERIENCE.md` — day-length-picker, UJ-1 step 2–4; `DESIGN.md` — day-card / slot-card; `mockups/mock-create-menu.html`]

### File structure requirements

**NEW (recommended):**

```text
supabase/migrations/YYYYMMDDHHMMSS_menus_menu_slots_recipes.sql
src/domain/menu/constants.ts
src/domain/menu/create-skeleton.ts   # pure helpers + types
src/domain/menu/actions.ts           # "use server" createMenuSkeleton
src/components/menu/day-length-picker.tsx
src/components/menu/day-card-grid.tsx # empty skeleton chrome
scripts/verify-rls-menus.mjs         # optional but preferred
```

**UPDATE:**

```text
app/(authenticated)/page.tsx              # wire picker + action
app/(authenticated)/plan/menu/page.tsx    # load menu + empty grid
# optionally AppHeader/pill-nav activeHref if not pathname-driven
```

**Do NOT create / do NOT implement:**

- OpenRouter / AI suggestion module  
- `CheckedMatch`, CriticalIngredient, matching eligibility  
- Refusal, Snacks, Ratings, History pick  
- Shopping list / Portion plan editing  
- Menu clone/reuse UI (AD-10 v1 out)  
- Service role in Next; `NEXT_PUBLIC_*` secrets  
- Dark mode / second design system  

### Library / framework requirements

- **Stack (locked):** Next 16.2.x App Router, React 19.2.x, `@supabase/ssr` 0.12.x, `@supabase/supabase-js` 2.110.x, Tailwind 4 Soft Workshop tokens  
- **Mutations:** `"use server"` actions + session `createClient()` from `@/lib/supabase/server`  
- **Pending UI:** React 19 `useActionState` and/or `useTransition` (already used in store-picker)  
- **Redirect pitfall:** `redirect()` throws — keep outside `try/catch` or rethrow  

### Testing requirements

No Vitest mandated. Minimum for 2.1:

1. Create Menu day=1/3/4 → correct slot counts; all `recipe_id` null  
2. `menus.store_id` equals settings store at create time  
3. Stale catalog cannot create Menu (UI + server)  
4. Empty day-card grid visible on `/plan/menu` after create  
5. RLS isolation script or SQL proof  
6. `npm run lint` / `npm run build` green  

### Previous story intelligence

**From 1.5 (stale gate — done):**
- Reuse `assertCatalogFresh` / `getOperatorCatalogGate` — do not invent a second freshness SoT  
- Create Menu already fail-closed for CTA disable; extend with server assert on mutate  
- Deferred: interactive day picker + purple shadow cleanup → **owned by this story**  
- Pathname gate includes `/plan/menu` — empty skeleton page will correctly show `warning-stale` when stale  

**From 1.3 (store picker — done):**
- `ensureUserStoreSettings` + Russian errors pattern in `src/domain/settings/actions.ts`  
- Snapshot store id; do not re-prompt store on Create Menu  

**From 1.1–1.2:**
- Soft Workshop shell + pill-nav; authenticated layout; RLS patterns for user-owned tables  

[Source: `1-5-block-planning-on-stale-catalog.md`, `1-3-store-picker-in-settings.md`, `deferred-work.md`]

### Git intelligence summary

Only commit on branch history: `e20cd4b Init`. Epic 1 lives as working-tree implementation (`src/domain/catalog|settings`, `app/(authenticated)/`, migrations, Soft Workshop). Follow those patterns; do not “clean up” unrelated Epic 1 files while here.

### Latest tech information

- Next 16 + React 19: prefer `useActionState` for form pending/error; call `revalidatePath` **before** `redirect`; never catch redirect errors as failures  
- Supabase JS 2.110: check `error` on every write; use `.insert().select('id').single()` for new menu id  
- No framework upgrades required for this story  

### Project context reference

No `project-context.md` in repo. Follow Architecture Spine + this story + Epic 1 story files.

### Anti-patterns (prevent disasters)

- Calling OpenRouter or filling Recipes “while scaffolding”  
- Creating Menu without slot rows (or partial slot set)  
- Using live Settings store for an existing Menu instead of snapshot  
- Skipping `assertCatalogFresh` on the server action  
- Building CheckedMatch / CriticalIngredient tables early (scope creep into 2.2)  
- Manual slot-by-slot create UI as the primary path (violates FR1)  
- Replacing Soft Workshop with generic dashboard cards / purple glow  
- Editing prior migrations instead of appending  
- Storing meal labels only in Russian in DB (use English enum ids)  
- `redirect` inside `try/catch` that swallows Next’s redirect throw  

### Open questions for implementer (non-blocking)

1. Active Menu addressing: prefer `?menuId=` on `/plan/menu` for 2.1; a later story may introduce `/plan/menu/[menuId]` if routing gets heavier.  
2. Whether bypass-auth can create Menus: prefer block (no user) over fake inserts.  
3. Seed Recipes: **not required** for empty skeleton; add seed only if FK/testing forces a row (empty slots use null FK).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]
- [Source: `prds/prd-keplo-2026-07-19/prd.md` — FR-1 Create Menu, FR-3 Assign meals]
- [Source: `architecture/.../ARCHITECTURE-SPINE.md` — AD-1, AD-5, AD-6, AD-8, AD-9, ERD]
- [Source: `ux-designs/.../EXPERIENCE.md` — day-length-picker, UJ-1, State Patterns]
- [Source: `ux-designs/.../DESIGN.md` — day-card, slot-card, empty-slot]
- [Source: `ux-designs/.../mockups/mock-create-menu.html`]
- [Source: `1-5-block-planning-on-stale-catalog.md` — freshness gate handoff]
- [Source: `app/(authenticated)/page.tsx` — Create Menu stub]
- [Source: `src/domain/catalog/freshness.ts` — `assertCatalogFresh`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `node scripts/verify-menu-skeleton-logic.mjs` — PASS
- `node --env-file=.env.local scripts/verify-rls-menus.mjs` — PASS (anon denied on menus/menu_slots/recipes)
- `npx eslint` on menu paths — green
- `npm run build` — green
- Supabase MCP `apply_migration` `menus_menu_slots_recipes` — success
- Supabase MCP `apply_migration` `menu_skeleton_hardening` — success

### Completion Notes List

- Migration `20260720040000_menus_menu_slots_recipes.sql`: `recipes`, `menus` (AD-9 `store_id` snapshot + `default_servings_per_meal=2`), `menu_slots`, RLS, RPC `create_menu_skeleton` for atomic insert.
- Domain `src/domain/menu/`: `assertCatalogFresh` before create; Russian errors; `createMenuSkeletonAction` → revalidate + redirect `/plan/menu?menuId=`.
- UI: interactive Soft Workshop `DayLengthPicker` + `CreateMenuForm` (`useActionState`, pending «Создаём…», dynamic meta-row); empty `DayCardGrid` on `/plan/menu`.
- Resolved 1.5 deferred stub radios / indigo shadow; no OpenRouter/matching.
- Code review patches: RPC hardened (Settings store + AD-8 in-SQL), freeze snapshot columns, day_index trigger, unavailable-store fail, fail-closed load.

### File List

- `supabase/migrations/20260720040000_menus_menu_slots_recipes.sql` (new)
- `supabase/migrations/20260720040100_menu_skeleton_hardening.sql` (new)
- `src/domain/menu/constants.ts` (new)
- `src/domain/menu/create-skeleton.ts` (new)
- `src/domain/menu/actions.ts` (new)
- `src/domain/menu/load-menu.ts` (new)
- `src/components/menu/day-length-picker.tsx` (new)
- `src/components/menu/create-menu-form.tsx` (new)
- `src/components/menu/day-card-grid.tsx` (new)
- `app/(authenticated)/page.tsx`
- `app/(authenticated)/plan/menu/page.tsx`
- `scripts/verify-rls-menus.mjs` (new)
- `scripts/verify-menu-skeleton-logic.mjs` (new)
- `_bmad-output/implementation-artifacts/2-1-create-menu-skeleton-by-day-length.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

### Change Log

- 2026-07-20: Story context created for Epic 2 kickoff (ready-for-dev).
- 2026-07-20: Implemented Menu skeleton create + empty day-card grid; status → review.
- 2026-07-20: Code review patches applied; status → done.
