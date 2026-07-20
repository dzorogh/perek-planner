---
name: keplo
description: Personal batch-cooking planner for the grocery store. shadcn/ui on Next.js + Tailwind; this DESIGN.md specifies the brand-layer delta only (Soft Workshop + Lavender Workshop).
status: final
sources:
  - {planning_artifacts}/prds/prd-keplo-2026-07-19/prd.md
  - {planning_artifacts}/prds/prd-keplo-2026-07-19/addendum.md
  - {planning_artifacts}/briefs/brief-keplo-2026-07-19/brief.md
  - {planning_artifacts}/briefs/brief-keplo-2026-07-19/addendum.md
updated: 2026-07-20
# Menu composition: meal lanes + slot-overflow (Update 2026-07-20)
colors:
  # Brand overrides on top of shadcn defaults. All unlisted tokens inherit
  # from shadcn (card, card-foreground, popover, input, ring, destructive, etc.).
  background: '#EEF2FF'
  surface: '#FFFFFF'
  foreground: '#1E293B'
  muted: '#64748B'
  muted-foreground: '#64748B'
  primary: '#4338CA'
  primary-foreground: '#FFFFFF'
  accent: '#312E81'
  accent-foreground: '#FFFFFF'
  border: '#E0E7FF'
  warning-bg: '#FEF9C3'
  warning-fg: '#854D0E'
  warning-border: '#FDE047'
  empty-slot: '#F8FAFC'
  slot-label: '#94A3B8'
  snacks-border: '#C7D2FE'
typography:
  # Body, label, and UI inherit from shadcn (Geist Sans) unless overridden below.
  page-title:
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  section-title:
    fontSize: 17px
    fontWeight: '700'
    lineHeight: '1.3'
  day-head:
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1.4'
  slot-label:
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.04em
  slot-name:
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.35'
  body-sm:
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  caption:
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  # Softer and rounder than default shadcn — Soft Workshop register.
  sm: 10px
  md: 12px
  lg: 14px
  xl: 16px
  full: 9999px
spacing:
  page-gutter: 28px
  page-gutter-wide: 40px
  content-padding-x: 28px
  card-padding: 16px
  slot-padding-y: 12px
  grid-gap: 16px
  section-gap: 20px
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.sm}'
    fontWeight: '600'
  button-ghost:
    background: '{colors.background}'
    foreground: '{colors.primary}'
    radius: '{rounded.sm}'
    fontWeight: '500'
  brand-mark:
    size: 32px
    radius: 9px
    background: '{colors.primary}'
    bar-fill: '{colors.background}'
    bar-fill-mid: '{colors.snacks-border}'
  wordmark:
    typography: '{typography.section-title}'
    foreground: '{colors.accent}'
    letterSpacing: -0.03em
    text: Keplo
  button-create:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.sm}'
    fontWeight: '600'
  pill-nav:
    track-background: '{colors.background}'
    active-background: '{colors.surface}'
    active-foreground: '{colors.primary}'
    inactive-foreground: '{colors.muted}'
    radius: '{rounded.full}'
  wizard-bar:
    background: '#F8FAFC'
    border: '{colors.border}'
    label-foreground: '{colors.muted}'
  meal-lane:
    label-width: 108px
    column-gap: 16px
    row-padding-y: 16px
    row-border: '#F1F5F9'
  day-axis:
    foreground: '{colors.accent}'
    fontWeight: '600'
    fontSize: 13px
  slot-cell:
    background: '{colors.empty-slot}'
    radius: '{rounded.md}'
    padding: 12px 14px
    min-height: 56px
  slot-cell-empty:
    background: '{colors.empty-slot}'
    slot-name-foreground: '{colors.slot-label}'
  slot-label:
    foreground: '{colors.slot-label}'
    typography: '{typography.slot-label}'
  slot-overflow:
    trigger-foreground: '{colors.muted}'
    trigger-active-foreground: '{colors.primary}'
    trigger-active-background: '{colors.background}'
    menu-background: '{colors.surface}'
    menu-border: '{colors.border}'
    menu-radius: '{rounded.md}'
  # day-card / slot-card: superseded for Menu+slot-edit by meal-lane + slot-cell (2026-07-20).
  # Tokens kept only if a non-Menu surface still references day columns.
  day-card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    head-background: '{colors.background}'
    head-foreground: '{colors.accent}'
  slot-card:
    background: '{colors.surface}'
    border-bottom: '#F1F5F9'
    padding-y: '{spacing.slot-padding-y}'
  slot-card-empty:
    background: '{colors.empty-slot}'
    slot-name-foreground: '{colors.slot-label}'
  warning-stale:
    background: '{colors.warning-bg}'
    foreground: '{colors.warning-fg}'
    border: '{colors.warning-border}'
    radius: '{rounded.md}'
    icon-background: '{colors.warning-border}'
  snacks-bar:
    background: '{colors.surface}'
    border: '{colors.snacks-border}'
    border-style: dashed
    radius: '{rounded.lg}'
    title-foreground: '{colors.primary}'
  snack-chip:
    background: '{colors.background}'
    foreground: '{colors.accent}'
    radius: '{rounded.full}'
  shopping-list-cta:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    button-background: '{colors.primary}'
    button-foreground: '{colors.primary-foreground}'
  history-rating-row:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    like-foreground: '{colors.primary}'
    dislike-foreground: '{colors.muted}'
