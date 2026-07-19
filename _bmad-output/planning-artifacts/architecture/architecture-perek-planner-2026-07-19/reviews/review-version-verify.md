# Architecture Spine — Stack & Technology Version Verification

**Document reviewed:** `ARCHITECTURE-SPINE.md`  
**Review date:** 2026-07-19  
**Reviewer role:** Independent version / fit / starter-reality audit  
**Method:** npm registry, PyPI JSON API, GitHub `vercel/next.js` `examples/with-supabase`, Supabase docs/changelog, Dokploy docs, OpenRouter docs, shadcn/ui docs, TypeScript 7.0 release notes

---

## Executive Verdict

**CONDITIONAL PASS** — Pinned npm/PyPI versions in the Stack table match registry **latest** as of 2026-07-19 and all named services/libraries **exist and fit** the architecture. However, the **starter seed path was not fully reality-checked**: the official `with-supabase` example diverges from several spine pins (Tailwind major, layout paths, env var names, Supabase package pinning). TypeScript is pinned vaguely as `5.x` while the ecosystem has moved to TS 6/7. No audit trail in `.memlog.md` proves web/npm verification for the npm version table (only `perekrestok-api` is explicitly sourced).

---

## Verification Matrix

| Technology | Spine claim | Verified as of 2026-07-19 | Status | Notes |
| --- | --- | --- | --- | --- |
| Next.js (App Router) | 16.2.10 | `npm view next` → **16.2.10**; `next@16.2.10` resolves | ✅ Confirmed | Matches latest; `create-next-app` latest is also 16.2.10 |
| React | 19.2.7 | `npm view react` → **19.2.7** | ✅ Confirmed | Matches latest |
| TypeScript | 5.x | `npm view typescript` → **7.0.2** (released 2026-07-08); starter uses `^5` | ⚠️ Imprecise / unconfirmed intent | `5.x` is safe with Next 16 default checker; TS 7 needs `experimental.useTypeScriptCli`. Pin should be explicit (e.g. `^5` or `^6`, not open-ended `5.x`) |
| Tailwind CSS | 4.3.3 | `npm view tailwindcss` → **4.3.3** | ✅ Pin current | **Starter ships ^3.4.1** — see Starter Seed section |
| shadcn/ui | current CLI components | CLI `npm view shadcn` → **4.13.1**; docs confirm Tailwind v4 + React 19 support (2.3.0+) | ⚠️ Unpinned | Acceptable for UX-locked components, but no version floor documented; drift risk vs starter |
| @supabase/supabase-js | 2.110.7 | `npm view @supabase/supabase-js` → **2.110.7** | ✅ Confirmed | Starter uses `"latest"`, not pinned |
| @supabase/ssr | 0.12.3 | `npm view @supabase/ssr` → **0.12.3** | ✅ Confirmed | Peer: `@supabase/supabase-js ^2.110.5` — compatible |
| Supabase Cloud | Auth + Postgres + RLS | Active product; email/password auth documented; RLS standard | ✅ Confirmed | API key migration in progress — see gaps |
| OpenRouter | API gateway | Active; OpenAI-compatible `/api/v1`; 400+ models | ✅ Confirmed | Fit for AD-4 (server-only, model id configurable) |
| perekrestok-api | 0.2.2 | PyPI latest **0.2.2**; `requires_python >=3.10` | ✅ Confirmed | Unofficial scraper client — operational risk, not version risk |
| Python (sync worker) | ≥3.10 | Matches PyPI package requirement | ✅ Confirmed | Greenfield could use 3.12+; floor is valid |
| Dokploy | self-hosted PaaS + Schedule Jobs | Active OSS PaaS; Schedule Jobs docs + API (`schedule.create`) | ✅ Confirmed | Fit for AD-1 (Next + Python worker + cron) |

---

## Per-Technology Detail

### Next.js 16.2.10 + React 19.2.7

- Both versions exist on npm and are **current latest**.
- Next 16.2.10 peer deps include React `^19.0.0` — React 19.2.7 satisfies this.
- Paradigm "BaaS-backed modular Next" with App Router, server actions, middleware — aligned with Next 16 capabilities.

**Evidence:** `npm view next version`, `npm view react version`, `npm view next@16.2.10 peerDependencies`

### TypeScript 5.x

- Latest npm TypeScript is **7.0.2** (native Go port, 2026-07-08).
- Official `with-supabase` example declares `"typescript": "^5"`.
- Next.js 16 added **experimental** TS 7 support via `experimental.useTypeScriptCli`; default build path still expects TS ≤6 programmatic API.
- Spine pin `5.x` is **not wrong for greenfield** but is **not verified as a deliberate choice** — it reads like a generic range, not a researched pin.

**Flag:** If implementers run `npm install -D typescript@latest`, they get 7.0.2 and may hit Next build friction without the experimental flag.

**Recommendation:** Pin explicitly to `^5` or `^6` (matching starter), or document TS 7 opt-in separately.

### Tailwind CSS 4.3.3 + shadcn/ui

