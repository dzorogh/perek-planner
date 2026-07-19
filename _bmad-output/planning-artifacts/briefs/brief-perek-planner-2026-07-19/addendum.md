---
title: "Addendum: perek-planner brief"
status: ready
created: 2026-07-19
updated: 2026-07-19
---

# Addendum

Supporting detail for the product brief. Downstream PRD and architecture should treat `brief.md` as the spine; this file holds registers and research notes.

## Assumption register

| ID | Assumption | Confidence | Impact | Shore-up |
|---|---|---|---|---|
| A1 | One order + one cook per ~3-day window is the real rhythm | High | High | Confirmed — core job |
| A2 | Food stays OK in the fridge for the window length | Medium | High | Require fridge days on recipes; window ≤ shortest dish |
| A3 | “Even drain” means portioning by day and meal only | High | Medium | Confirmed — no leftover tracking in first version |
| A4 | Unofficial catalog/price access is enough for a personal first version | Medium | High | Sync + copyable list + stale-catalog mode |
| A5 | “In stock today” can help filter recipes | Low | High | Timestamped soft signal + fallback recipe or product |
| A6 | Pantry items gate eligibility; cart is opt-in | High | Medium | Separate pantry layer |
| A7 | Automatic ingredient-to-product matching is reliable | Low | High | Checked matches required before cart; AI may propose |
| A8 | Nutrition / “health” always exists in the catalog | Low–Medium | Low–Medium | Show only when present |
| A9 | Finishing purchase outside the app is enough | High | High | Confirmed — copyable list always; link when possible |
| A10 | Snacks belong in the same single order | High | Medium | Same cart; any diverse ready-to-eat options |
| A11 | Multi-store is needed in the first version | Low | Medium | Store boundary only; no second store in scope |
| A12 | Single account holder | High | Low | Simplifies auth; default plan feeds two people |
| A13 | Window is always ~2–3 days from tomorrow | Medium | Medium | Configurable window |
| A14 | Variety across batch dishes matters more than variety by day | Medium | Medium | Guides packing; AI uses history and refusals |

## Store integration notes

- No public Perekrestok consumer checkout API.
- PyPI package `perekrestok-api`: unofficial reverse-engineering; plausible for personal catalog and prices; not reliable for ordering or guaranteed stock.
- Official X5 / partner paths are slow B2B processes, not a first-version dependency.
- VkusVill MCP (search + share basket) is a possible later alternate store, not in first-version scope.
- First-version ordering posture: hand off a list (and a link when possible), not checkout inside perek-planner.

## Fallback when a product disappears

When a critical product for a locked plan becomes unavailable (or confidence drops) after a catalog refresh:

1. Show which recipe or ingredient broke.
2. Offer at least one executable alternative: a substitute product and/or a different recipe that still fits the same day window, fridge storage time, and one cook session.
3. Prefer keeping the cook-once batch shape over a full replan from scratch.

## Pre-mortem risk table

| Failure mode | Why it kills the product | Prevention |
|---|---|---|
| Wrong recipe-to-product match | One bad cook destroys trust | Checked matches before cart; review queue for new links |
| Stale availability, weak fallback | Plan looks fine, then dies in the evening | Fallback that keeps one cook and the same window |
| Planning takes too long | User opens Perekrestok instead | Repeat last window; ready packs of checked recipes |
| Cannot carry the order into the store | User retypes the cart by hand | Copyable list as the minimum success path |
| Food spoils or is eaten unevenly | App does not match real fridge life | Required fridge days; portioning by day; window capped |
| Unofficial catalog access breaks | Whole app depends on one fragile pipe | Last saved catalog + stale warning + manual edits |
| Scope too wide for first version | No complete real loop ever ships | Success = two real fridge cycles |

## Language note for authors

When talking to Sergey in chat, prefer full readable sentences. Brief and addendum stay in English per project document language; avoid unexplained jargon in both.
