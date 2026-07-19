# Adversarial Architecture Review — ARCHITECTURE-SPINE.md

**Target:** `ARCHITECTURE-SPINE.md` (perek-planner, 2026-07-19)  
**Method:** For each finding, construct two capability units one level down (features/epics) that **obey every AD literally** yet implement **incompatible** persistence shapes, entity ownership, or state-mutation paths. Each pair is a hole to close with a new or tightened AD.  
**Reviewer stance:** Hostile implementer — maximize compliance paperwork, minimize integration.

---

## Verdict

**CONDITIONAL PASS — spine is directionally sound but not yet fork-safe.**

AD-1 through AD-6 establish runtime topology, write ownership, and dependency direction well. Six ADs are insufficient as a **build substrate**: the spine leaves canonical data shapes, entity lifecycles, and mutation entry points implicit. Parallel epics can each cite AD-3 (“matches persisted”, “eligibility in Next”) or AD-6 (“duplicated DTOs allowed”) while producing schemas and server actions that do not compose.

**Severity:** 5 critical fork points identified below. Without closing them, integration debt lands at Shopping list handoff (FR-19–FR-22), Menu reuse (FR-9), and stale-catalog UX (FR-18) — exactly where the ER diagram promises coherence.

---

## Hole 1 — CheckedMatch persistence model (scope, shape, lifecycle)

**Clash type:** clashing shared-data shapes + conflicting state-mutation paths  
**ADs obeyed:** AD-3, AD-5, AD-6, Consistency Conventions (“State mutation: Menu/matches … via Next server actions”)

### Epic A — *Menu & Portion plan* (FR-1…FR-5, FR-3 slot assignment)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| When matches are written | Lazily on slot assignment: `assignRecipeToSlot(menuSlotId, recipeId)` |
| Shape | Embedded JSON on `menu_slots.resolved_matches`: `{ criticalIngredientKey: productId \| productId[] }` |
| Scope | Match state is **Menu-scoped**; reopen reads the blob on the slot |
| Persistence | “Resolved matches are **persisted** in Supabase” ✓ |
| Eligibility | Pre-check in Next before assignment ✓ |

### Epic B — *Checked matches & eligibility* (FR-11…FR-15, FR-17)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| When matches are written | Eagerly during eligibility pass: `resolveMatchesForRecipe(recipeId, storeId)` |
| Shape | Normalized `checked_matches` rows: `(critical_ingredient_id, product_id, store_id, chosen_at)` |
| Scope | Match state is **Recipe×Store-scoped**, reused across Menus |
| Persistence | Same AD-3 quote ✓ |
| Eligibility | All logic on Next server ✓ |

### Incompatibility

- Shopping list (FR-19) from Epic A aggregates JSON blobs + servings; Epic B joins `checked_matches` × `menu_slots` — different keys (`criticalIngredientKey` string vs `critical_ingredient_id` UUID).
- FR-15 “prefer cheaper analogs” in Epic B updates `checked_matches.product_id`; Epic A never touches normalized rows — Shopping list shows stale products after re-resolution.
- ER diagram (`CriticalIngredient ||--o{ CheckedMatch`, `ShoppingListLine }o--|| CheckedMatch`) assumes normalized rows; Epic A makes `ShoppingListLine → CheckedMatch` impossible.

### Proposed AD (new)

**AD-7 — CheckedMatch canonical model [PROPOSED]**

- **Binds:** FR-11…FR-15, FR-17, FR-19, AD-3
- **Prevents:** embedded match blobs; recipe-global matches silently diverging from menu intent; Shopping list lines without stable match FK
- **Rule:** `CheckedMatch` is a **normalized Supabase table** only. Rows are owned by `(menu_id, critical_ingredient_id)` for assigned Recipes (not recipe-global cache). Resolution runs in Next; **only** domain commands `resolveMatchesForMenu` / `assignRecipeToSlot` (single module) insert or replace rows. JSON blobs on slots are forbidden. `ShoppingListLine.checked_match_id` is required.

---

## Hole 2 — Catalog schema contract (AD-6 duplication loophole)

**Clash type:** clashing shared-data shapes  
**ADs obeyed:** AD-2, AD-6 (“duplicated DTOs at the Supabase schema boundary”), Consistency Conventions (IDs, Errors/FR-18)

