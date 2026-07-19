---
name: perek-planner
description: Personal batch-cooking planner for Perekrestok. shadcn/ui on Next.js + Tailwind; this DESIGN.md specifies the brand-layer delta only (Soft Workshop + Lavender Workshop).
status: final
sources:
  - {planning_artifacts}/prds/prd-perek-planner-2026-07-19/prd.md
  - {planning_artifacts}/prds/prd-perek-planner-2026-07-19/addendum.md
  - {planning_artifacts}/briefs/brief-perek-planner-2026-07-19/brief.md
  - {planning_artifacts}/briefs/brief-perek-planner-2026-07-19/addendum.md
updated: 2026-07-19
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
  pill-nav:
    track-background: '{colors.background}'
    active-background: '{colors.surface}'
    active-foreground: '{colors.primary}'
    inactive-foreground: '{colors.muted}'
    radius: '{rounded.full}'
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
  slot-label:
    foreground: '{colors.slot-label}'
    typography: '{typography.slot-label}'
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

perek-planner is a personal batch-cooking planner: pick 1–4 days, edit a Menu of Recipes, build a Portion plan, and leave with a copyable Shopping list for one Perekrestok order and one cook session. The product posture is **home food, not restaurant** — simple batch cooking for a multi-day Menu, not a showcase of unique dishes per day. The visual direction is **Soft Workshop** — soft card columns, rounded corners, medium density, and a friendly home-workshop register rather than corporate SaaS chrome. The palette is **Lavender Workshop**: cool lavender page ground, white card surfaces, and cold indigo (`#4338CA`) as the action accent — not default purple SaaS.

Visual references: [direction B mockup](mockups/direction-b-soft-workshop.html), [color theme exploration](mockups/color-themes-soft-workshop.html), key-screen mocks — [Create Menu](mockups/mock-create-menu.html), [Menu + slot edit](mockups/mock-menu-edit.html), [Portion plan](mockups/mock-portion-plan.html), [Shopping list](mockups/mock-shopping-list.html), [History + Rating](mockups/mock-history-rating.html).

perek-planner inherits **shadcn/ui** on Next.js + Tailwind wholesale. This file specifies only brand-layer deltas — Lavender Workshop palette, Soft Workshop shape/spacing, and product-specific component skins. Standard shadcn components inherit shadcn visual specs unless listed under Components below.

**Light mode only** for v1 — no dark tokens. **Desktop web** is the form factor; UI copy is Russian. **PRD wins on conflict** with the product brief for v1 UX scope (no match-review UI, no fallback-after-planning flow, no ready packs, no in-app Shopping list edit as primary path).

**Geist Sans** (shadcn default) is locked for v1 — body, labels, and UI inherit shadcn's type ramp. Direction B mockups used system-ui for exploration only; implementation uses Geist.

## Colors

Lavender Workshop replaces shadcn's default neutral and primary tokens. Everything not listed inherits shadcn defaults.

- **Page background (`#EEF2FF`)** — cool lavender-gray canvas. Sets the workshop atmosphere; not used for card fills.
- **Surface (`#FFFFFF`)** — card, browser chrome content, and raised panels (day columns, snacks bar, Shopping list CTA block).
- **Foreground (`#1E293B`)** — primary body and Recipe titles on slots.
- **Muted (`#64748B`)** — secondary copy: store context, page subtitles, de-emphasized actions (e.g. Refusal link).
- **Primary indigo (`#4338CA`)** — main actions, active nav pill, slot action links, snack section title, primary buttons. Cold indigo — not purple SaaS default.
- **Primary foreground (`#FFFFFF`)** — text on primary-filled buttons.
- **Accent dark (`#312E81`)** — brand wordmark weight, day-card headers, snack chip text. Structural emphasis, not a second CTA color.
- **Border (`#E0E7FF`)** — soft card outlines, header dividers, pill-nav track separation.
- **Warning surface (`#FEF9C3` / `#854D0E` / `#FDE047`)** — stale catalog banner only. Explicit stale warning when planning uses non-fresh catalog data; never repurposed for generic alerts.
- **Empty slot (`#F8FAFC`)** — unfilled meal slot background; reads "open workspace" not error.
- **Slot label (`#94A3B8`)** — uppercase meal-type labels (Завтрак / Обед / Ужин) and empty-slot placeholder text.
- **Snacks border (`#C7D2FE`)** — dashed outline on the Snacks aggregate bar.

