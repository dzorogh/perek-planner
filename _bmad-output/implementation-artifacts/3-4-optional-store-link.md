---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 3.4: Optional store link

Status: done

## Story

As a operator (Sergey),
I want to open a store link when one works,
So that handoff is faster — while copy remains the reliable path.

## Acceptance Criteria

1. **Given** a working the store link can be produced  
   **When** the operator uses the secondary store-link control  
   **Then** it opens outside the app (new tab) and is labeled as external (FR19, UX-DR9, UX-DR15)

2. **Given** the link is missing or broken  
   **When** the Shopping list handoff is shown  
   **Then** planning and copy are not blocked; the link control is hidden or disabled with a plain explanation — not an error wall (FR18, FR19)

## Tasks / Subtasks

- [x] Derive store URL from Menu snapshot `stores.external_id` when non-placeholder
- [x] Secondary link control; plain explanation when missing

### Review Findings

- [x] [Review][Patch] Hide/disable link for placeholder external_id; never block copy

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Transport: `https://www.the store website/cat?shop={external_id}` when available.

### File List

- `src/domain/shopping/build-list.ts`
- `src/components/shopping/shopping-list-view.tsx`
- `_bmad-output/implementation-artifacts/3-4-optional-store-link.md`

### Change Log

- 2026-07-20: Optional store link; status → done.
