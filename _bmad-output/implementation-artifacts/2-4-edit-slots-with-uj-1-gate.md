---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 2.4: Edit slots with UJ-1 gate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want to edit breakfast/lunch/dinner after generation and only then continue,
So that the Menu is mine, not a blind autopilot result.

## Acceptance Criteria

1. **Given** a generated Menu  
   **When** the operator is on Menu + slot edit (`/plan/menu?menuId=`)  
   **Then** they see Model C `day-card` / `slot-card` grid; empty slots are allowed (FR3, UX-DR6)  
   **And** each filled/empty slot exposes actions: **AI resuggest** («Другое предложение»), **Refusal**, **clear** («Очистить») — no Recipe library browse and no History-pick (FR6, UX-DR6)

2. **Given** the UJ-1 flow  
   **When** the operator tries to open Shopping list (pill or direct URL) without having continued from slot edit  
   **Then** the skip is blocked (redirect/disabled + calm Russian copy); they must pass slot edit → Portion plan before Shopping list (FR23)

3. **Given** a slot replace via AI resuggest  
   **When** a new Recipe is chosen  
   **Then** it passes Story 2.2 eligibility before assignment (`assertRecipeAssignable` / matching) (FR10, FR15, AD-10)  
   **And** CheckedMatch rows are re-run for that Recipe on the Menu

4. **Given** Refusal on a filled slot  
   **When** the operator records Refusal  
   **Then** a `recipe_refusals` row is inserted for that user+recipe; the slot is cleared; future suggestions hard-suppress via existing 2.3 path (FR8 prep — full Refusal UX polish may still refine in 2.6)

5. **Given** slot edit in flight (resuggest)  
   **When** UI is shown  
   **Then** the acting control shows loading / disabled; Soft Workshop Russian errors on failure (UX-DR14 pattern)

## Tasks / Subtasks

