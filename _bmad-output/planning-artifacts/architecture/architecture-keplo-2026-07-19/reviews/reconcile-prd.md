# PRD ↔ Architecture Spine Reconciliation

**Date:** 2026-07-19  
**PRD:** `_bmad-output/planning-artifacts/prds/prd-keplo-2026-07-19/prd.md`  
**Spine:** `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md`  
**Task:** Identify load-bearing PRD requirements that did **not** land in the architecture spine (quiet requirements, tone/constraints dropped by AD structure). No spine rewrite.

---

## Verdict

**GAPS**

The spine correctly anchors runtime topology, catalog ownership, matching location, AI gateway, auth, and dependency direction. It binds FR-1…FR-24 at metadata level and maps capabilities to modules. However, many **behavioral invariants**, **negative constraints**, and **product-tone rules** from the PRD are absent from ADs and the ER seed — they are load-bearing for implementation consistency even though they are not infrastructure decisions.

---

## Gaps That Matter for Implementation Consistency

### Planning flow & product posture

| PRD source | Load-bearing requirement | Spine status |
|---|---|---|
| Vision §1; FR-1; UJ-1 | **Primary path:** pick 1–4 days → receive Recipes/suggestions; **not** slot-by-slot assembly before suggestions | Not in ADs or capability rules; only FR id binding |
| FR-9; UJ-2 | **Secondary path:** reuse past Menu as editable draft (weeks later); must **not** be presented as primary | Absent — no routing/priority invariant |
| Vision §1; Glossary “Cook session” | One **batch cook session** covers all Menu days (not per-day cooks) | Absent — no domain concept or invariant |
| Vision §1; §1 closing | App **does not replace the store**; **does not promise** perfect assortment — workable plan with today’s matches | Tone/constraint dropped entirely |
| Non-Goals | No **Fallback flow** after planning; no in-app cart/checkout | Partially implied by handoff map; not stated as forbidden capabilities |

### Portion plan & servings

| PRD source | Load-bearing requirement | Spine status |
|---|---|---|
| FR-2 | Default servings: **3 meals/day × 2 people** for new Menu | Absent from domain/ER conventions |
| FR-3 | Each day has breakfast/lunch/dinner slots; **empty slots allowed** | ER has MenuSlot but no meal-slot or emptiness rules |
| FR-5 | Portion plan visible **before** purchase; portions laid out so food is eaten **evenly across days**; **no leftover/eaten tracking** (Non-Goal) | Absent — “even distribution without leftover tracking” is a domain rule, not UX-only |
| FR-4 | **Snacks** are no-cook Menu items on same order; **no cook session** | ER `MenuSlot → Recipe` only; Snack entity/flag and cook-session exclusion missing |

### Suggestions, memory & AI behavior

| PRD source | Load-bearing requirement | Spine status |
|---|---|---|
| FR-7 | Suggestions use **cook history, Refusals, Ratings** | Capability map only; no persistence/filter contract |
| FR-7 | Prefer **variety across weeks** (avoid repeating same few Recipes) | Absent |
| FR-8 | Refusal → **hard-suppress** from suggestions in v1 (not demote) | Absent |
| FR-10 | Dislike Rating → **hard-suppress** that Recipe/Snack in v1 | Absent |
| FR-7, FR-12 | AI may propose **new Recipes**; gated by checked matches before entering Menu/library | AD-3/AD-4 gate eligibility; no model for AI Recipe persistence vs ephemeral proposal |
| SM-C1 | Do **not** optimize AI recipe count / “clever matches” if core success metrics fail | Product guardrail absent |

### Matching, eligibility & pantry

| PRD source | Load-bearing requirement | Spine status |
|---|---|---|
| FR-11 | Critical ingredient may map to **several Product variants**; Sergey **does not manually confirm** matches — sees Products on Shopping list | AD-3 covers persistence; multi-variant + **no match-review UI** (positive rule) not in invariants |
| FR-11 | Spices/sauces required by Recipe are **checked for catalog presence** as part of eligibility | Pantry vs Critical distinction not in ER/rules |
| FR-13 | Pantry items **gate eligibility** but appear on Shopping list **only with explicit opt-in** | AD-3 mentions eligibility broadly; opt-in list composition rule absent |
| FR-14; FR-1 | Recipe fridge-keep ≥ Menu length; **shortest selected fridge-keep caps** allowable Menu length | Absent from ER (`Recipe` has no fridge-keep) and AD-3 |
| FR-15 | Prefer **cheaper suitable analogs** without collapsing below basic quality bar | Explicitly deferred to OQ — load-bearing matching policy not bound in AD-3 |

