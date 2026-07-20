# Deferred work — resolved archive (2026-07-20)

All previously open items were closed in the deferred-work sweep. Strikethrough = already done earlier; **Resolved** = closed in this sweep.

## From story / epic reviews

- ~~Create Menu day radios stubs~~ — Story 2.1
- ~~Selected day indigo/purple shadow~~ — Story 2.1
- ~~DayCardGrid empty chrome with recipeId~~ — Story 2.3
- ~~FR12 shortest fridge-keep cap~~ — assign path
- ~~`recipe_ratings.updated_at` trigger~~ — set_updated_at
- **Resolved (obsolete):** `verify-matching-logic.mjs` / `assertRecipeAssignable` / O(N×M) catalog reload — removed with catalog drop
- **Resolved:** RLS anon checks require explicit deny (`assert-anon-denied.mjs`); authenticated positive + anon INSERT deny in `verify-rls-authenticated.mjs` (optional second operator for A↛B)
- **Resolved:** Create Menu double-submit — form `idempotencyKey` + in-process dedupe in `create-menu-actions.ts`
- **Resolved:** Recipes PostgREST page cap — `fetchAllRecipes` pagination in `candidates.ts`
- **Resolved:** Full-library resuggest races — `withMenuMutationLock` on slot mutations; recipes paged (no unsafe invent cache)
- **Resolved (by design):** Sticky `slot_edit_passed_at` pass-once UJ-1 — kept
- **Resolved (partial → shipped):** Shopping quantities scale when `amount_per_serving` present; nutrition UI when AI fills KBJU
- **Resolved:** Legacy placeholder `body_text` cleared via `20260720230000_deferred_work_hardening.sql`
- **Resolved (ops doc):** Enable Supabase Auth leaked-password protection — see `docs/deployment-guide.md` (Dashboard Auth → Password security). Advisors still WARN until toggled in project settings.

## Chunk 1 App+UI

- **Resolved:** `SlotCardActions` error alert layout (`pr-10` under overflow)
- **Resolved:** Stacked dialogs — comment dialog `z-[70]` + focus textarea
- **Resolved:** `recipeId` without name → «Рецепт недоступен» + actions
- **Resolved:** `continueToShoppingListAction` rename (+ deprecated alias)

## Chunk 2 Domain

- **Resolved:** Parallel resuggest serialize via menu mutation lock
- **Resolved:** Snack vs ingredient name collision — snacks always keep section lines
- **Resolved:** Expanded `looksLikeNoCookSnack` heuristics (+ verify sync)
- **Resolved:** `menu/actions.ts` → `create-menu-actions.ts`
- **Resolved:** History ratings query errors → soft `warning` banner
- **Resolved:** Create-skeleton `userId` documented + empty-guard (RPC still uses `auth.uid()`)

## Chunk 3 Infra

- **Resolved (accepted single-operator):** Shared `recipes` / `critical_ingredients` write RLS — intentional for invent library; advisors WARN expected
- **Resolved (no-op):** Price backfill heuristics — already applied; do not re-run
- **Resolved (accepted):** Duplicate timestamp `20260720110000_*` — leave applied history; rename would break remote
- **Resolved:** DB cap on `taste_preferences` (trigger, 60) + app `MAX_TASTE_PREFERENCES`
- **Resolved:** Auth bypass also blocked when `KEPLO_ENV=production`
- **Resolved:** `critical_ingredients` UPDATE policy/grant

## Chunk 4 Quality

- **Resolved (spot-sync):** `verify-suggestions-logic.mjs` updated for `plateRole` companion + no-cook snack heuristics; full TS import runner deferred until tooling exists (not blocking)
- **Resolved:** `shoppingListAllowed` pure helper in `uj1-gate.ts`; verify script mirrors it
- **Resolved:** Authenticated RLS script wired into `verify:rls` (skips if no operator creds)
- **Resolved:** `npm run verify:e2e` alias (kept out of default `verify` — needs OpenRouter/operator)
- **Resolved (decided keep):** Auth middleware fail-open on transient `getUser`

## From spec-fix-protein-protein-plate-pairing

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-protein-protein-plate-pairing.md`
  summary: Verifier still duplicates plate/meal-fit helpers instead of importing TS domain.
  evidence: Pre-existing pattern; green verify:logic can drift from production if only one copy is edited.