---

## Brand & Style

keplo is a personal batch-cooking planner: pick 1–4 days and people/meals on Create **Menu**, edit a Menu of Recipes, and leave with a copyable Shopping list for one grocery order and one cook session. The product posture is **home food, not restaurant** — simple batch cooking for a multi-day Menu, not a showcase of unique dishes per day. The visual direction is **Soft Workshop** — calm rounded surfaces, friendly home-workshop register, and **meal-lane** Menu composition (meal types as rows, days as columns) rather than stacked day-card columns. The palette is **Lavender Workshop**: cool lavender page ground, white work surfaces, and cold indigo (`#4338CA`) as the action accent — not default purple SaaS.

Visual references: [header + wizard chrome W1](mockups/mock-header-nav-w1-2026-07-20.html) *(canonical app chrome)*, [Menu + slot edit — meal lanes](mockups/mock-menu-edit.html) *(canonical Menu composition)*, [meal-lanes exploration](mockups/menu-compose-c-meal-lanes.html), [direction B shell](mockups/direction-b-soft-workshop.html) *(shell/palette exploration; Menu day-columns layout superseded)*, [color theme exploration](mockups/color-themes-soft-workshop.html), [Create Menu](mockups/mock-create-menu.html), [Shopping list](mockups/mock-shopping-list.html), [History + Rating](mockups/mock-history-rating.html). [Portion plan mock](mockups/mock-portion-plan.html) is historical — not a wizard step. Older day-column Menu mocks and header-embedded pills are **superseded** — spines win on conflict.

keplo inherits **shadcn/ui** on Next.js + Tailwind wholesale. This file specifies only brand-layer deltas — Lavender Workshop palette, Soft Workshop shape/spacing, and product-specific component skins. Standard shadcn components inherit shadcn visual specs unless listed under Components below.

**Light mode only** for v1 — no dark tokens. **Desktop web** is the form factor; UI copy is Russian. **PRD wins on conflict** with the product brief for v1 UX scope (no match-review UI, no fallback-after-planning flow, no ready packs, no in-app Shopping list edit as primary path).

**Geist Sans** (shadcn default) is locked for v1 — body, labels, and UI inherit shadcn's type ramp. Direction B mockups used system-ui for exploration only; implementation uses Geist.

## Colors

Lavender Workshop replaces shadcn's default neutral and primary tokens. Everything not listed inherits shadcn defaults.

