---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 2.6: Record Refusal

Status: done

## Story

As a operator (Sergey),
I want to refuse a Recipe before cooking,
So that it is not suggested again.

## Acceptance Criteria

1. **Given** a Recipe on a Menu slot  
   **When** the operator records a Refusal  
   **Then** the Refusal is stored against that Recipe (FR8)  
   **And** the slot is cleared (UX slot-card)

2. **Given** a refused Recipe  
   **When** AI suggestions run later  
   **Then** that Recipe is hard-suppressed (FR8, AD-4)

## Tasks / Subtasks

- [x] Persist Refusal — delivered in Story 2.4 (`refuseSlotAction` → `recipe_refusals` + clear slot + clear CheckedMatch)
- [x] Hard-suppress path — Story 2.3 `loadSuppressSets` / `isHardSuppressed` in generate + resuggest
- [x] UI Refusal control on slot-card — Story 2.4
- [x] Verify suppress logic still covered by `scripts/verify-suggestions-logic.mjs`

### Review Findings

- [x] [Review][Defer] Dedicated Refusal confirmation dialog — optional UX polish later
- [x] [Review][Defer] Cross-user dual-client RLS harness for refusals — same as menus smoke gap

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- No new schema: `recipe_refusals` from 2.3; write UI + clear from 2.4; suppress in suggestions module.
- Story closes the FR8 loop without duplicate implementation.

### File List

- (reuse) `src/domain/menu/slot-actions.ts` — `refuseSlotAction`
- (reuse) `src/domain/suggestions/suppress.ts`
- (reuse) `src/components/menu/slot-card-actions.tsx`
- `_bmad-output/implementation-artifacts/2-6-record-refusal.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Story closed — Refusal already shipped via 2.3/2.4; status → done.
