# Reconcile: PRD

Sources: `.working/extract-prd.md` (PRD + addendum extract) vs `.memlog.md` (UX decisions through 2026-07-19 finalize).

---

## Kept in UX

**Product spine (verbatim PRD intent)**

- Personal web batch-cooking planner: pick **1–4 days** → one **Menu**, one **the store order**, one **cook session**; default **3 meals/day × 2 people**; purchase **outside** the app via always-**copyable Shopping list** (+ optional store link). *(extract-prd §Product one-liner; memlog UJ-1 confirmed)*
- Single operator **Sergey**; unauthenticated users cannot access Menus or history. *(FR-23; memlog stakes + UJ-1)*
- **UJ-1** end-to-end: sign-in → pick days → **Menu slot edit** → **Portion plan** → **Shopping list** → external store. *(memlog: “UJ-1 flow confirmed OK as stated”)*

**Menu & portions (FR-1…FR-5)**

- Create Menu by choosing 1, 2, 3, or 4 days; primary path is **not** slot-by-slot from scratch. *(FR-1; memlog post-generation slot/edit step)*
- Breakfast / lunch / dinner slots per day; **empty slots allowed**; only eligible Recipes assignable. *(FR-3)*
- **Snacks** (no-cook) on same Menu/order. *(FR-4)*
- **Portion plan** visible by day and meal before purchase; servings adjustable before copying Shopping list. *(FR-2, FR-5)*

**Suggestions, Refusal, suppression (FR-7, FR-8, FR-10)**

- AI suggestions informed by history, **Refusals**, **Ratings**; prefer variety across weeks. *(FR-7)*
- **Refusal** before cooking; hard-suppressed from suggestions in v1. *(FR-8)*
- **Rating** after trying (like/dislike + reason: too hard, not tasty, too long, other); dislike hard-suppresses in v1. *(FR-10; memlog: required in UX, delivered via history — see Conflicts)*

**Checked matches & eligibility (FR-11…FR-15)**

- Recipes only when every **Critical ingredient** has **Checked match** Product variant(s); Sergey sees Products on Shopping list, **not** per-match confirmation UI. *(FR-11; memlog: PRD wins — no match-review)*
- **Pantry opt-in** gates eligibility; items join Shopping list only with explicit user consent (UX shape changed — see Dropped). *(FR-12)*
- **Fridge-keep** caps Menu length; shortest selection among chosen Recipes caps length. *(FR-13, FR-14)*
- **Cheaper analog preference** system-owned; no match-review UI. *(FR-15)*

**Catalog & store (FR-16…FR-18)**

- **Concrete store** selection; v1 default context **д. Алабино, 92**. *(FR-16; memlog: “Store selection surface in v1: yes”)*
- Only suggest Recipes **buyable today**; **no stock badge UI**; no fallback flow after planning. *(FR-17; memlog: PRD wins)*
- **Stale catalog warning** when sync fails; planning continues on last-saved catalog. *(FR-18)*

**Shopping list & handoff (FR-19…FR-22)**

- One combined Shopping list from Checked-match Products + opt-in Pantry items. *(FR-19)*
- Always copyable; store link optional and **must not** be the only purchase path. *(FR-20, FR-21)*
- Price and nutrition **only when catalog provides them**. *(FR-22)*

**Cooking aid (FR-24)**

- **Recipe text** readable while shopping or cooking; **no** cook-along / timers. *(FR-24; memlog: “available when cooking and at any other moment”)*

**Hard non-goals (all retained)**

- No in-app checkout, guaranteed stock, multi-store UI, ready packs, fallback-after-planning, in-app cart/list editing, cook-along, leftover tracking, budget caps, multi-household. *(extract-prd §Explicit non-goals; memlog PRD-over-brief override)*

**UX additions aligned with PRD (not contradictions)**

- **Desktop web**, UI language **Russian**. *(memlog form-factor)*
- **Visual system:** direction B Soft Workshop + Lavender Workshop palette; **shadcn/ui** on Next.js + Tailwind; **light mode only** v1. *(memlog decisions 19–22, 25)*
- **Accessibility floor:** standard keyboard use + adequate contrast; no elevated a11y bar beyond that. *(memlog line 34)*

---

## Dropped / overridden (qualitative ideas not in UX spines)

