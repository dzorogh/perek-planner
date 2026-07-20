# Google Stitch — keplo UX handoff

Paste into https://stitch.withgoogle.com. Produce: visual directions + key-screen HTML (and DESIGN.md if the tool emits it). Save all outputs into the project folder you were given (`ux-keplo-2026-07-19/`), preferably under `imports/` or `.working/`.

## Product

**keplo** — personal web batch-cooking planner for one operator (Sergey).  
Open app → pick **1–4 days** → get a **Menu** of **Recipes** for **one store order** and **one cook session**, with a **Portion plan** by day and meal (default: 3 meals/day × **2 people**). Purchase happens **outside** the app via a always-**copyable Shopping list** (optional store link when available).

Default store context: **д. Алабино, 92**.

## Audience & stakes

- Single internal user (Sergey), not a consumer product launch.
- Desktop web first. UI copy in **Russian**.
- Visual identity: **open** — propose 2–3 coherent visual directions; do not assume a brand system exists.

## Primary journeys (keep names)

**UJ-1 (primary) — Sergey, weekday evening, kids asleep:**  
Opens the web app on desktop → picks Menu length (1–4 days) → receives suggested Recipes for breakfast/lunch/dinner + optional no-cook Snacks → **edits slots** (swap/refuse/empty allowed) → reviews Portion plan → copies Shopping list (and optionally opens store link) → leaves to buy on the store site.

Climax: he leaves with one trustworthy list he can paste/use — not a polished empty dashboard.

**UJ-2 (secondary):**  
Reopens a previous Menu as a draft weeks later → accepts or edits slots → same handoff to Shopping list.

## Surfaces to design (desktop web)

1. **Sign-in** — login + password (unauthenticated users cannot see Menus/history).
2. **Create Menu / pick days** — choose 1–4 days; primary path is not building the week slot-by-slot from scratch.
3. **Menu + slot edit** — after suggestions, edit breakfast/lunch/dinner slots per day; empty slots OK; refuse a Recipe before cooking; add Snacks.
4. **Portion plan** — servings by day and meal; visible before purchase; adjustable before copying the list.
5. **Recipe library + suggestions** — browse library; AI suggestions informed by history, Refusals, Ratings; prefer variety across weeks.
6. **Pantry (opt-in)** — pantry gates eligibility; items join Shopping list only with explicit opt-in.
7. **Shopping list handoff** — one combined list; always copyable; optional store link; price/nutrition only if catalog provides them (never invent).
8. **Store selection** — pick a concrete store (not free-text address).
9. **Stale catalog warning** — if sync failed, plan on last-saved catalog with an **explicit** warning.
10. **Recipe text (cook aid)** — read Recipe while shopping/cooking; **no** cook-along timers/guided mode.
11. **Post-cook Rating** — like/dislike + reason (too hard / not tasty / too long / other); dislike hard-suppresses future suggestions.
12. **Reuse previous Menu** — optional draft path (UJ-2).

## Hard UX constraints (do not invent around these)

- No in-app checkout / cart editing inside this app.
- No stock-badge UI; Recipes without in-stock Critical matches are simply not suggested.
- No match-review / human confirmation UI for ingredient→Product links in v1 (system-owned Checked matches).
- No separate “fallback after planning” flow in v1 PRD scope (plan stays executable by only showing buyable Recipes).
- Shopping list is always enough even without a store link.
- Refusals and dislike Ratings **hard-suppress** repeats in v1.
- Do not invent brand colors, mascots, or marketing hero pages — this is a focused internal planner.

## Glossary (use verbatim in UI labels where natural; Russian UI)

Menu («меню»), Recipe, Critical ingredient, Product, Checked match, In stock today, Shopping list, Pantry item, Portion plan, Refusal, Rating, Snack, Order, Cook session.

## What to output

1. **2–3 visual directions** (short rationale each) for a dense, desktop, Russian-language planner — calm, practical, low chrome. User will pick one.
2. **Key screens (HTML)** for at least: Create Menu → Menu/slot edit → Portion plan → Shopping list handoff; plus Sign-in and Stale warning treatment.
3. If available: a **DESIGN.md** (colors, type, spacing, components) matching the chosen direction.
4. Annotate empty/error/stale states lightly on the critical screens.

## Out of scope for this pass

Mobile layouts, multi-store UI, ready packs, leftover tracking, cook-along, review queue for matches, in-app list editing as a primary path.
