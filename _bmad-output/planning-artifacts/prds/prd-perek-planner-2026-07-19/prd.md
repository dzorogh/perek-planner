---
title: "PRD: perek-planner"
status: final
created: 2026-07-19
updated: 2026-07-20
---

# PRD: perek-planner

## 0. Document Purpose

PRD for a personal hobby product (single operator: Sergey). Downstream readers: UX, architecture, and implementation of perek-planner. Builds on Product Brief `briefs/brief-perek-planner-2026-07-19/`. Glossary-anchored vocabulary; features grouped with nested FRs; assumptions tagged inline.

## 1. Vision

A personal web batch-cooking planner: open the app → pick 1–4 days → get Recipes for one Perekrestok order and one cook, with portions by day and meal for two people by default. Recipes enter the plan only when Critical ingredients are matched to real store Products; purchase happens outside the app (copyable Shopping list always; store link when available).

The app does not promise a perfect assortment and does not replace the store: it keeps the plan workable with matched Products that are in stock today, and a list Sergey can buy from outside the app.

## 2. Target User

Primary operator: **Sergey** — account holder and cook. Default plan feeds **two people**.

### 2.1 Jobs To Be Done

- Pick 1–4 days, get Recipes for two people with one grocery order and one cook session, without cooking every day.
- Only see Recipes that can be bought today (Product or analogs in stock); do not waste time on unavailable dishes.
- Avoid bloating the cart with pantry staples, spices, and sauces that are already on hand or not needed this order.
- Spend less attention deciding “what to eat” than manually browsing the store app.
- Remember Refusals and post-cook Ratings so bad or rejected Recipes/snacks are not re-suggested without reason.
- See enough variety across weeks so Menus do not feel like the same few dishes on repeat.

### 2.2 Non-Users (v1)

- Multi-household / multi-account family setups
- People who need multi-store shopping in one plan
- People whose rhythm is cooking a separate meal every day

### 2.3 Key User Journeys

- **UJ-1.** Sergey opens the app, picks 1–4 days, gets Recipes for a Menu (breakfast/lunch/dinner + snacks), and leaves with one copyable Shopping list (and a store link when available).
- **UJ-2.** As a secondary path, Sergey can reuse a previous Menu as a safe draft (even weeks later), then accept or edit it — primary path remains a new Menu with suggestions. **[POST-MVP — not in v1 UI.]**

## 3. Glossary

- **Menu** — An eating plan («меню») for 1–4 days: chosen length, Portion plan, one cook session, and one order for that period. Length is capped by how many days the dishes keep in the fridge.
- **Recipe** — A dish with ingredients and a required fridge-keep duration.
- **Critical ingredient** — An ingredient without which the Recipe cannot be cooked; must have a Checked match to a Product.
- **Product** — A Perekrestok catalog item for the selected store (v1 default context: д. Алабино, 92).
- **Checked match** — A system-selected Critical ingredient → Product link (one ingredient may have several Product variants). Without at least one in-stock variant today, the Recipe is not suggested. Sergey reviews Products via the Shopping list, not by confirming each match by hand.
- **In stock today** — A Product (or a suitable analog) is available at the selected store at planning time. Recipes that lack this for any Critical ingredient are not suggested.
- **Shopping list** — One combined list for the Menu; always copyable; store link optional.
- **Pantry item** — Spices, sauces, or staples that gate Recipe eligibility; appear on the Shopping list by default in v1 (Sergey filters at Perekrestok order time).
- **Portion plan** — Servings laid out by day and meal (breakfast / lunch / dinner).
- **Refusal** — A Recipe Sergey rejected before cooking; used to shape future suggestions.
- **Rating** — After trying a Recipe or Snack: like/dislike plus a reason from an extensible list (v1: too hard, not tasty, too long, other). Dislike hard-suppresses re-suggestion in v1.
- **Snack** — A no-cook item on the Menu that joins the same order; can receive a Rating like a Recipe.
- **Order** — The store purchase Sergey completes outside the app using this Menu’s Shopping list (and optional store link).
- **Cook session** — One batch cook that covers the Menu days (not a separate cook per day).

## 4. Features

### 4.1 Menu & Portion plan

**Description:** Maximally simple path: Sergey opens the app, picks 1–4 days, gets Recipes for a Menu, sets servings (default three meals for two people), has breakfast/lunch/dinner + snacks, and sees the Portion plan before shopping and cooking. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Create Menu

Sergey can create a Menu by choosing 1, 2, 3, or 4 days and receiving Recipes for that length. Realizes UJ-1.

