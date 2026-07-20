# Reconcile: UX ↔ Architecture Spine

**Date:** 2026-07-19  
**Scope:** Compare UX spines (`DESIGN.md`, `EXPERIENCE.md`) against `ARCHITECTURE-SPINE.md`. Report mismatches and UX-locked decisions absent from the architecture spine. **Do not rewrite the spine** — this file is input for epic/story planning and optional spine companions.

**Sources read:**
- `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/.memlog.md` (skim — decisions that shaped final UX spines)
- `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md`
- `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/.memlog.md` (skim — coaching decisions vs distilled spine)

**Reconciliation rules (from UX):**
- `EXPERIENCE.md` wins over mockups/wireframes on conflict.
- `DESIGN.md` / `EXPERIENCE.md` defer to PRD on scope conflict (no match-review, no fallback-after-planning, no ready packs, no in-app list edit as primary path).

---

## Verdict

**Mostly aligned on infrastructure invariants; materially under-specified on UX-locked product/domain behavior.**

The architecture spine correctly anchors runtime topology (Dokploy + Supabase + Python sync), matching ownership (Next server, persisted matches), AI gateway (OpenRouter server-only), auth/RLS, and high-level capability placement. It lists UX spines as sources and names shadcn / Soft Workshop as a UI constraint.

However, the distilled spine captures only a thin slice of UX-locked decisions. Many behavioral rules that **directly govern Next domain modules, DB shape, routing, and AI prompts** live only in UX (or in architecture `.memlog.md` but were dropped during distill). Implementers reading the spine alone would miss flow gates, suppression semantics, pantry/list rules, IA surfaces, and AI suggestion heuristics.

**Severity:** Gaps are not contradictions in deploy topology — they are **build-substrate holes** that invite epic-level drift (wrong routes, wrong shopping-list composition, wrong suggestion prompts, missing Settings/History modules).

---

## Aligned (no action required)

| Topic | UX | Spine | Notes |
|---|---|---|---|
| UI stack | shadcn/ui + Next + Tailwind | Stack table, paradigm, AD-6 | UX-locked |
| Visual direction | Soft Workshop + Lavender Workshop | Capability map: "Next + shadcn / Soft Workshop" | Palette/token detail correctly left in `DESIGN.md` |
| UI language | Russian copy | Consistency: "RU copy in UI only" | Aligned |
| Glossary naming | English domain ids in product vocabulary | "PRD glossary English ids in code" | Aligned |
| Auth | Login + password; no unauthenticated Menus/history | AD-5 | Aligned |
| Catalog stale warning | `warning-stale` on planning surfaces; continue on last-saved | Errors convention + FR-18 + sync markers | Aligned at intent level |
| Match-review UI | Out of v1 | Deferred table | Aligned |
| Store link handoff | Optional; copy always works | FR-21 deferred; shopping from persisted matches | Aligned (transport format deferred) |
| External purchase | No in-app checkout | Implicit via shopping handoff map | Aligned |
| Checked matches | System-owned; Products on list not match jargon | AD-3 persistence + naming | Aligned |
| Eligibility / today-stock | Only buyable recipes suggested; no stock-badge UI | AD-3 + FR-17 binding (implicit) | Aligned; stock-badge ban not explicit in spine |
| Time display | — | Europe/Moscow in UI | Compatible with RU desktop product |
| Entities (core) | Menu, Recipe, CheckedMatch, Product, ShoppingList, Rating, Refusal | ER diagram | Core graph present |
| Second chain | Not in v1 UI | Store adapter seam in AD-2 | Aligned |

---

## UX-locked decisions missing from spine

Grouped by impact on implementation. Items marked **memlog-only** were captured in architecture coaching `.memlog.md` but not carried into `ARCHITECTURE-SPINE.md`.

### A — Domain / Next server logic (high impact)

