---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 2.5: Add Snacks to Menu

Status: done

## Story

As a operator (Sergey),
I want to add no-cook Snacks to the same Menu,
So that they join the same Order without a cook session.

## Acceptance Criteria

1. **Given** a Menu on slot edit  
   **When** the operator adds Snacks via `snacks-bar` / `snack-chip`  
   **Then** Snacks are persisted on the Menu and shown in the dashed snacks aggregate (FR4, UX-DR7)

2. **Given** Snacks on the Menu  
   **When** Shopping list is built later (Epic 3)  
   **Then** Snack Products are included in the same list/order  
   **And** Snacks do not require a cook session (FR4)

## Tasks / Subtasks

- [x] Migration `menu_snacks` + RLS owner-only
- [x] Domain snack add/remove/search (store snapshot, fresh catalog, in_stock)
- [x] `SnacksBar` UI on `/plan/menu`
- [x] Load snacks in `loadMenuSkeleton`
- [x] Verify anon RLS + lint/build

### Review Findings

- [x] [Review][Patch] Escape ILIKE wildcards in snack search
- [x] [Review][Patch] Avoid sync setState-in-effect in SnacksBar search
- [x] [Review][Defer] Shopping list lines for snacks — Epic 3

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- `menu_snacks(menu_id, product_id)` unique; Soft Workshop dashed bar; product search by Menu store.
- List materialization deferred to Epic 3 (AC#2 handoff).

### File List

- `supabase/migrations/20260720080000_menu_snacks.sql`
- `src/domain/menu/snack-actions.ts`
- `src/domain/menu/load-menu.ts`
- `src/components/menu/snacks-bar.tsx`
- `app/(authenticated)/plan/menu/page.tsx`
- `scripts/verify-rls-menu-snacks.mjs`
- `_bmad-output/implementation-artifacts/2-5-add-snacks-to-menu.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Implemented snacks bar + schema; review patches applied; status → done.
