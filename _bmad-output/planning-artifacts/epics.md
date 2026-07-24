---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - planning-artifacts/prds/prd-keplo-2026-07-19/prd.md
  - planning-artifacts/prds/prd-keplo-2026-07-19/addendum.md
  - planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md
  - planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md
  - planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md
  - specs/spec-keplo/SPEC.md
  - specs/spec-keplo/glossary.md
---

# keplo - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for keplo, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Operator can create a Menu by choosing 1, 2, 3, or 4 days and receiving Recipe suggestions for that length (not slot-by-slot from scratch first).
FR2: Operator can set serving counts; new Menu defaults to 3 meals/day × 2 people; changeable before Shopping list copy.
FR3: Operator can assign/edit Slot dishes on breakfast, lunch, dinner, and snack meals via a uniform Plate-role model; empty roles allowed; only eligible Recipes assignable; lunch includes soup + Harvard second course; dinner is Harvard second course; breakfast/snack use simpler templates on the same structure.
FR4: Operator can add no-cook Snacks to the same Menu and Order (persisted as Slot dishes with role snack).
FR5: Operator can view Portion plan by day and meal before purchase/cook; portions laid out without leftover tracking.
FR6: Operator can replace a slot via AI resuggest (no separate Recipe library or manual History pick in v1). AI generation also reintroduces Recipes not cooked for ~2+ weeks, weighted by Rating (high more often, medium less).
FR7: Operator can receive AI suggestions informed by cook recency, Refusals, and Ratings; biased to simple home batch food (Model C); reintroduces Recipes idle ~2+ weeks (high Rating more often, medium less); new AI Recipes gated by Checked matches and today-stock.
FR8: Operator can record a Refusal before cooking; refused Recipes hard-suppressed from suggestions in v1.
FR9: Operator can rate Recipe/Snack from History (like/dislike + reason: too hard, not tasty, too long, other); dislike hard-suppresses; editable after submit; no forced post-cook interrupt.
FR10: Recipe usable only when every Critical ingredient has system-selected Checked-match Product variant(s); no match-review UI.
FR11: Pantry/staples gate eligibility by catalog presence and appear on Shopping list by default (no per-item opt-in prompt).
FR12: Recipe fridge-keep must be ≥ Menu length; shortest selected fridge-keep caps Menu length.
FR13: When choosing among suitable Products, prefer cheaper analogs at medium aggressiveness without collapsing below basic quality heuristic.
FR14: Operator can select a concrete store in Settings (default д. Алабино, 92); not prompted before every Menu; v1 chain single grocery chain only.
FR15: At planning time, do not suggest/assign Recipe if any Critical ingredient lacks an in-stock Checked-match variant; no stock-badge UI.
FR16: On catalog sync failure or stale catalog, show explicit stale warning and block Menu planning until a fresh sync succeeds.
FR17: Build one combined Shopping list from Menu CheckedMatch Products plus default staples.
FR18: Shopping list is always copyable; copy alone is enough to buy outside the app.
FR19: Optional store link when available; never the only purchase path; transport format TBD.
FR20: Show price/nutrition only when catalog provides them; never fabricate.
FR21: Sign-in with login+password; unauthenticated users cannot access Menus or personal history.
FR22: Operator can open Recipe text from Menu, History, or Shopping list anytime; no cook-along/timers.
FR23: UJ-1 flow gate — Create Menu → slot edit → Portion plan → Shopping list; cannot skip slot edit to Shopping list.
FR24: History surface lists past Menus/Recipes for review and Rating; feeds AI cook-recency / Rating weights (not a manual slot-pick UI).
FR25: Post sign-in lands on Create Menu / planning (not empty dashboard).
FR26: Lunch/dinner second course targets Harvard plate coverage — protein, vegetables, and carb (via separate Slot dishes and/or multi-role Recipes).
FR27: Lunch meal template always includes a soup Plate role.
FR28: Meal templates and required Plate roles are decided in application code; AI invents/fills Recipe content for those roles, not free-form meal architecture.
FR29: All meal types (including breakfast and snacks) persist through the same Slot dish + Plate role structure.

### NonFunctional Requirements

NFR1: Desktop web first; no mobile layout requirement in v1.
NFR2: UI copy in Russian; domain ids English in code (glossary).
NFR3: Light mode only in v1 — no dark tokens.
NFR4: Accessibility floor — keyboard operable controls, visible focus rings, stale warning not color-only; no elevated a11y program beyond that.
NFR5: Auth via Supabase email/password; RLS on user-owned rows; catalog readable by authenticated users, writable only by sync service role.
NFR6: Secrets (OpenRouter, service role, store credentials) never ship to the browser.
NFR7: Single operator / single prod (+ local against that Supabase); no required staging matrix for v1.
NFR8: App does not promise perfect assortment or replace the store; purchase completes outside the app.
NFR9: Dates ISO-8601 UTC in DB; display Europe/Moscow in UI.
NFR10: Soft Workshop / Lavender Workshop brand layer on shadcn; Geist Sans locked for v1.

