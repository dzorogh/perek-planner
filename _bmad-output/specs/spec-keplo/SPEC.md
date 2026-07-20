---
id: SPEC-keplo
companions:
  - glossary.md
  - ../planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md
  - ../planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md
  - ../planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md
sources:
  - ../planning-artifacts/prds/prd-keplo-2026-07-19/prd.md
  - ../planning-artifacts/prds/prd-keplo-2026-07-19/addendum.md
  - ../planning-artifacts/briefs/brief-keplo-2026-07-19/brief.md
  - ../planning-artifacts/briefs/brief-keplo-2026-07-19/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# keplo

## Why

**Pain + vision for a single operator.** Deciding what to eat for the next few days costs too much attention: recipes and the live the store assortment live in different places, plans break on out-of-stock ingredients, and carts fill with pantry staples already on hand. Sergey needs a personal web batch-cooking planner — pick 1–4 days, get a Menu for two people by default, one cook session and one order outside the app — that stays executable against today’s matched Products, without promising a perfect assortment or replacing the store.

## Capabilities

- **CAP-1**
  - **intent:** Operator can create a Menu by choosing 1–4 days and receiving Recipe suggestions for that length without assembling slots from scratch first.
  - **success:** Selecting a day length yields a Menu with suggestions; primary path does not require slot-by-slot build before first suggestions appear.

- **CAP-2**
  - **intent:** Operator can set serving counts for a Menu; new Menus default to three meals per day for two people.
  - **success:** Defaults are 3 meals/day × 2 people; servings are changeable before Shopping list copy.

- **CAP-3**
  - **intent:** Operator can edit breakfast/lunch/dinner slots after suggestions (replace via AI resuggest), leave slots empty, and refuse Recipes before cooking.
  - **success:** Day × meal grid is editable; empty slots allowed; no separate Recipe library browse and no manual History-pick control in v1; flow cannot skip slot edit to reach Shopping list.

- **CAP-4**
  - **intent:** Operator can add no-cook Snacks to the same Menu and Order.
  - **success:** Snacks appear on the Shopping list with the Menu and do not require a cook session.

- **CAP-5**
  - **intent:** Operator can view and adjust a Portion plan by day and meal before purchase and cooking.
  - **success:** Portion plan shows every day and meal slot (including empty); visible without checkout; portions laid out up front without leftover tracking.

- **CAP-6**
  - **intent:** Operator can receive AI Recipe suggestions shaped by cook recency, Refusals, and Ratings, biased to simple home batch food (Model C: repeats across days are normal), reintroducing Recipes idle ~2+ weeks with higher weight for liked Recipes and lower for medium-rated ones.
  - **success:** Suggestions consider recency/Refusals/Ratings; long-idle liked dishes return more often than medium-rated ones; Refusal/dislike never return; new AI Recipes only enter after Checked-match and today-stock gates.

- **CAP-7**
  - **intent:** Operator can record a Refusal on a Recipe before cooking.
  - **success:** Refusal is stored; refused Recipes are hard-suppressed from suggestions in v1.

- **CAP-8**
  - **intent:** Operator can rate a past Recipe or Snack from History (like/dislike + reason) after trying it.
  - **success:** Reasons include too hard / not tasty / too long / other; dislike hard-suppresses that item in v1; rating is editable after submit; no forced post-cook interrupt screen.

- **CAP-9**
  - **intent:** System admits a Recipe to suggestions/Menu only when every Critical ingredient has system-selected Checked-match Product variant(s).
  - **success:** Missing Checked match blocks suggestion and assignment; operator does not confirm matches by hand — Products appear on the Shopping list.

- **CAP-10**
  - **intent:** Pantry/staple items gate Recipe eligibility by catalog presence and appear on the Shopping list by default so the operator can filter them in the store.
  - **success:** Missing required pantry Product can make a Recipe ineligible; staples are on the list without per-item in-app opt-in prompts.

- **CAP-11**
  - **intent:** System enforces fridge-keep duration against Menu length.
  - **success:** Recipes with fridge-keep shorter than Menu length cannot be assigned; shortest selected fridge-keep caps allowable Menu length.

- **CAP-12**
  - **intent:** When choosing among suitable Products for a Checked match, the system prefers a cheaper analog at medium aggressiveness — favor the cheaper option when the price gap is clear, without collapsing below a basic quality bar or always picking the absolute cheapest.
  - **success:** Given several suitable in-stock variants, a clearly cheaper suitable Product is preferred over an ultra-expensive equivalent; the cheapest SKU is not chosen if it fails the basic quality heuristic; ties or tiny gaps need not force a switch.

- **CAP-13**
  - **intent:** Operator can select a concrete store in Settings that drives catalog and stock (default д. Алабино, 92).
  - **success:** A concrete store (not free-text address) is selected once in Settings and is not required before every new Menu; v1 UI is single grocery chain only.

