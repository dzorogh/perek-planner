# Reconcile: Brief

**Sources:** `.working/extract-brief.md` (product brief + addendum) vs UX spine in `.memlog.md`, `.working/stitch-handoff-prompt.md`, `.working/extract-prd.md`, and confirmed UJ-1 flow.

**Reconciliation rule (memlog):** PRD wins over brief for v1 UI unless the user explicitly overrides.

---

## Kept in UX

Core brief intent survives in the UX spine:

- **Batch meal-prep model** — one Perekrestok order, one cook session, eat from the fridge until the batch is nearly finished (`extract-brief.md` one-liner; UJ-1 in memlog).
- **Operator & defaults** — Sergey, single account; default **3 meals/day × 2 people** (`extract-brief.md`; stitch handoff).
- **Meal-prep window** — user picks length before suggestions; UX uses **1–4 days** (brief said ~2–3 configurable — kept, slightly widened).
- **Menu composition** — breakfast, lunch, dinner slots per day + **diverse no-cook snacks** on the same order (`extract-brief.md` journeys 2–3; UJ-1 confirmed memlog).
- **Slot edit after suggestions** — not slot-by-slot from scratch; user gets suggestions then **edits/swaps/refuses/empties** slots (memlog: Post-generation Menu flow; stitch handoff §Menu + slot edit).
- **AI suggestions** — library + new recipes informed by **history and refusals**; variety across weeks (brief journeys 3–4; UX adds **ratings** as a second suppression signal — memlog rating decisions).
- **Checked ingredient→product matching** — recipes only when critical ingredients map to catalog products; cheaper analog preference is **system-owned** (brief constraints A7; PRD FR-11…FR-15).
- **Critical vs spices/sauces** — critical ingredients gate eligibility; pantry-like items **opt-in per order** (brief A6; memlog pantry override — behavior kept, not a screen).
- **Fridge-days cap** — menu length ≤ shortest recipe fridge-keep among selections (brief A2).
- **Portion plan by day and meal** — “finished evenly” / even drain = portions laid out up front, no leftover tracking (brief journey 6; UJ-1 flow).
- **Shopping list handoff** — one combined list, **always copyable**, optional Perekrestok store link when working, never the only path (brief journeys 5, 7; stitch hard constraints).
- **External purchase only** — no in-app checkout (brief non-goals; stitch hard constraints).
- **Recipe text view** — readable while shopping/cooking; **no cook-along** timers or guided mode (brief must-haves; memlog recipe text decision).
- **Refusals** — record before cooking; hard-suppress future suggestions in v1 (brief jobs; PRD FR-9).
- **Post-cook rating** — like/dislike + reason; dislike hard-suppresses (not in brief; added in UX — memlog lines 27–28).
- **Store context** — single chain Perekrestok; **store selection surface** with default **д. Алабино, 92** (brief surfaces; memlog store selection decision).
- **Stale catalog mode** — plan on last-saved catalog with **explicit stale warning** when sync fails (brief journey 10; stitch surface 9).
- **Price and nutrition** — shown only when catalog provides fields; never invented (brief must-haves).
- **Tech & form factor** — desktop web, Next.js + **shadcn/ui** + Tailwind, Supabase auth/data; UI copy in **Russian** (brief stack; memlog form-factor + UI system decisions).
- **Visual direction** — Soft Workshop register, **Lavender Workshop** palette (memlog lines 20–22); light mode only (memlog line 25).
- **Accessibility floor** — standard keyboard + adequate contrast; no elevated a11y bar (memlog line 34).

---

## Dropped / overridden (qualitative ideas not in UX spines)

Brief-only or brief-emphasized ideas **not** carried into v1 UX surfaces:

| Brief idea | Brief reference | UX outcome |
|---|---|---|
| **Review queue** for new unchecked ingredient→product links | Must-have screens; open questions; glossary | **Dropped.** System-owned checked matches; no human match-review / confirmation UI (memlog override line 16; stitch “No match-review”). |
| **Fallback UI** after catalog refresh — show broken recipe/ingredient; offer substitute product and/or different recipe | Journey 9; must-have Fallback UI; glossary “fallback” | **Dropped.** No post-planning fallback flow; plan stays executable by **only suggesting buyable recipes** today (memlog override line 16; PRD FR-17). |
| **Ready packs** — fast path using a pre-checked pack of recipes | Journey 8; must-have; glossary; open questions | **Dropped** from v1 UX (memlog override line 16; stitch out-of-scope). |
| **Repeat last window / reuse previous Menu (UJ-2)** | Journey 8; must-have “repeat last window” | **Dropped** as v1 surface — UJ-2 out of scope (memlog line 31). Primary path remains new Menu with suggestions. |
| **Pantry layer screen** — separate pantry management; gates eligibility, cart opt-in | Must-have pantry layer; glossary | **Overridden.** No pantry management screen; **per-item prompt** when a staple would join the shopping list — user decides each time (memlog line 30). |
| **Separate Recipe library** browse surface | Must-have AI + library; stitch surface 5 | **Overridden.** **History of past Recipes/Menus only** — also hosts rating (memlog line 29). |
| **Manual shopping-list edits in app** (especially under stale catalog) | Journey 10 stale mode; open question on sync | **Dropped as primary path.** No in-app list editing; cart edits happen on Perekrestok site (memlog override line 16; PRD non-goals). |
| **Ingredient→product matching visibility / per-link review** | Must-have matching visibility + review queue | **Reduced.** User sees **Products on the shopping list**, not a match-review or link-approval UI. |
| **Availability UI** — “last checked” timestamp, “enough” soft signal, stock confidence | Must-have availability; open question A5 | **Overridden.** **No stock-badge UI**; recipes without in-stock critical matches are simply **not suggested** (stitch hard constraints; PRD FR-17). |
| **Calendar / timeline window picker** (explicit calendar UX) | Journey 1; must-have calendar/timeline | **Not designed.** Replaced by simpler **pick 1–4 days** control on Create Menu (UJ-1 wireframe; stitch surface 2). |
| **Fallback choice presentation** — substitute vs different recipe ordering | Open questions | **N/A in v1** — fallback flow removed entirely. |
| **Ready packs composition, naming, selection flow** | Open questions | **Deferred / dropped** with ready packs. |