### Additional Requirements

- Starter: `create-next-app -e with-supabase`, then upgrade Tailwind to 4.x, align folder layout to Structural Seed, retarget deploy to Dokploy, add `sync/`.
- Runtime topology (AD-1): Next + Python catalog-sync on Dokploy; Supabase Cloud for Auth/Postgres/RLS; Dokploy Schedule Jobs for sync; Node.js ≥22.
- Catalog write ownership (AD-2): only Python sync worker writes catalog/availability/`catalog_sync_runs` (service role); Next reads catalog; unofficial `store-catalog-api` behind store-adapter (the store v1).
- Matching & eligibility (AD-3, AD-7, AD-10): Next server matching module; Menu-scoped normalized `CheckedMatch` table; eligibility gates suggest and assign/replace; reuse/clone must re-run matching (not copy matches) if/when implemented later.
- AI (AD-4): OpenRouter from Next server only; model id runtime config; Refusal/dislike hard-suppress inside suggestion module.
- Auth (AD-5): `@supabase/ssr` cookie sessions; protect planning routes with `getUser()`.
- Dependency direction (AD-6): `supabase/migrations` is schema SoT; no Next↔sync reverse imports; no parallel hand-owned DTOs that rename columns.
- Store context (AD-9): Settings `selected_store_id`; Menu snapshots `store_id` at creation; changing Settings does not rewrite past Menus.
- Catalog stale signal (AD-8): FR-16 warning reads latest `catalog_sync_runs` for active store.
- Shopping list handoff (AD-11): `buildShoppingList(menuId)` materializes snapshot from CheckedMatch + default staples; no in-app list edit; regenerate replaces snapshot.
- Stack versions per Architecture Spine table (Next 16.2.10, React 19.2.7, Tailwind 4.3.3, Supabase JS 2.110.7, store-catalog-api 0.2.2, Python ≥3.10, etc.).
- Structural seed: `app/`, `src/domain/`, `src/lib/supabase/`, `sync/`, `supabase/`.
- Non-goals in code: no in-app cart edit, stock badges, fallback-after-planning flow, cook-along timers, match-review UI, ready packs, UJ-2 reuse surface in v1 UI (PRD FR-9 deferred post-MVP; aligned 2026-07-20).

### UX Design Requirements

UX-DR1: Implement Lavender Workshop color tokens from DESIGN.md frontmatter (background, surface, foreground, muted, primary, accent, border, warning-*, empty-slot, slot-label, snacks-border) on shadcn/Tailwind; inherit unlisted shadcn tokens.
UX-DR2: Implement Soft Workshop radii (sm 10 / md 12 / lg 14 / xl 16 / full) and spacing roles (page-gutter, content-padding, card-padding, slot-padding-y, grid-gap, section-gap).
UX-DR3: Implement typography roles: page-title, section-title, day-head, slot-label, slot-name, body-sm, caption on Geist Sans; Russian UI copy in workshop voice per EXPERIENCE Voice table.
UX-DR4: App chrome W1 — global header (L3 mark + Keplo · CTA «Создать меню» · История · Настройки · Выйти) separate from wizard bar (`Новое меню · Меню · Список`); wizard hidden on History/Settings. (Supersedes earlier «Дни · Меню · План порций · Shopping list» in one header group.)
UX-DR5: `day-length-picker` on Create Menu — 1–4 days; primary CTA triggers generation; store not re-prompted here.
UX-DR6: Model C `slot-card` / `day-card` grid — day × breakfast/lunch/dinner; empty slot state; actions: AI resuggest, Refusal, clear; Recipe name opens recipe-text-panel. No manual History-pick control in v1.
UX-DR7: `snacks-bar` + `snack-chip` aggregate below day grid for no-cook Snacks.
UX-DR8: `portion-plan-grid` — day × meal servings; default 2 people × 3 meals; editable before Shopping list.
UX-DR9: `shopping-list-cta` — always-available copy; optional secondary store link; staples on list by default with calm copy that user filters in the store; external handoff labeled outside app.
UX-DR10: `warning-stale` banner on Create Menu, slot edit, Portion plan when catalog non-fresh; Menu planning actions blocked until fresh sync.
UX-DR11: `store-picker` in Settings — concrete store list; default д. Алабино, 92; set once.
UX-DR12: `history-rating-row` — like/dislike + reason; editable after submit; empty History routes to Create Menu.
UX-DR13: `recipe-text-panel` as Dialog (one modal depth); Esc closes without discarding Menu; opens from Menu/History/Shopping list.
UX-DR14: State treatments — cold-load Skeleton; generating disables day-length-picker; copy success «Список скопирован.»; store link absent does not block copy.
UX-DR15: Interaction — desktop mouse primary + keyboard adequate; Tab order matches layout; focus rings visible; no hover-only critical actions; modal depth one level.
UX-DR16: Visual/UX non-goals — no match-review, fallback flow, ready packs, Pantry screen, stock badges, cook timer/duration UI, batch-component layer, dark mode, UJ-2 reuse surface.
UX-DR17: Every `slot-cell` shows ordered `slot-dish-line` rows with explicit Russian Plate role labels (Суп / Белок / Овощи / Углеводы / Основное / Перекус); multi-role one-pots show coverage on the line; overflow actions target a role.

