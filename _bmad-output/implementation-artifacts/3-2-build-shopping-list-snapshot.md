---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 3.2: Build Shopping list snapshot

Status: done

## Story

As a operator (Sergey),
I want one combined Shopping list for the Menu with staples included by default,
So that I can go buy without rebuilding the cart by hand.

## Acceptance Criteria

1. **Given** a Menu with CheckedMatch rows and optional Snacks  
   **When** `buildShoppingList(menuId)` runs  
   **Then** it materializes a Shopping list snapshot from CheckedMatch Products plus default staple/pantry lines (FR11 list side, FR17, AD-11)  
   **And** there is no per-item in-app pantry opt-in prompt and no in-app list editing as primary path

2. **Given** the Shopping list surface  
   **When** the operator views it  
   **Then** Product names are shown (not match jargon); calm copy notes staples can be filtered at the store (UX-DR9)  
   **And** regenerating after slot/match changes replaces the snapshot (AD-11)

## Tasks / Subtasks

- [x] Tables `shopping_lists` / `shopping_list_lines` + RLS
- [x] `buildShoppingList` regenerate-replace snapshot
- [x] Wire `/plan/shopping-list` after UJ-1
- [x] Anon RLS verify script

### Review Findings

- [x] [Review][Patch] Deduplicate products across matches + snacks
- [x] [Review][Patch] Pantry lines labeled with filter-at-store copy

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- AD-11 snapshot rebuilt on each page load; matched / pantry / snack kinds.

### File List

- `supabase/migrations/20260720090000_slot_servings_shopping_lists.sql`
- `src/domain/shopping/build-list.ts`
- `app/(authenticated)/plan/shopping-list/page.tsx`
- `src/components/shopping/shopping-list-view.tsx`
- `scripts/verify-rls-shopping-lists.mjs`
- `_bmad-output/implementation-artifacts/3-2-build-shopping-list-snapshot.md`

### Change Log

- 2026-07-20: Shopping list snapshot materialization; status → done.