**Consequences (testable):**
- Menu length is selectable as 1, 2, 3, or 4 days.
- Menu length cannot exceed the shortest fridge-keep duration among selected Recipes.
- Primary path does not require building the Menu slot-by-slot from scratch before seeing suggestions.

#### FR-2: Configure servings

Sergey can set serving counts for a Menu; default is three meals per day for two people.

**Consequences (testable):**
- A new Menu starts with default servings: 3 meals/day × 2 people.
- Sergey can change servings for that Menu before copying the Shopping list.

#### FR-3: Assign meals

Sergey can assign Recipes to breakfast, lunch, and dinner slots in the Portion plan. Realizes UJ-1.

**Consequences (testable):**
- Each day in the Menu has breakfast, lunch, and dinner slots.
- Empty meal slots are allowed (Sergey need not fill every slot).
- Only eligible Recipes (per Checked match rules) can be assigned to a slot.

#### FR-4: Add snacks

Sergey can add no-cook snacks to the same Menu and the same order. Realizes UJ-1.

**Consequences (testable):**
- Snacks appear on the Shopping list with the rest of the Menu.
- Snacks do not require a cook session.

#### FR-5: View Portion plan

Sergey can view the Portion plan by day and meal before purchase and cooking. Realizes UJ-1.

**Consequences (testable):**
- Portion plan shows every day and meal slot for the Menu (including empty slots).
- Portions are laid out up front so the Menu can be eaten evenly across days without leftover tracking.
- Portion plan is visible without completing checkout (checkout is out of app).

### 4.2 Recipe library & suggestions

**Description:** Primary path is a new Menu with library browsing and AI suggestions shaped by cook history, Refusals, and Ratings. Sergey can refuse a Recipe before cooking and rate Recipes/Snacks after trying them. Repeating a previous Menu is an optional safe draft, not the main flow. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-6: Slot replace via AI (no library browse)

Sergey can replace a Menu slot via AI resuggest. There is no separate Recipe library browse and no manual History-pick control in v1.

**Consequences (testable):**
- Slot replace uses AI resuggest only.
- Recipes without Checked matches for Critical ingredients cannot be assigned to a slot.

#### FR-7: AI suggestions with long-idle reuse

Sergey can receive AI suggestions (from known Recipes or newly proposed ones) informed by cook recency, Refusals, and Ratings. Realizes UJ-1.

**Consequences (testable):**
- Suggestions consider prior cook recency, Refusals, and Ratings.
- Recipes not cooked for approximately 2+ weeks are candidates for reintroduction; highly liked Recipes are weighted somewhat more often than medium-rated ones; Refusal/dislike stay hard-suppressed.
- Suggestions prefer variety across weeks (avoid repeating the same few Recipes when alternatives exist) while allowing Model C same-week side repetition.
- New AI Recipes are gated by FR-12 and must also satisfy FR-17 (in stock today).

#### FR-8: Record Refusal

Sergey can mark a Refusal on a Recipe before cooking.

**Consequences (testable):**
- A Refusal is stored against that Recipe.
- Refused Recipes are hard-suppressed from suggestions in v1 (not merely demoted).

#### FR-9: Reuse previous Menu (secondary) — POST-MVP

`[POST-MVP / deferred — not in v1 UI; see Non-Goals and §6.2.]`

Sergey can optionally reuse a previous Menu as a safe draft (including weeks later), then accept or edit it. Realizes UJ-2. **Not implemented in v1.**

**Consequences (testable) — when post-MVP ships:**
- A past Menu can be loaded as a draft for a new planning session.
- Reuse is available but not presented as the primary planning path.
- Sergey can edit any slot after reuse before generating the Shopping list.

#### FR-10: Rate Recipe or Snack

After trying a Recipe or Snack, Sergey can leave a Rating (like/dislike + reason from an extensible list).

**Consequences (testable):**
- Rating applies to a Recipe or a Snack.
- Reason is chosen from: too hard, not tasty, too long, other (list may grow later).
- Dislike hard-suppresses that item from future suggestions in v1 (FR-7).

### 4.3 Checked matches & eligibility

**Description:** A Recipe enters an order only when every Critical ingredient has a Checked match to a Product. Pantry items gate eligibility and join the Shopping list by default (Sergey filters at the store). Fridge-keep must cover the Menu. Cheaper Product analogs are preferred at medium aggressiveness without collapsing quality. Realizes UJ-1.

**Functional Requirements:**

#### FR-11: Require Checked matches

Sergey can use a Recipe in a Menu only when each Critical ingredient has system-selected Checked match Product variant(s).