### PRD ↔ Epics FR Crosswalk

Epics inventory IDs (FR1–FR29 below) are **not** always the same numbers as PRD `FR-1`…`FR-28`. Use this table for traceability.

| PRD | Epics inventory | Notes |
| --- | --------------- | ----- |
| FR-1 | FR1 | Create Menu |
| FR-2 | FR2 | Servings |
| FR-3 | FR3 | Assign meals (extended: Slot dishes + templates) |
| FR-4 | FR4 | Snacks (Slot dish role snack) |
| FR-5 | FR5 | Portion plan |
| FR-6 | FR6 | Slot AI replace; long-idle in Story 2.3 |
| FR-7 | FR7 | AI suggestions |
| FR-8 | FR8 | Refusal |
| FR-9 | — | **Deferred post-MVP** (UJ-2 Menu reuse) — not in v1 stories |
| FR-10 | FR9 | Rating |
| FR-11 | FR10 | Checked matches |
| FR-12 | FR7 / FR10 | Gate new AI Recipes (merged into suggest + match) |
| FR-13 | FR11 | Pantry default on list |
| FR-14 | FR12 | Fridge-keep |
| FR-15 | FR13 | Cheaper analogs |
| FR-16 | FR14 | Select store |
| FR-17 | FR15 | Buyable today |
| FR-18 | FR16 | Stale catalog |
| FR-19 | FR17 | Build Shopping list |
| FR-20 | FR18 | Copy list |
| FR-21 | FR19 | Optional store link |
| FR-22 | FR20 | Price/nutrition when present |
| FR-23 | FR21 | Auth |
| FR-24 | FR22 | Recipe text |
| (UX) | FR23 | UJ-1 flow gate |
| (UX) | FR24 | History surface |
| (UX) | FR25 | Post sign-in → Create Menu |
| FR-25 | FR26 | Harvard plate composition |
| FR-26 | FR27 | Lunch soup Plate role |
| FR-27 | FR28 | Code-structured suggestions |
| FR-28 | FR29 | Uniform Slot dish model |
| (UX) | UX-DR17 | Role-labeled slot-dish-line |

### FR Coverage Map

FR1: Epic 2 — Create Menu by day length + suggestions
FR2: Epic 3 — Configure servings (default 3×2)
FR3: Epic 2 (baseline slots) + Epic 6 — Slot dishes / meal templates / Harvard + soup
FR4: Epic 2 (baseline snacks) + Epic 6 — snacks as Slot dishes (role snack)
FR5: Epic 3 — View/adjust Portion plan
FR6: Epic 2 — Slot replace via AI resuggest; AI reuses long-idle Recipes by Rating weight
FR7: Epic 2 — AI suggestions (cook recency/Refusal/Rating, Model C)
FR8: Epic 2 — Record Refusal (hard-suppress)
FR9: Epic 4 — Rate Recipe/Snack from History
FR10: Epic 2 — Checked-match eligibility
FR11: Epic 2 — Pantry/staples catalog eligibility gate; Epic 3 — staples appear as Shopping list lines by default
FR12: Epic 2 — Fridge-keep vs Menu length
FR13: Epic 2 — Medium cheaper-analog preference
FR14: Epic 1 — Select store in Settings
FR15: Epic 2 — Today-stock gate
FR16: Epic 1 — Stale catalog warning + block planning until fresh sync
FR17: Epic 3 — Build combined Shopping list
FR18: Epic 3 — Always copy Shopping list
FR19: Epic 3 — Optional store link
FR20: Epic 3 — Price/nutrition when present
FR21: Epic 1 — Login/password auth
FR22: Epic 4 — View Recipe text
FR23: Epic 2 + Epic 3 — UJ-1 flow gate (slot edit then Portion plan → list)
FR24: Epic 4 — History surface
FR25: Epic 1 — Post sign-in lands on Create Menu / planning
FR26: Epic 6 — Harvard plate coverage for lunch/dinner second course
FR27: Epic 6 — Lunch soup Plate role
FR28: Epic 6 — Code-structured meal templates; AI fills role slots
FR29: Epic 6 — Uniform Slot dish model for all meal types
UX-DR17: Epic 6 — Role-labeled slot-dish-line UI

## Epic List

### Epic 1: Sign in, workspace & store catalog
Operator can sign in, land on the Soft Workshop planning shell, select a store store once in Settings, and plan against a fresh synced catalog — with an explicit stale warning that blocks Menu planning when sync is stale or failed.
**FRs covered:** FR14, FR16, FR21, FR25

### Epic 2: Plan a buyable Menu
Operator picks 1–4 days, receives AI Recipe suggestions that only include buyable Checked-match Recipes (including long-idle dishes weighted by Rating), edits day×meal slots via AI resuggest, adds Snacks, and records Refusals — without skipping slot edit.
**FRs covered:** FR1, FR3, FR4, FR6, FR7, FR8, FR10, FR11, FR12, FR13, FR15, FR23 (through slot edit)