### Catalog, stock & handoff

| PRD source | Load-bearing requirement | Spine status |
|---|---|---|
| FR-16 | v1 default store context: **д. Алабино, 92** | Absent (seed/config expectation) |
| FR-17 | Recipes lacking in-stock Critical match are **not shown at all** — **no stock badge UI** | Negative UX constraint absent; implementers may add stock UI |
| FR-17 | Substitutions after planning happen **in store cart**, not in app | Absent as explicit boundary |
| FR-20 | Shopping list **always copyable**; copy sufficient without store link | Not an AD invariant (only FR map) |
| FR-21 | Store link is **optional**; must **never** be the only purchase path | Deferred transport; optional-not-required invariant absent |
| FR-22 | Price/nutrition shown **only when catalog provides**; **no fabricated** values | Absent — risk of placeholder UI/logic |

### Auth scope & cooking aid

| PRD source | Load-bearing requirement | Spine status |
|---|---|---|
| §2; FR-23 | **Single operator** (Sergey); not multi-household | AD-5 covers RLS per user but not single-operator product scope |
| FR-24; Non-Goals | Cooking aid = **Recipe text + Shopping list** only; **no** cook-along/timers | Absent negative constraint |
| FR-10 | Ratings apply to **Recipes and Snacks** | ER has Rating; Snack linkage not explicit |

### Data model seed gaps (implementation drift)

- **Fridge-keep duration** on Recipe (FR-1, FR-14) — missing from ER.
- **Snack** vs Recipe distinction (FR-4, FR-10) — MenuSlot→Recipe only.
- **Pantry item** opt-in state per Menu/Shopping list (FR-13, FR-19) — no entity or rule.
- **Meal slot** (breakfast/lunch/dinner) on MenuSlot (FR-3, FR-5) — not in ER.
- **Portion/serving counts** per Menu (FR-2) — not in ER.

---

## Wrongly Contradicted

**None found.** No spine AD directly contradicts PRD requirements.

### Tensions to watch (not contradictions)

1. **AD-3 match persistence vs FR-17 “in stock today”** — PRD scopes in-stock gating to **planning time**; spine mandates persisted matches for Menu reopen/Shopping list. Reopening an old Menu under stale catalog (FR-18) may show products that were in-stock at save time but not now — consistent if revalidation happens on reopen; spine does not specify when eligibility is re-run.
2. **Capability map bundles FR-24 (Recipe text)** with suggestions/Rating/Refusal — organizational oddity, not a rule conflict.
3. **AD-5 “email/password”** vs PRD “login and password” — aligned via Supabase Auth.

---

## Coverage Summary (what landed well)

| Area | Spine coverage |
|---|---|
| Deploy topology (Dokploy + Supabase + Python sync) | AD-1 ✓ |
| Catalog single-writer + store adapter | AD-2 ✓ |
| Matching/eligibility in Next + persisted matches | AD-3 ✓ |
| AI via OpenRouter server-side | AD-4 ✓ |
| Auth + RLS | AD-5 ✓ |
| Module dependency direction | AD-6 ✓ |
| Stale catalog warning | Conventions + AD-2 logging ✓ |
| Match-review UI out of v1 | Deferred ✓ |
| Store-link format TBD | Deferred ✓ |
| Glossary naming in code | Conventions ✓ |

---

## Recommended downstream action (informational — not a spine edit)

Carry forward as **domain invariants** or **implementation checklist** (outside spine): primary/secondary planning paths, hard-suppression semantics, pantry opt-in, portion defaults, negative UX boundaries (no stock UI, no fallback, no in-app cart), fridge-keep cap, snack model, and FR-22 no-fabrication rule.