**Consequences (testable):**
- Missing Checked match for any Critical ingredient blocks the Recipe from suggestions and the Menu.
- A Critical ingredient may map to several Product variants.
- Spices/sauces required by the Recipe are checked for catalog presence as part of eligibility.
- Sergey does not manually confirm each match; he sees resulting Products on the Shopping list.

#### FR-12: Gate new AI Recipes

Newly AI-proposed Recipes are not suggested until the system has Checked matches for Critical ingredients.

**Consequences (testable):**
- Recipes without system Checked matches do not appear as suggestions or drive the Shopping list.
- `[ASSUMPTION: Match quality is system-owned; Sergey corrects outcomes by Refusal/Rating and by editing the store cart, not by a match-review UI in v1.]`

#### FR-13: Pantry on list by default

Pantry items affect Recipe eligibility; in v1 they appear on the Shopping list by default so Sergey can filter them at Perekrestok order time (no per-item in-app opt-in prompt).

**Consequences (testable):**
- A Recipe can be ineligible if a required Pantry item Product is missing from the catalog.
- Pantry items appear on the Shopping list by default without an in-app opt-in prompt.

#### FR-14: Fridge-keep vs Menu length

A Recipe is eligible for a Menu only if its fridge-keep duration is at least the Menu length.

**Consequences (testable):**
- Recipes with fridge-keep shorter than the Menu cannot be assigned to that Menu.
- Shortest Recipe fridge-keep among selections caps allowable Menu length (with FR-1).

#### FR-15: Prefer cheaper analogs (medium)

When choosing among suitable Products for a Checked match, the system prefers a cheaper analog at **medium** aggressiveness: favor the cheaper option when the price gap is clear, without collapsing below a basic quality bar or always picking the absolute cheapest.

**Consequences (testable):**
- Cheaper suitable Products are preferred over clearly ultra-expensive equivalents when both match the ingredient.
- The cheapest SKU is not chosen if it fails the basic quality heuristic; ties or tiny gaps need not force a switch.
- `[ASSUMPTION: “Basic quality” is a simple heuristic or manual preference, not a guaranteed quality score.]`

### 4.4 Catalog & store

**Description:** Sergey selects a specific Perekrestok store. The app syncs that store’s Product catalog. If a Recipe’s Critical ingredients have no Product (or suitable analog) in stock today, that Recipe is not suggested at all — no stock UI, no separate “fallback” flow. If store sync fails or the catalog is stale, Menu planning is blocked with a clear stale warning until a fresh sync succeeds. Cart edits happen on the store site, not in this app. Realizes UJ-1.

**Functional Requirements:**

#### FR-16: Select store

Sergey can select a specific Perekrestok store whose catalog drives Products and today’s stock.

**Consequences (testable):**
- A concrete store (not only a free-text address) is selected for planning.
- v1 chain is Perekrestok only.
- `[ASSUMPTION: Implementation keeps a thin store-adapter boundary so another chain can be added later without rewriting Menu/Recipe logic — details in addendum.]`

#### FR-17: Only suggest Recipes buyable today

At planning time, do not suggest a Recipe if any Critical ingredient lacks at least one Checked-match Product variant (including analogs) that is in stock today.

**Consequences (testable):**
- If one variant is OOS but another matched variant is in stock, the Recipe may still be suggested.
- Recipes with no in-stock variant for a Critical ingredient are not shown and cannot be assigned to the Menu.
- No stock badge UI is required.
- Substitutions after planning are handled by Sergey in the store cart, not in this app.

#### FR-18: Block planning when catalog is stale

If store access/sync fails or the catalog is not fresh, Menu planning is blocked with an explicit stale warning until a fresh sync succeeds.

**Consequences (testable):**
- A clear stale warning is shown on planning surfaces when catalog data is non-fresh.
- Generate/continue Menu planning actions are blocked while the catalog is stale or sync has failed.
- Planning is re-enabled after a successful fresh sync for the active store.
- Settings and account access remain available while planning is blocked.

### 4.5 Shopping list & handoff

**Description:** One Shopping list for the Menu. Always copyable. Optional Perekrestok link when available — never the only way to buy. Price and nutrition only when the catalog provides them. Sergey edits the cart on the store site, not in this app. Realizes UJ-1.

**Functional Requirements:**

#### FR-19: Build Shopping list

Sergey gets one combined Shopping list for the Menu from Checked-match Products (plus Pantry items by default).

**Consequences (testable):**
- List covers all Critical ingredient Products for Recipes/Snacks on the Menu.
- Pantry items appear on the list by default (FR-13).

#### FR-20: Copy Shopping list

Sergey can always copy the Shopping list.