### Epic 3: Portion plan & Shopping list handoff
Operator sets servings on the Portion plan and leaves with one combined, always-copyable Shopping list (staples included by default) plus an optional store link — never blocked if the link is missing.
**FRs covered:** FR2, FR5, FR17, FR18, FR19, FR20, FR23 (Portion plan → Shopping list)

### Epic 4: History, ratings & recipe text
Operator reviews past Menus/Recipes in History, rates Recipes/Snacks (editable after submit), and opens Recipe text anytime from Menu, History, or Shopping list.
**FRs covered:** FR9, FR22, FR24

### Epic 5: App chrome alignment (post-MVP UX)
Operator gets W1 header/wizard chrome from finalized UX spines — brand mark + Keplo, Create Menu CTA, plan steps separated from global nav — without false active states on History/Settings.
**FRs covered:** UX-DR4 (revised 2026-07-20)

### Epic 6: Harvard plate meal composition
Operator gets a uniform Slot dish model for every meal type; lunch/dinner follow Harvard plate (lunch includes soup); complex one-pots cover multiple roles; AI invents into code-defined meal templates.
**FRs covered:** FR3 (extended), FR4 (extended), FR6, FR7, FR26–FR29, UX-DR17

## Epic 1: Sign in, workspace & store catalog

Operator can sign in, land on the Soft Workshop planning shell, select a store store once in Settings, and plan against a fresh synced catalog — with an explicit stale warning that blocks Menu planning when sync is stale or failed.

### Story 1.1: App shell with Soft Workshop brand

As a operator (Sergey),
I want a Next.js app with Soft Workshop / Lavender Workshop styling and a Russian planning shell that lands on Create Menu after I am signed in,
So that I have a real workspace to build Menus in, not an empty dashboard.

**Acceptance Criteria:**

**Given** a greenfield repo
**When** the project is initialized from `create-next-app -e with-supabase`, upgraded to Tailwind 4.x, and laid out per Architecture Structural Seed (`app/`, `src/lib/supabase/`, `supabase/`)
**Then** the app runs locally against Supabase Auth/DB clients
**And** Lavender Workshop tokens from DESIGN.md are applied (background, surface, primary `#4338CA`, accent, border, warning-*, empty-slot, radii sm/md/lg)
**And** Geist Sans is used; light mode only; UI copy is Russian
**And** authenticated home shows Create Menu / planning landing with pill-nav placeholders (Дни · Меню · План порций · Shopping list) — not an empty dashboard (FR25, UX-DR1–4)

**Given** an unauthenticated visitor
**When** they open a planning route
**Then** they are redirected toward sign-in (full auth completes in Story 1.2 if only stubbed here)

### Story 1.2: Login and password

As a operator (Sergey),
I want to sign in with login and password,
So that my Menus and personal history are available only to me.

**Acceptance Criteria:**

**Given** an unauthenticated user
**When** they open any planning, History, or Settings route
**Then** they cannot access Menus or personal history and are shown the sign-in surface (FR21)

**Given** valid login and password for the operator account
**When** they sign in via Supabase Auth email/password with `@supabase/ssr` cookie session
**Then** they land on Create Menu / planning (FR25)
**And** subsequent requests use `getUser()`-protected server access (AD-5)

**Given** authenticated user-owned tables
**When** RLS policies are applied
**Then** user-owned rows require `auth.uid()`; unauthenticated clients cannot read Menus/history (NFR5)

### Story 1.3: Store picker in Settings

As a operator (Sergey),
I want to select a concrete store once in Settings (default д. Алабино, 92),
So that catalog and stock are for my store without being asked before every Menu.

**Acceptance Criteria:**

**Given** an authenticated operator
**When** they open Settings and use `store-picker`
**Then** they select a concrete store from a list (not free-text address) (FR14, UX-DR11)

**Given** a new operator with no prior preference
**When** Settings / store context is initialized
**Then** the default selected store is д. Алабино, 92 (FR14, AD-9)

**Given** `UserSettings.selected_store_id` is saved
**When** the operator starts a new Menu later
**Then** Create Menu does not re-prompt for store selection (FR14, UX-DR5)

**Given** `stores` (and user settings) tables needed for this story
**When** migrations are added
**Then** schema follows `supabase/migrations` as SoT; catalog remains readable by authenticated users per AD-5/AD-6

### Story 1.4: the store catalog sync worker

As a operator (Sergey),
I want my selected store’s Products and availability synced into the database on a schedule,
So that planning can use a real assortment for that store.

**Acceptance Criteria:**

**Given** the Architecture Structural Seed
**When** a Python sync worker is added under `sync/` with a store-adapter wrapping `store-catalog-api`
**Then** only the sync worker writes catalog/availability and `catalog_sync_runs` via service role (AD-2)
**And** Next never fetches the store site APIs for catalog writes (AD-2, AD-6)