| UX-locked decision | Source | Spine gap | Why it matters |
|---|---|---|---|
| **Pantry/staples on Shopping list by default** — no per-item opt-in prompt; user filters in the store | EXPERIENCE Foundation, `shopping-list-cta`, Voice | No mention of Pantry items in list composition | Directly affects shopping-list generator and FR-19/FR-12 interpretation. Overrides earlier memlog "prompt each time" — final UX is **include by default**. |
| **Refusal hard-suppresses** future suggestions (v1) | EXPERIENCE State Patterns, Glossary | Refusal entity exists; no suppression rule | AI suggestion pipeline must filter; needs persisted query |
| **Rating dislike hard-suppresses** future suggestions (v1) | EXPERIENCE `history-rating-row` | Rating entity exists; no suppression rule | Same as Refusal — domain + prompt constraint |
| **Rating editable after submit** (v1) | EXPERIENCE State Patterns, Key Flows | "Mutated via server actions" only | Update semantics vs insert-only; affects API/idempotency |
| **Model C menu grid** — day × meal slot (breakfast/lunch/dinner); **no batch-component / cook-once layer** | EXPERIENCE Foundation, `slot-card` | Menu/MenuSlot in ER; no slot-type or model C rule | Schema and AI output shape; prevents inventing parallel "cook view" |
| **AI repeats simple home dishes/sides across days** (~20% variety enough); unique fancy dish/day is anti-pattern | EXPERIENCE Foundation, Voice, UJ-1 | AD-4 mentions OpenRouter only | **Prompt and ranking policy** — must live in Next domain; not optional UX polish |
| **Cook ~2h heuristic** — suggestion quality/voice only; no timer, no duration UI, no hard filter | EXPERIENCE Foundation, Glossary | Not mentioned | AI prompt constraint; avoid building duration fields "because architecture is silent" |
| **Empty slots allowed**; user may proceed to Portion plan | EXPERIENCE `slot-card`, State Patterns | Not mentioned | Validation rules on Menu completion |
| **Slot replace: AI resuggest OR History pick only** — no Recipe library search/browse | EXPERIENCE Interaction Primitives, `slot-card` | Not mentioned | Domain endpoints + UI routes; History query required |
| **Slot edit gate** — cannot skip from Create Menu to Shopping list | EXPERIENCE Interaction Primitives, UJ-1 | UJ-1 in `binds` only | Route guards / flow state machine |
| **Snacks** — no-cook items on same Menu/Order; aggregated `snacks-bar` | EXPERIENCE IA, components | ER has MenuSlot→Recipe only; no Snack distinction | May need meal-type enum or `is_snack`; affects list aggregation |
| **Default portion plan: 2 people × 3 meals/day** | EXPERIENCE Foundation, UJ-1 | Not mentioned | Seed defaults for new Menu |
| **Fridge-keep caps menu length** (PRD) | EXPERIENCE Glossary (via PRD) | Not in spine rules | Validation when picking day length / recipes |
| **Only Recipes with in-stock Critical ingredients suggested**; **no fallback-after-planning flow** | EXPERIENCE UJ-1 failure edge | AD-3 gates AI; fallback ban not explicit | Prevents post-plan substitute UI/workflow |
| **Price/nutrition only when catalog provides** | EXPERIENCE Voice (implicit FR-22) | Not in spine | Display/null rules on list rows |
| **History replaces Recipe library** — browse/rating/replace source | EXPERIENCE IA, Scope | No History module in structural seed | Needs routes, queries, nav |
| **UJ-2 reuse previous Menu as draft** — out of v1 surfaces | EXPERIENCE Out of v1 | Spine mentions "Menu reopen" for matches | Not a conflict — spine future-ready; UX must not expose reopen flow in v1 |

### B — IA, routing, and surfaces (high impact)

| UX-locked decision | Source | Spine gap |
|---|---|---|
| **Post sign-in landing:** Create Menu / current planning — not empty dashboard | EXPERIENCE Foundation, UJ-1 | No route/landing rule |
| **Primary nav surfaces:** Create/Menu flow, History, Settings | EXPERIENCE IA table | Structural seed lists `app/` only — no surface map |
| **Settings + `store-picker`** — concrete store; **set once**, not before each Menu | EXPERIENCE IA, `store-picker` | Store entity in ER; **no user store preference** table or Settings route |
| **Default store: д. Алабино, 92** | EXPERIENCE Foundation, UJ-1 | No seed/default config |
| **`recipe-text-panel`** — Dialog; opens from any Recipe name (Menu, History, Shopping list) | EXPERIENCE IA, Interaction Primitives | No Recipe text storage/display contract |
| **Linear UJ-1 spine** with pill-nav steps (Дни · Меню · План порций · Shopping list) | EXPERIENCE, DESIGN `pill-nav` | Flow not mapped to App Router segments |
| **Modal depth: one level** | EXPERIENCE IA | Not mentioned |
| **External handoff** — store link opens new tab; labeled outside app | EXPERIENCE Interaction Primitives | Not mentioned |
| **Sign-in surface** — only surface when unauthenticated | EXPERIENCE State Patterns | Middleware mentioned; no IA |
| **Mocks/spine-only gaps:** Sign-in, Settings, Recipe text panel not mocked — spine-only acceptable per UX memlog | UX memlog | Spine silent on these screens |