### Epic A — *Catalog sync worker* (FR-16…FR-18, catalog-sync)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| Write path | Python sync, service role only ✓ (AD-2) |
| Product DTO | Maps API → columns: `external_id`, `name_ru`, `price_cents`, `in_stock` (boolean), `store_external_id` |
| Stale markers | Inserts `catalog_sync_runs(status, finished_at, store_id)` per job |
| Types | Python dataclass duplicated at boundary ✓ (AD-6) |

### Epic B — *Matching & eligibility* (FR-11, FR-15, FR-17)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| Read path | Next reads catalog; never writes ✓ (AD-2) |
| Product DTO | TypeScript type expects: `sku`, `title`, `price_rub`, `availability` enum `'in_stock' \| 'out_of_stock' \| 'unknown'` |
| Stale UX (FR-18) | Compares `max(products.synced_at)` to now — ignores `catalog_sync_runs` |
| Types | TS interface duplicated at boundary ✓ (AD-6) |

### Incompatibility

- Same Postgres table, **incompatible semantics**: sync writes `in_stock=true` while Next reads undefined `availability` → everything appears OOS (FR-17 blocks all Recipes) or everything eligible (SM-3 failure).
- FR-18: sync job fails but old rows have recent `synced_at` → Epic B shows fresh catalog; Epic A’s `catalog_sync_runs` says stale — contradictory warnings.
- External id stored as `external_id` vs queried as `sku` — joins in CheckedMatch silently fail.

### Proposed AD (new)

**AD-8 — Catalog read contract [PROPOSED]**

- **Binds:** FR-16…FR-18, AD-2, sync + matching epics
- **Prevents:** divergent column semantics across Python/TS DTOs; stale detection split across two signals
- **Rule:** `supabase/migrations` defines the **single canonical** `products`, `stores`, `catalog_sync_runs` column set. Sync worker and Next **must** map through generated or checked shared field names documented in the spine table (no ad-hoc aliases). **FR-18 stale signal:** UI reads `catalog_sync_runs` for the active store (not row timestamps). Availability is one column (`availability_status` enum); sync is sole writer.

---

## Hole 3 — Store context source of truth

**Clash type:** two owners of one entity + conflicting mutation paths  
**ADs obeyed:** AD-2, AD-5, AD-1 (Dokploy schedule)

### Epic A — *Catalog & store selection* (FR-16, FR-18)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| Store SoT | `user_profiles.selected_store_id` — global preference |
| Sync target | Dokploy job reads all users’ stores … or “primary” store from env `DEFAULT_STORE_ID` |
| Mutation | `setSelectedStore(storeId)` server action updates profile |

### Epic B — *Menu & planning session* (FR-1, FR-9, FR-16)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| Store SoT | `menus.store_id` captured at Menu creation — “planning context” |
| Matching | Eligibility uses `menu.store_id` for Product/availability queries |
| Mutation | `createMenu({ days, storeId })` — store copied from profile **or** picker each time |

### Incompatibility

- Sergey changes store on profile (Epic A); open draft Menu (Epic B) still references old `menus.store_id` — CheckedMatches point at Products from store A while catalog sync refreshes store B.
- Sync job (AD-2): unclear authoritative list — profile store vs distinct menu stores → wrong catalog refreshed, FR-18 lies about freshness for the store actually used in planning.
- Two write paths for “which store”: profile vs menu — neither AD-5 nor FR-16 picks one.

### Proposed AD (tighten AD-2 + AD-5 or new)

**AD-9 — Active store context [PROPOSED]**

- **Binds:** FR-16…FR-18, all matching/catalog reads
- **Prevents:** profile store and menu store diverging without explicit migration; sync targeting wrong store
- **Rule:** **Menu-bound store is authoritative for planning.** `menus.store_id` is immutable after creation unless `changeMenuStore` explicitly clears and re-resolves all `CheckedMatch` rows. Sync schedule syncs the **union of stores referenced by open menus** plus `user_profiles.selected_store_id` for pre-planning browse. Catalog reads in matching always filter `products.store_id = menus.store_id`.

---

## Hole 4 — ShoppingList materialization & pantry opt-in attachment

