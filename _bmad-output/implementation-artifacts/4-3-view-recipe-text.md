---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 4.3: View Recipe text

Status: done

## Story

As a operator (Sergey),
I want to open Recipe text from Menu, History, or Shopping list,
So that shopping and cooking are easier — without a cook-along mode.

## Acceptance Criteria

1. **Given** a Recipe name on Menu, History, or Shopping list  
   **When** the operator opens it  
   **Then** `recipe-text-panel` shows full Recipe text as a Dialog (one modal depth) (FR22, UX-DR13)

2. **Given** the panel is open  
   **When** the operator presses Esc  
   **Then** the panel closes without discarding saved Menu state (UX-DR13, UX-DR15)

3. **Given** cooking aid scope for v1  
   **When** Recipe text is available  
   **Then** there are no step timers or guided cook-along flows (FR22, UX-DR16)

## Tasks / Subtasks

- [x] Migration `recipes.body_text`
- [x] Radix Dialog + `RecipeTextPanel`
- [x] Wire Menu day cards, History rows, Shopping list recipes section
- [x] Esc close via Dialog (no timers)

### Review Findings

- [x] [Review][Patch] One modal depth; Esc closes without mutating menu
- [x] [Review][Patch] Empty body_text shows calm placeholder — never invent steps

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Recipe text is read-only dialog aid; no cook-along.

### File List

- `supabase/migrations/20260720100000_history_ratings_recipe_text.sql`
- `src/components/ui/dialog.tsx`
- `src/components/recipes/recipe-text-panel.tsx`
- `src/domain/recipes/load-recipe.ts`
- `src/domain/menu/load-menu.ts`
- `src/components/menu/day-card-grid.tsx`
- `app/(authenticated)/plan/shopping-list/page.tsx`
- `app/(authenticated)/history/page.tsx`
- `_bmad-output/implementation-artifacts/4-3-view-recipe-text.md`

### Change Log

- 2026-07-20: Recipe text panel on Menu/History/Shopping list; status → done.