### C — UI system constraints (medium impact — mostly DESIGN.md)

| UX-locked decision | Source | Spine gap |
|---|---|---|
| **Light mode only v1** | DESIGN.md, EXPERIENCE Foundation | Not in spine (was in architecture memlog) |
| **Desktop web first; no mobile layout requirement v1** | DESIGN.md, EXPERIENCE | Not in spine (was in architecture memlog) |
| **Geist Sans** (shadcn default) locked for v1 | DESIGN.md | Not in spine (was in architecture memlog) |
| **Lavender Workshop tokens** — full palette, typography roles, spacing, radii | DESIGN.md frontmatter | Spine says Soft Workshop only — sufficient pointer, but no `{colors.*}` / token file convention for implementers |
| **Max content width ~1180px** | DESIGN.md Layout | Not in spine |
| **`warning-stale` surfaces:** Create Menu, slot edit, Portion plan (not Shopping list called out) | EXPERIENCE State Patterns | FR-18 generic |
| **Accessibility floor** — keyboard + contrast; focus rings; no elevated a11y program | EXPERIENCE Accessibility Floor | Not in spine |
| **No hover-only critical actions** without keyboard path | EXPERIENCE Scope boundaries | Not in spine |
| **Skeleton loading** — card grid on cold load | EXPERIENCE State Patterns | Not in spine |

### D — Explicit v1 exclusions (medium impact — prevent scope creep)

These are UX-locked **bans** that spine partially covers. Listing for epic checklists:

| Excluded in UX | In spine? |
|---|---|
| Match-review UI | Yes (Deferred) |
| Fallback-after-planning flow | Partial (implicit via AD-3) — **should be explicit for builders** |
| Ready packs | No |
| In-app Shopping list edit as primary path | No (memlog had it) |
| Pantry management screen | No |
| Recipe library browse | No |
| UJ-2 reuse Menu surface | No |
| Stock-badge UI | No |
| Cook-along / cook timer / duration UI | No |
| Post-cook Rating interrupt screen | No |
| Per-item staple opt-in prompt | No (superseded by default-include rule) |
| Dark mode | No (memlog had light-only) |

---

## Mismatches and tensions

### 1. Architecture memlog vs distilled spine (internal drift)

Architecture coaching `.memlog.md` recorded UX constraints that **did not survive distill** into `ARCHITECTURE-SPINE.md`:

- Desktop web RU; Soft Workshop + Lavender Workshop; **light-only**; **Geist Sans**
- Shopping handoff = copy (+ optional store link); **no in-app cart edit**
- Single-operator product shape

**Assessment:** Not a UX↔architecture conflict — the spine **regressed** against its own coaching log. UX still expects these; implementers relying only on the spine file miss them.

### 2. Pantry semantics: PRD wording vs final UX

- PRD/reconcile-prd frame FR-12 as **pantry opt-in gates eligibility**.
- Final UX (memlog override 2026-07-19): **staples included on Shopping list by default**, no per-item prompt; filtering at the store.

**Assessment:** UX is internally consistent in `EXPERIENCE.md`. Architecture spine is silent — **not a direct contradiction**, but epics must follow **final UX** for list composition while still gating Recipe eligibility on pantry-like critical paths per PRD logic. Spine should eventually name this rule; until then, treat UX as authoritative for v1 list behavior.

### 3. "Menu reopen" vs UJ-2 out of v1

- Spine AD-3: "Shopping list and **Menu reopen** use stored matches."
- UX: **UJ-2 reuse previous Menu as draft — out of v1 surfaces.**

**Assessment:** Compatible if "reopen" means technical reload of in-progress Menu within a session, not the UJ-2 "weeks later draft" journey. **Clarify in stories:** v1 has no "open previous Menu" entry point; persistence supports durability/handoff, not UJ-2 UX.

### 4. ER diagram vs UX entities