**Clash type:** clashing data shapes + conflicting state-mutation paths  
**ADs obeyed:** AD-3 (“Shopping list … use stored matches”), Consistency Conventions (State mutation via Next)

### Epic A — *Shopping list & handoff* (FR-19…FR-22)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| ShoppingList | **Materialized** on `generateShoppingList(menuId)`: inserts `shopping_lists` + `shopping_list_lines` |
| Source | Reads persisted `CheckedMatch` rows (AD-3) ✓ |
| Pantry (FR-13) | `shopping_list_lines.include_pantry = true` for opted-in lines |
| Reopen | Returns stored list; copy (FR-20) from persisted lines |

### Epic B — *Menu & pantry opt-in* (FR-13, FR-5)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| ShoppingList | **Virtual** — computed on every `/menu/[id]` load from matches + servings |
| Pantry | `menu_pantry_opt_ins(menu_id, critical_ingredient_id)` junction table |
| Mutation | `togglePantryOptIn` writes junction; no ShoppingList table |
| Matches | Still persisted separately (AD-3) ✓ |

### Incompatibility

- ER diagram: `Menu ||--o| ShoppingList : derives` — Epic B deletes the entity; Epic A requires it.
- Pantry opt-in in Epic B does not appear in Epic A’s materialized lines until regenerate — or never if Epic B owns opt-in and Epic A never reads `menu_pantry_opt_ins`.
- FR-20 “copy always works”: Epic B copy serializes live computation; Epic A copy reads snapshot — after catalog goes stale, lists disagree.
- Two mutation paths for “what’s on the list”: `togglePantryOptIn` vs `generateShoppingList` — no single command owns list truth.

### Proposed AD (new)

**AD-10 — ShoppingList derivation [PROPOSED]**

- **Binds:** FR-13, FR-19…FR-22, AD-3
- **Prevents:** virtual vs materialized list split; pantry state orphaned from list lines
- **Rule:** `ShoppingList` is **materialized once** per Menu when Sergey first opens the list view or explicitly regenerates (`buildShoppingList(menuId)`). Pantry opt-in lives on `shopping_list_lines` (or a single `menu_pantry_decisions` table read only at build time). Live view reads the materialized list; regeneration invalidates prior lines and rebuilds from current `CheckedMatch` rows. No on-the-fly list SQL in UI routes.

---

## Hole 5 — Menu reuse vs match revalidation (mutation entry points)

**Clash type:** conflicting state-mutation paths + clashing eligibility semantics  
**ADs obeyed:** AD-3 (eligibility in Next; stored matches; not “recompute-as-SoT” for Shopping list)

### Epic A — *Reuse previous Menu* (FR-9, UJ-2)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| Entry | `cloneMenu(sourceMenuId)` server action |
| Matches | **Copies** `CheckedMatch` FKs to Products verbatim — “safe draft” |
| Rationale | Stored matches are SoT for reopen; AD-3 forbids discarding them for Shopping list |
| Eligibility | Slot assignment allowed if matches exist on draft |

### Epic B — *Today-stock eligibility* (FR-17, FR-11)

| Decision | Implementation (AD-compliant) |
| --- | --- |
| Entry | `openMenu(menuId)` and `listEligibleRecipes()` revalidate on every load |
| Matches | **Re-runs** eligibility; deletes/replaces `CheckedMatch` when Product no longer `in_stock` |
| Rationale | FR-17: don’t suggest unbuyable Recipes; eligibility in Next ✓ |
| Shopping list | Uses whatever matches remain after revalidation ✓ |

### Incompatibility

- Same entity (`CheckedMatch`), two owners: **clone** preserves historical product picks; **open** silently mutates them — Sergey’s “safe draft” (FR-9) loses Recipes between clone and open.
- AD-3 “not recompute-as-SoT” is ambiguous: Epic A reads it as match **persistence**; Epic B reads it as Shopping list must not bypass stored matches while **still** recomputing matches themselves.
- No rule for FR-9 “weeks later” when catalog changed — product ids may be dead rows.

### Proposed AD (tighten AD-3)

**AD-3 amendment — Match revalidation boundary [PROPOSED]**

Add to AD-3:

- **Rule:** `CheckedMatch` rows are immutable after Shopping list materialization. Before materialization, **only** `resolveMatchesForMenu` may replace them. Menu clone (FR-9) creates new rows; **must** call `revalidateMatchesForStore(menuId)` once at clone time (explicit UX if slots drop). Forbidden: silent match deletion on passive `openMenu` load. FR-17 re-check runs at suggestion/assignment time, not on every read.

---

## Hole 6 — Recipe & CriticalIngredient lifecycle (AI vs library)

**Clash type:** two owners of one entity + clashing shapes  
**ADs obeyed:** AD-3, AD-4, AD-6  
**Priority:** Secondary (fork risk before Rating/Refusal integration)

### Epic A — *Recipe library* (FR-6, FR-24)

- Canonical `recipes` + `critical_ingredients` rows seeded/imported; stable UUIDs for Rating/Refusal (FR-8, FR-10).

### Epic B — *AI suggestions* (FR-7, FR-12, AD-4)

- OpenRouter output held as `ai_recipe_drafts` JSON until accepted; `CriticalIngredient` rows created only at match time with **name-based** keys; on accept, insert new `recipes` row **or** never persist Recipe until Menu finalized (team choice).

Both gate via Next eligibility (AD-3, FR-12) and call OpenRouter server-side (AD-4). Incompatibility: Refusal on `recipe_id` misses AI drafts; duplicate `critical_ingredients` for the same dish; FR-9 reuse breaks if Recipe was never canonicalized.

### Proposed AD (new, if not folded into AD-7)

**AD-11 — Recipe canonicalization [PROPOSED]**

- **Rule:** Any Recipe appearing in a Menu slot **must** exist in `recipes` with normalized `critical_ingredients` before `CheckedMatch` resolution. AI proposals persist to `recipes` in `proposed` status at suggestion time (before slot assignment). Rating/Refusal FKs target `recipes.id` only.

---

## Hole 7 — Rating / Refusal identity (lower severity)

Epic A attaches Refusal/Rating to `recipe_id`; Epic B attaches to `menu_slot_id` for not-yet-library AI items. Both user-owned RLS rows (AD-5). Violates FR-8/FR-10 testable consequences (“stored against that Recipe”) while obeying AD-5. Close via AD-11 + explicit mention in AD-5 binds list.

---

## Coverage Matrix — AD vs fork points

| AD | Stops runtime/topology forks | Stops data-shape forks |
| --- | --- | --- |
| AD-1 | ✓ | — |
| AD-2 | ✓ (write owner) | ✗ (read shape open) |
| AD-3 | ✗ (persistence implied, not specified) | ✗ |
| AD-4 | ✓ | — |
| AD-5 | ✓ (tenancy) | ✗ (entity FK targets) |
| AD-6 | ✓ (import direction) | ✗ (**explicitly allows** incompatible DTOs) |

---

## Recommended spine edits (summary)

| ID | Action | Closes |
| --- | --- | --- |
| AD-7 | **Add** CheckedMatch canonical model | Hole 1 |
| AD-8 | **Add** Catalog read contract + FR-18 signal | Hole 2 |
| AD-9 | **Add** Active store context | Hole 3 |
| AD-10 | **Add** ShoppingList materialization | Hole 4 |
| AD-3 | **Amend** match revalidation boundary | Hole 5 |
| AD-11 | **Add** (optional v1) Recipe canonicalization | Holes 6–7 |

**ER diagram:** After AD-7/AD-10, annotate `CheckedMatch` with `(menu_id)` FK and `ShoppingList` as materialized 0..1.

**Consistency Conventions:** Replace “duplicated DTOs” bullet with “DTOs may duplicate **only** as mappers to the canonical schema in AD-8”.

---

## Test — “two teams, one repo” acceptance

Before marking spine **ADOPTED** (not draft):

1. Two implementers draft migrations independently from spine-only guidance — **must** produce identical `checked_matches`, `products`, `shopping_lists` DDL.
2. Clone-menu integration test (FR-9 + FR-17 + FR-19): clone → revalidate once → build list → copy — single code path, no silent slot loss on open.
3. Sync failure test (FR-18): stale banner follows `catalog_sync_runs`, not product row timestamps.

Until then: **CONDITIONAL PASS**.
