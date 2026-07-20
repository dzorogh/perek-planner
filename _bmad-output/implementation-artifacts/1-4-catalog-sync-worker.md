---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 1.4: the store catalog sync worker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want my selected store's Products and availability synced into the database on a schedule,
So that planning can use a real assortment for that store.

## Acceptance Criteria

1. **Given** the Architecture Structural Seed  
   **When** a Python sync worker is added under `sync/` with a store-adapter wrapping `store-catalog-api`  
   **Then** only the sync worker writes catalog/availability and `catalog_sync_runs` via service role (AD-2)  
   **And** Next never fetches the store site APIs for catalog writes (AD-2, AD-6)

2. **Given** a configured store (e.g. default д. Алабино, 92)  
   **When** a sync run completes successfully  
   **Then** `products` (and related availability field) are updated for that store  
   **And** a `catalog_sync_runs` row records the run for stale detection (AD-8)

3. **Given** Dokploy Schedule Jobs (or local manual invoke for dev)  
   **When** sync is scheduled  
   **Then** ingest is not implemented via GitHub Actions or Supabase Cron (AD-1)

4. **Given** an authenticated Next app  
   **When** it needs catalog data for planning  
   **Then** it reads Products from Supabase only (AD-2)

## Tasks / Subtasks

- [x] Schema: `products` + `catalog_sync_runs` (AC: #2, #4)
  - [x] Add **new** migration under `supabase/migrations/` (SoT per AD-6) — do **not** edit Story 1.2/1.3 migration files
  - [x] Create `public.products` with at least: `id uuid PK`, `store_id uuid NOT NULL REFERENCES stores(id)`, `external_id text NOT NULL`, `name text NOT NULL` (Russian catalog title), `price_cents integer NULL`, **`availability_status text NOT NULL`** with check/enum for a **single** availability field (e.g. `in_stock` | `out_of_stock` | `unknown`), `created_at` / `updated_at timestamptz`, **UNIQUE (`store_id`, `external_id`)**
  - [x] Create `public.catalog_sync_runs` with at least: `id uuid PK`, `store_id uuid NOT NULL REFERENCES stores(id)`, `status text NOT NULL` (`running` | `success` | `failed`), `started_at timestamptz NOT NULL`, `finished_at timestamptz NULL`, `error_message text NULL`, optional `products_upserted integer NULL`
  - [x] Document freshness semantics in migration comments for Story 1.5: **FR-18 reads latest `catalog_sync_runs` row for active store** — recommend default “fresh” = latest row `status = success` AND `finished_at` within **24 hours** (UTC); adjust only in migration comment/constant, never via `products.updated_at`
  - [x] RLS: `ENABLE` on both tables; policy **SELECT** for `authenticated`; **no** INSERT/UPDATE/DELETE policies for `authenticated`
  - [x] `REVOKE ALL` from `anon` + `authenticated`; `GRANT SELECT` to `authenticated` only (same tighten pattern as stores — Supabase defaults often grant write)
  - [x] Apply migration to Supabase project (MCP / Dashboard); keep local SQL as SoT

- [x] Python sync package under `sync/` (AC: #1, #2, #3)
  - [x] Create `sync/` directory (Structural Seed) — greenfield
  - [x] Pin Python ≥3.10 and `store-catalog-api==0.2.2` in `sync/requirements.txt` (or `pyproject.toml`)
  - [x] Pin a Supabase Python client (e.g. `supabase` package) for service-role writes — choose a current stable version and pin it; do not leave unpinned
  - [x] Env (sync-only, never `NEXT_PUBLIC_*`): `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`sb_secret_…`; legacy `SUPABASE_SERVICE_ROLE_KEY` still accepted)
  - [x] CLI entrypoint for local/Dokploy invoke, e.g. `python -m sync.worker` or `sync/main.py` — supports syncing one store by id or “all configured stores”
  - [x] Store adapter module wrapping `store-catalog-api` only — thin boundary (AD-2, NFR-I6); map API fields → **exact migration column names** (no `sku`/`title` aliases)

- [x] Sync run lifecycle + catalog upsert (AC: #2)
  - [x] Resolve target store(s) from `public.stores` (at minimum default Alabino UUID `a1000000-0000-4000-8000-000000000001`)
  - [x] Resolve live store/geopos for adapter using `stores.external_id`; if still placeholder `alabino-92`, discovery path must update `external_id` to the real opaque id (service-role UPDATE on `stores` allowed) **or** fail the run with a clear `catalog_sync_runs.error_message` telling the operator to set a valid `external_id`
  - [x] Start run: insert `catalog_sync_runs` with `status=running`
  - [x] Fetch catalog via adapter; upsert `products` for that `store_id` (availability via **only** `availability_status`)
  - [x] Finish: set `status=success` + `finished_at` (+ counts) **or** `status=failed` + `error_message` + `finished_at` — never leave a run hanging without finish on failure paths
  - [x] On failure: do **not** fake freshness by bumping product timestamps alone

- [x] Scheduling & docs (AC: #3)
  - [x] Document Dokploy Schedule Job (cron) invoking the worker — **not** GitHub Actions, **not** Supabase Cron/Edge for ingest (AD-1)
  - [x] Document local manual invoke (venv + env + one command)
  - [x] Update `README.md` + `.env.example` for sync secrets and run instructions
  - [x] Explicitly state: Next app does not call the store APIs; planning reads Supabase `products` only

- [x] Prove Next does not write catalog (AC: #1, #4)
  - [x] Do **not** add catalog write paths in `app/`, `src/domain/`, or `src/lib/supabase/` client helpers
  - [x] Do **not** import `sync/` from Next or Next from `sync/` (AD-6)
  - [x] Optional: Next may later SELECT `products` — out of scope to build matching UI here; schema + RLS readiness is enough for AC #4

- [x] Smoke verification (AC: #1–#4)
  - [x] Migration applied; authenticated can SELECT `products` / `catalog_sync_runs`; authenticated cannot INSERT/UPDATE them (script under `scripts/`, pattern from `verify-rls-stores.mjs` + `SMOKE_OPERATOR_*`)
  - [x] Manual or mocked sync run produces `catalog_sync_runs` success/failure row for Alabino store
  - [x] Successful path upserts ≥1 product when live API works; if live API flaky, adapter unit/mock path must still prove upsert + run recording
  - [x] `npm run lint` / `npm run build` still green (Next tree unchanged except docs/env)
  - [x] No service role in `NEXT_PUBLIC_*` or client bundles

### Review Findings

- [x] [Review][Patch] Document v1 append-only catalog (no prune of missing SKUs; truncated sync makes prune unsafe) [README.md]
- [x] [Review][Patch] Fail live sync when adapter returns 0 products (do not mark catalog_sync_runs success) [sync/worker.py]
- [x] [Review][Patch] Guard finish_sync_run (nested try + verify row updated) so status cannot stay `running` [sync/worker.py] [sync/db.py]
- [x] [Review][Patch] RLS smoke: authenticated UPDATE deny on products + catalog_sync_runs [scripts/verify-rls-catalog.mjs]
- [x] [Review][Patch] Document truncated catalog defaults (SYNC_MAX_*) and Dokploy invoke/env contract in README [README.md]
- [x] [Review][Patch] Add `sync/pyproject.toml` with `requires-python = ">=3.10"` [sync/]
- [x] [Review][Patch] Require `SUPABASE_URL` for sync (drop silent `NEXT_PUBLIC_SUPABASE_URL` fallback) [sync/config.py]
- [x] [Review][Patch] Validate SYNC_MAX_* ints with SystemExit + hard cap [sync/config.py]
- [x] [Review][Patch] Ignore `__pycache__/` / `*.pyc` in `.gitignore`
- [x] [Review][Patch] Close httpx client after worker run [sync/db.py]
- [x] [Review][Patch] Strip `external_id`; apply `STORE_EXTERNAL_ID` only for single-store sync (not `--all-stores`) [sync/adapter/primary.py] [sync/worker.py]
- [x] [Review][Patch] If CatalogFeedFilter has no PAGE, fetch once per category (no fake multi-page loop) [sync/adapter/primary.py]
- [x] [Review][Patch] Guard non-dict tree nodes; treat product id `0` as valid; fail if all category feeds fail [sync/adapter/primary.py]
- [x] [Review][Patch] Skip sync when latest run for store is still `running` (overlap guard) [sync/worker.py]
- [x] [Review][Patch] DB check: success/failed rows must have `finished_at NOT NULL` [supabase/migrations/20260720030100_catalog_sync_runs_finished_at_check.sql]
- [x] [Review][Patch] Add force-failure smoke path (`python -m sync --mock --fail`) proving `status=failed` [sync/worker.py]

## Dev Notes

### Epic context

Epic 1 — Sign in, workspace & store catalog. Stories 1.1–1.3 are **done**. This story owns **catalog ingest**. Story **1.5** owns stale UI/block using `catalog_sync_runs`.

Sibling boundaries:
- **1.3 (done):** `stores` + `selected_store_id` + Settings picker — do not reopen Settings UI
- **1.5 (next):** `warning-stale` + block planning CTAs — do not implement banner here
- **2.2:** matching/eligibility reads `availability_status` — do not build matching here

Traceability: PRD **FR-16…FR-18** data plane; Epics Story 1.4; Architecture **AD-1, AD-2, AD-5, AD-6, AD-8, AD-9**.

### Current code state (READ before editing)

| Area | Today | This story | Must preserve |
| --- | --- | --- | --- |
| `sync/` | **Missing** | Create worker + adapter | N/A |
| `supabase/migrations/` | user_settings + stores (+ privilege/remove-seed) | **New** products + catalog_sync_runs migration | Do not rewrite 1.2/1.3 SQL files |
| `stores` | Seed Alabino; `external_id='alabino-92'` placeholder | Consume; may UPDATE `external_id` to real id via service role | RLS SELECT-only for authenticated |
| Settings / AppShell | Store picker done | **Do not change** UI | Soft Workshop, AD-9 Settings semantics |
| Next supabase clients | Publishable key only | Keep — no service role in Next | `getUser()`, proxy.ts |
| Python tooling | None for app | Add under `sync/` only | Do not pollute root with unrelated Python |

### Technical requirements (MUST follow)

| Item | Requirement |
| --- | --- |
| Runtime | Python ≥3.10 in `sync/` |
| Catalog client | `store-catalog-api==0.2.2` (PyPI; unofficial RE — operational risk accepted) |
| API style | Async `the storeAPI` context manager; Catalog.tree / Catalog.feed / Geolocation as needed ([docs](https://open-inflation.github.io/primary_api/quick_start)) |
| Writes | Service role only → `products`, `catalog_sync_runs` (+ optional `stores.external_id` fixup) |
| Availability | **One** column: `availability_status` — sole writer = sync (AD-8) |
| Stale SoT | `catalog_sync_runs` only — **never** `products.updated_at` for FR-18 (AD-8) |
| Schedule | Dokploy Schedule Jobs; local manual OK; **ban** GH Actions / Supabase Cron for ingest (AD-1) |
| Dependency direction | No Next↔sync imports (AD-6) |
| Secrets | Service role / store creds only in sync env — never browser (NFR6) |
| Chain | v1 single grocery chain only; keep adapter seam for future chains |
| Default store | UUID `a1000000-0000-4000-8000-000000000001` / display «д. Алабино, 92» |

### Recommended schema sketch

```sql
-- products (catalog; authenticated SELECT; service role writes)
create type public.product_availability as enum ('in_stock', 'out_of_stock', 'unknown');
-- or text + check — pick one in migration and stick to it

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  external_id text not null,
  name text not null,
  price_cents integer null check (price_cents is null or price_cents >= 0),
  availability_status text not null check (
    availability_status in ('in_stock', 'out_of_stock', 'unknown')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, external_id)
);

create table public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_message text null,
  products_upserted integer null
);