**Given** a configured store (e.g. default д. Алабино, 92)
**When** a sync run completes successfully
**Then** `products` (and related availability field) are updated for that store
**And** a `catalog_sync_runs` row records the run for stale detection (AD-8)

**Given** Dokploy Schedule Jobs (or local manual invoke for dev)
**When** sync is scheduled
**Then** ingest is not implemented via GitHub Actions or Supabase Cron (AD-1)

**Given** an authenticated Next app
**When** it needs catalog data for planning
**Then** it reads Products from Supabase only (AD-2)

### Story 1.5: Block planning on stale catalog

As a operator (Sergey),
I want Menu planning blocked when catalog sync is stale or failed, with an explicit stale warning,
So that I do not build a Menu against a dead assortment.

**Acceptance Criteria:**

**Given** the latest `catalog_sync_runs` row for the active store indicates failure or non-fresh data (AD-8)
**When** the operator is on Create Menu, slot edit, or Portion plan
**Then** `warning-stale` is shown with explicit Russian copy that the catalog is outdated (FR16, UX-DR10)
**And** Menu planning actions are blocked (e.g. generate Menu / continue planning CTAs disabled or rejected) — planning does not proceed on last-saved catalog alone

**Given** a successful fresh sync for the active store
**When** the operator returns to Create Menu / planning
**Then** `warning-stale` is cleared for that session state
**And** Menu planning actions are enabled again

**Given** catalog tables remain readable
**When** planning is blocked
**Then** Settings and sign-out remain available so the operator can wait for sync or change store context

## Epic 2: Plan a buyable Menu

Operator picks 1–4 days, receives AI Recipe suggestions that only include buyable Checked-match Recipes (including long-idle dishes weighted by Rating), edits day×meal slots via AI resuggest, adds Snacks, and records Refusals — without skipping slot edit.

### Story 2.1: Create Menu skeleton by day length

As a operator (Sergey),
I want to choose 1–4 days and get a Menu skeleton with breakfast/lunch/dinner slots per day,
So that I can fill a multi-day plan without building slots from scratch first.

**Acceptance Criteria:**

**Given** an authenticated operator with a fresh catalog (Story 1.5 allows planning)
**When** they use `day-length-picker` and create a Menu for 1, 2, 3, or 4 days
**Then** a Menu is persisted with `store_id` snapshotted from Settings (AD-9)
**And** each day has breakfast, lunch, and dinner slots (Model C); empty slots are allowed (FR1, FR3, UX-DR5–6)

**Given** Recipe domain tables needed for later fill
**When** migrations add `Recipe` with fridge-keep and related ingredient structures as required by this skeleton
**Then** only tables needed for Menu/MenuSlot (and minimal Recipe reference) are created now — not the full matching pipeline (FR12 prep)

**Given** the Create Menu surface
**When** day length is selected
**Then** the primary path does not require manually assembling every slot before a Menu exists (FR1)
**And** UI is Russian Soft Workshop `day-length-picker` / day-card chrome (UX-DR5–6)

### Story 2.2: Buyable matching and eligibility

As a operator (Sergey),
I want Recipes eligible for a Menu only when Critical ingredients have in-stock Checked-match Products,
So that I do not plan dishes I cannot buy today.

**Acceptance Criteria:**

**Given** Critical ingredients on a Recipe and Products in the active store catalog
**When** the Next matching module runs for a Menu
**Then** it creates Menu-scoped normalized `CheckedMatch` rows (AD-3, AD-7)
**And** a Recipe is blocked from suggest/assign if any Critical ingredient lacks a Checked match (FR10)

**Given** multiple suitable Product variants for an ingredient
**When** the matcher chooses among in-stock variants
**Then** it prefers a cheaper suitable analog at medium aggressiveness without collapsing below the basic quality heuristic (FR13, FR15)
**And** if no in-stock variant exists for a Critical ingredient, the Recipe is not suggested or assignable (FR15)

**Given** pantry/staple Products required for eligibility
**When** a required pantry Product is missing from the catalog
**Then** the Recipe can be ineligible (FR11 gate only — list lines come in Epic 3)

**Given** Menu length N days and Recipe fridge-keep
**When** eligibility is evaluated
**Then** Recipes with fridge-keep shorter than N cannot be assigned; shortest selected fridge-keep caps allowable length (FR12)

**Given** matching results
**When** the operator views planning UI
**Then** there is no match-review UI; Products surface later on the Shopping list (FR10)

### Story 2.3: AI generate buyable Menu

As a operator (Sergey),
I want to press generate and receive Recipes for my chosen days,
So that I do not assemble the Menu by hand.

**Acceptance Criteria:**

**Given** a Menu skeleton and fresh catalog
**When** the operator triggers generate (`Сгенерировать`)
**Then** Next server calls OpenRouter only (no client LLM keys) (AD-4, FR7)
**And** suggestions consider cook recency, Refusals, and Ratings when present
**And** bias is simple home batch food (Model C); repeating sides across days is allowed (~20% variety enough) (FR7, UX-DR6)