- **CAP-14**
  - **intent:** At planning time, system only suggests/assigns Recipes whose Critical ingredients have at least one in-stock Checked-match variant today.
  - **success:** Recipes lacking an in-stock variant for any Critical ingredient are not shown and cannot be assigned; no stock-badge UI; post-plan substitutions happen in the store cart.

- **CAP-15**
  - **intent:** When store sync fails or the catalog is stale, Menu planning is blocked with an explicit stale warning until a fresh sync succeeds.
  - **success:** A clear stale warning is shown on planning surfaces; generate/continue Menu actions are blocked while stale; planning re-enables after a successful fresh sync; Settings remain available.

- **CAP-16**
  - **intent:** Operator gets one combined Shopping list for the Menu from Checked-match Products plus default staples.
  - **success:** List covers Critical-ingredient Products for Recipes/Snacks on the Menu and includes staples by default.

- **CAP-17**
  - **intent:** Operator can always copy the Shopping list to complete purchase outside the app.
  - **success:** Copy works even when no store link is available and is sufficient to buy outside the app.

- **CAP-18**
  - **intent:** When a working the store link can be produced, operator can open it as a secondary handoff.
  - **success:** Missing or broken link does not block planning or copy; link is never the only purchase path.

- **CAP-19**
  - **intent:** System shows price and nutrition for Products/Recipes only when the catalog provides those fields.
  - **success:** Missing fields do not block the Shopping list; no fabricated price or nutrition values.

- **CAP-20**
  - **intent:** Operator can sign in with login and password so Menus, Refusals, Ratings, and matches persist.
  - **success:** Unauthenticated users cannot access Menus or personal history; auth is login+password in v1.

- **CAP-21**
  - **intent:** Operator can open Recipe text for Menu dishes while shopping or cooking.
  - **success:** Recipe text is available from Menu, History, or Shopping list; no step timers or guided cook-along in v1.

## Constraints

- Single operator (Sergey); default plan feeds two people; desktop web first; Russian UI copy; light mode only in v1.
- Purchase completes outside the app; no in-app checkout or cart/list editing as a primary path.
- v1 grocery chain is single grocery chain only; keep a thin store-adapter boundary for a later chain.
- UJ-1 gate: Create Menu → slot edit → Portion plan → Shopping list; cannot skip slot edit.
- Refusal and dislike Rating hard-suppress future suggestions in v1 (not demote).
- Runtime and domain ownership follow Architecture Spine AD-1…AD-11 (Dokploy Next + Python catalog sync; Supabase Cloud auth/data; OpenRouter from Next server only; Menu-scoped CheckedMatch; materialised Shopping list snapshot).
- Visual/interaction contract: Soft Workshop + Lavender Workshop on shadcn (`DESIGN.md`); experience rules in `EXPERIENCE.md` win over mockups/wireframes.
- App does not promise perfect assortment or replace the store; post-planning substitutions are in the store cart.
- History replaces separate Recipe library browse in v1; UJ-2 Menu reuse as draft is out of v1 surfaces.
- Glossary terms in `glossary.md` are authoritative for domain vocabulary.

## Non-goals

- In-app checkout / ordering; guaranteed stock until delivery
- Multi-store or multi-chain UI in v1; multi-household accounts
- Ready packs / prebuilt Menu templates; separate fallback-after-planning flow
- In-app Shopping list or store-cart editing; match-review UI; stock-badge UI
- Cook-along timers / guided cooking; leftover / “eaten” tracking
- Hard monthly budget caps; hard food exclusions as required onboarding
- UJ-2 reuse-previous-Menu surface; dedicated Recipe library browse; Pantry management screen
- Dark mode; mobile layout requirement in v1

## Success signal

After two real cycles (Menu → buy outside the app → one cook → eat from the fridge for the Menu days): Sergey does not fall back to fully manual “by eye” shopping only in the store app; food covers the planned Menu days/portions; Recipes without an in-stock Product or analog at planning time did not enter those Menus. Do not optimize count of AI Recipes or “clever” matches if those three fail.

## Assumptions

- Match quality is system-owned; Sergey steers via Refusal, Rating, and store-cart edits.
- “Basic quality” for cheaper analogs is a simple heuristic, not a guaranteed quality score; preference aggressiveness is medium.
- Unofficial the store catalog access is enough for personal v1 catalog/prices (not ordering or stock guarantees).
- Cook ~2h is a suggestion-quality heuristic only — no duration UI or hard filter in v1.

## Open Questions

- Exact store-link transport format (deep link vs share URL vs other)? — deferred to implementation; copyable Shopping list remains the sufficient purchase path until a working link exists.