**Consequences (testable):**
- Copy works even when no store link is available.
- Copy is sufficient to complete purchase outside the app.

#### FR-21: Optional store link

When a working Perekrestok link can be produced, Sergey can open it; it must not be the only purchase path.

**Consequences (testable):**
- Missing or broken link does not block planning or copy (FR-20).
- `[ASSUMPTION: Link format may be deep link, share URL, or equivalent — exact transport in addendum.]`

#### FR-22: Price and nutrition when present

Show price and nutrition for Products/Recipes only when the catalog provides those fields.

**Consequences (testable):**
- Missing catalog fields do not block the Shopping list.
- No fabricated price or nutrition values.

### 4.6 Account

**Description:** Single-operator access via login and password so Menus, Refusals, Ratings, and matches persist for Sergey.

**Functional Requirements:**

#### FR-23: Login / password

Sergey can sign in with login and password to use the app.

**Consequences (testable):**
- Unauthenticated users cannot access Menus or personal history.
- Auth is login+password in v1 (not anonymous-only).

### 4.7 Cooking aid (v1)

**Description:** v1 cooking help is Recipe text plus the Shopping list — not a cook-along mode.

**Functional Requirements:**

#### FR-24: View Recipe text

Sergey can open Recipe text for dishes on the Menu while shopping or cooking.

**Consequences (testable):**
- Recipe text is available in-app for Menu Recipes.
- No step timers or guided cook-along flow in v1 (see Non-Goals).

## 5. Non-Goals (Explicit)

- In-app checkout / ordering
- Guaranteed stock until delivery
- Multi-store or multi-chain UI in v1 (adapter boundary only)
- Ready packs / prebuilt Menu templates
- A separate Fallback flow after planning
- Editing the Shopping list or store cart inside this app
- Cook-along timers / guided cooking mode
- Leftover / “eaten” tracking
- Hard monthly budget caps
- Hard food exclusions as required onboarding
- Multi-household accounts
- Reuse previous Menu as draft / UJ-2 surface in v1 (FR-9 deferred post-MVP)

## 6. MVP Scope

### 6.1 In Scope

- Menu (1–4 days, simple pick → get Recipes), servings, Portion plan, Snacks — FR-1…FR-5
- Login/password auth for the single operator — FR-23
- AI suggestions, slot AI replace, Refusal, Rating — FR-6…FR-8, FR-10 (FR-9 Menu reuse deferred)
- Checked matches, Pantry on list by default, fridge-keep, cheaper analogs (medium) — FR-11…FR-15
- Store selection, today-stock eligibility, stale catalog blocks planning — FR-16…FR-18
- Shopping list copy + optional store link; price/nutrition when present — FR-19…FR-22
- Recipe text as cooking aid — FR-24
- Single operator; Perekrestok chain; selectable store

### 6.2 Out of Scope for MVP

- Everything in §5 Non-Goals
- Second grocery chain in the product UI
- UJ-2 Menu reuse draft surface (FR-9)

## 7. Success Metrics

**Primary**
- **SM-1**: After two real cycles (Menu → buy outside the app → one cook → eat from the fridge for the Menu days), Sergey does not fall back to fully manual “by eye” shopping only in the store app. Validates FR-1…FR-5, FR-19…FR-21.
- **SM-2**: In those cycles, food was enough for the planned Menu (portions/days covered without running out early). Validates FR-2, FR-5.
- **SM-3**: Recipes without a Product or analog in stock at planning time did not enter those Menus. Validates FR-17, FR-11.

**Counter-metrics (do not optimize)**
- **SM-C1**: Count of AI-proposed Recipes or “clever” matches — must not be optimized if SM-1/SM-2 fail.

## 8. Open Questions

1. ~~Exact UX for “pick 1–4 days → get Recipes”~~ — **Resolved (UX):** slot-edit step after suggestions before Portion plan and Shopping list.
2. ~~How aggressively to prefer cheaper Product variants~~ — **Resolved:** medium aggressiveness (FR-15); see SPEC CAP-12.
3. Store-link generation/transport format (deep link vs share URL vs other) — owner: engineering; deferred to implementation; copyable list remains sufficient (FR-20/21).

## 9. Assumptions Index

- Thin store-adapter boundary for future chains (FR-16) — implementation detail in addendum.
- Match quality is system-owned; no match-review UI in v1 (FR-12).
- Store link transport format TBD (FR-21); deferred to implementation.
- “Basic quality” for cheaper analogs is a simple heuristic; preference aggressiveness is medium (FR-15).
- Pantry/staples on Shopping list by default in v1; filter at store (FR-13) — aligned with UX/SPEC.
