# Rubric Walker Review — Architecture Spine

**Date:** 2026-07-19  
**Reviewer role:** good-spine rubric walker  
**Spine:** `_bmad-output/planning-artifacts/architecture/architecture-perek-planner-2026-07-19/ARCHITECTURE-SPINE.md`  
**Authority:** `_bmad-output/planning-artifacts/architecture/architecture-perek-planner-2026-07-19/.memlog.md`  
**Mechanical lint:** `lint_spine.py` — **0 findings** (placeholders, AD fields, stack pins all clean)

---

## Verdict

**ISSUES**

The spine nails the six major architectural divergence axes (topology, catalog ownership, matching location, AI gateway, auth/RLS, dependency direction) and memlog reconciliation is faithful — including the supersession of Supabase Cron/Edge catalog sync by Dokploy Schedule Jobs. It is a usable build substrate for feature/epic work on infrastructure boundaries. It does **not** yet fully satisfy the rubric on enforceable AD rules, operational envelope completeness, and a few load-bearing divergence points that feature teams could still interpret differently.

---

## Checklist Assessment

### 1. Fixes real divergence points for the level below; misses none that matter

| Divergence axis | Covered? | Notes |
|---|---|---|
| Deploy topology (Dokploy vs Vercel/Actions/Supabase Cron) | ✓ AD-1 | Memlog conflict resolved correctly |
| Catalog single-writer | ✓ AD-2 | RLS + service role implied |
| Matching/eligibility ownership | ✓ AD-3 | Next server, not DB functions |
| Match persistence vs ephemeral | ✓ AD-3 | Persisted SoT for list/reopen |
| AI call site & vendor lock-in | ✓ AD-4 | OpenRouter, server-only |
| Auth stack & RLS | ✓ AD-5 | Supabase Auth + `@supabase/ssr` |
| Module import direction | ⚠ AD-6 | Direction clear; shared-contract strategy ambiguous (see Finding 1) |
| Shared types / schema boundary | ✗ | AD-6 allows two incompatible choices |
| Eligibility revalidation on Menu reopen | ✗ | AD-3 + FR-17 tension unresolved (see Finding 3) |
| Store selection model | ✗ | UX decided; spine silent (see Finding 4) |
| Core entity shapes (Snack, pantry, fridge-keep, meal slots) | ✗ | ER seed under-specified (see Finding 5) |
| Recipe source (library vs history-only) | ✗ | UX override not bound; capability map implies library browse |

**Assessment:** Infrastructure divergences are well covered. Domain/data-model divergences that two feature epics could hit differently are under-bound.

---

### 2. Every AD Rule is enforceable and prevents its stated divergence

| AD | Enforceable? | Prevents stated divergence? | Gap |
|---|---|---|---|
| AD-1 | Yes — deploy manifests, Dokploy services, env count | Yes | — |
| AD-2 | Yes — RLS denying catalog writes except service role; sync-only store API calls | Yes | Requires `supabase/migrations` discipline (named in Structural Seed) |
| AD-3 | Mostly — code location + no eligibility pg functions | Mostly | Revalidation timing on reopen not specified; two valid implementations remain |
| AD-4 | Yes — server route/actions only; env-gated key | Yes | — |
| AD-5 | Yes — middleware `getUser()`, RLS policies | Yes | — |
| AD-6 | **No** — "may live in shared package **or** duplicated DTOs" | **No** — exactly the divergence it should prevent | Finding 1 |

---

### 3. Nothing under Deferred could let two units diverge unsafely

| Deferred item | Safe? | Notes |
|---|---|---|
| Exact OpenRouter model id | ✓ | Runtime config; AD-4 pins gateway |
| Cheaper-analog aggressiveness | ✓ | PRD OQ; single matching epic owns heuristic |
| Store-link transport (FR-21) | ✓ | Copy-always invariant in PRD; transport is additive |
| Second grocery chain | ✓ | AD-2 adapter seam pins extension point |
| Staging environment | ✓ | AD-1 explicitly single prod + local |
| Supabase Edge Functions | ✓ | AD-1/AD-2 forbid catalog ingest via Edge |
| Match-review UI | ✓ | Out of v1 scope |
| Elevated observability | ✓ | Conventions require sync last-run markers for FR-18 |

**Assessment:** Deferred section is clean — no unsafe divergence holes.

---

### 4. Named tech verified-current

