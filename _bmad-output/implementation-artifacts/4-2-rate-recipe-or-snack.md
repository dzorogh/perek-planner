---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 4.2: Rate Recipe or Snack

Status: done

## Story

As a operator (Sergey),
I want to leave like/dislike plus a reason after trying a Recipe or Snack,
So that AI uses that later (dislike never suggested again).

## Acceptance Criteria

1. **Given** a past Recipe or Snack in History  
   **When** the operator uses `history-rating-row`  
   **Then** they can set like/dislike and a reason from: too hard, not tasty, too long, other (FR9, UX-DR12)

2. **Given** a dislike Rating  
   **When** AI suggestions run later  
   **Then** that item is hard-suppressed from suggestions in v1 (FR9)

3. **Given** a submitted Rating  
   **When** the operator returns to History  
   **Then** the Rating remains editable after submit; no forced post-cook interrupt screen (FR9, UX-DR12)

## Tasks / Subtasks

- [x] Migration: `recipe_ratings.reason` + `snack_ratings` + RLS
- [x] Upsert actions for recipe/snack ratings
- [x] `HistoryRatingRow` UI
- [x] Snack search hard-suppress disliked products (fail-closed)
- [x] Recipe dislike already wired via Epic 2 `loadSuppressSets`

### Review Findings

- [x] [Review][Patch] Fail-closed snack dislike query errors
- [x] [Review][Patch] Editable after submit; calm confirmation copy

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Reasons v1 taxonomy; medium kept for schema/AI weighting compatibility.

### File List

- `supabase/migrations/20260720100000_history_ratings_recipe_text.sql`
- `src/domain/history/constants.ts`
- `src/domain/history/rating-actions.ts`
- `src/components/history/history-rating-row.tsx`
- `src/domain/menu/snack-actions.ts`
- `scripts/verify-rls-snack-ratings.mjs`
- `_bmad-output/implementation-artifacts/4-2-rate-recipe-or-snack.md`

### Change Log

- 2026-07-20: Rating UI + snack suppress; status → done.
