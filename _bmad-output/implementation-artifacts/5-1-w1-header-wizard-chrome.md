---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 5.1: W1 header and wizard chrome

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want the app header and plan stepper to match the W1 UX chrome,
So that Create Menu, History, and plan steps do not fight for the same active state and the brand is clear.

## Acceptance Criteria

1. **Given** an authenticated operator on any planning surface (`/`, `/plan/menu`, `/plan/shopping-list`)  
   **When** the shell renders  
   **Then** global header shows L3 brand-mark + wordmark **Keplo** (no subtitle under brand), CTA «Создать меню», links «История» / «Настройки», and «Выйти»  
   **And** a wizard bar under the header shows pills `Новое меню · Меню · Список` with correct active step  
   **And** «Создать меню» is a primary-styled CTA in the global header — not a plain text twin of the wizard step (UX-DR4, DESIGN W1)

2. **Given** the operator is on History or Settings  
   **When** the shell renders  
   **Then** the wizard bar is **absent**  
   **And** no plan step (including «Новое меню») appears active  
   **And** the matching global link is marked current (UX-DR4, EXPERIENCE Off-plan surface)

3. **Given** UJ-1 slot-edit gate  
   **When** `slot_edit_passed` is false or `menuId` is missing  
   **Then** «Список» remains blocked as today (title / aria-disabled)  
   **And** this story does not change gate semantics — only chrome placement/labels (FR23)

4. **Given** visual contract  
   **When** comparing to `mockups/mock-header-nav-w1-2026-07-20.html`  
   **Then** layout matches W1 (two rows; Soft Workshop / Lavender tokens; pill active styles unchanged in spirit)  
   **And** older mocks that put pills inside the global header are ignored for chrome

## Tasks / Subtasks