-- Freshness for Story 1.5 (document, do not implement UI):
-- fresh := latest run for store has status='success'
--          and finished_at >= now() - interval '24 hours'
```

### Architecture compliance

- **AD-1:** Dokploy hosts sync; Schedule Jobs for cron.
- **AD-2:** Sync sole catalog writer; Next read-only for catalog.
- **AD-5:** Catalog SELECT authenticated; writes service role.
- **AD-6:** Migrations SoT; no DTO column aliases; no UI↔sync imports.
- **AD-8:** Single `availability_status`; stale via `catalog_sync_runs`.
- **AD-9:** Sync configured store(s); Settings preference already exists; Menu snapshot is 2.1.

### UX / brand

No new UX surfaces in this story. Do not add `warning-stale` (1.5). Operator-facing errors go into `catalog_sync_runs.error_message` and logs (English or Russian OK in logs; Russian preferred for operator-facing messages).

### File structure requirements

**NEW:**

```text
sync/
  requirements.txt          # or pyproject.toml
  __init__.py / worker entry
  adapter/primary.py    # thin store-adapter
  db.py                     # service-role client helpers
supabase/migrations/<timestamp>_products_catalog_sync_runs.sql
scripts/verify-rls-catalog.mjs
```

**UPDATE:**

```text
README.md
.env.example
_bmad-output/implementation-artifacts/sprint-status.yaml
```

**Do NOT create / do NOT implement:**

- `warning-stale` UI / planning gates (1.5)
- Settings / store-picker changes (1.3 done)
- `menus` / matching / AI / shopping list
- GitHub Actions cron, Supabase Cron, Edge Function ingest
- Service role in Next Server Actions or `NEXT_PUBLIC_*`
- Stock badge UI / in-app cart

### Library / framework requirements

- **Use:** `store-catalog-api==0.2.2`, Python asyncio, Supabase service client in sync only.
- **Do not use:** Next Route Handlers as catalog writers; scraping from Node; dual availability columns.
- Mock adapter in tests if live site flaky — still must prove DB upsert + run rows.

### Testing requirements

No Vitest mandated. Minimum for 1.4:

1. RLS smoke: authenticated SELECT OK; authenticated write deny on `products` + `catalog_sync_runs`; anon deny
2. Successful sync (live or mock) → products upserted + `catalog_sync_runs.status=success`
3. Forced failure → `status=failed` + `error_message` set
4. Next build/lint unchanged/green
5. Docs show Dokploy schedule + local invoke

### Previous story intelligence (1.3)

- `stores.external_id` placeholder `alabino-92` — 1.4 must resolve real id or fail loudly
- Privilege tighten pattern: revoke ALL from authenticated then GRANT SELECT only
- Smoke scripts: empty `[]` without error ≠ PASS; use `SMOKE_OPERATOR_EMAIL` / `SMOKE_OPERATOR_PASSWORD` for authenticated JWT checks
- Never edit prior migrations — append new ones
- Settings UI and header store label are done — leave them alone

[Source: `1-3-store-picker-in-settings.md`]

### Git intelligence summary

Branch still mostly uncommitted relative to `e20cd4b Init`. Follow Soft Workshop Next patterns for any doc-only Next touches; keep Python isolated under `sync/`.

### Latest tech information

- `store-catalog-api` 0.2.2 (2026-02-23): `pip install primary_api`; async `the storeAPI`; Catalog.tree / Catalog.feed; Geolocation.current for city context — store selection may need geopos/store APIs beyond the quick-start sample; explore library docs when implementing adapter.
- Unofficial client: site changes can break sync — log failures into `catalog_sync_runs`, do not crash Next.
- Prefer `SUPABASE_SECRET_KEY` (`sb_secret_…` from Dashboard → API Keys). Legacy env name `SUPABASE_SERVICE_ROLE_KEY` still works as fallback.

### Project context reference

No `project-context.md`. Follow Architecture Spine + this story.

### Anti-patterns (prevent disasters)

- Next writing `products` / `catalog_sync_runs`
- Next calling the store HTTP
- Stale detection via `products.updated_at`
- Two availability fields (`in_stock` boolean + separate enum)
- Renaming columns in Python/TS DTOs (`sku` vs `external_id`)
- GH Actions / Supabase Cron for ingest
- Implementing warning-stale “while here”
- Shipping service role to browser
- Leaving `running` sync rows forever on exception
- Syncing without recording `catalog_sync_runs` (breaks 1.5)

### Open questions for implementer (non-blocking)

1. Exact store id for д. Алабино, 92 — discover via geolocation/store APIs; persist into `stores.external_id`.
2. Full-catalog vs category-limited sync for v1 — prefer complete enough for planning; document scope if truncated for rate limits.
3. Price units from API → `price_cents` mapping — verify once against live payload; store NULL if unknown (never fabricate).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.4]
- [Source: `ARCHITECTURE-SPINE.md` — AD-1, AD-2, AD-6, AD-8, AD-9, Structural Seed, stack table]
- [Source: `reviews/review-adversarial.md` — catalog column contract / AD-8]
- [Source: `prds/.../prd.md` — FR-16…FR-18; `addendum.md` — store adapter]
- [Source: `1-3-store-picker-in-settings.md` — stores seed + external_id handoff]
- [Source: https://pypi.org/project/store-catalog-api/0.2.2/]
- [Source: https://open-inflation.github.io/primary_api/quick_start]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Applied MCP migration `products_catalog_sync_runs`.
- Privileges: products/catalog_sync_runs auth SELECT=true, INSERT=false; anon SELECT=false.
- Anon REST SELECT products → 42501.
- Mock catalog proof: 3 products + success catalog_sync_runs row for Alabino store.
- Adapter unit check: mock catalog + map_feed_item OK in `.venv-sync`.
- `npm run lint` / `npm run build` green (eslint ignores `.venv-sync`).
- Live `python -m sync --mock` requires `SUPABASE_SECRET_KEY` in env.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created (2026-07-20)
- Implemented `sync/` worker + primary adapter + `--mock`, migration for `products`/`catalog_sync_runs`, RLS SELECT-only, README/Dokploy docs, catalog RLS smoke script. Status → review.
- Code review patches applied (append-only docs, 0-product fail, finish guard, UPDATE RLS smoke, pyproject, SUPABASE_URL required, SYNC_MAX validation, httpx close, external_id strip / override scope, PAGE/feed guards, overlap skip, finished_at check, `--fail` smoke). Status → done.

### File List

- `supabase/migrations/20260720030000_products_catalog_sync_runs.sql` (new)
- `supabase/migrations/20260720030100_catalog_sync_runs_finished_at_check.sql` (new)
- `sync/requirements.txt` (new)
- `sync/pyproject.toml` (new)
- `sync/__init__.py` (new)
- `sync/__main__.py` (new)
- `sync/config.py` (new)
- `sync/db.py` (new)
- `sync/worker.py` (new)
- `sync/adapter/__init__.py` (new)
- `sync/adapter/types.py` (new)
- `sync/adapter/mock.py` (new)
- `sync/adapter/primary.py` (new)
- `scripts/verify-rls-catalog.mjs` (new)
- `README.md`
- `.env.example`
- `.gitignore`
- `eslint.config.mjs`
- `_bmad-output/implementation-artifacts/1-4-catalog-sync-worker.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Story context created (ready-for-dev) — Python sync/, products + catalog_sync_runs, AD-2/AD-8 ingest for Story 1.5.
- 2026-07-20: Implemented sync worker + schema + docs; status → review.
- 2026-07-20: Applied all 16 review patches; migration finished_at check; status → done.
