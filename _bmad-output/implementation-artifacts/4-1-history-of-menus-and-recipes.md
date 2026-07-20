---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 4.1: History of Menus and Recipes

Status: done

## Story

As a operator (Sergey),
I want to see past Menus and Recipes,
So that I can recall what I cooked and leave Ratings.

## Acceptance Criteria

1. **Given** an authenticated operator with past Menus  
   **When** they open History from primary nav  
   **Then** past Menus/Recipes are listed for review (FR24, UX-DR12)  
   **And** History feeds AI cook-recency / Rating weights (Epic 2) — it is not a manual slot-pick UI

2. **Given** no past Menus  
   **When** History is empty  
   **Then** empty state routes to Create Menu — not a Recipe library browse (UX-DR12, UX-DR14)

## Tasks / Subtasks

- [x] `loadHistory` domain query
- [x] `/history` Soft Workshop list + empty CTA
- [x] Link back to menu; snacks listed too

### Review Findings

- [x] [Review][Patch] Empty state → Create Menu, not a library browse
- [x] [Review][Patch] Deduplicate recipes/snacks per menu card

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- History is review + rating surface; AI already reads ratings/refusals from Epic 2.

### File List

- `src/domain/history/load-history.ts`
- `app/(authenticated)/history/page.tsx`
- `_bmad-output/implementation-artifacts/4-1-history-of-menus-and-recipes.md`

### Change Log

- 2026-07-20: History list + empty state; status → done.
