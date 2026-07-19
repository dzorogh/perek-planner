# Extract: PRD (+ addendum)

## Product one-liner

Personal web batch-cooking planner: open the app → pick 1–4 days → get Recipes for one Perekrestok order and one cook, with portions by day and meal for two people by default. Purchase happens outside the app (copyable Shopping list always; store link when available).

## Target users / personas (names if present)

- **Sergey** — primary operator, account holder, cook; default plan feeds **two people**
- **Non-users (v1):** multi-household / multi-account family setups; people needing multi-store shopping in one plan; people cooking a separate meal every day

## Jobs / goals

- Pick 1–4 days, get Recipes for two people with one grocery order and one cook session, without cooking every day
- Only see Recipes that can be bought today (Product or analogs in stock); do not waste time on unavailable dishes
- Avoid bloating the cart with Pantry items already on hand or not needed this order
- Spend less attention deciding “what to eat” than manually browsing the store app
- Remember Refusals and post-cook Ratings so bad or rejected Recipes/snacks are not re-suggested without reason
- See enough variety across weeks so Menus do not feel like the same few dishes on repeat

## Surfaces / platforms implied

- **Web app** (Next.js; modern UI components per addendum)
- **External:** Perekrestok retailer site for cart edits and purchase completion
- **Backend/auth:** Supabase (login/password; data persistence) — not a user-facing surface but constrains auth UX

## Key user journeys / flows (names + brief)

- **UJ-1 (primary):** Sergey opens the app, picks 1–4 days, gets Recipes for a Menu (breakfast/lunch/dinner + snacks), and leaves with one copyable Shopping list (and a store link when available)
- **UJ-2 (secondary):** Sergey reuses a previous Menu as a safe draft (even weeks later), then accept or edit it — primary path remains a new Menu with suggestions

## Must-have screens / features for UX

**Menu & Portion plan (FR-1…FR-5)**
- Create Menu: choose 1, 2, 3, or 4 days; receive Recipes for that length (primary path not slot-by-slot from scratch)
- Configure servings: default 3 meals/day × 2 people; change before copying Shopping list
- Assign meals: breakfast, lunch, dinner slots per day; empty slots allowed; only eligible Recipes assignable
- Add Snacks: no-cook items on same Menu/order
- View Portion plan: by day and meal before purchase/cooking; visible without checkout

**Recipe library & suggestions (FR-6…FR-10)**
- Browse Recipe library; select into Portion plan slots
- AI suggestions (library or newly proposed Recipes) informed by history, Refusals, Ratings; prefer variety across weeks
- Record Refusal before cooking (hard-suppressed from suggestions in v1)
- Reuse previous Menu as optional draft (not primary path); edit any slot after reuse
- Rate Recipe or Snack after trying: like/dislike + reason (too hard, not tasty, too long, other); dislike hard-suppresses in v1

**Checked matches & eligibility (FR-11…FR-15)**
- Recipes only when every Critical ingredient has Checked match Product variant(s); Sergey sees Products on Shopping list, not per-match confirmation UI
- Pantry opt-in: Pantry items gate eligibility but join Shopping list only with explicit opt-in
- Fridge-keep vs Menu length: Recipe eligible only if fridge-keep ≥ Menu length; shortest among selections caps Menu length
- Cheaper analog preference (system-owned; no match-review UI in v1)

**Catalog & store (FR-16…FR-18)**
- Select specific Perekrestok store (v1 default context: д. Алабино, 92); concrete store, not free-text address
- Only suggest Recipes buyable today; no stock badge UI; no fallback flow after planning
- Stale catalog warning when sync fails; planning continues on last-saved catalog

**Shopping list & handoff (FR-19…FR-22)**
- One combined Shopping list from Checked-match Products + opt-in Pantry items
- Always copyable Shopping list (works without store link)
- Optional Perekrestok store link when available; must not be only purchase path
- Price and nutrition shown only when catalog provides them (no fabricated values)