**Given** cook history with last-cooked timestamps (or equivalent Menu assignment dates) for Recipes
**When** AI generates or resuggests slots
**Then** Recipes not cooked for approximately 2+ weeks are eligible candidates for reintroduction (FR6, FR7)
**And** there is no manual “pick from History” control required for this behavior in v1

**Given** Ratings on past Recipes
**When** ranking long-idle candidates during generate/resuggest
**Then** highly liked Recipes are weighted to appear somewhat more often than medium-rated ones
**And** Refusal and dislike remain hard-suppress (never reintroduced) (FR8, FR9)

**Given** AI-proposed Recipes (library or newly proposed), including long-idle reintroductions
**When** they are assigned to slots
**Then** each passes Story 2.2 matching + today-stock + fridge-keep gates before assignment (FR7, FR10, FR12, FR15)
**And** refused or dislike-rated items are hard-suppressed from suggestions when those records exist (FR7, FR8, FR9 prep)

**Given** generation in flight
**When** the Create Menu / slot-edit UI is shown
**Then** primary CTA shows loading and `day-length-picker` is disabled until success or error (UX-DR14)

### Story 2.4: Edit slots with UJ-1 gate

As a operator (Sergey),
I want to edit breakfast/lunch/dinner after generation and only then continue,
So that the Menu is mine, not a blind autopilot result.

**Acceptance Criteria:**

**Given** a generated Menu
**When** the operator is on Menu + slot edit
**Then** they see Model C `day-card` / `slot-card` grid; empty slots are allowed (FR3, UX-DR6)
**And** slot actions include AI resuggest, Refusal, and clear — no separate Recipe library browse and no manual History-pick control (FR6, UX-DR6)

**Given** the UJ-1 flow
**When** the operator tries to jump from Create/generate to Shopping list without slot edit
**Then** the flow blocks that skip; they must pass slot edit before Portion plan (FR23)

**Given** a slot replace via AI resuggest
**When** a new Recipe is chosen
**Then** it must pass Story 2.2 eligibility before assignment (FR10, FR15)
**And** CheckedMatch rows for that slot are re-run (AD-10)

### Story 2.5: Add Snacks to Menu

As a operator (Sergey),
I want to add no-cook Snacks to the same Menu,
So that they join the same Order without a cook session.

**Acceptance Criteria:**

**Given** a Menu on slot edit
**When** the operator adds Snacks via `snacks-bar` / `snack-chip`
**Then** Snacks are persisted on the Menu and shown in the dashed snacks aggregate (FR4, UX-DR7)

**Given** Snacks on the Menu
**When** Shopping list is built later (Epic 3)
**Then** Snack Products are included in the same list/order
**And** Snacks do not require a cook session (FR4)

### Story 2.6: Record Refusal

As a operator (Sergey),
I want to refuse a Recipe before cooking,
So that it is not suggested again.

**Acceptance Criteria:**

**Given** a Recipe on a Menu slot
**When** the operator records a Refusal
**Then** the Refusal is stored against that Recipe (FR8)
**And** the slot is cleared or marked refused per UX slot-card behavior

**Given** a refused Recipe
**When** AI suggestions run later
**Then** that Recipe is hard-suppressed (not merely demoted) in v1 (FR8, AD-4)

## Epic 3: Portion plan & Shopping list handoff

Operator sets servings on the Portion plan and leaves with one combined, always-copyable Shopping list (staples included by default) plus an optional store link — never blocked if the link is missing.

### Story 3.1: Portion plan by day and meal

As a operator (Sergey),
I want to see and adjust servings by day and meal (default two people × three meals),
So that food covers the whole Menu.

**Acceptance Criteria:**

**Given** a Menu that has passed slot edit
**When** the operator opens Portion plan
**Then** `portion-plan-grid` shows every day × breakfast/lunch/dinner, including empty slots (FR5, UX-DR8)
**And** new Menu defaults are 3 meals/day × 2 people (FR2)

**Given** editable servings
**When** the operator changes counts before Shopping list
**Then** values persist on the Menu and are used for later list quantities (FR2, FR5)
**And** Portion plan is visible without checkout (FR5)
**And** UJ-1 continues from slot edit → Portion plan → Shopping list (FR23)

### Story 3.2: Build Shopping list snapshot

As a operator (Sergey),
I want one combined Shopping list for the Menu with staples included by default,
So that I can go buy without rebuilding the cart by hand.

**Acceptance Criteria:**

**Given** a Menu with CheckedMatch rows and optional Snacks
**When** `buildShoppingList(menuId)` runs
**Then** it materializes a Shopping list snapshot from CheckedMatch Products plus default staple/pantry lines (FR11 list side, FR17, AD-11)
**And** there is no per-item in-app pantry opt-in prompt and no in-app list editing as primary path

**Given** the Shopping list surface
**When** the operator views it
**Then** Product names are shown (not match jargon); calm copy notes staples can be filtered at the store (UX-DR9)
**And** regenerating after slot/match changes replaces the snapshot (AD-11)

### Story 3.3: Copy Shopping list

