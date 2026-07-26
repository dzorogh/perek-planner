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

## From spec-menu-meal-mix-and-day-distribution

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-meal-mix-and-day-distribution.md`
  summary: Resuggest/LLM-assign fallback still skips `ensureHeavyAnimalOnLunchDinner` (create-flow only).
  evidence: Review found `resuggest-slot.ts` uses bare `deterministicAssignments` without the new meat/L/D guarantee.

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-meal-mix-and-day-distribution.md`
  summary: `looksLikeHeavyAnimalProteinDish` still misses some one-pots named in invent prompt (голубцы, пельмени, манты).
  evidence: Pre-existing heuristic gap; invent can invent them but quota check may not count them as meat.

## From spec-position-pair-menu-planning

- ~~Resuggest still uses batch invent~~ — **Resolved:** `resuggest-slot.ts` + snack resuggest use position-pair invent (meal×pair×role).

- ~~Unused DayLengthPicker after create-form removal~~ — **Resolved:** picker restored for pair lengths 2 / 4 / 6.

## From spec-modify-dish-with-wishes

- source_spec: `_bmad-output/implementation-artifacts/spec-modify-dish-with-wishes.md`
  summary: Cross-pair modify is not fully atomic if a later pair assign fails after an earlier success (same pattern as replace).
  evidence: Review noted partial apply; invent-once reduces variant drift but does not roll back earlier pair slots.

- source_spec: `_bmad-output/implementation-artifacts/spec-modify-dish-with-wishes.md`
  summary: No automated check that the AI recipe body actually satisfies the user wish.
  evidence: Wish is prompt-only; same trust model as other OpenRouter invent paths.

- source_spec: `_bmad-output/implementation-artifacts/spec-ai-debug-logs-db.md`
  summary: RLS smoke for ai_debug_logs only covers anon SELECT deny, not anon INSERT or cross-user isolation.
  evidence: Review noted verify-rls-ai-debug-logs.mjs selects only; authenticated A↛B needs a second operator like other RLS suites.

## Deferred from: code review of 6-1-slot-dish-roles-schema-and-templates.md (2026-07-25)

- Wire `covers_roles` into invent/assign (helpers-only in 6.1) — Story 6.2
- Full Harvard soup/veg persistence on assign dual-write (currently protein+carb legacy map) — Story 6.2
- Deduplicate meal templates in `verify-meal-composition-logic.mjs` vs domain modules — project verify-mjs pattern

## Deferred from: code review of 6-2-template-driven-ai-invent-assign.md (2026-07-25)

- Non-atomic `menu_slots` FK update before `replaceSlotDishes` — pre-existing dual-write pattern (`assign.ts`)
- `inventAndPersistRecipes` still free-mixes plate roles — not on create-menu path; batch invent remains secondary

## Deferred from: code review of 6-3-role-labeled-menu-ui-and-per-role-edit.md (2026-07-25)

- `canClear` only for carb — MVP secondary clear scope from story; not expanding clear to veg/soup in 6.3
- `verify-plate-role-labels-logic.mjs` duplicates domain helpers — same pure-script pattern as other verify:logic files
- Parallel empty-role «Предложить» lacks cell-level busy — busy overlay still keyed on shared `recipeId`; empty lines can race

## Deferred from: spec-menu-sheet-redesign.md (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-sheet-redesign.md`
  summary: Align remote Supabase migration version fingerprint for `fruit` with local `20260726150000_plate_role_fruit.sql` (remote listed as `20260726113927_plate_role_fruit`).
  evidence: Blind Hunter found local file version ≠ remote `list_migrations` version; risk of drift on other envs.

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-sheet-redesign.md`
  summary: Expand e2e beyond sheets + refusal + Список — assert chips, fruit role, portion meta, totals D, absence of cut blocks.
  evidence: `e2e/planning-flow.spec.ts` still only covers happy-path structure; AC gaps noted in adversarial review.

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-sheet-redesign.md`
  summary: Refresh docs (`docs/api-contracts.md`, `docs/component-inventory.md`) after removing UJ-1 CTA / DayCardGrid / MenuDishList.
  evidence: Docs still list `continueToShoppingListAction`, `getSlotEditPassedAction`, deleted components.

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-sheet-redesign.md`
  summary: Decide fate of leftover `uj1-gate.ts` + `slot_edit_passed_at` column now that shopping is ungated.
  evidence: Gate removed from nav/build-list; verify-uj1 still mirrors pure predicate; column unused by new UX.

- source_spec: `_bmad-output/implementation-artifacts/spec-menu-realtime-sync.md`
  summary: Wrap snack AI mutations (`resuggestSnackAction` / invent snack paths) in `withMenuMutationLock`.
  evidence: Review noted lock covers slot AI paths only; concurrent snack invent on the same menu can still interleave across instances.

## Deferred from: spec-replace-dish-form-diversity.md (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-replace-dish-form-diversity.md`
  summary: Enforce form/method leap in code (reject/retry same culinary form), not only in the replace prompt.
  evidence: Blind Hunter — `planHitsAvoid` only checks exact names; variety audit still allows up to two same-form proteins, so same-form replace can still ship.

- source_spec: `_bmad-output/implementation-artifacts/spec-replace-dish-form-diversity.md`
  summary: Reuse `cookingMethodKey` on the replace invent path for deterministic method-leap checks.
  evidence: Classifier exists in `cooking-method-variety.ts` but replace still relies on LLM wording alone.

- source_spec: `_bmad-output/implementation-artifacts/spec-replace-dish-form-diversity.md`
  summary: Add verify/logic coverage for `replacedDishes` threading on main/role/carb replace paths.
  evidence: No unit/integration tests for the new payload field or role scoping.
