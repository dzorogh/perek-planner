---
title: Sprint Change Proposal — IR readiness alignment
status: approved-applied
approved: 2026-07-20
applied: 2026-07-20
scope: Moderate
handoff: PO/DEV docs applied; next bmad-sprint-planning
date: 2026-07-20
project: keplo
trigger: implementation-readiness-report-2026-07-20 (NEEDS WORK)
mode: incremental
decisions:
  uj2_mvp: defer (option A — amend PRD; keep UX/epics cut)
  story_27: merge into 2.3 and remove 2.7
  fr_crosswalk: add to epics.md
  ad10: clarify v1 no reuse UI
---

# Sprint Change Proposal — keplo

## 1. Issue Summary

**Problem:** Planning artifacts disagree on MVP boundary and Epic 2 story independence, blocking a clean start to Phase 4 implementation.

**Discovered:** Implementation Readiness assessment (`implementation-readiness-report-2026-07-20.md`), before sprint coding.

**Evidence:**
- PRD §6.1 MVP includes FR-9 (reuse previous Menu / UJ-2); UX EXPERIENCE and `epics.md` Non-goals exclude UJ-2 UI.
- Story 2.3 AC defers long-idle weighting to Story 2.7 (forward dependency).
- Epics FR numbering ≠ PRD FR-1…FR-24 (e.g. epics FR9 = Rating = PRD FR-10).

**User decision:** Defer UJ-2 from MVP (align PRD to UX/epics). Merge Story 2.7 into 2.3. Add FR crosswalk. Clarify Architecture AD-10.

## 2. Impact Analysis

### Epic Impact

| Epic | Impact |
| ---- | ------ |
| Epic 1 | None for UJ-2. No reorder. |
| Epic 2 | Story 2.3 gains long-idle ACs; Story 2.7 removed (or emptied). Story list renumber optional (2.6 stays Refusal; former 2.7 gone). |
| Epic 3 | None. |
| Epic 4 | None for UJ-2 (History remains review/Rating only, not reuse-as-draft). |
| New / removed epics | None. |

### Story Impact

- **2.3 AI generate buyable Menu** — expand ACs; remove “fully specified in Story 2.7”.
- **2.7 AI reintroduces long-idle Recipes** — **remove** after merge into 2.3.
- Optional (not required by user approvals): AI error / zero-eligible ACs on 2.3/2.4 — deferred unless added later.

### Artifact Conflicts

| Artifact | Change needed |
| -------- | ------------- |
| PRD | Move FR-9 / UJ-2 out of MVP into Non-Goals / Out of Scope; keep FR-9 text as post-MVP or mark deferred. |
| Epics | Merge 2.7→2.3; add PRD↔epics FR crosswalk; update FR Coverage Map notes for FR-9 deferred. |
| UX EXPERIENCE / DESIGN | Already “UJ-2 out of v1” — no functional change; optional one-line note that PRD now matches. |
| Architecture Spine AD-10 | Explicit: v1 has no reuse/clone UI; AD-10 matching rule is future-ready only. |
| Code / infra | N/A (pre-implementation). |
| sprint-status.yaml | N/A until Sprint Planning creates it; if present later, drop story 2.7 entry. |

### Technical Impact

None on running systems. Prevents implementing a reuse UI or a split incomplete generate story.

## 3. Recommended Approach

**Hybrid: Option 1 (Direct Adjustment) + Option 3 (MVP Review).**

- **MVP Review:** Defer UJ-2 / PRD FR-9 from MVP (matches UX/epics).
- **Direct Adjustment:** Edit Epic 2 stories and add FR crosswalk; clarify AD-10.

| | |
| --- | --- |
| Effort | Low (docs only) |
| Risk | Low |
| Rollback | N/A (no coded stories yet) |
| Rejected | Option 2 Rollback — nothing to roll back |

**Rationale:** Fastest path to READY for Sprint Planning without building deferred UX.

## 4. Detailed Change Proposals

### 4.1 PRD — `prds/prd-keplo-2026-07-19/prd.md`

**Approved [a]**

1. **§5 Non-Goals** — add bullet: `Reuse previous Menu as draft / UJ-2 surface in v1`
2. **§6.1 In Scope** — change line covering suggestions/Rating from `FR-6…FR-10` to clarify: FR-6…FR-8, FR-10 in MVP; **FR-9 deferred post-MVP**
3. **§6.2 Out of Scope for MVP** — add: UJ-2 Menu reuse draft surface
4. **§4.2 FR-9** — add status note: `[POST-MVP / deferred — not in v1 UI; see Non-Goals]`
5. **§2.3 Key User Journeys** — UJ-2: mark as post-MVP journey (not v1)

