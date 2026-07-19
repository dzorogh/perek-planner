# Adversarial Recheck — ARCHITECTURE-SPINE.md (post AD-7..AD-10)

**Target:** `ARCHITECTURE-SPINE.md` (perek-planner, 2026-07-19)  
**Baseline:** `reviews/review-adversarial.md` — five critical fork points (Holes 1–5)  
**Method:** Re-run hostile two-epic clash for each baseline hole against adopted AD-7..AD-10 and tightened AD-3/AD-6. Altitude: **initiative** (build substrate, not DDL-level precision).

---

## Verdict

**NOT PASS** — four of five baseline critical holes are closed enough for initiative altitude. One remains fork-safe only at ER-diagram level, not at AD level.

---

## Hole-by-hole recheck

| # | Baseline hole | Closing AD(s) | Status |
| --- | --- | --- | --- |
| 1 | CheckedMatch shape (JSON blob vs normalized; recipe-global cache) | AD-7, AD-3 cross-ref | **Closed** |
| 2 | Catalog DTO drift (renamed columns; dual stale signals) | AD-8, AD-6 tighten | **Closed** |
| 3 | Store dual-SoT (`selected_store_id` vs `menu.store_id`) | AD-9 | **Closed** |
| 4 | Shopping list SoT (materialized vs virtual; pantry attachment) | AD-7 partial only | **Open — CRITICAL** |
| 5 | Clone vs revalidate (copy matches vs passive revalidation) | AD-10, AD-3 cross-ref | **Closed** |

---

## Closed holes (summary)

### 1 — CheckedMatch shape ✓

AD-7 mandates normalized rows, Menu-scoped (not recipe-global cache), single matching-module writer, and Shopping lines tied to `CheckedMatch` ids or one handoff command. ER diagram aligns (`CheckedMatch }o--|| Menu`, optional `ShoppingListLine → CheckedMatch`). Hostile JSON-on-slot and recipe×store cache epics no longer cite a compliant AD.

### 2 — Catalog DTO drift ✓

AD-8 + tightened AD-6 close the AD-6 duplication loophole: migrations are schema SoT; sync and Next map through generated types or explicit column maps with **no renamed parallel DTOs**; availability is one sync-written field; FR-18 reads `catalog_sync_runs` only. Missing a spine field-name table is acceptable at initiative altitude.

### 3 — Store dual-SoT ✓

AD-9 resolves the planning-context fork: Settings hold default `selected_store_id`; Menu snapshots `store_id` at creation; matching and Shopping for that Menu use the snapshot; Settings changes do not rewrite past Menus. Profile vs menu ambiguity for **planning reads** is gone.

### 5 — Clone vs revalidate ✓

AD-10 (repurposed from the proposed ShoppingList AD) explicitly rules: clone copies structure/Recipes only, **must not copy `CheckedMatch` rows**, then re-runs matching; persisted matches are SoT until slot replace; eligibility gates suggest/assign (not passive open); stale-catalog warning alone does not invalidate matches. The FR-9 / FR-17 clash from the baseline review is closed.

---

## Remaining CRITICAL holes (max 3)

### CRITICAL — Shopping list SoT (baseline Hole 4)

**What changed:** Proposed AD-10 (*ShoppingList materialization*) was **not adopted**. Adopted AD-10 covers eligibility timing & Menu reuse instead. Shopping semantics live only as a partial rule inside AD-7:

> Shopping list lines for matched products reference `CheckedMatch` ids **(or are derived in one handoff command from them)**.

**Why still fork-safe:** Two AD-compliant epics can still diverge:

| Epic A | Epic B |
| --- | --- |
| Materializes `shopping_lists` + `shopping_list_lines` on first list open / regenerate | Computes list virtually on every menu load from `CheckedMatch` + servings |
| Pantry opt-in (FR-13) on `shopping_list_lines.include_pantry` | Pantry in `menu_pantry_opt_ins` junction, never read at list build |
| Copy (FR-20) from persisted snapshot | Copy serializes live computation |

ER diagram implies a `ShoppingList` entity (`Menu ||--o| ShoppingList`), but no AD mandates persistence vs ephemeral derivation, regeneration semantics, or where FR-13 pantry state attaches. Integration debt still lands at FR-19–FR-22 handoff — the exact seam the baseline review flagged.

**To close (next spine edit):** Restore materialization rule (when built, regeneration, pantry column/table, single `buildShoppingList` command) — either as a dedicated AD or as explicit AD-7 sub-rules.

---

## Notes (non-critical at initiative altitude)

- **Sync store targeting:** AD-9 says sync refreshes “configured store(s)” but does not specify union-of-menu-stores vs Settings-only vs env default. Single-store MVP (Alabino default) makes this tolerable now; not elevated to CRITICAL for this recheck.
- **Recipe canonicalization / Rating FK targets (baseline Holes 6–7):** Still open but were secondary in the baseline review; out of scope for this five-hole recheck.

---

## Acceptance gate (unchanged from baseline)

Before epic-level **ADOPTED** (not initiative spine):

1. Independent migrations from spine-only guidance produce identical `checked_matches`, `products`, `shopping_lists` DDL.
2. Clone → re-match → build list → copy — single code path (AD-10 ✓; shopping build step still undefined).
3. Sync failure → stale banner from `catalog_sync_runs` only (AD-8 ✓).

---

*Recheck date: 2026-07-19*
