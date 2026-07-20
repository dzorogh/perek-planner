---
title: "Brief ↔ PRD reconciliation: keplo"
status: draft
created: 2026-07-19
updated: 2026-07-19
inputs:
  - briefs/brief-keplo-2026-07-19/brief.md
  - briefs/brief-keplo-2026-07-19/addendum.md
  - prds/prd-keplo-2026-07-19/prd.md
  - prds/prd-keplo-2026-07-19/addendum.md
---

# Brief ↔ PRD Reconciliation

Spine: product brief (`brief.md`). Supporting brief notes: brief `addendum.md`. Target: PRD (`prd.md`) + PRD `addendum.md`.

This note separates **accepted deltas** (PRD intentionally overrides the brief), **accidental gaps** (brief ideas absent from the PRD without an explicit decision), and **qualitative tone/feel** thinned by FR structuring.

---

## 1. Alignment summary

The PRD preserves the core job: single operator (Sergey), default two people, one cook + one order per Menu, Checked matches before cart, pantry opt-in, fridge-keep capping window length, copyable Shopping list with optional store link, the store-only v1 with a thin store adapter, stale-catalog mode, and success judged by real fridge cycles—not clever AI.

The largest structural shift is resilience strategy: the brief centers **post-refresh fallback that keeps one cook and the same window**; the PRD replaces that with **today-stock eligibility at planning time** and explicitly non-goals a separate fallback flow. Secondary shifts remove ready packs and in-app list editing, expand the window to 1–4 days, and add Ratings.

---

## 2. Accepted deltas (intentional PRD overrides)

These are deliberate product decisions visible in PRD Non-Goals, FRs, or glossary—not omissions.

### D1 — Menu length: ~2–3 days → 1–4 days

| Brief | PRD |
|---|---|
| Default / usual window is two or three days | Menu length selectable as **1, 2, 3, or 4 days** (FR-1, Vision, UJ-1) |

**Verdict:** Accepted expansion. Fridge-keep still caps length (FR-1 / FR-14). Brief assumption A13 (“~2–3 from tomorrow”) is superseded for UX range; rhythm narrative remains batch-oriented.

### D2 — Post-plan fallback removed; planning-time stock filter instead

| Brief | PRD |
|---|---|
| If a critical product disappears after catalog refresh, offer fallback (substitute product and/or different recipe) preserving one cook and same window | **Non-Goal:** “A separate Fallback flow after planning.” FR-17: only suggest Recipes with an in-stock Checked-match variant **today**; post-plan substitutions happen in the **store cart**, not in-app. No stock badge UI. |

Brief addendum “Fallback when a product disappears” (show break → offer executable alternative → prefer cook-once shape) is overridden, not deferred.

**Verdict:** Accepted strategy change. Resilience moves from “heal a locked plan” to “never lock a plan that isn’t buyable now.” Downstream UX/arch should not reintroduce brief-style fallback unless this delta is reversed.

### D3 — Ready packs out of MVP

| Brief | PRD |
|---|---|
| In first version: “ready pack of checked recipes” as a fast path | **Non-Goal:** “Ready packs / prebuilt Menu templates” |

Repeat-previous remains (FR-9) as the only fast-path remnant, and is demoted to secondary (see D4).

**Verdict:** Accepted scope cut. Brief risk protection “ready packs so planning stays faster than the store app” is only partially covered by Menu reuse.

### D4 — Repeat-last-window demoted from co-primary protection to secondary journey

| Brief | PRD |
|---|---|
| Risks: offer repeat-last-window **and** ready packs so planning stays faster | UJ-2 / FR-9: reuse previous Menu as **optional safe draft**; primary path is new Menu with suggestions |

**Verdict:** Accepted prioritization. Feature kept; product emphasis flipped.

### D5 — Fixed address → selectable concrete store

| Brief | PRD |
|---|---|
| One store for address д. Алабино, 92 | FR-16: select a **specific store**; v1 chain single grocery chain only. Alabino appears in glossary as Product context, not as the only selectable store. |

**Verdict:** Accepted. Thin adapter boundary retained (PRD + PRD addendum).

### D6 — No in-app Shopping list / cart editing

| Brief | PRD |
|---|---|
| If the store access breaks: last saved catalog + stale warning + **allow manual list edits** | FR-18: stale catalog + warning. **Non-Goal:** “Editing the Shopping list or store cart inside this app.” Cart edits on store site (FR-17, §4.5). |

**Verdict:** Accepted hardening of handoff model. Stale mode remains; manual edit path does not.

### D7 — Match-review queue dropped; matches system-owned

| Brief (+ addendum) | PRD |
|---|---|
| Prefer small set of proven matches; new recipes wait in a **review queue**; wrong match destroys trust | FR-11–12: system-selected Checked matches; Sergey does **not** confirm each match. **Assumption:** no match-review UI in v1; steer via Refusal, Rating, store-cart edits. |