- [x] UJ-1 gate persistence (AC: #2)
  - [x] Append migration: e.g. `menus.slot_edit_passed_at timestamptz null` (or equivalent owned flag). Set only from Next domain when operator confirms continue («К плану порций»)
  - [x] Helper `markSlotEditPassed(supabase, menuId)` + `hasSlotEditPassed(menu)` 
  - [x] Pill-nav / Shopping list: block when no passed flag for active menu (or no menuId context)
  - [x] `/plan/shopping-list` server-side: if not passed → redirect to `/plan/menu?menuId=` (or Create Menu) with explanation — do not render list stub as success
  - [x] Portion plan route may open after mark; pass `menuId` in query where practical

- [x] Slot actions domain (AC: #1, #3, #4)
  - [x] `src/domain/suggestions/resuggest-slot.ts` — single-slot: `buildCandidates` → exclude current recipeId → OpenRouter one-slot (or deterministic fallback) → `assignProposalsToSlots`; fail Russian if zero candidates
  - [x] Clear slot: set `menu_slots.recipe_id = null` for owned slot; do not invent match-review UI
  - [x] Refusal: insert `recipe_refusals` (ignore duplicate unique) + clear slot
  - [x] Server actions in `src/domain/menu/actions.ts` (or `slot-actions.ts`): `resuggestSlotAction`, `clearSlotAction`, `refuseSlotAction`, `continueToPortionsAction` (mark passed + redirect)
  - [x] Freshness: fail-closed via matching / catalog gate already on assign; stale UI still blocks planning CTAs from 1.5 where applicable

- [x] Slot-edit UI (AC: #1, #5)
  - [x] Client `slot-card` actions on `DayCardGrid` (or split `slot-card.tsx`): «Другое предложение», «Очистить», Refusal label per glossary
  - [x] Primary CTA «К плану порций →» on `/plan/menu` (marks gate + navigates `/plan/portions?menuId=`)
  - [x] Update page copy — remove “в следующих шагах”; Soft Workshop tokens only
  - [x] No snacks-bar (2.5), no recipe-text panel (4.3), no History pick

- [x] Nav / stubs wiring (AC: #2)
  - [x] Update `pill-nav` to respect gate (disable or soft-block Shopping list; keep Settings/logout)
  - [x] Minimal Portion plan page: accept `menuId`, calm “далее — Shopping list после плана порций” stub OK for Epic 3 UI, but gate must already be marked
  - [x] Smoke: verify script or manual checklist for gate + resuggest eligibility

## Dev Notes

### Epic context

Epic 2 — after **2.3 AI generate**. This story owns **slot edit chrome + UJ-1 skip prevention**.

Sibling boundaries:
- **2.3 (done):** full-menu generate, suggestions module, filled names — reuse `buildCandidates` / assign / OpenRouter
- **2.5:** snacks-bar
- **2.6:** may polish Refusal UX; **persist Refusal here** so AC#1 is honest (table already exists)
- **Epic 3:** real Portion plan servings + Shopping list materialization

### Current code state (READ before editing)

- `/plan/menu?menuId=` + `DayCardGrid` show recipe names; **no** slot buttons / continue CTA
- `pill-nav.tsx` links freely to shopping-list — **gate missing**
- `generateBuyableMenuForUser` is full-menu only — add **single-slot** resuggest orchestrator
- `recipe_refusals` table + `loadSuppressSets` already exist

### Technical requirements

| Topic | Rule |
| --- | --- |
| AD-10 | Resuggest rematch via `assertRecipeAssignable` |
| AD-4 | Refusal insert feeds same suppress module; no second suggest path |
| AD-9 / AD-8 | Menu store snapshot; freshness fail-closed on assign |
| UJ-1 | Persist pass flag; block Shopping list without it |
| Clear vs Refusal | Clear = empty slot only; Refusal = persist + clear + hard-suppress |

### Recommended flows

```text
Resuggest(slotId):
  load slot + menu → buildCandidates → exclude current →
  propose one slot (LLM or deterministic) → assignProposalsToSlots → revalidate

Clear(slotId):
  update recipe_id null → revalidate

Refuse(slotId):
  insert recipe_refusals → clear slot → revalidate

Continue:
  mark slot_edit_passed_at → redirect /plan/portions?menuId=
```

### File structure

**NEW:**
```text
supabase/migrations/YYYYMMDDHHMMSS_menus_slot_edit_passed.sql
src/domain/suggestions/resuggest-slot.ts
src/domain/menu/slot-actions.ts   # or extend actions.ts
src/components/menu/slot-card-actions.tsx  # client buttons
scripts/verify-uj1-gate-logic.mjs  # optional pure helpers
```

**UPDATE:** `day-card-grid.tsx`, `plan/menu/page.tsx`, `pill-nav.tsx`, `plan/shopping-list/page.tsx`, `plan/portions/page.tsx`, suggestions `index.ts`

**Do NOT:** snacks, Shopping list build, recipe-text Dialog, History pick, match-review, weaken stale gate

### UX copy

- Resuggest: «Другое предложение»
- Clear: «Очистить»
- Refusal: label **Refusal** (glossary) or short RU workshop phrase — prefer glossary term visible
- Continue: «К плану порций →»
- Gate block: calm Russian — e.g. «Сначала проверьте меню и перейдите к плану порций.»

### Testing

1. Resuggest on filled slot → new or alternate eligible recipe (or clear error)
2. Clear → empty chrome
3. Refusal → row in `recipe_refusals` + empty slot; recipe not in later candidates
4. Without continue: `/plan/shopping-list` blocked
5. After continue: shopping-list reachable (stub OK)
6. Lint/build green

### Previous story intelligence

- OpenRouter timeout + fail-closed suppress (2.3 review)
- `assignProposalsToSlots` verifies update row count
- Deterministic fill for omitted slots — reuse for single-slot fallback
- DayCardGrid already has filled/empty chrome

### Anti-patterns

- Enabling Shopping list pill without pass flag
- Resuggest without matching gate
- History-pick or library browser
- Implementing Epic 3 list lines “while here”
- Client-side OpenRouter

### References

- [Source: `epics.md` — Story 2.4, FR6, FR23]
- [Source: `EXPERIENCE.md` — slot-card, UJ-1, Generating/Edit states]
- [Source: `2-3-ai-generate-buyable-menu.md`]
- [Source: `src/domain/suggestions/*`, `src/domain/matching/index.ts`]

### Review Findings

- [x] [Review][Patch] Pill-nav respects `slot_edit_passed_at` via `getSlotEditPassedAction`.
- [x] [Review][Patch] Shopping list gate fail → `redirect` to menu.
- [x] [Review][Patch] Slot emptiness / actions use `recipeId`.
- [x] [Review][Patch] Clear/Refusal clear CheckedMatch + Refusal CAS on `recipe_id`.
- [x] [Review][Patch] Continue blocked when catalog stale (+ server assert).
- [x] [Review][Patch] `encodeURIComponent(menuId)` on links/redirects.
- [x] [Review][Patch] Continue CTA pending via `useFormStatus`.
- [x] [Review][Defer] Full-library `buildCandidates` on every resuggest — optimize later [`resuggest-slot.ts`]
- [x] [Review][Defer] Verify script mirrors predicate — same pattern as matching/suggestions smokes
- [x] [Review][Defer] Parallel resuggest race — deferred
- [x] [Review][Defer] Sticky gate after later clears — intentional UJ-1 pass-once

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `node scripts/verify-uj1-gate-logic.mjs` — PASS
- eslint on touched paths — green
- `npm run build` — green
- Supabase MCP `apply_migration` `menus_slot_edit_passed` — success

### Completion Notes List

- Migration: `menus.slot_edit_passed_at`; set on «К плану порций».
- Slot actions: resuggest (OpenRouter/deterministic + matching), clear, Refusal insert+clear.
- UJ-1: shopping-list and portions require passed flag + menuId; pill disables portions/list without menuId.
- Soft Workshop slot action copy; no snacks / recipe-text / History pick.

### File List

- `supabase/migrations/20260720070000_menus_slot_edit_passed.sql` (new)
- `src/domain/menu/uj1-gate.ts` (new)
- `src/domain/menu/uj1-actions.ts` (new)
- `src/domain/menu/slot-actions.ts` (new)
- `src/domain/suggestions/resuggest-slot.ts` (new)
- `src/domain/suggestions/index.ts` (modified)
- `src/components/menu/slot-card-actions.tsx` (new)
- `src/components/menu/continue-to-portions-button.tsx` (new)
- `src/components/menu/day-card-grid.tsx` (modified)
- `src/components/layout/pill-nav.tsx` (modified)
- `src/components/layout/app-header.tsx` (modified)
- `app/(authenticated)/plan/menu/page.tsx` (modified)
- `app/(authenticated)/plan/portions/page.tsx` (modified)
- `app/(authenticated)/plan/shopping-list/page.tsx` (modified)
- `scripts/verify-uj1-gate-logic.mjs` (new)
- `_bmad-output/implementation-artifacts/2-4-edit-slots-with-uj-1-gate.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Story context created (ready-for-dev).
- 2026-07-20: Implemented slot edit + UJ-1 gate; status → review.
- 2026-07-20: Code review patches applied; status → done.
