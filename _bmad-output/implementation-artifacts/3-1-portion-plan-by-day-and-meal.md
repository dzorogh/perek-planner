---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 3.1: Portion plan by day and meal

Status: done

## Story

As a operator (Sergey),
I want to see and adjust servings by day and meal (default two people × three meals),
So that food covers the whole Menu.

## Acceptance Criteria

1. **Given** a Menu that has passed slot edit  
   **When** the operator opens Portion plan  
   **Then** `portion-plan-grid` shows every day × breakfast/lunch/dinner, including empty slots (FR5, UX-DR8)  
   **And** new Menu defaults are 3 meals/day × 2 people (FR2)

2. **Given** editable servings  
   **When** the operator changes counts before Shopping list  
   **Then** values persist on the Menu and are used for later list quantities (FR2, FR5)  
   **And** Portion plan is visible without checkout (FR5)  
   **And** UJ-1 continues from slot edit → Portion plan → Shopping list (FR23)

## Tasks / Subtasks

- [x] Migration `menu_slots.servings` default 2 (1–20)
- [x] `updateSlotServingsAction` + load servings in `loadMenuSkeleton`
- [x] `PortionPlanGrid` on `/plan/portions` behind UJ-1 gate
- [x] CTA to Shopping list

### Review Findings

- [x] [Review][Patch] Persist servings on blur/submit; revalidate portions + shopping-list paths
- [x] [Review][Defer] Per-product quantity scaling from servings — catalog matches are product-identity; servings remain cook-plan source of truth

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Soft Workshop day cards with per-slot servings; empty slots included; snacks excluded from portion grid.

### File List

- `supabase/migrations/20260720090000_slot_servings_shopping_lists.sql`
- `src/domain/menu/portion-actions.ts`
- `src/domain/menu/load-menu.ts`
- `src/components/menu/portion-plan-grid.tsx`
- `app/(authenticated)/plan/portions/page.tsx`
- `_bmad-output/implementation-artifacts/3-1-portion-plan-by-day-and-meal.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Portion plan grid + servings persistence; status → done.