| UX concept | ER / spine |
|---|---|
| Snack (no-cook, separate aggregate bar) | Only MenuSlot → Recipe |
| User's selected store | Store catalog exists; no User→Store preference |
| History (surface) | User→Menu/Rating exists; no named History aggregate |
| Recipe text panel | Recipe exists; no text/blob field called out |
| Settings | Not modeled |

**Assessment:** Schema seed is incomplete relative to UX IA — not necessarily wrong, but **UX-locked surfaces imply tables/columns** (e.g. `user_settings.selected_store_id`, `menu_slot.meal_type`, `recipe.instructions_text` or similar).

### 5. Stale warning session persistence

- UX: `warning-stale` **persistent for session** until fresh sync on planning surfaces.
- Spine: sync writes last-success/error markers consumed by FR-18.

**Assessment:** Aligned at data layer; spine omits **client/session presentation rule** (which pages, dismiss behavior). Low architecture risk if FR-18 stories reference UX State Patterns.

### 6. Store selection timing

- UX: store chosen **once in Settings**; Create Menu does not re-prompt.
- Spine: FR-16 bound to catalog area; no Settings or preference persistence.

**Assessment:** Gap — matching/eligibility reads catalog for **user's stored store**, not a per-Menu picker.

---

## UX decisions correctly deferred to DESIGN.md (not spine gaps)

These are UX-locked but appropriately live in the design spine, not architecture:

- Full Lavender Workshop color/type/spacing/radius tokens
- Component visual skins (`day-card`, `slot-card`, `snacks-bar`, etc.)
- Elevation/shadow values
- Mockup references and wireframe precedence rules

Architecture spine's pointer to "UX spine (constraint)" is sufficient **if** epics also load `DESIGN.md` for UI stories.

---

## Recommended follow-ups (for epics / companions — not spine edits)

1. **Domain companion or AD stub:** Pantry-on-list-by-default, Refusal/Rating suppression, Model C slot grid, AI repetition + ~2h heuristic, empty-slot validation, slot-replace sources.
2. **IA/route map companion:** Sign-in, Create Menu landing, Menu/slot edit, Portion plan, Shopping list, Settings (`store-picker`), History, global `recipe-text-panel`; UJ-1 gate ordering.
3. **Schema notes:** User store preference; meal slot types + Snack flag; Recipe text storage; Rating update semantics.
4. **Explicit v1 exclusion checklist** in epic templates (mirror UX Scope boundaries + spine Deferred).
5. **Reconcile architecture memlog → spine:** Either restore light-only/desktop/Geist/no-cart-edit into spine or mark memlog items as superseded — avoid two architecture truths.

---

## Traceability matrix (UX component → spine coverage)

| UX artifact | Behavioral spec | Spine coverage |
|---|---|---|
| `day-length-picker` | 1–4 days → AI generate | FR-1 area; no picker/generate flow |
| `slot-card` | Model C, replace/refusal/clear, empty OK | Partial (Menu domain) |
| `warning-stale` | Planning surfaces, session persistent | FR-18 / errors |
| `portion-plan-grid` | 2×3 default, editable | FR-2/5 area |
| `shopping-list-cta` | Copy primary; staples default; optional link | AD-3 + partial FR |
| `store-picker` | Settings once; default Алабино 92 | **Missing** |
| `recipe-text-panel` | Global dialog | **Missing** |
| `history-rating-row` | Like/dislike + reason; editable; suppress | Entity only |
| `pill-nav` | Flow wayfinding | **Missing** (UI only) |
| `snacks-bar` | Aggregate snacks | **Missing** (domain) |

---

## Summary for parent agent

**Verdict:** Infrastructure aligned; **product/domain/IA UX locks largely absent from spine.**

**Top gaps:**
1. Pantry/staples **included on Shopping list by default** (no per-item prompt) — shopping-list domain rule missing.
2. **Settings + store-picker** (once, default Алабино 92) — no user store preference in spine/ER.
3. **AI suggestion policy** (Model C, cross-day repetition, ~2h heuristic, suppression from Refusal/Rating dislike) — not in AD-3/AD-4.
4. **UJ-1 flow gates & IA** (landing, slot-edit gate, History replaces library, linear steps) — not in structural seed.
5. **v1 exclusion list** incomplete in spine (no cart edit, no stock badges, no fallback, UJ-2 UI, etc.) — architecture memlog had some; distilled spine dropped them.
