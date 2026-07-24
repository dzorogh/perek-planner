---
title: Sprint Change Proposal — Harvard plate meal composition
status: approved-applied
approved: 2026-07-25
applied: 2026-07-25
scope: Moderate
handoff: Docs applied; next bmad-create-story on 6-1
date: 2026-07-25
project: keplo
trigger: stakeholder request — detail meals by Harvard plate + lunch soup; uniform Slot dish model; reduce AI structural decisions
mode: incremental
decisions:
  epic: new Epic 6 (do not reopen Epic 2; do not mix with Epic 5 chrome)
  data_model: MenuSlot → MenuSlotDish[] with Plate roles for ALL meal types
  breakfast_snack: same architecture; simpler meal templates ([main] / [snack])
  ai: code emits role slots from templates; AI invents recipe content only
  complex_dishes: coversRoles skips duplicate role invent
---

# Sprint Change Proposal — keplo (2026-07-25)

## 1. Issue Summary

**Problem:** Meal slots today support at most main + one companion. Lunch has no dedicated soup role; lunch/dinner do not enforce Harvard plate coverage (protein + vegetables + carb). Breakfast and snacks use a different persistence shape than lunch/dinner. AI prompts spend capacity on inventing meal *structure* (`plateKind` complete/needs_companion) instead of recipe content. UI does not make each dish’s nutritional role obvious.

**Discovered:** Stakeholder request during post-MVP sprint (2026-07-25), after Epics 1–4 done and Epic 5 chrome in review.

**Evidence:**
- Schema: `menu_slots.recipe_id` + `companion_recipe_id` only; snacks via separate `menu_snacks`.
- Domain: `plateKind` binary + keyword plate-complete guards; no soup / protein / veg / carb roles.
- UI: companion labeled as «гарнир»; no role rail for Harvard components.
- Prior specs (`spec-menu-meal-mix-*`, `spec-fix-protein-*`) improved pairing quality but did not introduce Harvard structure.

## 2. Impact Analysis

### Epic Impact

| Epic | Impact |
| ---- | ------ |
| Epic 1–4 | Done — no reopen. Behaviors extend via new epic. |
| Epic 5 | Unaffected (chrome only). Finish/review independently. |
| **Epic 6 (new)** | Harvard plate + uniform Slot dish model + template-driven AI + role UI. |

### Story Impact

| Story | Scope |
| ----- | ----- |
| **6.1** | Schema migration, meal templates, composition rules, load/shopping/history adapters |
| **6.2** | Plan/invent/assign prompts & orchestration — code structures, AI fills |
| **6.3** | Role-labeled Menu UI + per-role resuggest/refuse |

### Artifact Conflicts

| Artifact | Change |
| -------- | ------ |
| PRD | Glossary + extend FR-3; add FR-25…FR-28; MVP in-scope note |
| Epics | Epic 6 + stories; inventory FR26–FR29 (+ UX-DR17); crosswalk |
| Architecture Spine | AD-12; ER update; AD-4 clarifying line |
| UX EXPERIENCE / DESIGN | `slot-dish-line`; UX-DR17; RU role labels |
| sprint-status.yaml | Add epic-6 + 6-1…6-3 backlog |
| Code (after create-story) | suggestions, menu load/actions, day-card-grid, migrations |

**FR numbering note:** Epics inventory already uses **FR25** for post-sign-in landing. New epics inventory IDs are **FR26–FR29**, mapping 1:1 to PRD **FR-25…FR-28**.

### Technical Impact

- Migration from binary companion FKs → child `menu_slot_dishes` (or equivalent).
- Snack persistence aligned to Slot dish pattern (role `snack`).
- Recipe metadata for multi-role coverage (`covers_roles`).
- Shopping list / history / resuggest must iterate all Slot dishes.
- Verify scripts for composition matrix (lunch soup + Harvard; dinner Harvard; breakfast/snack templates; plov coversRoles).

## 3. Recommended Approach

**Option 1 — Direct Adjustment (new epic):** Add Epic 6; do not rollback Epic 2 plate work; do not shrink MVP goals.

| | |
| --- | --- |
| Effort | High (schema + AI + UI) |
| Risk | Medium (migration of existing menus; prompt regression) |
| Rejected | Option 2 Rollback — current companion model is a stepping stone, not a mistake to erase |
| Rejected | Option 3 MVP cut — this *is* the desired product behavior |

**Rationale:** Clean backlog entry for create-story → dev-story; keeps Epic 5 chrome unblocked.

## 4. Detailed Change Proposals (approved incrementally)

### 4.1 Epics — `epics.md` — **[a]**

Add Epic 6 + Stories 6.1–6.3; inventory FR26–FR29, UX-DR17; coverage map + PRD crosswalk rows.

**Meal templates (product):**
- breakfast / second_breakfast: `[main]`
- lunch: `[soup, protein, veg, carb]`
- dinner / late_dinner: `[protein, veg, carb]`
- snack / перекус: `[snack]`

**Story keys (sprint-status):**
- `6-1-slot-dish-roles-schema-and-templates`
- `6-2-template-driven-ai-invent-assign`
- `6-3-role-labeled-menu-ui-and-per-role-edit`

### 4.2 PRD — `prd.md` — **[a]** (revised)

- Glossary: Plate role, Meal template, Harvard plate, Slot dish
- FR-3 extended for templates + multi-role coverage + uniform model
- FR-25 Harvard plate; FR-26 lunch soup; FR-27 code-structured suggestions; FR-28 uniform Slot dish
- §6.1 in scope for FR-25…FR-28

### 4.3 Architecture — `ARCHITECTURE-SPINE.md` — **[a]**

- AD-12 Meal templates & Slot dishes
- ER: MenuSlot → MenuSlotDish → Recipe; `covers_roles`
- AD-4: assign only into code-emitted role slots
- Capability map + binds update

### 4.4 UX — EXPERIENCE + DESIGN — **[a]**

- `slot-dish-line` with RU labels: Суп / Белок / Овощи / Углеводы / Основное / Перекус
- Same chrome for all meal types; lunch/dinner multi-line
- UX-DR17; overflow actions per role; multi-role line shows coverage chips
- No abandoned-scope copy

### 4.5 sprint-status.yaml — apply on final approval

```yaml
  epic-6: backlog
  6-1-slot-dish-roles-schema-and-templates: backlog
  6-2-template-driven-ai-invent-assign: backlog
  6-3-role-labeled-menu-ui-and-per-role-edit: backlog
  epic-6-retrospective: optional
```

## 5. Implementation Handoff

**Scope classification:** Moderate (backlog reorganization + multi-layer docs; then DEV).

| Role | Responsibility |
| ---- | -------------- |
| This session (on yes) | Apply doc edits + sprint-status |
| create-story | Produce `6-1-…md` ready-for-dev (then 6.2, 6.3) |
| dev-story | Implement against story file |
| code-review | After each story |

**Success criteria:**
1. Epics/PRD/Architecture/UX/sprint-status agree on Epic 6 + FR-25…28 / FR26–29.
2. First backlog story is `6-1-…` for create-story auto-discover.
3. Implementation delivers soup lunch + Harvard dinner/lunch second + uniform breakfast/snack Slot dishes + role-clear UI + template-driven AI.

## Checklist status

| Section | Status |
| ------- | ------ |
| 1 Trigger & context | [x] Done |
| 2 Epic impact | [x] Done |
| 3 Artifact conflicts | [x] Done |
| 4 Path forward | [x] Option 1 selected |
| 5 Proposal components | [x] Done |
| 6 Final review / apply | [x] Approved and applied 2026-07-25 |
