---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 2.3: AI generate buyable Menu

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want to press generate and receive Recipes for my chosen days,
So that I do not assemble the Menu by hand.

## Acceptance Criteria

1. **Given** a fresh catalog and day length 1–4  
   **When** the operator triggers generate (`Сгенерировать`)  
   **Then** Next creates a Menu skeleton (reuse Story 2.1 path) and fills breakfast/lunch/dinner slots via AI suggestions  
   **And** OpenRouter is called only from Next server code — no `NEXT_PUBLIC_*` LLM keys, no browser fetch to OpenRouter (AD-4, FR7)  
   **And** bias is simple home batch food (Model C); repeating sides/dishes across days is allowed (~20% variety enough) (FR7, UX-DR6)

2. **Given** cook history (last Menu assignment dates for Recipes for this user)  
   **When** suggestions run  
   **Then** Recipes not assigned for approximately **14+ days** are eligible candidates for reintroduction (FR6, FR7)  
   **And** there is no manual “pick from History” control in v1

3. **Given** Ratings / Refusals when those rows exist  
   **When** ranking candidates during generate  
   **Then** highly liked Recipes are weighted to appear somewhat more often than medium-rated ones  
   **And** Refusal and dislike Rating are **hard-suppressed** in the **same** suggestion module (never bypassed by a second path) (AD-4, FR8, FR9 prep)

4. **Given** AI-proposed Recipe ids (library candidates)  
   **When** they are assigned to slots  
   **Then** each passes Story 2.2 matching + today-stock + fridge-keep via `assertRecipeAssignable` (or equivalent) **before** `menu_slots.recipe_id` is set (FR7, FR10, FR12, FR15, AD-3, AD-10)  
   **And** CheckedMatch rows are persisted for assigned Recipes (Menu-scoped, AD-7)

5. **Given** generation in flight  
   **When** the Create Menu UI is shown  
   **Then** primary CTA shows loading copy and `day-length-picker` is disabled until success or error (UX-DR14)  
   **And** on success, `/plan/menu?menuId=` shows filled `slot-card`s (recipe name) for assigned slots; empty slots remain valid chrome

6. **Given** OpenRouter failure, missing `OPENROUTER_API_KEY`, or zero eligible library Recipes for this Menu  
   **When** generate cannot complete a useful plan  
   **Then** the operator sees a clear Russian Soft Workshop error (no raw SDK dump)  
   **And** planning is not left looking successful with a silently empty “generated” Menu (either no Menu created / Menu rolled back, or redirect with explicit error state — pick one, document it)

## Tasks / Subtasks

