---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 3.5: Price and nutrition when present

Status: done

## Story

As a operator (Sergey),
I want to see price and nutrition only when the catalog provides them,
So that the app never invents numbers.

## Acceptance Criteria

1. **Given** catalog fields for price and/or nutrition on a Product or Recipe  
   **When** those fields are present  
   **Then** the Shopping list (and related views) may display them (FR20)

2. **Given** missing price or nutrition fields  
   **When** the Shopping list is built or shown  
   **Then** missing values are omitted — not fabricated — and the list is not blocked (FR20)

## Tasks / Subtasks

- [x] Snapshot `price_cents` from Products onto list lines when present
- [x] UI/copy omit null prices
- [x] Nutrition omitted until catalog provides fields (no fabrication)

### Review Findings

- [x] [Review][Patch] Never invent price/nutrition placeholders
- [x] [Review][Defer] Nutrition column — catalog has no nutrition fields yet

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Price shown as ₽ when `price_cents` present; nutrition deferred pending catalog fields.

### File List

- `src/domain/shopping/build-list.ts`
- `src/components/shopping/shopping-list-view.tsx`
- `scripts/verify-shopping-list-logic.mjs`
- `_bmad-output/implementation-artifacts/3-5-price-and-nutrition-when-present.md`

### Change Log

- 2026-07-20: Price-when-present; nutrition deferred; status → done.
