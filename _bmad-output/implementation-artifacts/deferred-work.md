## Deferred from: code review of 1-5-block-planning-on-stale-catalog.md (2026-07-20)

- ~~Create Menu day radios are non-interactive stubs with hardcoded day 3~~ — resolved in Story 2.1 (`DayLengthPicker` + `CreateMenuForm`).
- ~~Selected day uses indigo/purple shadow~~ — resolved in Story 2.1 (`shadow-sm` / Soft Workshop tokens).

## Deferred from: code review of 2-1-create-menu-skeleton-by-day-length.md (2026-07-20)

- ~~`DayCardGrid` always shows empty-slot chrome even if `recipeId` is set~~ — resolved in Story 2.3 (filled slot names).
- RLS verify script only checks anon deny, not cross-user A↛B isolation — needs dual authenticated clients / harness.
- Create Menu double-submit can insert duplicate Menus — strengthen with idempotency key if it becomes a real UX issue.

## Deferred from: code review of 2-2-buyable-matching-and-eligibility.md (2026-07-20)

- ~~FR12 `maxMenuDaysForRecipes` / shortest-keep cap across selected recipes~~ — resolved in Epic close: `assignProposalsToSlots` enforces `maxMenuDaysForRecipes([...selected, next]) >= day_count` (plus per-recipe fridge gate).
- `verify-matching-logic.mjs` duplicates TS predicates — accept until a shared test runner imports domain code.
- `assertRecipeAssignable` persists matches (side effect) — OK for assign path; add pure assert if callers need dry-run.

## Deferred from: code review of 2-3-ai-generate-buyable-menu.md (2026-07-20)

- O(N×M) eligibility×assign reloads full catalog per recipe/attempt — optimize when library grows.
- Recipes / cook-history queries may hit PostgREST default page cap — paginate when needed.
- `verify-rls-refusals-ratings.mjs` treats empty data as PASS without asserting `error` / insert deny.
- ~~`recipe_ratings.updated_at` has no update trigger~~ — resolved (`set_updated_at` on recipe_ratings + snack_ratings).

## Deferred from: code review of 2-4-edit-slots-with-uj-1-gate.md (2026-07-20)

- Full-library `buildCandidates` on every single-slot resuggest — cache or narrow later.
- `verify-uj1-gate-logic.mjs` mirrors predicate instead of importing domain.
- Parallel resuggest on same slot — last-writer race; serialize if it becomes an issue.
- Sticky `slot_edit_passed_at` after later clears — intentional pass-once UJ-1.

## Deferred from: Epic 3 / 4 close (2026-07-20)

- Shopping list line quantities from servings — catalog matches are product-identity; scale when ingredient amounts exist.
- Nutrition display — catalog has no nutrition fields yet (price-when-present shipped).
- Author real `recipes.body_text` content (placeholder calm copy shipped).
- Enable Supabase Auth leaked-password protection in Dashboard (project setting).

## Deferred from: code review of project-context.md — Chunk 1 App+UI (2026-07-20)

- `SlotCardActions` error alert layout near absolute overflow menu — polish when touching slot chrome.
- Stacked Radix dialogs (recipe panel + comment/create) — shared modal host if focus traps bite in practice.
- Filled slot with `recipeId` but missing `recipeName` — empty cell without actions; harden when loader contracts change.
- `continueToPortionsAction` name vs redirect to shopping-list — rename when next touching slot-actions API.