Avoid: gradients on product surfaces, dark-mode variants, stock-badge colors (out of v1 scope), decorative accent fills unrelated to actions or stale warning.

## Typography

Body, labels, and form controls inherit shadcn's Geist Sans ramp unless overridden. Product type roles:

- **Page title** — 24px / 700 / −0.02em tracking. Menu and flow step headers ("Меню на 3 дня").
- **Section title** — 17px / 700. App wordmark in header.
- **Day head** — 15px / 600 in `{colors.accent}`; date suffix at 12px regular in `{colors.muted}`.
- **Slot label** — 11px / 600 / uppercase / +0.04em tracking in `{colors.slot-label}`. Meal type per slot.
- **Slot name** — 14px / 600 in `{colors.foreground}`. Recipe title in a slot.
- **Body sm** — 13px regular. Stale warning copy, nav pills, snack section labels.
- **Caption** — 12px regular in `{colors.slot-label}`. Footer hints, tertiary metadata.

Glossary terms (Menu, Recipe, Refusal, Snack, Shopping list, etc.) appear verbatim in UI copy — typography does not special-case them. No display or serif override in v1.

## Layout & Spacing

Soft Workshop uses **medium density**: Sergey sees a full day column at a glance and edits slots without spreadsheet tension. Desktop layout; max content width ~1180px in mockups.

- **Page gutter** — 28–40px horizontal padding on the app shell.
- **Content padding** — 20px top / 28px horizontal / 28px bottom inside the main work area.
- **Day grid** — equal columns (1–4 days); 16px gap between day cards.
- **Section gap** — ~18–20px between day grid and Snacks bar; 16px above footer hints.

Single primary work row (day columns) with secondary aggregate (Snacks) below. Flow step nav (`Дни · Меню · План порций · Shopping list`) sits in a pill track in the app header — not a sidebar.

shadcn / Tailwind 4-based spacing scale inherited for everything not listed. [NOTE FOR UX] Breakpoint behavior below ~1024px not designed in v1 artifacts — desktop-first only.

## Elevation & Depth

Depth is soft and indigo-tinted, not harsh Material elevation.

- **Rationale / info card** — `0 1px 3px rgba(49, 46, 129, 0.06)`.
- **App shell / browser frame** — `0 24px 60px rgba(49, 46, 129, 0.12)` in mockups (presentation chrome; production may flatten).
- **Active nav pill** — `0 1px 2px rgba(67, 56, 202, 0.15)`.

Hierarchy comes from **tonal layering** (`{colors.background}` page → `{colors.surface}` cards → `{colors.background}` day heads) and borders (`{colors.border}`), not heavy shadows. Cards do not lift on hover unless shadcn default applies to interactive cards.

## Shapes

Soft Workshop corners are **rounder than default shadcn** — friendly workshop, not sharp tool.

- **`rounded/sm` (10px)** — buttons (primary, ghost).
- **`rounded/md` (12px)** — stale warning banner.
- **`rounded/lg` (14px)** — day cards, meal slot containers, snacks bar, Shopping list CTA block, history rows.
- **`rounded/xl` (16px)** — outer app shell / presentation frame in mockups.
- **`rounded/full`** — pill nav track items, snack chips, stale warning icon circle.

Meal slots inside day cards use square bottom corners only where separated by hairline dividers (`#F1F5F9`). Snacks bar uses **dashed** `{colors.snacks-border}` — shape language signals "additive / optional" distinct from solid day columns.