**Verdict:** Accepted UX simplification. Trust model shifts from human match review to Refusal/Rating after the fact.

### D8 — Ratings added beyond brief refusals

| Brief | PRD |
|---|---|
| Record of recipes he **rejected**; AI uses history and refusals | Glossary **Rating** + FR-10: like/dislike + extensible reasons after trying Recipe/Snack; dislike demotes suggestions. Refusal (FR-8) kept for pre-cook reject. |

**Verdict:** Accepted enrichment. Not a conflict—brief silent on post-cook rating.

### D9 — Soft “last checked” availability → hard “in stock today” gate

| Brief | PRD |
|---|---|
| Availability is useful but imperfect with a **“last checked”** time, not a guarantee; fallback when wrong/stale | Glossary **In stock today**; FR-17 binary eligibility; no stock badge UI; stale warning only for sync-failure catalog (FR-18) |

Related to D2. Soft-timestamp UX is not listed as a Non-Goal line-item, but the FR model is inconsistent with treating availability as a dated soft signal shown to the user.

**Verdict:** Treated as **accepted delta** (planning filter replaces soft signal + fallback). If product still wants a visible “last checked” on catalog freshness globally, that must be added explicitly—today only sync-failure stale warning is specified.

### D10 — Auth made explicit

| Brief | PRD |
|---|---|
| Supabase for auth (solution stack); single account holder | FR-23 login/password; unauthenticated users blocked from Menus/history |

**Verdict:** Accepted clarification / promotion to FR. Stack remains in PRD addendum, not requirements.

---

## 3. Accidental gaps (brief ideas missing without decision)

Items still present in the brief (or brief addendum) that the PRD neither implements nor explicitly non-goals/defers. Candidates for PRD edit or Open Questions.

### G1 — Cross-week variety as a packing / suggestion goal

Brief Success / Solution / assumption A14: variety across weeks (and “across batch dishes”) matters; AI guided by history and refusals toward that.

PRD: AI uses history, Refusals, Ratings (FR-7) but never states **variety** as a consequence, metric, or preference. Risk of suggestion loops of “safe same dishes” is unaddressed.

**Recommendation:** Add a consequence under FR-7 or a soft success note; or explicitly defer (“variety heuristic TBD”).

### G2 — Calendar / timeline as the window-picking metaphor

Brief Solution step 1: choose days on a **calendar or timeline**.

PRD: “picks 1–4 days” (FR-1); Open Question 1 covers post-suggestion editing, not the day-picker metaphor.

**Recommendation:** Keep as UX open question, or state “any control that selects length 1–4 is fine.”

### G3 — Recipe text as v1 cooking aid

Brief: “Cooking help in the first version is **recipe text** plus the shopping list — not cook-along.”

PRD: cook-along is Non-Goal; Recipe glossary has ingredients + fridge-keep; **no FR** that Sergey can view recipe instructions/method while cooking.

**Recommendation:** Add a thin FR (view Recipe text for Menu dishes) or Non-Goal if instructions are out of MVP.

### G4 — “Even drain / nearly finished by end of window” qualitative success

Brief: portions laid out so the batch is **nearly finished** by end of window; “finished evenly” = portioning only (A3).

PRD: Portion plan FRs + SM-2 (“food was enough… without running out early”). SM-2 covers under-portioning, not the brief’s “don’t leave a fridge full of ignored dishes / uneven eat-down” feel. No counter-metric for chronic over-planning.

**Recommendation:** Optional SM tweak or UX note; low urgency if Portion plan is considered sufficient proxy.

### G5 — Visibility when a Recipe is blocked (why not suggested)

Brief addendum fallback step 1: **show which recipe or ingredient broke**.

With D2, fallback is gone, but the brief’s diagnostic clarity has no PRD home. FR-17 only says ineligible Recipes are not shown—no requirement to explain “missing Product X” when browsing or after a refresh invalidates a draft Menu.

**Recommendation:** Decide: silent filter vs. explain-on-block for library browse / draft reuse after catalog change.

---

## 4. Qualitative tone / feel dropped by FR structure

These are not necessarily missing features; they are voice and product philosophy that the brief carries and the PRD flattens.

### T1 — Resilience narrative → eligibility filter

Brief problem/solution: the difference worth building is **plans that stay executable when the catalog is wrong or stale**—not an AI-chef fantasy or fake in-stock promise.

PRD Vision still says the app “holds the plan workable,” but FRs operationalize that as **pre-filter by today’s stock** (FR-17) plus stale catalog on sync fail (FR-18). The emotional contract “something went wrong after I planned—app saves the cook” is gone (by D2). Downstream writers may over-read Vision as fallback unless they read Non-Goals.

### T2 — Anti-friction / one-bad-cook death

Brief Risks: product fails by **adding friction and failing once on a real cook**. Pre-mortem table (wrong match, slow planning, retyping cart, spoilage, fragile pipe, scope creep).