As a operator (Sergey),
I want to always copy the Shopping list,
So that I can buy even when no store link exists.

**Acceptance Criteria:**

**Given** a materialized Shopping list
**When** the operator uses `shopping-list-cta` copy
**Then** the list is copied to the clipboard (FR18, UX-DR9)
**And** copy works even if no store link is available (FR18, FR19)

**Given** a successful copy
**When** confirmation is shown
**Then** Russian copy is calm (e.g. «Список скопирован.») and the list remains visible (UX-DR14)

### Story 3.4: Optional store link

As a operator (Sergey),
I want to open a store link when one works,
So that handoff is faster — while copy remains the reliable path.

**Acceptance Criteria:**

**Given** a working the store link can be produced
**When** the operator uses the secondary store-link control
**Then** it opens outside the app (new tab) and is labeled as external (FR19, UX-DR9, UX-DR15)

**Given** the link is missing or broken
**When** the Shopping list handoff is shown
**Then** planning and copy are not blocked; the link control is hidden or disabled with a plain explanation — not an error wall (FR18, FR19)
**And** exact link transport format may be TBD at implementation (open question)

### Story 3.5: Price and nutrition when present

As a operator (Sergey),
I want to see price and nutrition only when the catalog provides them,
So that the app never invents numbers.

**Acceptance Criteria:**

**Given** catalog fields for price and/or nutrition on a Product or Recipe
**When** those fields are present
**Then** the Shopping list (and related views) may display them (FR20)

**Given** missing price or nutrition fields
**When** the Shopping list is built or shown
**Then** missing values are omitted — not fabricated — and the list is not blocked (FR20)

## Epic 4: History, ratings & recipe text

Operator reviews past Menus/Recipes in History, rates Recipes/Snacks (editable after submit), and opens Recipe text anytime from Menu, History, or Shopping list.

### Story 4.1: History of Menus and Recipes

As a operator (Sergey),
I want to see past Menus and Recipes,
So that I can recall what I cooked and leave Ratings.

**Acceptance Criteria:**

**Given** an authenticated operator with past Menus
**When** they open History from primary nav
**Then** past Menus/Recipes are listed for review (FR24, UX-DR12)
**And** History feeds AI cook-recency / Rating weights (Epic 2) — it is not a manual slot-pick UI

**Given** no past Menus
**When** History is empty
**Then** empty state routes to Create Menu — not a Recipe library browse (UX-DR12, UX-DR14)

### Story 4.2: Rate Recipe or Snack

As a operator (Sergey),
I want to leave like/dislike plus a reason after trying a Recipe or Snack,
So that AI uses that later (dislike never suggested again).

**Acceptance Criteria:**

**Given** a past Recipe or Snack in History
**When** the operator uses `history-rating-row`
**Then** they can set like/dislike and a reason from: too hard, not tasty, too long, other (FR9, UX-DR12)

**Given** a dislike Rating
**When** AI suggestions run later
**Then** that item is hard-suppressed from suggestions in v1 (FR9)

**Given** a submitted Rating
**When** the operator returns to History
**Then** the Rating remains editable after submit; no forced post-cook interrupt screen (FR9, UX-DR12)

### Story 4.3: View Recipe text

As a operator (Sergey),
I want to open Recipe text from Menu, History, or Shopping list,
So that shopping and cooking are easier — without a cook-along mode.

**Acceptance Criteria:**

**Given** a Recipe name on Menu, History, or Shopping list
**When** the operator opens it
**Then** `recipe-text-panel` shows full Recipe text as a Dialog (one modal depth) (FR22, UX-DR13)

**Given** the panel is open
**When** the operator presses Esc
**Then** the panel closes without discarding saved Menu state (UX-DR13, UX-DR15)

**Given** cooking aid scope for v1
**When** Recipe text is available
**Then** there are no step timers or guided cook-along flows (FR22, UX-DR16)

## Epic 5: App chrome alignment (post-MVP UX)

Bring authenticated shell chrome in line with finalized W1 UX (2026-07-20): split global header from wizard steps, L3 + Keplo brand, rename step 0 to «Новое меню», hide wizard off-plan.

### Story 5.1: W1 header and wizard chrome

As a operator (Sergey),
I want the app header and plan stepper to match the W1 UX chrome,
So that Create Menu, History, and plan steps do not fight for the same active state and the brand is clear.

**Acceptance Criteria:**

**Given** an authenticated operator on any planning surface (`/`, `/plan/menu`, `/plan/shopping-list`)
**When** the shell renders
**Then** global header shows L3 brand-mark + wordmark **Keplo** (no subtitle under brand), CTA «Создать меню», links «История» / «Настройки», and «Выйти»
**And** a wizard bar under the header shows pills `Новое меню · Меню · Список` with correct active step
**And** «Создать меню» is a primary-styled CTA in the global header — not a plain text twin of the wizard step (UX-DR4, DESIGN W1)

**Given** the operator is on History or Settings
**When** the shell renders
**Then** the wizard bar is **absent**
**And** no plan step (including «Новое меню») appears active
**And** the matching global link is marked current (UX-DR4, EXPERIENCE Off-plan surface)