## Components

Standard shadcn components ship unchanged unless noted. Brand-layer and product-specific skins:

- **button-primary** — `{colors.primary}` fill, `{colors.primary-foreground}` text, `{rounded.sm}`, 600 weight. Forward CTAs ("К плану порций →", "Открыть Order →"). Other Button variants inherit shadcn defaults.
- **button-ghost** — `{colors.background}` fill, `{colors.primary}` text. Secondary actions ("Добавить Snack") that stay on the current step.
- **pill-nav** — Track on `{colors.background}`; active segment `{colors.surface}` with `{colors.primary}` label and subtle indigo shadow; inactive `{colors.muted}`. Flow-step wayfinding only — not global app nav with undeclared destinations.
- **day-card** — `{colors.surface}` body, `{colors.border}` 1px outline, `{rounded.lg}`. Header band `{colors.background}` / `{colors.accent}` with date metadata in `{colors.muted}`.
- **slot-card** — Meal row inside a day column. Filled: white background, slot label + slot name (opens **Recipe** text) + inline text actions (slot replace, **Refusal**, clear). Empty: `{colors.empty-slot}` background, placeholder copy in `{colors.slot-label}`.
- **slot-label** — Uppercase meal-type treatment per slot-card; see Typography.
- **warning-stale** — Full-width banner below header when catalog sync fails. `{colors.warning-bg}` / `{colors.warning-fg}` / `{colors.warning-border}`; circular `{colors.warning-border}` icon badge. Required whenever planning uses last-saved catalog — not optional chrome.
- **snacks-bar** — Dashed `{colors.snacks-border}` container below day grid. Title in `{colors.primary}`; aggregates no-cook Snacks for the same Order.
- **snack-chip** — Pill chips on `{colors.background}` with `{colors.accent}` text; "+ Snack" affordance matches chip shape.
- **shopping-list-cta** — Summary block at Shopping list step: item count + cook-session context + primary button to external Perekrestok. Visual pattern from color-theme previews; exact copy in EXPERIENCE.md. [NOTE FOR UX] Single mockup snippet only — confirm layout parity with direction B shell.
- **history-rating-row** — Row in history of past Recipes/Menus for like/dislike + reason (Option A — no post-cook interrupt; editable after submit in v1). `{colors.surface}` card, `{colors.border}` outline, `{rounded.lg}`. Like affordance `{colors.primary}`; dislike de-emphasized `{colors.muted}`. [NOTE FOR UX] Exact row anatomy (inline vs expanded reason picker) not captured in visual artifacts.

Behavioral specs (Refusal, Rating reasons, store selection, slot replace) live in EXPERIENCE.md — this file is visual only.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Inherit shadcn defaults for everything not in the brand layer | Override shadcn tokens beyond Lavender Workshop palette and Soft Workshop shape/spacing |
| Use soft card columns at medium density for Menu slot edit | Collapse Menu into dense tables or clinical grid (Direction A was rejected) |
| Treat repeated sides across days as normal, successful batch planning | Celebrate per-day novelty, "chef's special" variety, or restaurant-style uniqueness as the default win |
| Present Menu as home batch cooking — practical, repeatable, workshop calm | Style or copy like a restaurant menu, food magazine, or daily tasting flight |
| Show explicit stale catalog warning with warning tokens | Hide stale state or reuse warning colors for non-catalog alerts |
| Keep cold indigo `#4338CA` as the sole action chroma | Introduce second CTA colors, gradients, or SaaS-purple defaults |
| Use `{rounded.lg}` and dashed snacks border for workshop friendliness | Sharp 4px corners (Drift-style) or fully flat borderless panels |
| Light mode only in v1 | Ship dark-mode tokens or `{colors.*-dark}` pairs |
| Reference mockups for layout intent | Invent screens out of PRD scope (match-review, fallback flow, ready packs, Pantry management screen, cook-once batch-component layer, cook timer UI) |