### 4.2 Epics — `epics.md`

**Approved [a]** for merge 2.7→2.3 and remove 2.7  
**Approved [a]** for FR crosswalk

**A. Story 2.3 — add ACs (from former 2.7), remove forward ref**

OLD (excerpt):
```
**And** long-idle reuse weighting is fully specified in Story 2.7
```

NEW: replace with concrete ACs:
```
**Given** cook history with last-cooked timestamps (or equivalent Menu assignment dates)
**When** AI generates or resuggests slots
**Then** Recipes not cooked for approximately 2+ weeks are eligible candidates for reintroduction
**And** highly liked Recipes are weighted somewhat more often than medium-rated ones
**And** Refusal and dislike remain hard-suppressed
**And** reintroduced Recipes still pass Story 2.2 buyable/matching/fridge-keep gates
```

**B. Remove Story 2.7** entirely (section heading + ACs).

**C. Add after Requirements Inventory / before FR Coverage Map — FR Crosswalk:**

| PRD | Epics inventory | Notes |
| --- | --------------- | ----- |
| FR-1 | FR1 | Create Menu |
| FR-2 | FR2 | Servings |
| FR-3 | FR3 | Assign meals |
| FR-4 | FR4 | Snacks |
| FR-5 | FR5 | Portion plan |
| FR-6 | FR6 | Slot AI replace (+ long-idle in 2.3) |
| FR-7 | FR7 | AI suggestions |
| FR-8 | FR8 | Refusal |
| FR-9 | — | **Deferred post-MVP** (UJ-2) |
| FR-10 | FR9 | Rating |
| FR-11 | FR10 | Checked matches |
| FR-12 | FR7/FR10 | Gate new AI (merged) |
| FR-13 | FR11 | Pantry default |
| FR-14 | FR12 | Fridge-keep |
| FR-15 | FR13 | Cheaper analogs |
| FR-16 | FR14 | Select store |
| FR-17 | FR15 | Buyable today |
| FR-18 | FR16 | Stale catalog |
| FR-19 | FR17 | Build list |
| FR-20 | FR18 | Copy list |
| FR-21 | FR19 | Store link |
| FR-22 | FR20 | Price/nutrition |
| FR-23 | FR21 | Auth |
| FR-24 | FR22 | Recipe text |
| (UX) | FR23–FR25 | Flow gate, History, post-login landing |

**D. Additional Requirements / Non-goals** — keep “UJ-2 reuse surface in v1 UI”; add pointer that PRD FR-9 is deferred to match.

### 4.3 Architecture — `architecture/.../ARCHITECTURE-SPINE.md`

**Approved [a]**

**AD-10** — append:

> **v1 scope:** No Menu reuse/clone UI (UJ-2 / PRD FR-9 deferred). Do not implement a user-facing clone path in v1 stories. The re-match-on-reuse rule above applies only when/if a reuse story is added post-MVP.

### 4.4 UX

No required edit (already aligned). Optional: one sentence under “Out of v1 — UJ-2” that PRD MVP now matches — skip unless desired.

## 5. Implementation Handoff

| Field | Value |
| ----- | ----- |
| **Scope classification** | **Moderate** — backlog/docs reorganization (PO/DEV); no code yet |
| **Handoff to** | Apply doc edits (this session or Dev/PM agent) → optional re-run `bmad-check-implementation-readiness` → `bmad-sprint-planning` |
| **Success criteria** | PRD MVP excludes FR-9/UJ-2; epics has no Story 2.7; Story 2.3 includes long-idle ACs; FR crosswalk present; AD-10 v1 note present; IR critical blockers cleared |

### Action sequence

1. Apply §4 edits to PRD, epics, Architecture.
2. (Optional) Re-run Implementation Readiness for a green check.
3. Run Sprint Planning (`bmad-sprint-planning`).
4. Proceed Create Story → Dev Story cycle.

---

**Checklist status (Correct Course)**

| Section | Status |
| ------- | ------ |
| 1 Trigger & context | Done — IR; user chose defer UJ-2 |
| 2 Epic impact | Done — Epic 2 story merge only |
| 3 Artifact conflicts | Done — PRD, epics, AD-10 |
| 4 Path forward | Done — Hybrid Option 1+3 |
| 5 Proposal components | Done — this document |
| 6 Final approval / apply | Pending user |