PRD Success Metrics and Non-Goals encode outcomes but lose the pre-mortem framing. SM-C1 (don’t optimize clever AI) is the main surviving philosophy guardrail.

### T3 — Batch rhythm language

Brief executive summary: every two or three days—one order, one cook, fridge nearly empty by end. PRD opens with functional Menu language (1–4 days, slots, FRs). Correct for a PRD; easy to lose the “this is not a daily meal planner” feel in UX copy unless UX re-imports it.

### T4 — Copyable list as minimum success path (tone)

Still present (FR-20, SM-1) but brief’s insistence—“never depend only on a store link”—is slightly softer next to optional-link FR-21. Substance retained.

### T5 — Author language note

Brief addendum: prefer full readable sentences with Sergey; docs in English. PRD Vision is in Russian; rest English. No carry-forward of chat language guidance (fine for PRD; note for UX/copy).

### T6 — Stack / integration research tone

Brief Solution names Next.js / Supabase; brief addendum documents unofficial `store-catalog-api`, X5 B2B, VkusVill later. PRD correctly parks stack and store research in addendum—tone of “fragile unofficial pipe” is quieter in the PRD spine (only stale-catalog FR remains).

---

## 5. Coverage matrix (brief → PRD)

| Brief theme | PRD home | Status |
|---|---|---|
| Batch prep, one cook, one order | Vision, Menu glossary, FR-1…5 | Aligned |
| Two people, 3 meals/day default | Target User, FR-2 | Aligned |
| Window ~2–3 days | FR-1 (1–4) | **Delta D1** |
| Sergey single operator | §2, FR-23 | Aligned (+ D10) |
| the store / Alabino | Glossary, FR-16 | **Delta D5** (selectable store) |
| Critical ingredient Checked matches | FR-11–12, glossary | Aligned; review queue **D7** |
| Spices/sauces check + pantry opt-in | FR-11, FR-13 | Aligned |
| AI library + new, history/refusals | FR-6–8 | Aligned; + Ratings **D8** |
| Variety across weeks | — | **Gap G1** |
| Snacks no-cook same order | FR-4 | Aligned |
| Fridge-keep ≥ window | FR-14 | Aligned |
| Cheaper analogs, quality floor | FR-15 | Aligned |
| Imperfect availability + last checked | FR-17–18 | **Delta D9** |
| Fallback after product disappears | Non-Goal + FR-17 | **Delta D2** |
| Copyable list always | FR-20 | Aligned |
| Optional store link | FR-21 | Aligned |
| Price/nutrition when present | FR-22 | Aligned |
| No in-app checkout | §5 | Aligned |
| Recipe text + list cooking help | — / cook-along Non-Goal only | **Gap G3** |
| No leftover tracking | §5 | Aligned |
| Repeat last window | FR-9 secondary | **Delta D4** |
| Ready packs | Non-Goal | **Delta D3** |
| Thin store boundary | FR-16 assumption, addendum | Aligned |
| Stale catalog on sync fail | FR-18 | Aligned |
| Manual list edits when stale | Non-Goal | **Delta D6** |
| Calendar/timeline day pick | — (OQ-1 adjacent) | **Gap G2** |
| Even drain / nearly finished | Portion plan; SM-2 partial | **Gap G4** |
| Explain what broke | — | **Gap G5** |
| Two real fridge cycles success | SM-1 | Aligned |
| Hard budget / hard exclusions out | §5 | Aligned |
| Multi-store / multi-household out | §5, Non-Users | Aligned |

---

## 6. Recommendations (for PRD maintainers)

1. **Keep D2–D3–D6–D7 as written** if the team agrees planning-time stock + copy handoff is the v1 resilience model; do not reintroduce brief fallback/ready-packs/list-edit via UX “helpfulness.”
2. **Close G1, G3, G5** with one sentence each (FR consequence, thin FR, or explicit defer/Non-Goal)—highest accidental-gap risk.
3. **Re-import T1/T2 in Vision or Success** in one short paragraph so FR-17 is not misread as “fake perfect stock,” and so anti-friction remains a product constraint.
4. Leave G2 to UX; optionally note G4 under SM-2 if even-drain still matters.

---

## 7. Compact extract (for handoff)

**Input:** brief-keplo-2026-07-19

**Accepted deltas:**
- Menu window expanded to 1–4 days (from ~2–3).
- Post-plan fallback removed; today-stock eligibility + store-cart fixes instead.
- Ready packs and in-app list editing cut from MVP; match-review queue dropped.
- Repeat-previous demoted to secondary; Ratings added; concrete store select over fixed address-only.

**Accidental gaps:**
- Cross-week variety goal not carried.
- Recipe-text cooking aid has no FR.
- Blocked-recipe / broken-ingredient explanation unspecified after fallback removal.
- Calendar/timeline day-picker and even-drain success nuance under-specified.

**Tone dropped:** “Stay executable when catalog is wrong” and one-bad-cook anti-friction framing flattened into eligibility FRs.