**Brief non-goals** that UX also honors (no conflict): in-app checkout, guaranteed stock, multi-store UI, cook-along, daily separate cooking, multi-household, leftover tracking, hard budget caps, required food-exclusion onboarding.

---

## Conflicts resolved (cite memlog)

| Conflict | Brief position | Resolution | Memlog cite |
|---|---|---|---|
| Match review vs system matching | Human review queue for unchecked AI matches | **PRD/UX wins:** system-owned checked matches; no review UI | `(override) PRD wins over brief for v1 UI: no match-review…` |
| Post-planning fallback | Show breaks; offer substitutes or alternate recipes | **PRD/UX wins:** no fallback-after-planning flow | same override line 16 |
| Ready packs & repeat window | Fast paths for ready packs and repeat last window | **Ready packs dropped; UJ-2 (reuse Menu) out of v1** | override line 16; `(override) UJ-2 reuse previous Menu as draft: out of v1 UX surfaces` |
| Pantry layer vs per-item opt-in | Dedicated pantry layer screen | **Per-item prompt**, no pantry screen | `(override) No Pantry management screen in v1…` |
| Recipe library vs history | Browse library + suggestions | **History only** (hosts rating) | `(override) No separate Recipe library in v1 UX…` |
| In-app list editing | Manual list edits when catalog stale | **Not primary path**; external cart edits | override line 16 |
| Menu flow after generation | Brief silent on edit step | **Slot/edit step required** before portion plan / list | `(assumption) Post-generation Menu flow: user expects slot/edit step…` |
| Window length | ~2–3 days (A13) | **1–4 days** in UJ-1 | `(decision) UJ-1 flow confirmed OK… pick 1–4 days → Menu slot edit → Portion plan → Shopping list` |
| Rating placement | Not in brief | **Rate from history**; no forced post-cook interrupt | `(decision) Rating UX: option A — rate from history…` |
| UI language | Brief docs in English | **Russian UI copy** for Sergey | `(decision) Form-factor: desktop web; UI language: Russian` |
| Visual identity | “Modern UI components” only | **Soft Workshop + Lavender Workshop** | `(decision) Visual direction: B soft-workshop…`; `(decision) Palette: Lavender Workshop…` |
| Dark mode | Unspecified | **Light only v1** | `(decision) Dark mode: out of scope for v1 — light only` |
| Design tool path | Stitch handoff drafted | **Stitch abandoned; coaching path** — artifacts kept in `.working/` | `(change) Design handoff via Google Stitch abandoned…` |

---

## Open for product (not UX)

Items the brief raises that UX deliberately did not close — owner is product/engineering, not UX design:

1. **Window start default** — brief A13 “~2–3 days from tomorrow” (medium confidence); UX allows 1–4 days but **default pre-selection** on Create Menu not specified.
2. **Refusals record UX** — brief requires keeping rejected recipes; UX hard-suppresses but **browse/search/reuse of refusals list** not designed (brief open question).
3. **Availability semantics** — brief A5 “enough” + last-checked as soft signal; UX avoids UI by filtering suggestions — **product policy** if anything beyond hide/unhide is needed later.
4. **Manual list edits under stale catalog** — brief allows edits; UX defers to external store — **product decision** if copy-only handoff is insufficient when catalog is stale.
5. **Cheaper analog aggressiveness** — brief prefers cheaper analogs without quality collapse; system-owned in PRD; **engineering tuning**, not UX surface.
6. **Store-link format** — deep link vs share URL (PRD open question); UX only requires optional link alongside copy.
7. **Optional preference data** — food exclusions “later” in brief; no v1 UX (aligned).
8. **Success validation** — “two real fridge cycles” success bar (brief constraints) — **product metric**, not a screen.
9. **Rating reason taxonomy extension** — v1 reasons fixed in PRD; extensibility is product backlog.
10. **Ready packs / UJ-2 / fallback / review queue** — if user overrides PRD-first rule, product must re-open scope; currently **explicitly out of v1 UX**.

---

*Reconciled: 2026-07-19. Next UX artifact: populate `DESIGN.md` / `EXPERIENCE.md` spines from memlog decisions.*