- **Page background (`#EEF2FF`)** — cool lavender-gray canvas. Sets the workshop atmosphere; not used for card fills.
- **Surface (`#FFFFFF`)** — work panel, browser chrome content, overflow menus, Shopping list CTA block.
- **Foreground (`#1E293B`)** — primary body and Recipe titles in slot cells.
- **Muted (`#64748B`)** — secondary copy: page subtitles, overflow trigger at rest, de-emphasized chrome links.
- **Primary indigo (`#4338CA`)** — main actions, active nav pill, open overflow trigger, primary buttons. Cold indigo — not purple SaaS default.
- **Primary foreground (`#FFFFFF`)** — text on primary-filled buttons.
- **Accent dark (`#312E81`)** — brand wordmark weight, day-axis labels. Structural emphasis, not a second CTA color.
- **Border (`#E0E7FF`)** — soft work-panel outlines, header dividers, pill-nav track separation, open slot-cell outline.
- **Warning surface (`#FEF9C3` / `#854D0E` / `#FDE047`)** — stale catalog banner only. Explicit stale warning when planning uses non-fresh catalog data; never repurposed for generic alerts.
- **Empty slot (`#F8FAFC`)** — default slot-cell fill (filled and empty); reads "open workspace" not error. Open/focused cell lifts to `{colors.surface}`.
- **Slot label (`#94A3B8`)** — uppercase meal-lane labels (Завтрак / Обед / Ужин / Перекус) and empty-slot placeholder text.
- **Snacks border (`#C7D2FE`)** — reserved if a dashed Snacks aggregate appears outside Menu lanes; Menu **Перекус** uses the same `slot-cell` treatment as other meals.

Avoid: gradients on product surfaces, dark-mode variants, stock-badge colors (out of v1 scope), decorative accent fills unrelated to actions or stale warning.

## Typography

Body, labels, and form controls inherit shadcn's Geist Sans ramp unless overridden. Product type roles:

- **Page title** — 24px / 700 / −0.02em tracking. Menu and flow step headers ("Меню на 3 дня").
- **Section title** — 17px / 700. App wordmark **Keplo** in header (`{components.wordmark}`): `{colors.accent}`, −0.03em tracking; no kebab-case product string.
- **Day axis** — 13px / 600 in `{colors.accent}`. Column headers above meal lanes (День 1…N).
- **Slot label** — 11px / 600 / uppercase / +0.04em tracking in `{colors.slot-label}`. Meal-lane row label (left rail).
- **Slot name** — 14px / 600 in `{colors.foreground}`. Recipe title inside a slot cell.
- **Body sm** — 13px regular. Stale warning copy, nav pills, snack section labels.
- **Caption** — 12px regular in `{colors.slot-label}`. Footer hints, tertiary metadata.

Glossary terms (Menu, Recipe, Refusal, Snack, Shopping list, etc.) appear verbatim in UI copy — typography does not special-case them. No display or serif override in v1.

## Layout & Spacing

Soft Workshop Menu uses **calm meal-lane density**: Sergey reads meal types as quiet horizontal bands and days as columns — not a dense spreadsheet and not a stack of day cards with always-visible action rows. Desktop layout; max content width ~1120–1180px in mockups.

- **Page gutter** — 28–40px horizontal padding on the app shell.
- **Content padding** — 20px top / 28px horizontal / 28–32px bottom inside the plan content band.
- **Meal-lane grid** — left rail ~108px for meal labels; equal day columns (1–4); 16px column gap; ~16px vertical padding per lane; hairline `#F1F5F9` between lanes.
- **Work panel** — white `{colors.surface}` card on `{colors.background}` content band; holds page title + meal-lane grid.

Primary composition: **meal lanes × day columns**. Snacks included in the plan appear as a **Перекус** lane (same cell language), not a separate dashed bar below day cards.

**App chrome (W1):** two layers — never mixed in one control group.