**Account (FR-23)**
- Login + password sign-in; unauthenticated users cannot access Menus or personal history

**Cooking aid (FR-24)**
- View Recipe text for Menu dishes while shopping or cooking (no cook-along mode)

## Constraints (scope, tech, brand, a11y, i18n, offline, etc.)

- **Scope:** single operator (Sergey); Perekrestok chain only in v1 UI; Menu length 1–4 days capped by fridge-keep
- **Purchase:** outside app; no in-app checkout; cart edits on store site only
- **Stock:** app does not promise perfect assortment or guaranteed stock until delivery; Recipes without in-stock Critical matches not suggested at all
- **Matching:** system-owned Checked matches; no human match-review UI in v1; Sergey steers via Refusal, Rating, store-cart edits
- **Pantry:** opt-in only on Shopping list
- **Suggestions:** Refused Recipes and disliked Ratings hard-suppressed in v1 (not merely demoted)
- **Tech (addendum):** Next.js web, Supabase auth/data/functions; thin store-adapter boundary for future chains
- **Catalog access:** unofficial catalog access may be used; not for guaranteed stock or in-app ordering
- **Not specified in PRD/addendum:** brand, a11y, i18n, offline behavior

## Voice / content notes

- Glossary-anchored vocabulary; use terms verbatim (Menu, Recipe, Critical ingredient, Product, etc.)
- Russian domain terms appear in glossary: «меню» for Menu
- Stale catalog requires **explicit stale warning** when planning uses non-fresh data
- Reason list for Rating (v1): too hard, not tasty, too long, other (extensible later)
- App positioning: does not replace the store; keeps plan workable with matched Products in stock today

## Explicit non-goals / out of scope

- In-app checkout / ordering
- Guaranteed stock until delivery
- Multi-store or multi-chain UI in v1 (adapter boundary only)
- Ready packs / prebuilt Menu templates
- Separate Fallback flow after planning
- Editing Shopping list or store cart inside this app
- Cook-along timers / guided cooking mode
- Leftover / “eaten” tracking
- Hard monthly budget caps
- Hard food exclusions as required onboarding
- Multi-household accounts
- Second grocery chain in product UI (MVP out of scope)
- No stock badge UI required (FR-17)
- No step timers or guided cook-along (FR-24)

## Open questions / unresolved UX decisions

1. **Exact UX for “pick 1–4 days → get Recipes”** — how much post-suggestion editing of slots is expected (owner: UX; revisit when `bmad-ux` runs) — **PRD §8 Q1**
2. How aggressively to prefer cheaper Product variants when several are in stock (owner: engineering; implementation)
3. Store-link generation details / transport format — deep link, share URL, or equivalent (owner: engineering; addendum)

## Glossary (terms to keep verbatim)

- **Menu** — eating plan («меню») for 1–4 days: chosen length, Portion plan, one cook session, one order; length capped by fridge-keep
- **Recipe** — dish with ingredients and required fridge-keep duration
- **Critical ingredient** — ingredient without which Recipe cannot be cooked; must have Checked match to Product
- **Product** — Perekrestok catalog item for selected store
- **Checked match** — system-selected Critical ingredient → Product link (one ingredient may have several Product variants)
- **In stock today** — Product or suitable analog available at selected store at planning time
- **Shopping list** — one combined list for Menu; always copyable; store link optional
- **Pantry item** — spices, sauces, or staples that gate Recipe eligibility; added to order only with opt-in
- **Portion plan** — servings by day and meal (breakfast / lunch / dinner)
- **Refusal** — Recipe rejected before cooking; shapes future suggestions
- **Rating** — after trying Recipe or Snack: like/dislike + reason (v1: too hard, not tasty, too long, other)
- **Snack** — no-cook item on Menu; same order; can receive Rating
- **Order** — store purchase completed outside app using Menu’s Shopping list (and optional store link)
- **Cook session** — one batch cook covering Menu days (not separate cook per day)
