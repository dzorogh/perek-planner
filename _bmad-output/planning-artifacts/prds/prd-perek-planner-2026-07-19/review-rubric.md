# PRD Quality Review — perek-planner

## Overall verdict
This is a solid hobby PRD: a clear thesis (workable batch plan with in-stock Checked matches and out-of-app purchase), honest non-goals, and FRs that mostly carry testable consequences. The main usefulness risk is a few soft FR edges — undefined “locking” of the Shopping list, and Refusal/Rating demotion left as “suppress or strongly demote” — not missing strategy or scope theater. Fit for UX / architecture / stories at personal stakes.

## Decision-readiness — strong
Trade-offs are stated as product choices, not smoothed: Vision (§1) and §4.4/§4.5 explicitly refuse ideal assortment, in-app checkout, and stock-until-delivery guarantees; Non-Goals (§5) and Non-Users (§2.2) make the same cuts legible. Open Questions (§8) are real deferrals (UX density of post-suggestion editing, cheap-analog aggressiveness, link transport) without a hidden answer in the next sentence. Assumptions are tagged where the PRD infers (FR-12, FR-15, FR-16, FR-21). For a single-operator hobby greenlight, a decision-maker can act without inventing the spine.

### Findings
_None — dimension holds without additive findings._

## Substance over theater — strong
One named operator (Sergey, §2) drives UJs and FRs; no persona stack. Vision (§1) is product-specific (1–4 days, Перекрёсток, one order / one cook, Checked matches) — not swappable into another meal planner. JTBD (§2.1) map to eligibility, pantry opt-in, and Refusal/Rating behavior rather than generic “delight.” There is no NFR boilerplate section of “scalable / secure / reliable”; constraints live as FR consequences (FR-17, FR-18, FR-20–22). Differentiation is earned by the Checked-match + out-of-app handoff bet, not an Innovation section.

### Findings
_None._

## Strategic coherence — strong
Thesis is explicit: keep the plan workable with verified Products in stock today and a list you can buy outside the app (§1, §4.3–§4.5). Feature groups follow that arc (Menu → eligibility/matches → catalog/stock → Shopping list handoff → light auth for persistence). MVP Scope (§6) matches a problem-solving MVP, not a platform laundry list. Success Metrics (§7) validate the thesis with real cycles (SM-1), portion adequacy (SM-2), and stock gating (SM-3); SM-C1 correctly counters optimizing “clever” AI/matches when the primary SMs fail.

### Findings
_None._

## Done-ness clarity — adequate
Most FRs have concrete Consequences (e.g. FR-1 length enum and fridge-keep cap; FR-11–FR-14 eligibility rules; FR-17–FR-18 stock/stale behavior; FR-19–FR-21 copy-always / link-optional). Soft spots remain where an engineer still has to invent a rule: FR-2 references “locking the Shopping list” without defining lock; FR-8/FR-10 allow “suppressed or strongly demoted” without choosing one; FR-7’s “consider” history/Refusals/Ratings is directional, not a threshold. Acceptable at hobby stakes; still the dimension story creation will feel first.

### Findings
- **medium** Undefined “lock” of Shopping list (§4.1 FR-2) — Consequence says servings can change “before locking the Shopping list,” but no FR defines what lock means (immutable list? copy moment? link generation?). *Fix:* Either define lock (e.g. first successful copy / explicit “ready to shop”) or rephrase to “before generating/copying the Shopping list.”
- **medium** Refusal/Rating demotion left as OR (§4.2 FR-8, FR-10) — “suppressed or strongly demoted” is two behaviors; SM-3/SM-1 don’t pick one. *Fix:* Pick a v1 rule (e.g. hard suppress for Refusal and dislike; demote only for soft reasons) or state “implementation may choose either as long as re-suggestion loops are broken.”
- **low** Empty meal slots unspecified (§4.1 FR-3) — Slots exist and only eligible Recipes assign; unclear if a Menu may leave breakfast/lunch/dinner empty. *Fix:* One consequence: empty slots allowed / or all three meal slots required before Shopping list.

## Scope honesty — strong
§5 Non-Goals does real work (no checkout, no multi-chain UI, no in-app cart edit, no leftover tracking, etc.). §2.2 Non-Users and §6.2 Out of Scope reinforce the same cuts. Inline `[ASSUMPTION]` tags and §9 Assumptions Index cover the main inferences; Open Questions (§8) defer UX/heuristic/link detail without pretending they’re closed. Open-item density is appropriate for hobby — not a greenlight blocker.

### Findings
_None._

## Downstream usability — adequate
Glossary (§3) anchors Menu, Recipe, Critical ingredient, Product, Checked match, In stock today, Shopping list, Pantry item, Portion plan, Refusal, Rating, Snack — and FRs use those terms consistently. FR-1…FR-23 are contiguous; UJ-1/UJ-2 name Sergey; SM ↔ FR links resolve; Assumptions Index matches inline tags. Chain-top readers can extract. Gaps: colloquial “order” / “cook session” appear in Vision and feature blurbs without glossary entries; FR-7 and FR-12 both gate AI Recipes on Checked matches (overlap, not contradiction).

### Findings
- **low** Domain nouns outside Glossary (§1, §4.1–§4.2) — “one order,” “one cook session,” and FR-2 “locking” are load-bearing in prose but not defined in §3. *Fix:* Add short Glossary entries (Order = the store purchase for this Menu’s Shopping list; Cook session = one batch cook covering the Menu days) and align FR-2 wording with Done-ness fix above.
- **low** Overlapping AI-gate FRs (§4.2 FR-7 vs §4.3 FR-12) — Same rule (new AI Recipes need Checked matches) stated twice. *Fix:* Keep the gate in FR-12; in FR-7 consequence, cross-ref FR-12 instead of restating.

## Shape fit — strong
Hobby / solo single-operator product: light UJ set (UJ-1 primary, UJ-2 secondary reuse), one persona, capability-shaped FRs with testable consequences — not over-formalized into multi-stakeholder theater, not under-specified as a bare backlog. Stakes calibration matches §0 Document Purpose (personal, feeds UX/architecture/implementation). Addendum correctly parks stack and store-adapter detail off the spine.

### Findings
_None._

## Mechanical notes
- **Assumptions Index roundtrip:** Four inline `[ASSUMPTION]` tags (FR-12, FR-15, FR-16, FR-21) ↔ four §9 bullets — clean.
- **ID continuity:** FR-1…FR-23 contiguous; UJ-1/UJ-2; SM-1…SM-3 + SM-C1 — no gaps or duplicates; cross-refs (FR-7, FR-13, FR-1, FR-20, etc.) resolve.
- **UJ protagonists:** Both journeys name Sergey inline.
- **Glossary drift:** Minor — “order” / “cook session” vs Shopping list / Menu language (see Downstream findings). Product address “д. Алабино, 92” is illustrative in Glossary; FR-16 correctly requires a concrete selected store (not free-text only).
- **Language mix:** Vision/some JTBD in Russian, body in English — fine for this operator; not a usefulness defect.
- **Required sections for hobby stakes:** Vision, user, glossary, FRs, non-goals, MVP, SMs, open questions, assumptions — present. No Acceptance Criteria section; consequences largely substitute at these stakes.