| Component | Pinned | Verified (2026-07-19) | Flag |
|---|---|---|---|
| Next.js | 16.2.10 | ✓ Latest stable (2026-07-01) | — |
| React | 19.2.7 | ✓ Released 2026-06-01 | — |
| Tailwind CSS | 4.3.3 | ✓ Latest (2026-07-16) | — |
| @supabase/supabase-js | 2.110.7 | ✓ Latest (2026-07-16) | Requires Node **22+** (Node 20 dropped in 2.110.0) — spine does not pin Node |
| @supabase/ssr | 0.12.3 | ✓ Latest (2026-07-14) | — |
| perekrestok-api | 0.2.2 | ✓ Latest PyPI (2026-02-23) | Unofficial scraper client; operational risk acknowledged in memlog |
| TypeScript | 5.x | ✓ Acceptable range pin | — |
| shadcn/ui | "current CLI components" | ⚠ Unpinned by design (UX-locked) | Not mechanically verifiable; acceptable if intentional |
| Python (sync) | ≥3.10 | ✓ Matches perekrestok-api requirement | — |
| Dokploy | (no version) | ✓ Self-hosted PaaS — version not applicable | — |
| **Node.js (Next runtime)** | **Absent** | Next 16 requires ≥20.9.0; `@supabase/supabase-js@2.110` requires ≥22 | **Finding 2** |

---

### 5. Covers driving spec capabilities if present

**Driving inputs:** PRD `prd-perek-planner-2026-07-19` + UX `ux-perek-planner-2026-07-19` (both listed in spine `sources`).

| Source | Coverage |
|---|---|
| FR-1…FR-5 Menu & Portion | Mapped to Next domain; ER has Menu/MenuSlot but missing meal-slot, serving defaults, Snack |
| FR-6…FR-10 Suggestions & memory | AD-3/AD-4; hard-suppression semantics absent |
| FR-11…FR-15 Matching | AD-3; FR-15 deferred; pantry/fridge-keep rules absent from ER/AD |
| FR-16…FR-18 Catalog | AD-2; default store seed absent |
| FR-19…FR-22 Shopping handoff | AD-3; FR-22 no-fabrication rule absent |
| FR-23 Auth | AD-5 ✓ |
| FR-24 Recipe text | Bound in frontmatter; bundled oddly in capability map; no negative constraint (no cook-along) |
| UJ-1 / UJ-2 | UJ-1 in binds; primary vs secondary path priority not an invariant |
| UX: history-not-library | **Not reflected** — conflicts with FR-6 capability implication |
| UX: pantry staples on list by default | **Not reflected** — post-UX override diverges from PRD FR-13 opt-in |
| UX: store picker once in settings | **Not reflected** — FR-16 architectural persistence model open |

**Assessment:** Metadata binds all FR ids; capability map covers major areas. UX-bound decisions that change architecture-relevant data flows are not distilled into spine rules — feature teams may implement PRD vs UX differently.

---

### 6. Every altitude-owned dimension decided, deferred, or open question

Initiative altitude owns: paradigm, deploy/environments, infra providers, cross-module boundaries, schema seed, naming/config conventions, operations floor.

| Dimension | Status | Gap |
|---|---|---|
| Paradigm | ✓ Decided | BaaS-backed modular Next |
| Deploy topology | ✓ AD-1 | Prod Dokploy + Supabase Cloud |
| Environments | ⚠ Partial | Prod + "local dev" named; **local Supabase target undecided** (cloud dev project vs Supabase CLI) |
| Infra providers | ✓ | Dokploy, Supabase Cloud, OpenRouter |
| Secrets/config split | ✓ Conventions | Browser vs server/sync env vars |
| Operations floor | ✓ Deferred + conventions | Sync markers + structured logs |
| Schema ownership | ✓ | `supabase/migrations` |
| CI/build pipeline | ✗ Silent | Not decided, deferred, or open question |
| Node runtime pin | ✗ Silent | Finding 2 |
| Recipe bootstrap / seed strategy | ✗ Silent | Where initial Recipe corpus lives |
| Store selection persistence | ✗ Silent | Finding 4 |
| Shared contract strategy | ✗ Ambiguous | Finding 1 |

**Assessment:** Core operational envelope (where things run) is decided. Local-dev envelope and runtime toolchain are under-specified for an initiative spine.

---

## Findings

### Critical

None. No AD contradicts memlog authority or would cause unsafe dual-writer / split-brain on day one.

### High

#### H1 — AD-6 shared-contract rule is not enforceable (Finding 1)

**Location:** AD-6 Rule  
**Issue:** Rule permits *either* a thin shared package *or* duplicated DTOs at the Supabase schema boundary. Two feature epics can legitimately pick opposite strategies, producing incompatible import graphs and duplicate type drift.  
**Prevents claim fails:** The stated prevention is circular package deps — the OR branch opens a new divergence axis.  
**Fix:** Pick one: e.g. "Schema types generated from Supabase migrations into `src/lib/database.types.ts`; sync worker duplicates only sync-facing DTOs; no cross-runtime shared npm package in v1."

#### H2 — Operational envelope incomplete: local dev + Node runtime (Finding 2)

