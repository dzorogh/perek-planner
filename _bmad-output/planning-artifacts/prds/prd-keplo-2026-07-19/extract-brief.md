# Requirements digest — keplo brief

Source: `briefs/brief-keplo-2026-07-19/` (extracted 2026-07-19)

## 1. Product one-liner
Personal web app for **batch meal prep**: one grocery order + one cook for a 2–3 day fridge window, with plans that stay executable against a live local store catalog.

## 2. Primary user / operator
**Sergey** — account holder and cook. Plans feed **two people** by default.

## 3. Core problem
Deciding meals for the next few days is high-attention; recipes and local assortment live apart, so plans break on stockouts or carts fill with pantry staples. The real rhythm is one shop / one cook / fridge for ~3 days — nothing reliably closes that loop against a live local catalog without fake stock guarantees.

## 4. Proposed solution shape
- Pick a meal-prep eat window (calendar/timeline).
- Assign breakfast / lunch / dinner portions from food cooked once (+ no-cook snacks in the same order).
- AI suggests from library or new recipes using history and refusals; recipes enter orders only after ingredient→product matches are checked.
- Eligibility: critical ingredients map to store products; fridge life ≥ window; soft availability from last check; prefer cheaper analogs without quality collapse.
- One combined shopping list (pantry optional); portion plan by day/meal; fallback if critical product disappears after refresh.
- Purchase finishes outside the app. Cook help = recipe text + list (no cook-along).

## 5. In-scope for v1
- Meal-prep window; configurable servings (default 3 meals/day × 2 people)
- AI recipe suggestions (library or new), gated on checked matches; history + refusals
- Diverse no-cook snacks in same order
- Local recipe & product DBs; catalog sync
- Imperfect availability + “last checked” + fallback preserving one cook / same window
- One combined cart; smart price substitutes (not ultra-cheap collapse)
- Copyable list always; store link when possible
- Cost/nutrition when catalog has fields
- single grocery chain only @ Alabino, 92; thin store-catalog boundary for later stores
- Graceful last-saved catalog if store access breaks; manual list edits
- Fast path: repeat previous window / ready pack of checked recipes

## 6. Explicitly out of scope for v1
Checkout in-app; guaranteed stock until delivery; multi-store UI; unchecked AI matches driving the cart; cook-along timers; daily separate cooking; multiple households; leftover/eaten tracking; hard monthly budget caps; hard food exclusions as required setup (optional prefs later).

## 7. Success criteria / early validation signal
- One order + one cook covers chosen 2–3 day window with clear day/meal portion plan for two by default.
- Plans stay executable: unsuitable recipes blocked; missing products → fallback fitting one cook + same window; pantry doesn’t bloat cart; copyable list enough to buy outside.
- **Early validation:** after **two real** cycles (order → cook once → eat from fridge several days), shopping is no longer fully manual “by eye” in the store app.

## 8. Non-negotiable invariants / protections
- No unchecked product matches in cart; new recipes wait in review queue; prefer proven matches.
- Fallbacks preserve **one cook** and **same day window**.
- Repeat-last-window / ready packs so planning beats opening the store app alone.
- Copyable list is minimum success path — never link-only.
- Window capped by fridge keep days; show day portioning.
- Store access break → last saved catalog + stale warning + manual edits.
- Judge v1 by real fridge cycles, not clever matching or a second store.

## 9. Form factor & constraints
- **Form:** personal web app.
- **Store:** single grocery chain only; address **д. Алабино, 92**.
- **Servings default:** 3 meals/day for **2 people** (configurable).
- **Window:** typically **2–3 days**; capped by shortest dish fridge life.
- Spices/sauces always checked for eligibility; added to order only if user opts in.
- “Finished evenly” = portions by day/meal up front — **no** leftover tracking in v1.

## 10. Concerns this PRD must address
- Store integration fragility (unofficial catalog; no public checkout API).
- Availability as soft, timestamped signal — not a guarantee; fallback when stock dies post-refresh.
- AI gating: propose freely; cart only after checked ingredient→product matches.
- Pantry layer: gates eligibility; cart opt-in so staples don’t bloat.
- Handoff UX: copyable list always; link opportunistic.
- Planning latency vs store app (repeat/ready packs).
- Fridge/window integrity (required fridge days on recipes).
- Price substitutes without quality collapse; nutrition/price only when present.
- Thin store boundary without shipping multi-store UI.

## 11. Gaps / open questions the brief leaves for PRD
- Exact UX for window selection (calendar vs timeline) and “ready packs.”
- Matching/review-queue workflow (who checks, what “checked” means operationally).
- Fallback ranking: substitute product vs alternate recipe; when to force replan.
- Snack selection rules (“any diverse” — how constrained?).
- Pantry model details (what counts as pantry; how maintained).
- Catalog sync cadence, stale thresholds, and confidence drop definition.
- Auth/single-user model beyond “single account holder.”
- Optional preference data later vs hard exclusions deferred — what is stored in v1.
- How refusals/history are captured and used by AI.

## 12. Tech notes for PRD addendum (not PRD body)
- Stack mentioned in brief: Next.js, modern UI, Supabase (data/auth/cloud functions) — architecture detail, not product requirements spine.
- No public the store consumer checkout API; PyPI `store-catalog-api` = unofficial RE, OK for personal catalog/prices, not ordering/guaranteed stock.
- Official X5/partner = slow B2B, not v1 dependency.
- VkusVill MCP = possible later alternate store, not v1.
- Assumption register A1–A14 and pre-mortem table live in addendum as research/risk registers.
