# Extract: Product Brief (+ addendum)

## Product one-liner

Personal web app for batch meal prep: about every two or three days, one grocery order, one cook session, eat from the fridge until the batch is nearly finished — with plans that stay executable when the store catalog is wrong or stale.

## Target users / personas (names if present)

- **Sergey** — account holder and cook (single account holder; A12).
- Default plan feeds **two people**, three meals a day (breakfast, lunch, dinner).

## Jobs / goals

- Cover a chosen two- or three-day window with **one order and one cook session**, not daily cooking.
- **Fewer shopping trips and cooking sessions**; variety across weeks.
- Keep a **record of recipes he rejected** (refusals).
- Plans must **not collapse** when Perekrestok is missing a key ingredient.
- **Finish the purchase outside this app** — copyable shopping list is always enough; Perekrestok link when a working link is available.
- Early validation: after two real cycles of “order → cook once → eat from the fridge for several days,” shopping is not fully manual “by eye” in the store app again.

## Surfaces / platforms implied

- **Web planner** (Next.js, modern UI components; Supabase for data, auth, cloud functions).
- **External:** Perekrestok store (hand off list and/or link — no checkout inside perek-planner).
- Single store in first version: **Perekrestok**, address **д. Алабино, 92**.

## Key user journeys / flows (names + brief)

1. **Choose meal-prep window** — pick days on a calendar or timeline (when the batch will be eaten; configurable ~2–3 days; A13).
2. **Pick dishes** — breakfast, lunch, dinner as portions from food cooked once (servings configurable); plus diverse **no-cook snacks** in the same order.
3. **AI recipe suggestions** — from library or new, using cook history and refusals; new recipes wait for **checked ingredient-to-product matches**.
4. **Validate against store** — only recipes whose critical ingredients map to Perekrestok products, fridge storage ≥ window, availability “enough” on last check; prefer cheaper analogs without ultra-cheap quality collapse.
5. **Build one combined shopping list** — pantry items gate eligibility but are **opt-in for cart** (A6); always copyable; Perekrestok link when possible.
6. **Portion plan by day and meal** — “finished evenly” / “even drain” = portions laid out up front (A3); no leftover tracking in v1.
7. **Cook** — recipe text plus shopping list only (not cook-along).
8. **Repeat last window / ready packs** — fast path to repeat a previous window or use a ready pack of checked recipes.
9. **Fallback when product disappears** — after catalog refresh, show what broke; offer substitute product and/or different recipe preserving same window, fridge days, and one cook session.
10. **Stale catalog mode** — if Perekrestok access breaks, work on last saved catalog with clear stale warning; allow manual list edits.

## Must-have screens / features for UX

- Calendar / timeline for **meal-prep window** selection.
- Meal slots: **breakfast, lunch, dinner** + **diverse no-cook snacks** (same cart).
- **AI recipe suggestions** (library + new), informed by history and **refusals**.
- **Ingredient-to-product matching** visibility; **review queue** for new unchecked links.
- **Critical ingredients** vs **spices and sauces** — always checked for suitability; spices/sauces added to order only if user chooses.
- **Availability** with **“last checked”** timestamp (soft signal, not guarantee).
- **One combined shopping list** — always **copyable**; **Perekrestok link** when working (never the only path).
- **Portion plan by day and meal** for two people by default.
- **Price and nutrition** only when catalog provides those fields.
- **Recipe view** — text + list (no step-by-step cook-along, no timers).
- **Fallback UI** — show broken recipe/ingredient; offer executable alternative(s).
- **Pantry layer** — separate from cart; gates eligibility, cart opt-in.
- **Repeat last window** and **ready packs** of checked recipes.
- **Stale catalog warning** + **manual list edits** when store access breaks.
- **Fridge days** on recipes; window capped by shortest dish storage time.

## Constraints (scope, tech, brand, a11y, i18n, offline, etc.)

- **Scope:** one store (Perekrestok, Alabino 92); thin **store catalog** boundary for future stores.
- **Tech stack:** Next.js, modern UI components, Supabase (data, auth, cloud functions).
- **Catalog:** unofficial access (e.g. `perekrestok-api`); sync + copyable list + stale-catalog mode (A4).
- **Matching:** checked matches required before cart; unchecked AI matches must not drive cart (A7).
- **Availability:** timestamped soft signal + fallback (A5); not guaranteed stock.
- **Pantry:** gates eligibility; cart is opt-in (A6).
- **Window:** configurable ~2–3 days; ≤ shortest recipe **fridge days** (A2).
- **Variety:** across batch dishes matters more than variety by day (A14).
- **Success bar:** two real fridge cycles, not clever matching or second store.
- **Language (docs):** brief and addendum in English; when talking to Sergey in chat, prefer full readable sentences; avoid unexplained jargon.
- **a11y / i18n / brand / offline:** not explicitly stated in brief or addendum.

## Voice / content notes

- Chat with Sergey: **full readable sentences**; avoid unexplained jargon.
- Product docs (brief, addendum): **English**.
- Do not promise guaranteed stock or in-app checkout.
- Stale catalog and imperfect availability must be communicated clearly (not a fake in-stock promise).

## Explicit non-goals / out of scope

- Checkout inside this app.
- Guaranteed stock until delivery.
- Multi-store marketplace in the interface (A11).
- Unchecked artificial-intelligence product matches driving the cart.
- Cook-along timers / step-by-step cook-along mode.
- Daily separate cooking.
- Multiple households.
- Leftover / eaten tracking (“finished evenly” is portioning only).
- Hard monthly budget caps.
- Hard food exclusions as a required setup step (optional preference data later).
- VkusVill MCP / second store in first version.

## Open questions / unresolved UX decisions

- **Window start default** — A13: “always ~2–3 days from tomorrow” is medium confidence; window is configurable — exact default UX unspecified.
- **Review queue** — how users approve or reject new ingredient-to-product links before cart (mentioned in pre-mortem, not designed).
- **Fallback choice** — substitute product vs different recipe: presentation and preference order not specified.
- **Ready packs** — composition, naming, and selection flow not defined.
- **Availability confidence** — how to show “enough” vs low confidence before fallback triggers (A5 low confidence).
- **Manual list edits** — extent and sync behavior with locked plan not specified.
- **Refusals record** — browse/search/reuse UX not specified.
- **Optional preference data** — “later” food exclusions; no v1 UX.

## Glossary (terms to keep verbatim)

- perek-planner
- Perekrestok
- meal-prep window
- batch / cook once / one cook session
- finished evenly / even drain
- portion plan by day and meal
- critical ingredients
- spices and sauces
- pantry items / pantry layer
- checked ingredient-to-product matches
- refusals
- review queue
- ready packs
- repeat last window
- copyable list / copyable shopping list
- last checked
- fridge days
- fallback
- store catalog / store catalog boundary
- stale catalog / stale warning
- availability (soft signal)
- no-cook snacks
- ready-to-eat snacks

## Brand / visual hints (only if explicitly stated — do not invent)

- **Modern UI components** (stack note alongside Next.js — no palette, typography, or logo specified).