- Tailwind **4.3.3** is npm latest — pin is current.
- shadcn/ui officially supports Tailwind v4 + React 19; new projects use CSS-first config, OKLCH tokens, `tw-animate-css` instead of `tailwindcss-animate`.
- UX spine locks shadcn — technology still exists and fits.

**Critical starter mismatch:** `examples/with-supabase/package.json` (Next.js canary, fetched 2026-07-19) declares:

```json
"tailwindcss": "^3.4.1",
"tailwindcss-animate": "^1.0.7"
```

So the documented starter **does not** produce Tailwind 4.3.3 out of the box. Implementers must upgrade Tailwind and re-init/align shadcn per [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4).

Note: the same example's `components.json` already has `"tailwind.config": ""` (v4-style) while still depending on Tailwind 3 — an **inconsistent transitional state** in upstream. Spine should not assume the starter is internally coherent without adaptation steps.

### Supabase packages & Cloud

- `@supabase/supabase-js@2.110.7` and `@supabase/ssr@0.12.3` — both latest, both exist.
- `@supabase/ssr` cookie session pattern in AD-5 matches current Supabase Next.js guidance.
- Supabase Cloud (hosted Auth + Postgres + RLS) — valid BaaS choice.

**Supabase API key migration (2026):**

- New projects use **publishable keys** (`sb_publishable_...`) and **secret keys** (`sb_secret_...`).
- Legacy `anon` / `service_role` JWT keys still work during migration; legacy keys scheduled for removal **late 2026** (TBC per Supabase changelog).
- Official `with-supabase` `.env.example` uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Spine Config row says only `NEXT_PUBLIC_SUPABASE_*` — **generic and behind current starter defaults**.
- Sync worker "service role" should document mapping to `sb_secret_...` for new Supabase projects.

**Evidence:** Supabase changelog "Upcoming changes to Supabase API Keys", `examples/with-supabase/.env.example`

### OpenRouter

- Service active; unified OpenAI-compatible API; server-side-only usage in AD-4 is appropriate.
- "Model id configurable" / deferred exact model — reasonable; no version pin expected.

### perekrestok-api 0.2.2

- PyPI latest **0.2.2**; requires Python **≥3.10**.
- GitHub: Open-Inflation/perekrestok_api — explicitly **not official**; mimics site traffic.
- `.memlog.md` records PyPI 0.2.2 — **only stack item with explicit research provenance** in project artifacts.
- Version is current; **fit risk** is operational (site changes, low community — ~7 GitHub stars, 1 open issue), not "package missing."

### Python ≥3.10

- Matches package requirement.
- Not stale; could note recommended 3.12/3.13 for new containers but floor is fine.

### Dokploy

- Project exists (dokploy.com, GitHub dokploy/dokploy).
- **Schedule Jobs** documented: cron expressions, application/compose/server job types, REST API.
- Fits AD-1: host Next + Python sync container; cron triggers sync (not GitHub Actions / Supabase Cron for ingest).
- Self-hosted PaaS with Traefik, Docker — reasonable Vercel alternative for deploy target adaptation.

---

## Starter Seed Reality Check

**Spine claim (line 129):**

> Starter seed: official `create-next-app -e with-supabase`, then adapt deploy target from Vercel defaults to Dokploy; add `sync/` Python worker.

### Command syntax

- `-e with-supabase` is valid shorthand for `--example with-supabase` — confirmed via Supabase docs and Vercel template pages.
- Docs typically also pass a project directory name: `npx create-next-app --example with-supabase my-app`. Spine omits directory arg (minor).

### What the starter actually ships vs spine Stack

| Item | Spine Stack | `with-supabase` example (GitHub canary, 2026-07-19) | Gap |
| --- | --- | --- | --- |
| Next.js | 16.2.10 | `"next": "latest"` (resolves to 16.2.10 today) | OK at install time; not pinned in template |
| React | 19.2.7 | `"react": "^19.0.0"` | Minor range vs exact pin |
| TypeScript | 5.x | `"typescript": "^5"` | Aligned in practice |
| Tailwind | **4.3.3** | **`^3.4.1`** + `tailwindcss-animate` | **Major mismatch — not mentioned in spine** |
| @supabase/supabase-js | 2.110.7 | `"latest"` | Unpinned in starter |
| @supabase/ssr | 0.12.3 | `"latest"` | Unpinned in starter |
| Env vars | `NEXT_PUBLIC_SUPABASE_*` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Naming drift / key migration |
| Layout | `app/` + `src/domain/` + `src/lib/supabase/` | `app/`, `lib/` (no `src/`) | Structural seed ≠ starter layout |
| shadcn | UX-locked | Pre-init `components.json` (new-york, RSC) | Partial overlap; Tailwind major mismatch |
| eslint-config-next | (not in spine) | **15.3.1** in example while Next is 16.x | Stale devDep in upstream example |

**Conclusion:** The spine version table reads like **npm-latest snapshot at authoring time**, but the **starter seed paragraph understates adaptation work**. "Adapt deploy target to Dokploy" is insufficient — implementers must also **upgrade Tailwind 3→4**, reconcile shadcn/Tailwind v4 setup, align folder structure, pin Supabase packages, and update env var names for publishable/secret keys.

---

## Named Technologies Outside Stack Table