- [x] Schema: Refusal + Rating tables for suppress/weight hooks (AC: #3)
  - [x] Append migration under `supabase/migrations/` (do not edit 2.1/2.2 migrations)
  - [x] `recipe_refusals`: at least `id`, `user_id` → `auth.users`, `recipe_id` → `recipes`, `created_at`; unique `(user_id, recipe_id)`; RLS owner-only
  - [x] `recipe_ratings`: at least `id`, `user_id`, `recipe_id`, score or enum that can express **like / medium / dislike** (document mapping), `created_at`; unique `(user_id, recipe_id)`; RLS owner-only
  - [x] **No write UI** in this story (2.6 Refusal CTA; Epic 4 Rating) — tables exist so AD-4 suppress path is real, not a comment
  - [x] Do **not** invent `cook_history` table — use past `menu_slots.recipe_id` + owning `menus.created_at` (or `menus` timestamp) as last-cooked proxy

- [x] OpenRouter client + config (AC: #1, #6)
  - [x] Add `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to `.env.example` (server-only, never `NEXT_PUBLIC_`)
  - [x] Default model: cheap OpenAI-compatible slug via runtime config (e.g. a small/cheap catalog model — pin a concrete default in code + env override)
  - [x] Client under `src/lib/openrouter/` or `src/domain/suggestions/openrouter.ts` — `fetch` to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer …`; optional `HTTP-Referer` / `X-OpenRouter-Title`
  - [x] Prefer **no new npm dependency** (plain `fetch`); if adding `openai` SDK, pin version and still point `baseURL` at OpenRouter
  - [x] Fail clearly when key missing (typed error → Russian UI copy)

- [x] Domain suggestions module (AC: #1–#4, #6)
  - [x] Add `src/domain/suggestions/` per Architecture spine (`menu`, `matching`, `suggestions`)
  - [x] Recommended split:
    - `constants.ts` — `LONG_IDLE_DAYS = 14`, variety notes, dislike/refusal meaning
    - `history.ts` — last-assigned map per recipe for current user from past menus/slots
    - `suppress.ts` — load refusal ids + dislike rating ids; **hard filter** before LLM and before assign
    - `rank.ts` / `candidates.ts` — build candidate list: library recipes minus hard-suppress; annotate long-idle + rating weight; filter with `evaluateRecipeEligibility` (or match) against **this Menu** so LLM only sees buyable options
    - `openrouter-generate.ts` — prompt LLM with slots + candidate recipes (ids + names + meal hints); parse structured JSON assignment `{ slotId|day+meal → recipeId }`
    - `assign.ts` — for each proposed assignment: `assertRecipeAssignable` → update `menu_slots.recipe_id`; skip/retry alternate candidate on `RecipeIneligibleError` within same slot budget
    - `generate-menu.ts` — orchestration: ensure Menu exists → candidates → LLM → assign → return menuId
  - [x] **Library-only v1:** do **not** insert new `recipes` / `critical_ingredients` from LLM output. AI selects among pre-gated library ids. (FR12 “gate new AI Recipes” = when inventing later; inventing now without ingredients would always fail matching.)
  - [x] Repeating the same Recipe across days is allowed; do not force unique-per-slot
  - [x] Store SoT: Menu `store_id` snapshot (AD-9); freshness via matching/`assertCatalogFresh` (AD-8)
  - [x] Single suppress path inside suggestions (AD-4) — matching module must not reintroduce refused/disliked ids

- [x] Wire Create Menu CTA (AC: #1, #5, #6)
  - [x] Replace or extend `createMenuSkeletonAction` so primary path is **create skeleton + generate fill** (keep skeleton RPC; do not reimplement slot inserts in TS)
  - [x] Pending copy: e.g. «Генерируем…» (not only «Создаём…»); disable picker + CTA (`aria-busy`)
  - [x] Success → `redirect` `/plan/menu?menuId=` **outside** try/catch
  - [x] Failure → typed `{ ok: false, error: string }` Russian; document orphan-Menu policy (prefer: if generate fails before any assign, delete Menu or leave empty only if error is shown on Create form without fake success)
  - [x] Stale catalog still blocks via `planningBlocked` / freshness (do not weaken 1.5)

- [x] Filled day-card grid (AC: #5)
  - [x] Update `DayCardGrid` / `loadMenuSkeleton` to show recipe **name** when `recipeId` set; keep empty chrome when null
  - [x] Soft Workshop tokens only; no resuggest / Refusal / clear buttons yet (Story 2.4 / 2.6)
  - [x] Update `/plan/menu` copy — remove “слоты пока пустые… следующем шаге” when slots have recipes

- [x] Smoke / verification (AC: #1–#6)
  - [x] Pure-logic script: long-idle cutoff, hard-suppress filters, rating weight ordering (mirror domain like matching verify)
  - [x] Optional: mock OpenRouter (inject/fake client) for assign path without network
  - [x] RLS: anon denied on refusals/ratings
  - [x] Confirm no `NEXT_PUBLIC_OPENROUTER*`; key only server
  - [x] `npm run lint` / `npm run build` green
  - [x] Do **not** implement Shopping list, snacks-bar, UJ-1 skip gate polish, or slot AI-resuggest UI (2.4+)

## Dev Notes

### Epic context

Epic 2 — Plan a buyable Menu. **2.1–2.2 done** (skeleton + matching/eligibility). This story owns **first AI fill** of slots after Create Menu CTA.

**Long-idle:** former Story 2.7 was **merged into 2.3** (sprint-change-proposal 2026-07-20). Implement long-idle + rating weights **here** — no forward dependency.

Sibling boundaries:
- **2.1 (done):** skeleton RPC, day-length UI — reuse; extend action, don’t fork a second create path
- **2.2 (done):** call `assertRecipeAssignable` / matching public API before every assign
- **2.4:** slot edit actions (resuggest, clear), UJ-1 cannot skip to Shopping list
- **2.5 / 2.6:** Snacks; Refusal **recording** CTA (table may already exist from this story)
- **Epic 3 / 4:** Shopping list; History Rating UI

### Current code state (READ before editing)

**Exists:**
- CTA «Сгенерировать» → `createMenuSkeletonAction` → empty slots only (`src/components/menu/create-menu-form.tsx`)
- `DayCardGrid` **ignores** `recipeId` (always empty chrome) — deferred from 2.1 review; **this story fixes it**
- Matching public API: `assertRecipeAssignable`, `evaluateRecipeEligibility`, `matchAndPersistRecipe` (`src/domain/matching/index.ts`)
- Seed recipes: `SEED_RECIPE_LONG_KEEP_ID` / `SHORT_KEEP_ID` in matching constants — may be the only eligible set until catalog matches more
- Catalog gate: `getOperatorCatalogGate` / `assertCatalogFresh`

**Missing:**
- `src/domain/suggestions/`, OpenRouter client, env keys
- `recipe_refusals` / `recipe_ratings` tables
- Filled slot UI; true generate orchestration

### Technical requirements (MUST follow)

| Topic | Rule |
| --- | --- |
| AD-4 | OpenRouter from Next server only; one suggestion module owns suppress |
| AD-3 / AD-10 | Gate every assign/replace with matching module; rematch on assign via `assertRecipeAssignable` |
| AD-7 / AD-9 | Menu-scoped CheckedMatch; match against Menu store snapshot |
| AD-8 | Fresh catalog required; fail-closed |
| AD-6 | Domain → openrouter client → fetch; no sync imports |
| Errors | Typed domain errors + Russian UI boundary; never leak API keys |
| Library-only | LLM returns recipe **ids** from candidate list only; validate ids ∈ candidates before assign |
| JSON parse | Prefer JSON mode / strict schema in prompt; reject unknown recipe ids |

### Recommended generate flow

```text
Create Menu form submit(dayCount)
  → create_menu_skeleton RPC (existing)
  → buildCandidates(user, menu): suppress → eligibility filter → rank annotations
  → if candidates empty → fail (RU) + rollback policy
  → openRouter.chat(slots, candidates) → proposed map
  → for each proposal: assertRecipeAssignable → update menu_slots.recipe_id
  → redirect /plan/menu?menuId=
```

If eligible recipes < slot count: leave some slots empty and/or reuse recipes across days (both OK).

### Architecture compliance

- Spine folder: `src/domain/… suggestions`
- Config: `OPENROUTER_API_KEY` server/sync-only class of secrets
- Model id: runtime config (Spine deferred → resolve in this story)

[Source: `ARCHITECTURE-SPINE.md` — AD-3, AD-4, AD-6, AD-10, Config, Project structure]

### UX / brand

- Soft Workshop Russian; CTA label stays «Сгенерировать»
- Loading: disable `day-length-picker` + primary button (UX-DR14 / EXPERIENCE State Patterns)
- Filled `slot-card`: recipe name; empty still valid
- **No** History pick control; **no** match-review; **no** resuggest/Refusal buttons yet
- Stale: keep `warning-stale` + blocked CTA from 1.5

[Source: `EXPERIENCE.md` — Creating Menu, Generating Menu, slot-card]

### File structure requirements

**NEW (recommended):**

```text
supabase/migrations/YYYYMMDDHHMMSS_recipe_refusals_ratings.sql
src/lib/openrouter/client.ts          # or under domain/suggestions
src/domain/suggestions/constants.ts
src/domain/suggestions/history.ts
src/domain/suggestions/suppress.ts
src/domain/suggestions/candidates.ts
src/domain/suggestions/generate-menu.ts
src/domain/suggestions/assign.ts
src/domain/suggestions/errors.ts
src/domain/suggestions/index.ts
scripts/verify-suggestions-logic.mjs
```

**UPDATE:**
- `src/domain/menu/actions.ts` — generate orchestration entry
- `src/components/menu/create-menu-form.tsx` — loading copy
- `src/components/menu/day-card-grid.tsx` — filled slots
- `src/domain/menu/load-menu.ts` — include recipe names (join or second query)
- `app/(authenticated)/plan/menu/page.tsx` — copy
- `.env.example` — OpenRouter vars

**Do NOT implement:**
- Slot resuggest / clear / Refusal buttons (2.4 / 2.6)
- UJ-1 Shopping-list skip gate (2.4)
- Snacks (2.5)
- Shopping list snapshot (Epic 3)
- Client-side OpenRouter
- Service-role client in Next UI path
- New Recipe invention with hallucinated ingredients

### Library / framework requirements

- Next 16 / React 19 / Supabase JS 2.110 / session `createClient`
- OpenRouter: OpenAI-compatible Chat Completions `POST https://openrouter.ai/api/v1/chat/completions`
- Prefer zero new deps (`fetch`); document if SDK added

### Testing requirements

1. Hard-suppress: refused id never in candidate list  
2. Dislike rating hard-suppress  
3. Long-idle: recipe last assigned 15 days ago flagged; 7 days ago not  
4. Like weight: higher score sorts/annotates above medium (deterministic unit test)  
5. Unknown LLM recipe id rejected  
6. Assign path calls matching gate (integration or stub)  
7. Anon RLS deny on new tables  
8. Lint/build green  

### Previous story intelligence

**From 2.2 (done):**
- Use `assertRecipeAssignable` — it persists matches; throws `RecipeIneligibleError`
- Whole-token name match; paginated catalog; atomic `replace_checked_matches`
- Empty / pantry-only ingredient sets → `missing_match`
- Seed recipes may be few — generate must handle sparse eligible set (empty slots OK; zero eligible → error)

**From 2.1 (done):**
- `redirect` outside try/catch; typed `{ ok, error }`; RPC `create_menu_skeleton`
- Soft Workshop day-length pending pattern already exists — extend copy for AI
- DayCardGrid empty-chrome deferral owned by **this** story

**From 1.5:**
- Never weaken stale gate

### Git intelligence summary

Single commit `e20cd4b Init`; Epic 1–2.2 live in working tree. Follow `src/domain/<area>/` + append-only migrations + verify scripts pattern.

### Latest tech information

- OpenRouter auth: `Authorization: Bearer $OPENROUTER_API_KEY` (keys typically `sk-or-…`)
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Model slug format: `provider/model` (configurable via `OPENROUTER_MODEL`)
- Optional ranking headers: `HTTP-Referer`, `X-OpenRouter-Title` (not required for function)
- Do not ship key to client bundles — only server actions / server modules read `process.env.OPENROUTER_API_KEY`

### Project context reference

No `project-context.md`. Follow Architecture Spine + this story + 2.1/2.2 files.

### Anti-patterns (prevent disasters)

- Calling OpenRouter from a Client Component or exposing the key  
- Assigning `recipe_id` without `assertRecipeAssignable`  
- Second “fallback suggest” path that skips Refusal/dislike filters  
- Inventing Recipe rows without Critical ingredients  
- Matching against Settings store instead of Menu snapshot  
- Building a full chat UI / streaming playground  
- Implementing 2.4 resuggest or 2.6 Refusal buttons “while here”  
- Silent success with all-empty slots when generate failed  
- Editing prior migrations in place  

### Open questions for implementer (non-blocking)

1. Exact cheap default model slug — pick one stable low-cost model and document in `.env.example`  
2. Orphan Menu on failure — prefer delete-if-zero-assigns for Create form clarity  
3. Whether to call OpenRouter when only 1–2 eligible recipes exist — still OK to ask model to place them, or deterministic round-robin without LLM; LLM preferred for AC honesty, with deterministic fallback if you must (document choice)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-20.md` — merge 2.7→2.3]
- [Source: `architecture/.../ARCHITECTURE-SPINE.md` — AD-3, AD-4, AD-6, AD-10]
- [Source: `ux-designs/.../EXPERIENCE.md` — Generating Menu, slot-card, UX-DR14]
- [Source: `2-1-create-menu-skeleton-by-day-length.md`, `2-2-buyable-matching-and-eligibility.md`]
- [Source: `src/domain/matching/index.ts`, `src/components/menu/create-menu-form.tsx`]

### Review Findings

- [x] [Review][Decision] Minimum fill — resolved: always deterministic-fill remaining slots after LLM; then require `assignedCount >= 1`.
- [x] [Review][Patch] Fail-closed suppress load.
- [x] [Review][Patch] Suppressed proposal retries ranked alternates.
- [x] [Review][Patch] Slot update verified via `.select('id')`.
- [x] [Review][Patch] OpenRouter timeout + invalid JSON → OpenRouterError.
- [x] [Review][Patch] Menu delete error surfaced on rollback.
- [x] [Review][Patch] Slot meal / count validated before LLM.
- [x] [Review][Patch] History query errors fail-closed.
- [x] [Review][Patch] Partial LLM + deterministic fill remaining slots.
- [x] [Review][Defer] O(N×M) eligibility×assign catalog reloads — deferred until recipe library grows [`candidates.ts` / `assign.ts`]
- [x] [Review][Defer] Recipes/history PostgREST page cap — deferred until library/history large [`candidates.ts` / `history.ts`]
- [x] [Review][Defer] RLS verify script weak (empty data without error check) — same pattern as other smokes [`scripts/verify-rls-refusals-ratings.mjs`]
- [x] [Review][Defer] `recipe_ratings.updated_at` without trigger — Epic 4 write path [`20260720060000_…`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `node scripts/verify-suggestions-logic.mjs` — PASS
- `node --env-file=.env.local scripts/verify-rls-refusals-ratings.mjs` — PASS
- `npx eslint` on suggestions/openrouter/menu UI — green
- `npm run build` — green
- Supabase MCP `apply_migration` `recipe_refusals_ratings` — success

### Completion Notes List

- Migration: `recipe_refusals` + `recipe_ratings` (`dislike|medium|like`); RLS owner-only; no write UI.
- OpenRouter: `src/lib/openrouter/client.ts` (fetch, default `openai/gpt-4o-mini`); env in `.env.example` only (server).
- Domain `src/domain/suggestions/`: suppress → eligibility candidates → LLM JSON assign → `assertRecipeAssignable` → slot update.
- Orphan policy: on generate failure after skeleton create, delete Menu; Russian error on Create form (no fake success).
- Library-only: unknown LLM recipe ids rejected; empty LLM parse falls back to deterministic round-robin of gated candidates.
- CTA «Генерируем…»; DayCardGrid shows recipe names; cook-recency via past menu assignments (14d long-idle).

### File List

- `supabase/migrations/20260720060000_recipe_refusals_ratings.sql` (new)
- `src/lib/openrouter/client.ts` (new)
- `src/domain/suggestions/constants.ts` (new)
- `src/domain/suggestions/errors.ts` (new)
- `src/domain/suggestions/suppress.ts` (new)
- `src/domain/suggestions/history.ts` (new)
- `src/domain/suggestions/rank.ts` (new)
- `src/domain/suggestions/candidates.ts` (new)
- `src/domain/suggestions/openrouter-generate.ts` (new)
- `src/domain/suggestions/assign.ts` (new)
- `src/domain/suggestions/generate-menu.ts` (new)
- `src/domain/suggestions/index.ts` (new)
- `src/domain/menu/actions.ts` (modified)
- `src/domain/menu/load-menu.ts` (modified)
- `src/components/menu/create-menu-form.tsx` (modified)
- `src/components/menu/day-card-grid.tsx` (modified)
- `app/(authenticated)/plan/menu/page.tsx` (modified)
- `.env.example` (modified)
- `scripts/verify-suggestions-logic.mjs` (new)
- `scripts/verify-rls-refusals-ratings.mjs` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/2-3-ai-generate-buyable-menu.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Story context created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-07-20: Implemented AI generate + suggestions module; status → review.
- 2026-07-20: Code review patches applied; status → done.