1. **Global header** — brand mark (L3) + wordmark **Keplo** · primary CTA «Создать меню» · «История» · «Настройки» · «Выйти». Always present on authenticated surfaces.
2. **Wizard bar** — second row directly under the global header; `pill-nav` steps `Новое меню · Меню · Список`. Visible only on active plan surfaces (Create **Menu**, slot edit, **Shopping list**). **Hidden** on History and Settings — no false active step.

→ Visual contract: [header + wizard chrome W1](mockups/mock-header-nav-w1-2026-07-20.html).

shadcn / Tailwind 4-based spacing scale inherited for everything not listed. [NOTE FOR UX] Breakpoint behavior below ~1024px not designed in v1 artifacts — desktop-first only.

## Elevation & Depth

Depth is soft and indigo-tinted, not harsh Material elevation.

- **Rationale / info card** — `0 1px 3px rgba(49, 46, 129, 0.06)`.
- **App shell / browser frame** — `0 24px 60px rgba(49, 46, 129, 0.12)` in mockups (presentation chrome; production may flatten).
- **Active nav pill** — `0 1px 2px rgba(67, 56, 202, 0.15)`.

Hierarchy comes from **tonal layering** (`{colors.background}` page → `{colors.surface}` work panel → `{colors.empty-slot}` slot cells → `{colors.surface}` when a cell is open) and borders (`{colors.border}`), not heavy shadows. Slot cells do not lift on idle hover; open overflow state may use a light indigo-tinted shadow.

## Shapes

Soft Workshop corners are **rounder than default shadcn** — friendly workshop, not sharp tool.

- **`rounded/sm` (10px)** — buttons (primary, ghost).
- **`rounded/md` (12px)** — stale warning banner, slot cells, overflow menu.
- **`rounded/lg` (14px)** — Menu work panel, Shopping list CTA block, history rows.
- **`rounded/xl` (16px)** — outer app shell / presentation frame in mockups.
- **`rounded/full`** — pill nav track items, stale warning icon circle.

Meal lanes separate with hairline dividers (`#F1F5F9`); each day×meal intersection is a soft `{rounded.md}` cell — no nested card-in-card stacks.

## Components

Standard shadcn components ship unchanged unless noted. Brand-layer and product-specific skins:

- **brand-mark (L3)** — 32×32 rounded square (`9px`) on `{colors.primary}` with three vertical slot bars (day × meal cue): outer bars `{colors.background}`, middle `{colors.snacks-border}`. Sits left of the wordmark; not a separate clickable destination from brand home.
- **wordmark** — **Keplo** at section-title size/weight in `{colors.accent}`; letter-spacing −0.03em. No subtitle under the mark in the approved chrome.
- **button-create** — Global-header primary CTA «Создать меню»: `{colors.primary}` / `{colors.primary-foreground}`, `{rounded.sm}`, 600. Distinct from wizard `pill-nav` — starts or returns to Create **Menu** (step 0).
- **button-primary** — `{colors.primary}` fill, `{colors.primary-foreground}` text, `{rounded.sm}`, 600 weight. Forward CTAs in page content («Сгенерировать», «К списку», «Копировать список»). Other Button variants inherit shadcn defaults.
- **button-ghost** — `{colors.background}` fill, `{colors.primary}` text. Secondary actions ("Добавить Snack") that stay on the current step.
- **wizard-bar** — Full-width row under global header on plan surfaces only. Quiet track (`#F8FAFC`) + bottom `{colors.border}`; hosts `pill-nav`. Optional small uppercase label «План» in `{colors.muted}`.
- **pill-nav** — Track on `{colors.background}`; active segment `{colors.surface}` with `{colors.primary}` label and subtle indigo shadow; inactive `{colors.muted}`. **Wizard/plan steps only** (`Новое меню · Меню · Список`) — never co-located with History / Settings / Logout. Gate **Shopping list** until slot-edit pass (UJ-1) as today.
- **meal-lane** — Horizontal band: left `{slot-label}` rail + one `{slot-cell}` per day. Lane order follows planned meal types (e.g. Завтрак → Обед → Ужин → Перекус). → [mock](mockups/mock-menu-edit.html)
- **day-axis** — Column headers (День 1…N) above the lanes in `{colors.accent}` / 600.
- **slot-cell** — Day × meal intersection. Recipe name is the hero (`{typography.slot-name}`); name opens **Recipe** text. Default fill `{colors.empty-slot}`; no always-visible action button row. Empty: placeholder in `{colors.slot-label}` on the same cell chrome.
- **slot-overflow** — Equal-weight slot actions behind a always-focusable ⋯ control (`Заменить`, `Заменить все`, `Никогда не предлагать`). Menu uses `{colors.surface}` + `{colors.border}` + soft indigo shadow. Do not pin these actions as visible buttons on every cell.
- **slot-label** — Uppercase meal-lane rail treatment; see Typography.
- **warning-stale** — Full-width banner below wizard bar when catalog sync fails. `{colors.warning-bg}` / `{colors.warning-fg}` / `{colors.warning-border}`; circular `{colors.warning-border}` icon badge. Required whenever planning uses last-saved catalog — not optional chrome.
- **snacks-bar / snack-chip** — Historical Soft Workshop aggregate under day columns. **Superseded on Menu** by a **Перекус** meal lane when snacks are in the plan. Tokens retained only if a non-Menu surface still needs chips.
- **shopping-list-cta** — Summary block at Shopping list step: item count + cook-session context + primary button to the external store. Visual pattern from color-theme previews; exact copy in EXPERIENCE.md. [NOTE FOR UX] Single mockup snippet only — confirm layout parity with direction B shell.
- **history-rating-row** — Row in history of past Recipes/Menus for like/dislike + reason (Option A — no post-cook interrupt; editable after submit in v1). `{colors.surface}` card, `{colors.border}` outline, `{rounded.lg}`. Like affordance `{colors.primary}`; dislike de-emphasized `{colors.muted}`. [NOTE FOR UX] Exact row anatomy (inline vs expanded reason picker) not captured in visual artifacts.

Behavioral specs (Refusal, Rating reasons, store selection, slot replace) live in EXPERIENCE.md — this file is visual only.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Inherit shadcn defaults for everything not in the brand layer | Override shadcn tokens beyond Lavender Workshop palette and Soft Workshop shape/spacing |
| Use calm meal lanes (meal rows × day columns) for Menu slot edit; hide slot actions in ⋯ | Stack day cards with always-visible multi-button rows; collapse Menu into dense spreadsheet grids |
| Treat repeated sides across days as normal, successful batch planning | Celebrate per-day novelty, "chef's special" variety, or restaurant-style uniqueness as the default win |
| Present Menu as home batch cooking — practical, repeatable, workshop calm | Style or copy like a restaurant menu, food magazine, or daily tasting flight |
| Show explicit stale catalog warning with warning tokens | Hide stale state or reuse warning colors for non-catalog alerts |
| Keep cold indigo `#4338CA` as the sole action chroma | Introduce second CTA colors, gradients, or SaaS-purple defaults |
| Keep global header and wizard `pill-nav` in separate rows (W1) | Mix plan steps with History / Settings in one header group; leave plan pills active on History |
| Show L3 mark + **Keplo** wordmark in the global header | Plain kebab string alone; undeclared logo styles |
| Use `{rounded.lg}` and dashed snacks border for workshop friendliness | Sharp 4px corners (Drift-style) or fully flat borderless panels |
| Light mode only in v1 | Ship dark-mode tokens or `{colors.*-dark}` pairs |
| Reference mockups for layout intent | Invent screens out of PRD scope (match-review, fallback flow, ready packs, Pantry management screen, cook-once batch-component layer, cook timer UI) |