**Given** UJ-1 slot-edit gate
**When** `slot_edit_passed` is false or `menuId` is missing
**Then** «Список» remains blocked as today (title / aria-disabled)
**And** this story does not change gate semantics — only chrome placement/labels (FR23)

**Given** visual contract
**When** comparing to `mockups/mock-header-nav-w1-2026-07-20.html`
**Then** layout matches W1 (two rows; Soft Workshop / Lavender tokens; pill active styles unchanged in spirit)
**And** older mocks that put pills inside the global header are ignored for chrome

## Epic 6: Harvard plate meal composition

Bring every meal onto a uniform Slot dish + Plate role model; lunch always has soup plus a Harvard second course; dinner is Harvard only; breakfast and snacks use simpler templates on the same structure; AI fills code-emitted role slots; UI labels each dish’s role.

**Meal templates (code-owned, v1):**
- breakfast / second_breakfast: `[main]`
- lunch: `[soup, protein, veg, carb]`
- dinner / late_dinner: `[protein, veg, carb]`
- snack / перекус: `[snack]`

### Story 6.1: Slot dish roles schema and meal templates

As an operator (Sergey),
I want every meal to store role-labeled Slot dishes (including breakfast and snacks) with composition rules for Harvard plate and lunch soup,
So that the plan data matches how I eat and complex one-pots do not spawn duplicate sides.

**Acceptance Criteria:**

**Given** a Menu with breakfast, lunch, dinner, and snack meals selected
**When** slots are persisted
**Then** each meal uses the same Slot dish persistence (`MenuSlot` → `MenuSlotDish[]` with Plate role + Recipe/item ref)
**And** breakfast/second_breakfast template is `[main]`; snack template is `[snack]`; lunch is `[soup, protein, veg, carb]`; dinner/late_dinner is `[protein, veg, carb]` (FR3, FR27, FR29)

**Given** a multi-role Recipe (e.g. plov) with `coversRoles` including protein and carb
**When** composition rules run for lunch or dinner
**Then** separate Slot dishes are not required for already-covered roles
**And** uncovered required roles remain available to fill (FR26)

**Given** existing menus that used `recipe_id` / `companion_recipe_id` and/or ad-hoc `menu_snacks`
**When** migration/adapters run
**Then** load, shopping list, and history can read the new Slot dish shape without dropping assigned dishes (FR17 path preserved)

**Given** domain verify scripts
**When** composition matrix cases run
**Then** lunch soup role presence, Harvard coverage, breakfast/snack templates, and coversRoles skip-duplicate behavior PASS

### Story 6.2: Template-driven AI invent and assign

As an operator (Sergey),
I want generation to fill a fixed meal structure decided in code,
So that the model spends capacity on suitable recipes, not inventing meal architecture.

**Acceptance Criteria:**

**Given** create-menu or resuggest invent runs for selected meals
**When** the planner expands work for the AI
**Then** role slots are emitted from meal templates in code before invent/expand
**And** prompts ask for Recipe content per role slot (and optional coversRoles), not free-form `plateKind` meal architecture (FR28, FR7)

**Given** lunch is in the meal selection
**When** invent+assign completes successfully
**Then** the lunch template includes a soup role and Harvard second-course roles (protein, veg, carb), subject to coversRoles compression (FR26, FR27)

**Given** dinner is in the meal selection
**When** invent+assign completes successfully
**Then** dinner has Harvard second-course roles and no soup role requirement (FR26)

**Given** Refusal / dislike hard-suppress and fridge-keep eligibility
**When** invent/assign places Recipes into role slots
**Then** those gates still apply on every path (FR6, FR7, FR8, AD-3/AD-4)

**Given** a complex one-pot that covers multiple roles
**When** assign normalizes the plate
**Then** duplicate invent/assign for covered roles is skipped

### Story 6.3: Role-labeled Menu UI and per-role edit

As an operator (Sergey),
I want each dish line to show its Plate role clearly and to replace one role without breaking the whole meal,
So that I always know what each dish is for.

**Acceptance Criteria:**

**Given** a filled lunch or dinner `slot-cell`
**When** the Menu meal-lane renders
**Then** each Slot dish appears as a `slot-dish-line` with Russian role label (Суп / Белок / Овощи / Углеводы) and dish name (UX-DR17)
**And** multi-role one-pots show coverage on the line (e.g. «Белок · Углеводы»)

**Given** breakfast or snack `slot-cell`
**When** the Menu renders
**Then** the same `slot-dish-line` chrome is used (labels Основное / Перекус) — not a separate widget class (FR29, UX-DR17)

**Given** `slot-overflow` on a role line
**When** the operator chooses replace or Refusal
**Then** the action targets that Plate role / dish (FR6, FR8)
**And** UI copy does not narrate abandoned companion/гарнир scope

**Given** empty roles
**When** the cell renders
**Then** empty role lines remain valid (empty slots/roles allowed) and the operator can still proceed toward Shopping list per UJ-1