- [x] Restructure `AppHeader` / shell chrome into W1 layers (AC: #1, #2, #4)
  - [x] Global header row: brand (L3 + Keplo) · CTA «Создать меню» · История · Настройки · Выйти
  - [x] Remove subtitle «Планировщик меню» under wordmark (approved W1 has no subtitle)
  - [x] Wizard bar as **second row** under header (quiet `#F8FAFC` / border-b); optional «План» label
  - [x] Render wizard bar only on plan routes: `/`, `/plan/menu`, `/plan/shopping-list` (and legacy `/plan/portions` if still hit — treat as plan or redirect; do not show on `/history`, `/settings`)
  - [x] Keep `warning-stale` below chrome (do not break Story 1.5 placement)

- [x] Brand mark L3 + wordmark (AC: #1, #4)
  - [x] Add reusable mark (inline SVG or tiny component): 32×32, rx≈9, primary fill, three vertical bars (outer `background`, mid `snacks-border`)
  - [x] Wordmark text exactly `Keplo` — section-title / accent, tracking ≈ −0.03em
  - [x] Brand link targets `/` (Create Menu); mark + wordmark share one link

- [x] Global nav CTA + links (AC: #1, #2)
  - [x] «Создать меню» → `/` as `button-create` (primary fill, rounded-sm) — not a muted text link styled like History
  - [x] PrimaryNav: only «История» + «Настройки» as text links (remove «Создать меню» from the text-link list OR keep single CTA source of truth)
  - [x] Fix active state: on History/Settings highlight that link; on plan routes do **not** force `activeHref="/"` onto a text «Создать меню» twin; CTA may use subtle current styling only when pathname is `/` if desired — never mark a plan pill via PrimaryNav
  - [x] Logout unchanged

- [x] Wizard `pill-nav` labels + visibility (AC: #1, #2, #3)
  - [x] Rename step 0 label `Дни` → `Новое меню` (href `/` unchanged)
  - [x] Keep `Меню` → `/plan/menu`, `Список` → `/plan/shopping-list`
  - [x] Preserve UJ-1 block on Список (`getSlotEditPassedAction` + menuId)
  - [x] Preserve menuId query passthrough on menu/list links
  - [x] When wizard hidden, ensure no leftover active pill DOM on History/Settings

- [x] Tests / smoke (AC: #1–#4)
  - [x] Update `e2e/shell-bypass.spec.ts`: assert wizard visible on `/`, hidden on `/history` and `/settings`; step label «Новое меню»; CTA present; brand «Keplo»
  - [x] Assert on `/history` the «Шаги планирования» nav is not visible (or not in document)
  - [x] Manual keyboard: tab through global header then wizard when present; focus rings visible

## Dev Notes

### Why this story exists

Epics 1–4 shipped an earlier chrome where `PillNav` and `PrimaryNav` share one header row. Finalized UX (2026-07-20) **overrides** that: W1 two-layer chrome. Product rename is **Keplo**. Step 0 form is richer than days alone → label «Новое меню». Portion plan is **not** a wizard step (already reflected in current 3-step pills; do not re-add «Порции»).

### Canonical UX sources (spines win)

- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md` — Layout & Spacing «App chrome (W1)»; Components brand-mark / wordmark / button-create / wizard-bar / pill-nav]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md` — Global vs plan chrome; Off-plan surface; Component Patterns `button-create`, `wizard-bar`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/mockups/mock-header-nav-w1-2026-07-20.html`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5 / Story 5.1; UX-DR4 revised]

### Current code to UPDATE (read before editing)

| File | Today | Story change |
|---|---|---|
| `src/components/layout/app-header.tsx` | Single header row; wordmark + subtitle; PillNav + PrimaryNav + Logout side-by-side; `resolvePillActiveHref` defaults to `/` so History still “activates” Дни via PillNav always mounted | Split into global header + conditional wizard bar; brand L3; no subtitle; fix active-href logic so off-plan does not mount/highlight wizard |
| `src/components/layout/pill-nav.tsx` | Steps `Дни · Меню · Список`; always rendered when AppHeader mounts | Rename to `Новое меню`; keep UJ-1 gate; may accept `hidden` via parent not mounting |
| `src/components/layout/primary-nav.tsx` | Links Создать меню / История / Настройки; active `/` on non-history/settings | CTA moves to button-create; text links History/Settings only; active only for those routes |
| `src/components/layout/app-shell.tsx` | Header then main | May wrap header+wizard; keep max-width 1180; stale banner callers unchanged |
| `e2e/shell-bypass.spec.ts` | Expects «Шаги планирования» on home and navigates Меню; visits History via Основная навигация | Update selectors/labels; add History/Settings wizard-hidden assertions |

### Must preserve

- UJ-1 list gate (`getSlotEditPassedAction`, blocked span + title)
- `menuId` query on plan links
- Soft Workshop tokens / existing pill active classes (surface + primary + shadow-sm)
- Logout, Settings store-picker, History rating flows
- Auth / bypass-auth e2e env behavior
- Russian UI copy workshop voice

### Out of scope

- Redesigning Create Menu form fields (days/people/meals already exist)
- Reintroducing Portion plan wizard step or `portion-plan-grid` chrome
- Changing Shopping list / generation domain logic
- Dark mode, mobile breakpoints, new destinations in global nav
- Replacing Geist or Lavender palette

### Architecture compliance

- Client components for pathname/searchParams stay in `src/components/layout/`
- Domain calls (`getSlotEditPassedAction`) stay in pill/wizard — do not move UJ-1 into a new domain module unless needed
- No new npm dependencies
- Stack: Next App Router, shadcn Button optional for CTA — match existing `Button` if already used for primary actions

### Previous story intelligence

- Story 1.1 established shell + Soft Workshop; pills were placeholders «Дни · Меню · План порций · Shopping list» — **superseded** for chrome by this story
- Story 2.4 owns UJ-1 gate semantics — do not weaken
- Story 3.1 portion plan UI largely retired in product (people at create); chrome must not resurrect «Порции» pill

### Git intelligence

- Repo still has single init commit pattern; treat layout files above as the live SoT

### Testing requirements

- Prefer updating Playwright `e2e/shell-bypass.spec.ts` (already covers shell under bypass auth)
- Optional small unit/pure helpers if you extract `isPlanRoute(pathname)` / `resolveWizardActiveHref` — keep testable without DOM if extracted
- Lint must pass on touched files

### Project Structure Notes

- New tiny component OK: e.g. `src/components/layout/brand-mark.tsx` or inline in header
- Do not invent `src/components/nav/` parallel tree
- Product name in UI: **Keplo** (package.json already `keplo`)

### References

- UX DESIGN Layout W1 + Components: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md`
- UX EXPERIENCE chrome table: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md`
- Mock: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/mockups/mock-header-nav-w1-2026-07-20.html`
- Epics Epic 5: `_bmad-output/planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Completion Notes List

- Implemented W1 two-row chrome: global header (L3 + Keplo, primary CTA «Создать меню», History/Settings, Logout) + wizard bar only on plan routes.
- Extracted `plan-chrome.ts` helpers; pure smoke in `scripts/verify-plan-chrome-logic.mjs` (wired into `npm run verify:logic`).
- Renamed wizard step 0 to «Новое меню»; UJ-1 list gate unchanged in `pill-nav.tsx`.
- Off-plan: wizard unmounted — no false «Новое меню» active on History/Settings.
- E2E `e2e/shell-bypass.spec.ts` updated and passing.

### File List

- `src/components/layout/app-header.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/brand-mark.tsx` (new)
- `src/components/layout/plan-chrome.ts` (new)
- `src/components/layout/primary-nav.tsx`
- `src/components/layout/pill-nav.tsx`
- `scripts/verify-plan-chrome-logic.mjs` (new)
- `e2e/shell-bypass.spec.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/5-1-w1-header-wizard-chrome.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-20: Story created from finalized W1 UX (header/nav update); Epic 5 added to epics + sprint-status.
- 2026-07-20: Implemented W1 chrome; status → review.