**Location:** AD-1 (local dev mention); Stack table  
**Issue:** Memlog decides "local Next/Python for development" but spine never states whether developers hit a shared Supabase cloud dev project or local Supabase CLI — connection strings, RLS testing, and migration workflow diverge. Separately, pinned `@supabase/supabase-js@2.110.7` requires Node 22+ while Next 16 requires ≥20.9.0; neither Node version nor Docker base image is decided.  
**Fix:** Add convention or AD fragment: e.g. "Local dev uses Supabase CLI (`supabase start`) + local Next/Python; prod uses cloud project. Node 22 LTS for Next container."

#### H3 — AD-3 silent on eligibility revalidation when reopening Menu (Finding 3)

**Location:** AD-3 Rule; tension with FR-17 / FR-18 / FR-9  
**Issue:** AD-3 mandates persisted matches as SoT for Shopping list and Menu reopen. FR-17 gates on *planning-time* stock. Reopening a past Menu (FR-9) under stale catalog (FR-18) has two valid implementations: (a) show persisted matches as-is with stale warning, or (b) re-run eligibility and invalidate slots. Spine does not decide — shopping-list and menu-reuse epics can diverge.  
**Fix:** Extend AD-3 Rule: e.g. "On Menu reopen, re-run today-stock eligibility before generating a new Shopping list; persisted matches are audit/history, not automatic SoT for a fresh shop trip."

### Medium

#### M1 — UX-bound capability overrides not reflected (Finding 4)

**Location:** Capability map; sources binding  
**Issue:** UX memlog overrides: (1) no separate Recipe library — history only; (2) pantry staples added straight to Shopping list (overrides PRD FR-13 per-item opt-in); (3) store picker once in settings with default Алабино 92. Spine lists UX as source but capability map still implies library browse (FR-6) and does not model store preference persistence.  
**Fix:** Add capability-map rows or convention lines binding UX decisions; or log explicit open question if PRD/UX conflict is unresolved at product level.

#### M2 — Structural seed ER missing load-bearing entities (Finding 5)

**Location:** Structural Seed ERD  
**Issue:** PRD/UX require Snack (no-cook), fridge-keep duration, meal slot type, portion/serving counts, pantry inclusion state. ER shows only Menu→MenuSlot→Recipe. Feature epics modeling schema independently will diverge.  
**Fix:** Extend ERD with Snack (or `Recipe.is_snack`), `Recipe.fridge_keep_days`, `MenuSlot.meal`, `Menu.default_servings`, and shopping-list line source (match vs pantry).

#### M3 — Domain behavioral invariants absent (informational; see reconcile-prd.md)

Hard-suppression (FR-8/FR-10), no stock-badge UI (FR-17), no fabricated price/nutrition (FR-22), primary planning path (FR-1), and forbidden capabilities (no in-app cart, no fallback flow) are not in ADs. At initiative altitude this is borderline — they are product rules more than infra — but they **are** divergence points for AI/suggestion and shopping epics. Acceptable if explicitly deferred to a domain companion spec; currently silent.

### Low

- **L1:** `shadcn/ui` unpinned — intentional UX lock; not verifiable-current.
- **L2:** `perekrestok-api` is unofficial — memlog flagged; operational fragility is known risk, not a spine defect.
- **L3:** Capability map bundles FR-24 with suggestions row — organizational only.

---

## AD-by-AD Enforceability Summary

```
AD-1  ████████████████████  enforceable
AD-2  ████████████████████  enforceable (given migrations)
AD-3  ██████████████░░░░░░  mostly — revalidation gap
AD-4  ████████████████████  enforceable
AD-5  ████████████████████  enforceable
AD-6  ████████░░░░░░░░░░░░  NOT enforceable — OR branch
```

---

## Deferred Safety Audit

All eight Deferred rows are safe for v1 hobby stakes. None creates a hidden fork that violates AD-1…AD-6.

---

## Tech Verification Summary

All pinned semver dependencies are current as of 2026-07-19. Flag: **Node.js runtime unpinned** despite stack coupling (Finding 2). Flag: **shadcn unpinned** by design.

---

## Recommended Fixes (priority order)

1. **Resolve AD-6 OR** — pick shared-contract strategy (H1).  
2. **Pin local-dev + Node envelope** — Supabase CLI vs cloud dev project; Node 22 (H2).  
3. **Clarify AD-3 revalidation on Menu reopen** (H3).  
4. **Distill UX overrides into capability map or open questions** (M1).  
5. **Extend ERD seed** for Snack, fridge-keep, meal slots, servings (M2).

---

## Cross-References

- PRD reconciliation detail: `reviews/reconcile-prd.md` (behavioral gap inventory)  
- Memlog authority aligns with spine on all six ADs; Supabase Cron/Edge supersession correctly reflected in AD-1/Deferred