| PRD item | UX outcome | Memlog |
|---|---|---|
| **FR-6 Browse Recipe library** as a dedicated surface (“Recipe library + suggestions” in handoff list) | **No separate Recipe library in v1.** Past Recipes/Menus **history** is the browse/re-entry surface; also hosts Rating. | `(override) No separate Recipe library in v1 UX — history of past Recipes/Menus only` |
| **FR-9 / UJ-2 Reuse previous Menu** as optional secondary journey and surface | **Out of v1 UX surfaces.** Primary path remains new Menu with suggestions; no “reopen draft weeks later” flow in v1 UI. | `(override) UJ-2 reuse previous Menu as draft: out of v1 UX surfaces` |
| **Pantry** as a named surface / management screen (handoff item #6) | **No Pantry management screen.** When a pantry-like item would join the order, **prompt each time** per item; user decides whether to buy. | `(override) No Pantry management screen in v1 — … prompt each time` |
| **PRD §8 Q1** — how much post-suggestion slot editing | **Resolved:** user expects **slot/edit step (правки)** after recipes are picked, **not** jump straight to Shopping list. | `(decision) Post-generation Menu flow: user expects slot/edit step after recipes are picked` |
| **Rating** as implied dedicated post-cook interrupt / banner | **Option A:** rate from **history** of past Menu/Recipe entries; **no** forced post-cook interrupt screen; **no** soft banner required in v1. | `(decision) Rating UX: option A — rate from history …` |
| Brief-leaning extras (when they conflicted with PRD) | PRD constraints win: no match-review, no fallback-after-planning, no ready packs, no in-app shopping-list edit as primary. | `(override) PRD wins over brief for v1 UI …` |

**Not in PRD but UX narrowed scope**

- **Dark mode:** out of scope v1 — light only. *(memlog line 25)*

---

## Conflicts resolved (cite memlog)

1. **“Pick 1–4 days → get Recipes” editing model (PRD §8 Q1)**  
   - *PRD tension:* open whether suggestions land directly on Shopping list or allow edits.  
   - *Resolution:* `(decision) Post-generation Menu flow: user expects slot/edit step after recipes are picked (правки), not jump straight to shopping list` → wired into confirmed UJ-1: `… → Menu slot edit → Portion plan → Shopping list`.

2. **Recipe library vs history (FR-6 vs FR-9)**  
   - *PRD tension:* both “browse library” and “reuse previous Menu” as features.  
   - *Resolution:* `(override) No separate Recipe library in v1 UX — history of past Recipes/Menus only (also hosts Rating)` **and** `(override) UJ-2 reuse previous Menu as draft: out of v1 UX surfaces`. History becomes the single retrospective surface; explicit draft-reuse journey deferred.

3. **Pantry UX shape (FR-12)**  
   - *PRD tension:* Pantry opt-in is required behavior; surface unspecified.  
   - *Resolution:* `(override) No Pantry management screen in v1 — when a staple/pantry-like item would join the order, prompt each time to add to Shopping list`. Eligibility gating unchanged; management UI dropped.

4. **Rating placement (FR-10)**  
   - *PRD tension:* Rating required after trying; no prescribed screen.  
   - *Resolution:* `(decision) Rating after cooking: required in UX; preferred placement is via history of past Recipes` → `(decision) Rating UX: option A — rate from history … no dedicated forced post-cook interrupt screen`.

5. **PRD vs brief on match review, fallback, ready packs, in-app list edit**  
   - *Resolution:* `(override) PRD wins over brief for v1 UI: no match-review, no fallback-after-planning flow, no ready packs, no in-app shopping-list edit as primary — unless user overrides`.

6. **Store selection (FR-16)**  
   - *PRD stated; UX confirmed:* `(decision) Store selection surface in v1: yes (concrete store; default Алабино 92)` — no conflict; explicit UX commitment.

---

## Open for product (not UX)

These remain **outside finalized UX spines** — product, engineering, or future UX polish:

| Topic | Owner | Notes |
|---|---|---|
| **Cheaper-variant aggressiveness** when several in-stock Products match | Engineering / product | PRD §8 Q2; UX retains system-owned preference, no UI knob. |
| **Store-link transport** (deep link, share URL, format) | Engineering | PRD §8 Q3 / addendum; UX requires optional link + always-copyable list only. |
| **Rating interaction micro-details** within history | Product + UX polish | Memlog: “exact interaction TBD with user” before option A; spine is history-based, not interrupt — field-level UX still refinable. |
| **Suggestion algorithm & variety metrics** | Product / engineering | FR-7 behavior; no UX surface beyond slot edit + Refusal/Rating feedback loops. |
| **Catalog sync reliability & unofficial access** | Product / engineering | Stale warning is UX; sync cadence, failure modes, legal/ops not UX. |
| **Supabase auth flows, password reset, session** | Engineering | FR-23 constrains; sign-in screen in scope; account lifecycle not designed. |
| **Brand, i18n beyond Russian UI, offline** | Product | PRD “not specified”; UX picked visual direction for internal use only. |
| **UJ-2 Menu reuse, dedicated Recipe library, Pantry admin** | Product (vNext) | Explicitly dropped from v1 UX; PRD features remain backlog candidates. |
| **Multi-household, multi-store, second chain, budget caps, exclusions onboarding** | Product | PRD non-goals / non-users; no v1 UX. |

---

*Reconciled 2026-07-19 against extract-prd.md and memlog through finalize.*