| Name | Exists? | Fits? | Verified? |
| --- | --- | --- | --- |
| App Router | Yes (Next 16) | Yes | ✅ |
| Postgres + RLS | Yes (Supabase) | Yes | ✅ |
| `@supabase/ssr` cookie sessions | Yes (0.12.3) | Yes | ✅ |
| Dokploy Schedule Jobs | Yes | Yes — replaces Supabase Cron/Edge for ingest per AD-1 | ✅ |
| Supabase Edge Functions (deferred) | Yes | Correctly marked unused for catalog | ✅ |
| Perekrestok site APIs (unofficial) | Via perekrestok-api | Yes with adapter boundary | ✅ (with operational caveat) |
| Europe/Moscow timezone display | Standard IANA | Yes | ✅ (no version concern) |

---

## Evidence of Research vs Training-Data Assertion

From `.memlog.md`:

- **Explicitly researched:** `perekrestok-api` PyPI 0.2.2, unofficial nature, Dokploy hosting, OpenRouter, Supabase as BaaS.
- **Not documented as researched:** Exact npm pins (Next 16.2.10, React 19.2.7, Tailwind 4.3.3, Supabase JS packages). These **do** match npm latest when verified 2026-07-19 — consistent with a one-time `npm view` pass, but **no provenance** in artifacts.
- **Likely asserted without starter check:** Starter seed paragraph; Tailwind 4 pin coexisting with `with-supabase` recommendation; generic `NEXT_PUBLIC_SUPABASE_*`; mixed `app/` + `src/domain/` layout vs starter's flat `lib/`.

---

## Findings Summary

### Critical (fix before treating spine as implementation-ready)

1. **Starter vs Tailwind 4.3.3** — Official `with-supabase` still depends on Tailwind **3.4.x**. Spine must document mandatory Tailwind v4 + shadcn realignment after scaffold, or change starter recommendation (e.g. `create-next-app@latest` + manual Supabase/shadcn v4 setup).

### High (should update spine)

2. **Supabase env var / key migration** — Document `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and secret key for sync service role; note late-2026 legacy key deprecation.
3. **Starter structural mismatch** — `src/lib/supabase/` vs starter's `lib/`; clarify `--src-dir` or post-scaffold moves.
4. **TypeScript pin** — Replace vague `5.x` with explicit `^5` or `^6`; note TS 7 is optional/experimental with Next 16.

### Medium (document or accept)

5. **shadcn/ui unpinned** — Add CLI floor (e.g. shadcn CLI ≥2.3.0 / Tailwind v4 path) or "pin at init" instruction.
6. **Supabase packages `"latest"` in starter** — Spine pins exact versions; seed steps should say `npm install @supabase/supabase-js@2.110.7 @supabase/ssr@0.12.3` after scaffold.
7. **perekrestok-api operational risk** — Version OK; unofficial scraper dependency should stay in Deferred/Risk, not just memlog.

### Low

8. **Starter command** — Add project name argument for copy-paste safety.
9. **Upstream example stale eslint-config-next 15.3.1** — Watch on first scaffold; bump to match Next 16.

---

## Recommendations

1. Add a **"Post-scaffold alignment"** subsection under Stack listing: Tailwind 4 upgrade, shadcn v4 init, Supabase package pins, publishable/secret env vars, folder moves.
2. Change TypeScript cell to **`^5` (or `^6`)** with footnote on TS 7 experimental path.
3. Update Config convention row to name **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** explicitly (with anon fallback note).
4. Optionally add **verification provenance** line in spine metadata: `stack_verified: 2026-07-19 via npm/PyPI`.

---

## Sources

- npm registry: `next`, `react`, `typescript`, `tailwindcss`, `@supabase/supabase-js`, `@supabase/ssr`, `shadcn`, `create-next-app`
- PyPI: https://pypi.org/pypi/perekrestok-api/json
- GitHub: https://github.com/vercel/next.js/tree/canary/examples/with-supabase
- Supabase: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs , API keys changelog
- Dokploy: https://docs.dokploy.com/docs/core/schedule-jobs
- OpenRouter: https://openrouter.ai/docs/faq
- shadcn/ui: https://ui.shadcn.com/docs/tailwind-v4 , https://ui.shadcn.com/docs/installation/next
- TypeScript 7.0: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Next.js TS 7: https://github.com/vercel/next.js/discussions/95633 , commit a249dcb (experimental.useTypeScriptCli)

---

## Final Verdict

| Criterion | Result |
| --- | --- |
| All named technologies exist | **Yes** |
| Pinned versions current on 2026-07-19 | **Yes** (npm/PyPI pins match latest) |
| Technologies fit architecture | **Yes** (with perekrestok-api operational caveat) |
| Starter seed matches stack defaults | **No** — Tailwind major, layout, env vars, pinning |
| Every decision web-researched / reality-checked | **Partial** — version table likely npm-checked; starter path and several conventions not fully verified |

**Overall: CONDITIONAL PASS** — safe to proceed if implementers treat the Stack table as target versions and follow an explicit post-scaffold alignment checklist; do not assume `create-next-app -e with-supabase` alone satisfies the pinned stack.
