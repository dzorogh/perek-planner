---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
readinessStatus: NEEDS WORK
assessor: bmad-check-implementation-readiness
assessmentDate: 2026-07-20
documentsIncluded:
  - prds/prd-keplo-2026-07-19/prd.md
  - architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md
  - epics.md
  - ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md
  - ux-designs/ux-keplo-2026-07-19/DESIGN.md
  - ux-designs/ux-keplo-2026-07-19/wireframes/flow-uj1-2026-07-19.excalidraw
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-20
**Project:** keplo

## Document Inventory

Assessment set confirmed by user (2026-07-20).

### PRD
- Whole: `prds/prd-keplo-2026-07-19/prd.md` (~19 KB, 2026-07-20)
- Supporting (excluded from primary set): addendum.md, extract-brief.md, reconcile-brief.md, research-landscape.md, review-rubric.md
- Sharded: none

### Architecture
- Whole: `architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md` (~13 KB, 2026-07-19)
- Supporting (excluded): reviews/*
- Sharded: none

### Epics & Stories
- Whole: `epics.md` (~31 KB, 2026-07-20)
- Sharded: none

### UX Design
- Primary: `ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md` (~17 KB, 2026-07-20)
- Primary: `ux-designs/ux-keplo-2026-07-19/DESIGN.md` (~15 KB, 2026-07-19)
- Wireframe: `ux-designs/ux-keplo-2026-07-19/wireframes/flow-uj1-2026-07-19.excalidraw`
- Supporting (excluded): reconcile-*.md, .working/*
- Sharded: none

### Issues Resolved
- No whole vs sharded duplicates
- All four document types present
- `project-context.md` absent (non-blocking for discovery)

## PRD Analysis

Source: `prds/prd-keplo-2026-07-19/prd.md` (status: final)

### Functional Requirements

FR-1: Create Menu — Sergey can create a Menu by choosing 1, 2, 3, or 4 days and receiving Recipes for that length. Realizes UJ-1.
- Menu length selectable as 1, 2, 3, or 4 days.
- Menu length cannot exceed the shortest fridge-keep duration among selected Recipes.
- Primary path does not require building the Menu slot-by-slot from scratch before seeing suggestions.

FR-2: Configure servings — Sergey can set serving counts for a Menu; default is three meals per day for two people.
- A new Menu starts with default servings: 3 meals/day × 2 people.
- Sergey can change servings for that Menu before copying the Shopping list.

FR-3: Assign meals — Sergey can assign Recipes to breakfast, lunch, and dinner slots in the Portion plan. Realizes UJ-1.
- Each day in the Menu has breakfast, lunch, and dinner slots.
- Empty meal slots are allowed.
- Only eligible Recipes (per Checked match rules) can be assigned to a slot.

FR-4: Add snacks — Sergey can add no-cook snacks to the same Menu and the same order. Realizes UJ-1.
- Snacks appear on the Shopping list with the rest of the Menu.
- Snacks do not require a cook session.

FR-5: View Portion plan — Sergey can view the Portion plan by day and meal before purchase and cooking. Realizes UJ-1.
- Portion plan shows every day and meal slot for the Menu (including empty slots).
- Portions laid out up front so the Menu can be eaten evenly across days without leftover tracking.
- Portion plan visible without completing checkout (checkout is out of app).

FR-6: Slot replace via AI (no library browse) — Sergey can replace a Menu slot via AI resuggest. There is no separate Recipe library browse and no manual History-pick control in v1.
- Slot replace uses AI resuggest only.
- Recipes without Checked matches for Critical ingredients cannot be assigned to a slot.

FR-7: AI suggestions with long-idle reuse — Sergey can receive AI suggestions (from known Recipes or newly proposed ones) informed by cook recency, Refusals, and Ratings. Realizes UJ-1.
- Suggestions consider prior cook recency, Refusals, and Ratings.
- Recipes not cooked for approximately 2+ weeks are candidates for reintroduction; highly liked Recipes weighted somewhat more often; Refusal/dislike stay hard-suppressed.
- Suggestions prefer variety across weeks while allowing Model C same-week side repetition.
- New AI Recipes are gated by FR-12 and must also satisfy FR-17 (in stock today).

FR-8: Record Refusal — Sergey can mark a Refusal on a Recipe before cooking.
- A Refusal is stored against that Recipe.
- Refused Recipes are hard-suppressed from suggestions in v1.

FR-9: Reuse previous Menu (secondary) — Sergey can optionally reuse a previous Menu as a safe draft (including weeks later), then accept or edit it. Realizes UJ-2.
- A past Menu can be loaded as a draft for a new planning session.
- Reuse is available but not presented as the primary planning path.
- Sergey can edit any slot after reuse before generating the Shopping list.

FR-10: Rate Recipe or Snack — After trying a Recipe or Snack, Sergey can leave a Rating (like/dislike + reason from an extensible list).
- Rating applies to a Recipe or a Snack.
- Reason from: too hard, not tasty, too long, other (list may grow later).
- Dislike hard-suppresses that item from future suggestions in v1 (FR-7).

FR-11: Require Checked matches — Sergey can use a Recipe in a Menu only when each Critical ingredient has system-selected Checked match Product variant(s).
- Missing Checked match for any Critical ingredient blocks the Recipe from suggestions and the Menu.
- A Critical ingredient may map to several Product variants.
- Spices/sauces required by the Recipe are checked for catalog presence as part of eligibility.
- Sergey does not manually confirm each match; he sees resulting Products on the Shopping list.

FR-12: Gate new AI Recipes — Newly AI-proposed Recipes are not suggested until the system has Checked matches for Critical ingredients.
- Recipes without system Checked matches do not appear as suggestions or drive the Shopping list.
- Assumption: Match quality is system-owned; Sergey corrects outcomes by Refusal/Rating and by editing the store cart, not by a match-review UI in v1.

FR-13: Pantry on list by default — Pantry items affect Recipe eligibility; in v1 they appear on the Shopping list by default so Sergey can filter them at store order time (no per-item in-app opt-in prompt).
- A Recipe can be ineligible if a required Pantry item Product is missing from the catalog.
- Pantry items appear on the Shopping list by default without an in-app opt-in prompt.

FR-14: Fridge-keep vs Menu length — A Recipe is eligible for a Menu only if its fridge-keep duration is at least the Menu length.
- Recipes with fridge-keep shorter than the Menu cannot be assigned to that Menu.
- Shortest Recipe fridge-keep among selections caps allowable Menu length (with FR-1).

FR-15: Prefer cheaper analogs (medium) — When choosing among suitable Products for a Checked match, the system prefers a cheaper analog at medium aggressiveness: favor the cheaper option when the price gap is clear, without collapsing below a basic quality bar or always picking the absolute cheapest.
- Cheaper suitable Products preferred over clearly ultra-expensive equivalents when both match.
- Cheapest SKU not chosen if it fails basic quality heuristic; ties or tiny gaps need not force a switch.
- Assumption: “Basic quality” is a simple heuristic or manual preference, not a guaranteed quality score.

FR-16: Select store — Sergey can select a specific store whose catalog drives Products and today’s stock.
- A concrete store (not only a free-text address) is selected for planning.
- v1 chain is single grocery chain only.
- Assumption: Thin store-adapter boundary for future chains.

FR-17: Only suggest Recipes buyable today — At planning time, do not suggest a Recipe if any Critical ingredient lacks at least one Checked-match Product variant (including analogs) that is in stock today.
- If one variant is OOS but another matched variant is in stock, the Recipe may still be suggested.
- Recipes with no in-stock variant for a Critical ingredient are not shown and cannot be assigned.
- No stock badge UI is required.
- Substitutions after planning are handled by Sergey in the store cart, not in this app.

FR-18: Block planning when catalog is stale — If store access/sync fails or the catalog is not fresh, Menu planning is blocked with an explicit stale warning until a fresh sync succeeds.
- Clear stale warning on planning surfaces when catalog data is non-fresh.
- Generate/continue Menu planning actions blocked while catalog is stale or sync failed.
- Planning re-enabled after successful fresh sync for the active store.
- Settings and account access remain available while planning is blocked.

FR-19: Build Shopping list — Sergey gets one combined Shopping list for the Menu from Checked-match Products (plus Pantry items by default).
- List covers all Critical ingredient Products for Recipes/Snacks on the Menu.
- Pantry items appear on the list by default (FR-13).

FR-20: Copy Shopping list — Sergey can always copy the Shopping list.
- Copy works even when no store link is available.
- Copy is sufficient to complete purchase outside the app.

FR-21: Optional store link — When a working the store link can be produced, Sergey can open it; it must not be the only purchase path.
- Missing or broken link does not block planning or copy (FR-20).
- Assumption: Link format may be deep link, share URL, or equivalent — exact transport deferred.

FR-22: Price and nutrition when present — Show price and nutrition for Products/Recipes only when the catalog provides those fields.
- Missing catalog fields do not block the Shopping list.
- No fabricated price or nutrition values.

FR-23: Login / password — Sergey can sign in with login and password to use the app.
- Unauthenticated users cannot access Menus or personal history.
- Auth is login+password in v1 (not anonymous-only).

FR-24: View Recipe text — Sergey can open Recipe text for dishes on the Menu while shopping or cooking.
- Recipe text is available in-app for Menu Recipes.
- No step timers or guided cook-along flow in v1.

**Total FRs: 24**

### Non-Functional Requirements

PRD has no dedicated numbered NFR section. Implicit / cross-cutting quality requirements derived from FR consequences, Non-Goals, and MVP scope:

NFR-I1 (Security / Access): Unauthenticated users cannot access Menus or personal history; v1 auth is login+password for a single operator (from FR-23).

NFR-I2 (Data freshness / Reliability): Menu planning must not proceed on stale or failed catalog sync; planning surfaces show an explicit stale warning; settings/account remain available (from FR-18).

NFR-I3 (Integrity of catalog-derived data): Price and nutrition must never be fabricated when catalog fields are missing (from FR-22).

NFR-I4 (Usability / Simplicity): Primary path is pick days → get Recipes without slot-by-slot build-first; no stock badge UI; no match-review UI; no in-app cart edit; copyable list is always sufficient purchase path (from FR-1, FR-17, FR-12, Non-Goals, FR-20/21).

NFR-I5 (Suggestion policy quality): Refusal and dislike are hard-suppressed; variety preferred across weeks with Model C same-week side repetition allowed; long-idle (~2+ weeks) reintroduction candidates (from FR-7, FR-8, FR-10).

NFR-I6 (Extensibility constraint): Thin store-adapter boundary so another chain can be added later without rewriting Menu/Recipe logic (assumption on FR-16); not a second-chain UI in v1.

**Total explicit numbered NFRs in PRD: 0**
**Total implicit NFRs extracted for traceability: 6**

### Additional Requirements

**Key user journeys:**
- UJ-1: Open app → pick 1–4 days → Menu (meals + snacks) → copyable Shopping list (+ optional store link).
- UJ-2: Secondary — reuse previous Menu as safe draft, then accept/edit.

**Non-Goals (must not be implemented as v1 scope):**
- In-app checkout / ordering; guaranteed stock until delivery; multi-store/multi-chain UI; ready packs / prebuilt templates; separate Fallback flow after planning; editing Shopping list/cart in-app; cook-along timers; leftover tracking; hard monthly budget caps; hard food exclusions as required onboarding; multi-household accounts.

**Success metrics (validation targets, not implementation stories by themselves):**
- SM-1, SM-2, SM-3; counter-metric SM-C1 (do not optimize AI recipe/match counts if SM-1/SM-2 fail).

**Open questions:**
1. UX for pick days → get Recipes — Resolved (UX): slot-edit after suggestions before Portion plan and Shopping list.
2. Cheaper analog aggressiveness — Resolved: medium (FR-15).
3. Store-link generation/transport format — open; owner engineering; deferred; copy remains sufficient.

**Assumptions index:** Thin store-adapter; system-owned match quality; store link transport TBD; basic quality heuristic for analogs; pantry on list by default.

**Constraints:** Single operator; single grocery chain only in v1 UI; default store context д. Алабино, 92; default plan feeds two people; purchase outside the app.

### PRD Completeness Assessment

- Functional scope is well structured: 24 nested FRs with testable consequences, clear Non-Goals, MVP in/out, glossary, and journeys.
- Gaps for readiness: no dedicated NFR section (performance, availability, accessibility, latency, observability not specified); store-link transport still open; addendum referenced for adapter/link details but was excluded from primary assessment set.
- Clarity is high for product behavior; quality attributes beyond freshness/auth/no-fabrication are under-specified for engineering SLAs.

## Epic Coverage Validation

Source: `epics.md`. **Important:** Epics renumber FRs relative to PRD (epics FR1–FR25 ≠ PRD FR-1…FR-24). Matrix below uses **PRD IDs** as the source of truth and maps to epics inventory IDs.

### Epic FR Coverage Extracted (epics document IDs)

FR1: Epic 2 — Create Menu by day length + suggestions
FR2: Epic 3 — Configure servings
FR3: Epic 2 — Edit breakfast/lunch/dinner slots
FR4: Epic 2 — Add Snacks
FR5: Epic 3 — View/adjust Portion plan
FR6: Epic 2 — Slot replace via AI; long-idle reuse by Rating weight
FR7: Epic 2 — AI suggestions (recency/Refusal/Rating, Model C)
FR8: Epic 2 — Record Refusal
FR9: Epic 4 — Rate from History (maps to PRD FR-10, not PRD FR-9)
FR10: Epic 2 — Checked-match eligibility
FR11: Epic 2 + Epic 3 — Pantry/staples gate + list lines
FR12: Epic 2 — Fridge-keep vs Menu length
FR13: Epic 2 — Medium cheaper-analog preference
FR14: Epic 1 — Select store in Settings
FR15: Epic 2 — Today-stock gate
FR16: Epic 1 — Stale catalog warning + block planning
FR17: Epic 3 — Build combined Shopping list
FR18: Epic 3 — Always copy Shopping list
FR19: Epic 3 — Optional store link
FR20: Epic 3 — Price/nutrition when present
FR21: Epic 1 — Login/password auth
FR22: Epic 4 — View Recipe text
FR23: Epic 2 + Epic 3 — UJ-1 flow gate (UX-derived; not a PRD FR number)
FR24: Epic 4 — History surface (UX-derived)
FR25: Epic 1 — Post sign-in lands on Create Menu (UX-derived)

**Total FRs claimed in epics inventory: 25**

### Coverage Matrix (PRD → Epics)

| PRD FR | PRD Requirement (short) | Epic Coverage | Status |
| ------ | ----------------------- | ------------- | ------ |
| FR-1 | Create Menu 1–4 days + suggestions | Epics FR1 → Epic 2 (Stories 2.1, 2.3) | ✓ Covered |
| FR-2 | Configure servings (default 3×2) | Epics FR2 → Epic 3 (Story 3.1) | ✓ Covered |
| FR-3 | Assign meals / slots | Epics FR3 → Epic 2 (Stories 2.1, 2.4) | ✓ Covered |
| FR-4 | Add snacks | Epics FR4 → Epic 2 (Story 2.5) | ✓ Covered |
| FR-5 | View Portion plan | Epics FR5 → Epic 3 (Story 3.1) | ✓ Covered |
| FR-6 | Slot replace via AI only | Epics FR6 → Epic 2 (Story 2.4) | ✓ Covered |
| FR-7 | AI suggestions + long-idle / variety | Epics FR7 (+ FR6 long-idle) → Epic 2 (Stories 2.3, 2.7) | ✓ Covered |
| FR-8 | Record Refusal | Epics FR8 → Epic 2 (Story 2.6) | ✓ Covered |
| FR-9 | Reuse previous Menu (UJ-2 secondary) | **NOT FOUND** — epics Non-goals: “UJ-2 reuse surface in v1 UI” | ❌ MISSING (deferred) |
| FR-10 | Rate Recipe or Snack | Epics FR9 → Epic 4 (Story 4.2) | ✓ Covered |
| FR-11 | Require Checked matches | Epics FR10 → Epic 2 (Story 2.2) | ✓ Covered |
| FR-12 | Gate new AI Recipes until matches | Covered under Epics FR7/FR10 (Story 2.3) — no separate epics FR | ✓ Covered (merged) |
| FR-13 | Pantry on list by default | Epics FR11 → Epic 2 + Epic 3 (Stories 2.2, 3.2) | ✓ Covered |
| FR-14 | Fridge-keep vs Menu length | Epics FR12 → Epic 2 (Stories 2.1, 2.2) | ✓ Covered |
| FR-15 | Prefer cheaper analogs (medium) | Epics FR13 → Epic 2 (Story 2.2) | ✓ Covered |
| FR-16 | Select store | Epics FR14 → Epic 1 (Story 1.3) | ✓ Covered |
| FR-17 | Only suggest Recipes buyable today | Epics FR15 → Epic 2 (Story 2.2) | ✓ Covered |
| FR-18 | Block planning when catalog stale | Epics FR16 → Epic 1 (Story 1.5) | ✓ Covered |
| FR-19 | Build Shopping list | Epics FR17 → Epic 3 (Story 3.2) | ✓ Covered |
| FR-20 | Copy Shopping list | Epics FR18 → Epic 3 (Story 3.3) | ✓ Covered |
| FR-21 | Optional store link | Epics FR19 → Epic 3 (Story 3.4) | ✓ Covered |
| FR-22 | Price and nutrition when present | Epics FR20 → Epic 3 (Story 3.5) | ✓ Covered |
| FR-23 | Login / password | Epics FR21 → Epic 1 (Story 1.2) | ✓ Covered |
| FR-24 | View Recipe text | Epics FR22 → Epic 4 (Story 4.3) | ✓ Covered |

### Missing Requirements

#### Critical Missing FRs

**PRD FR-9: Reuse previous Menu (secondary / UJ-2)**
- Full PRD text: Sergey can optionally reuse a previous Menu as a safe draft (including weeks later), then accept or edit it. Realizes UJ-2.
- Impact: Secondary journey UJ-2 has no implementation path in v1 stories; PRD lists it in MVP scope (§6.1: FR-6…FR-10 includes FR-9).
- Epics stance: Explicitly excluded (“Non-goals in code: … UJ-2 reuse surface in v1 UI”).
- Recommendation: Either (a) add a story under Epic 4 (or Epic 2) for draft-reuse, or (b) formally amend PRD MVP to move FR-9 / UJ-2 out of MVP and keep epics alignment — **do not leave PRD vs epics in conflict**.

#### High Priority Process Gaps (not missing FR behavior)

1. **FR numbering divergence:** Epics FR9 = PRD FR-10 (Rating); epics FR10–FR22 = PRD FR-11–FR-24 shifted; PRD FR-9 omitted; epics add FR23–FR25 (flow gate, History, post-login landing). Traceability risk for implementation agents.
2. **PRD FR-12** has no dedicated epics FR id (merged into FR7/FR10) — acceptable if AC remain explicit (Story 2.3 does gate new AI Recipes).

### FRs in epics but not numbered in PRD

| Epics FR | Meaning | Notes |
| -------- | ------- | ----- |
| FR23 | UJ-1 flow gate (cannot skip slot edit) | From UX resolve of open question; good addition |
| FR24 | History surface | Supports Rating / cook-recency; PRD implies via FR-10/FR-7 |
| FR25 | Post sign-in → Create Menu | UX/architecture landing rule |

### Coverage Statistics

- Total PRD FRs: **24**
- FRs covered in epics (by behavior): **23**
- FRs missing / deferred with conflict: **1** (PRD FR-9 / UJ-2)
- Coverage percentage (behavioral): **95.8%**
- Coverage percentage if FR-9 treated as intentional MVP cut needing PRD amend: still a **blocker for readiness until reconciled**

## UX Alignment Assessment

### UX Document Status

**Found** — primary set confirmed in Step 1:
- `ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md` (status: final) — Experience Spine, IA, flows, components, a11y floor
- `ux-designs/ux-keplo-2026-07-19/DESIGN.md` (status: final) — Soft Workshop / Lavender Workshop brand layer
- `ux-designs/ux-keplo-2026-07-19/wireframes/flow-uj1-2026-07-19.excalidraw` — UJ-1 primary journey

### UX ↔ PRD Alignment

**Aligned:**
- UJ-1 path matches PRD: sign-in → pick 1–4 days → suggestions → slot edit → Portion plan → copyable Shopping list (+ optional store link).
- Glossary terms shared; Checked-match / pantry-default / stale-block / no stock badges / no match-review / no in-app checkout match Non-Goals.
- Slot-edit-after-suggestions resolves PRD Open Question #1.
- Rating from History (not forced post-cook) fits PRD FR-10 consequences and UX EXPERIENCE.

**Misaligned / unresolved:**
- **UJ-2 / PRD FR-9:** PRD §6.1 MVP includes FR-9 (reuse previous Menu). UX Foundation and “Out of v1 — UJ-2” explicitly exclude reuse surfaces. Epics Non-goals match UX, not PRD MVP list. This is the same readiness blocker as Step 3.
- UX/Epics add flow rules not numbered in PRD (slot-edit gate, post-sign-in Create Menu landing, History as primary nav) — acceptable productization, already inventoried as epics FR23–FR25.

### UX ↔ Architecture Alignment

**Supported well:**
- Stack posture: Next App Router + shadcn Soft Workshop / Lavender Workshop; desktop; Russian; light-only (Spine Consistency + DESIGN).
- Store picker in Settings + Menu `store_id` snapshot (AD-9) matches UX `store-picker` once-not-every-menu.
- Stale catalog block via `catalog_sync_runs` (AD-8) matches `warning-stale` on Create Menu / slot edit / Portion plan.
- Shopping list snapshot + staples by default (AD-11) matches `shopping-list-cta` / pantry rules.
- AI OpenRouter server-only + Refusal/dislike hard-suppress (AD-4) matches UX suggestion policy.
- History + Rating + recipe-text Dialog (Consistency IA) match EXPERIENCE surfaces.

**Gaps / tensions:**
- **AD-10** still specifies Menu reuse/clone matching rules (binds PRD FR-9) while UX/epics defer UJ-2 UI — architecture is forward-compatible, but implementers may over-build a clone path with no UX story. Prefer: implement AD-10 only when/if FR-9 is restored, or document “domain-ready, no UI story in v1.”
- No architecture SLAs for UI responsiveness/load times (UX desktop-first only; DESIGN notes breakpoints &lt;1024px undesigned) — acceptable for hobby v1 if acknowledged.
- DESIGN open notes: shopping-list-cta layout parity with direction B; history-rating-row exact anatomy — polish, not blockers if EXPERIENCE behavioral rules are followed.

### Alignment Issues

1. **PRD MVP vs UX/Epics on UJ-2 (FR-9)** — must reconcile before Phase 4.
2. **FR numbering drift** (PRD vs epics) amplifies UX-derived FR23–25 confusion for agents.
3. Architecture prepares FR-9 (AD-10) without a v1 UX surface — clarify intentional deferral vs incomplete cut.

### Warnings

- Do not start implementation assuming PRD §6.1 FR-6…FR-10 literally includes Menu reuse until PRD or epics/UX are amended to match.
- Mockups referenced by DESIGN/EXPERIENCE (`mockups/*.html`) were not in the confirmed assessment set; wireframe UJ-1 was. Visual parity checks may need mockups during story implementation.
- Accessibility is an explicit floor (keyboard + contrast + non-color-only stale warning) — present in UX/epics NFR4; not elevated WCAG program.

## Epic Quality Review

Reviewed against create-epics-and-stories standards: user value, epic independence, story sizing, ACs, dependencies, DB timing, starter template.

### Epic Structure Validation

| Epic | User-centric title/outcome? | Stands with prior epics only? | Verdict |
| ---- | --------------------------- | ----------------------------- | ------- |
| Epic 1: Sign in, workspace & store catalog | Yes — sign in, land on planning, store once, plan only on fresh catalog | Standalone | ✓ Pass |
| Epic 2: Plan a buyable Menu | Yes — pick days, get buyable AI Menu, edit slots, snacks, refusals | Needs Epic 1 only | ✓ Pass (internal story issue below) |
| Epic 3: Portion plan & Shopping list handoff | Yes — servings + leave with copyable list | Needs Epic 1–2 | ✓ Pass |
| Epic 4: History, ratings & recipe text | Yes — review, rate, read recipe text | Needs Epic 1–2; Shopping-list open path needs Epic 3 | ✓ Pass with note |

No pure “Setup Database / API Development” epics. Story 1.4 (catalog sync worker) is technical in shape but outcome is user-facing (real store assortment) — acceptable for this product.

### Best Practices Compliance Checklist

| Check | Epic 1 | Epic 2 | Epic 3 | Epic 4 |
| ----- | ------ | ------ | ------ | ----- |
| Epic delivers user value | ✓ | ✓ | ✓ | ✓ |
| Epic can function independently (N uses only &lt;N) | ✓ | ✓ | ✓ | ✓* |
| Stories appropriately sized | ⚠ 1.1 large | ⚠ 2.2/2.3 large | ✓ | ✓ |
| No forward dependencies | ✓ | ❌ 2.3→2.7 | ✓ | ⚠ 4.3→Epic 3 surface |
| DB tables when first needed | ✓ | ✓ | ✓ | ✓ |
| Clear Given/When/Then ACs | ✓ | ✓ | ✓ | ✓ |
| Traceability to FRs | ✓ | ✓ | ✓ | ✓ |

\*Epic 4 History/Rating/Recipe-from-Menu work without Epic 3; Recipe-from-Shopping-list AC implies Epic 3 exists.

### Starter Template Check

Architecture specifies `create-next-app -e with-supabase` (+ Tailwind 4, Structural Seed, Dokploy, `sync/`). **Story 1.1** explicitly initializes from that starter — ✓ Compliant.

### Greenfield Indicators

Present: project init (1.1), auth/DB (1.2), sync worker (1.4). Absent: dedicated CI/CD pipeline story — **minor** for hobby single-operator scope; Dokploy deploy implied by Architecture, not story-bound.

### Dependency Analysis (notable)

**Within Epic 2 — Critical/Major:**
- Story 2.3 AC: “long-idle reuse weighting is fully specified in Story 2.7” → **forward dependency**. Generate Menu (2.3) cannot be considered complete against FR6/FR7 long-idle without 2.7, yet 2.3 ships earlier.
- Remediation: Merge long-idle weighting ACs into 2.3, or reorder so 2.7 precedes/joins 2.3, or scope 2.3 as “suggestions without long-idle weights” and make 2.7 the explicit enhancement with measurable delta.

**Epic 2 → Epic 3 (acceptable deferred effects):**
- 2.5/2.2 note list lines / Snack products appear when Shopping list is built in Epic 3 — persistence now, handoff later — OK.

**Epic 4 → Epic 3:**
- 4.3 “opens from … Shopping list” — implement Menu/History first; treat Shopping-list entry as AC that becomes testable after Epic 3.

### Acceptance Criteria Quality

Strengths: Consistent Given/When/Then; stale/error paths in 1.5 and 3.4; eligibility/hard-suppress called out; UX-DR refs; AD tags.

Weaknesses:
- Story 2.3 defers completeness to 2.7 (above).
- Story 1.1 allows auth redirect to be “stubbed” until 1.2 — acceptable sequencing but leaves 1.1 alone non-demoable for real login.
- No explicit failure AC for OpenRouter/AI errors in 2.3/2.4 (loading/disabled picker only) — **major** for implementability.
- Exact stale freshness threshold (what “non-fresh” means in time) not in story ACs — deferred to `catalog_sync_runs` semantics / migrations — **minor** if migration story defines it.

### Quality Findings by Severity

#### Critical Violations

1. **PRD FR-9 / UJ-2 vs epics Non-goals** (cross-doc; also Steps 3–4) — MVP scope conflict, not an epic-structure defect alone, but blocks “ready to implement as written.”
2. **Story 2.3 forward-depends on Story 2.7** for long-idle / Rating-weighted reintroduction — violates independent completability of 2.3.

#### Major Issues

1. **FR numbering divergence** (epics FR1–25 vs PRD FR-1…24) — high agent error risk during Phase 4.
2. **Missing AI failure ACs** on generate/resuggest (2.3, 2.4) — error, retry, empty-eligible-set handling underspecified.
3. **Story 1.1 size** — starter + brand tokens + shell + pill-nav + landing; consider splitting brand/shell vs starter if velocity stalls.
4. **Story 2.2 size** — matching + analogs + pantry gate + fridge-keep + today-stock in one story; high risk of incomplete “done”; consider splitting matcher core vs policy heuristics (FR13 medium aggressiveness).

#### Minor Concerns

1. No CI/CD story for greenfield.
2. Epic 4 Shopping-list entry point for recipe text depends on Epic 3 surface.
3. Epics NFR1–10 are richer than PRD (good) but not mirrored back into PRD NFR section.
4. Architecture AD-10 reuse rules without epics UI story — clarify “no clone UI in v1.”

### Remediation Recommendations

1. Reconcile FR-9: amend PRD MVP **or** add reuse story — pick one.
2. Fix 2.3/2.7 ordering or merge ACs so generate story is independently shippable.
3. Add PRD↔Epics FR alias table at top of `epics.md` (or renumber epics to PRD IDs).
4. Add AI error / zero-eligible-recipe ACs to Stories 2.3 and 2.4.
5. Optionally split 2.2 into eligibility core + cheaper-analog/pantry policy.
6. Document AD-10 as future-ready only until UJ-2 is in scope.

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK**

Planning artifacts are strong (final PRD, UX spine, Architecture Spine, four user-value epics with BDD ACs). They are **not yet safe to treat as a single authoritative MVP** because PRD still includes UJ-2 / FR-9 while UX and epics explicitly cut it, and Epic 2 has a forward story dependency that breaks independent completion of AI generate.

### Critical Issues Requiring Immediate Action

1. **Reconcile PRD FR-9 (UJ-2 Menu reuse) with UX/Epics** — PRD §6.1 MVP lists FR-9; EXPERIENCE and epics Non-goals exclude UJ-2 UI. Pick amend-PRD or add-story before Phase 4.
2. **Remove Story 2.3 → 2.7 forward dependency** — long-idle / Rating-weighted reintroduction must be completable inside the generate story or reordered so 2.3 is independently shippable.
3. **Publish PRD↔Epics FR alias map (or renumber)** — epics FR9 = PRD FR-10; epics omit PRD FR-9 and add FR23–25. Without an alias table, implementation agents will mis-trace requirements.

### Recommended Next Steps

1. Decide UJ-2: update PRD MVP/Non-Goals to match UX/epics **or** add a reuse story and restore UX surface — then align Architecture AD-10 wording (“v1: no UI; domain rule if/when”).
2. Fix Epic 2 story order/ACs for long-idle (merge into 2.3 or move 2.7 before/with 2.3); add AI failure / zero-eligible-set ACs to 2.3 and 2.4.
3. Add a short FR crosswalk at the top of `epics.md` (PRD FR-n → epics FRn / story).
4. Optionally split Story 2.2 (matcher core vs cheaper-analog/pantry policy) if the first implementation pass looks oversized.
5. Re-run this readiness check (or a focused delta review) after the three critical fixes, then proceed to sprint planning / story creation for implementation.

### Final Note

This assessment identified **11** notable issues across **4** categories (coverage conflict, UX/PRD alignment, epic quality/dependencies, traceability/process). Address the **3 critical** items before Phase 4 implementation. Findings can improve the artifacts; proceeding as-is risks building the wrong MVP boundary and incomplete AI generate acceptance.

**Assessor:** bmad-check-implementation-readiness  
**Date:** 2026-07-20  
**Report:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-20.md`
