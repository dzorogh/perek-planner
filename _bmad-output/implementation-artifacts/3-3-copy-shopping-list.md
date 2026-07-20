---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 3.3: Copy Shopping list

Status: done

## Story

As a operator (Sergey),
I want to always copy the Shopping list,
So that I can buy even when no store link exists.

## Acceptance Criteria

1. **Given** a materialized Shopping list  
   **When** the operator uses `shopping-list-cta` copy  
   **Then** the list is copied to the clipboard (FR18, UX-DR9)  
   **And** copy works even if no store link is available (FR18, FR19)

2. **Given** a successful copy  
   **When** confirmation is shown  
   **Then** Russian copy is calm (e.g. «Список скопирован.») and the list remains visible (UX-DR14)

## Tasks / Subtasks

- [x] `formatShoppingListCopy` + clipboard CTA
- [x] Confirm copy independent of store link
- [x] Verify script for copy formatting

### Review Findings

- [x] [Review][Patch] Omit missing prices from copy (no fabricated values)

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Primary CTA always available; confirmation does not navigate away.

### File List

- `src/domain/shopping/build-list.ts`
- `src/components/shopping/shopping-list-view.tsx`
- `scripts/verify-shopping-list-logic.mjs`
- `_bmad-output/implementation-artifacts/3-3-copy-shopping-list.md`

### Change Log

- 2026-07-20: Copy CTA + calm confirmation; status → done.
