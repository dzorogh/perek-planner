---
title: 'Persist AI debug logs to Supabase (per-user)'
type: 'feature'
created: '2026-07-25'
status: 'done'
baseline_commit: '7cd0d3750f8332d61f9c30630d66fc1d8dc37c70'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** OpenRouter debug logs live only in process memory, so they vanish on restart/HMR and cannot be inspected later.

**Approach:** Persist each OpenRouter call to a per-user Supabase table; Settings panel loads/clears from the DB (same UX).

## Boundaries & Constraints

**Always:**
- Logs are scoped to the authenticated operator (`user_id`); RLS enforces select/insert/delete own only.
- Every real OpenRouter call (success or transport/HTTP failure recorded today) writes one row when a user session is available.
- Keep at most 24 newest rows per user after each insert (prune older).
- Truncate request/response content to 80_000 chars per field (same as today).
- DB write failures must not break menu generation or other AI flows (log and continue).
- Apply migration via Supabase MCP in the same turn as the local migration file.

**Ask First:**
- Changing retention above 24, or sharing logs across users.
- Exposing logs to anon / service-role-only admin tooling.

**Never:**
- Client-side OpenRouter or API keys.
- Storing logs without `user_id` / shared global table.
- Blocking the AI call on slow DB (best-effort persist after the OpenRouter round-trip; never throw from the recorder into callers).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Authenticated user, OpenRouter returns content | Row inserted; Settings shows it after refresh | N/A |
| OpenRouter HTTP error | Authenticated, non-2xx | Row with `ok=false`, `error` set, `response=null` | Same as today for caller |
| No session | OpenRouter called without cookies/user | No DB row; AI flow unchanged | Silent skip |
| DB insert fails | Authenticated, PostgREST error | AI flow still succeeds | Swallow; optional console error |
| Over retention | User already has ≥24 rows | After insert, only 24 newest remain | Prune by `created_at` desc |
| Clear | User clicks «Очистить» | All own rows deleted; panel empty | Auth required |
| Other user | User B selects | Never sees User A rows | RLS deny / empty |
| Anon | Unauthenticated select/insert | Denied | Permission/RLS error |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260725020000_ai_debug_logs.sql` -- new table + RLS + grants
- `src/lib/openrouter/debug-types.ts` -- shared entry shape (keep; map from DB rows)
- `src/lib/openrouter/debug-log.ts` -- replace in-memory store with async DB insert/list/clear + prune
- `src/lib/openrouter/client.ts` -- await best-effort `recordAiDebugEntry` (already calls it)
- `src/domain/settings/ai-debug-actions.ts` -- load/clear via DB helpers; keep auth gate
- `src/components/settings/ai-debug-panel.tsx` -- no UX change expected; still uses actions
- `scripts/verify-rls-ai-debug-logs.mjs` -- anon deny smoke; wire into `verify:rls` if other RLS scripts are listed there

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260725020000_ai_debug_logs.sql` -- create `ai_debug_logs` (id, user_id, at/created_at, model, duration_ms, ok, error, request_messages jsonb, response text) + RLS own select/insert/delete + revoke anon -- durable per-user log
- [x] Apply migration via Supabase MCP `apply_migration` -- remote schema matches file
- [x] `src/lib/openrouter/debug-log.ts` -- async record (getUser + insert + prune to 24); list/clear from DB; drop process array -- SoT is DB
- [x] `src/lib/openrouter/client.ts` -- fire-and-forget `void recordAiDebugEntry` (never await / never throw) -- AI path not blocked by DB latency
- [x] `src/domain/settings/ai-debug-actions.ts` -- load/clear use DB helpers; map rows → `AiDebugEntry` -- Settings panel works
- [x] `scripts/verify-rls-ai-debug-logs.mjs` + `package.json` `verify:rls` -- anon cannot read -- regression guard
- [x] Manual: Settings loads DB rows for current user (seed+API 200); panel shows entry after refresh -- persistence proof

**Acceptance Criteria:**
- Given an authenticated operator generates a menu, when OpenRouter is called, then a row appears in `ai_debug_logs` for that `user_id`.
- Given the Next.js process restarts, when Settings loads the log, then previous rows for that user are still shown.
- Given User A has logs, when User B loads Settings, then User A’s rows are not returned.
- Given insert/prune fails, when generation runs, then the menu action still completes (no user-facing log error).
- Given the operator clears the log, when the action finishes, then that user has zero rows.

## Spec Change Log

## Design Notes

Recording runs inside the server request that already has cookies — `createClient()` + `getUser()` in the recorder; no need to thread `userId` through every invent/plan call.

`request_messages` JSON shape: `[{ "role": "system"|"user"|"assistant", "content": "..." }]`.

Prune SQL pattern: after insert, delete ids for the user not in the 24 newest by `created_at desc`.

## Verification

**Commands:**
- `npm run verify:rls` (or the new script alone with `--env-file=.env.local`) -- PASS anon deny for `ai_debug_logs`
- `npm run lint` -- no new errors in touched files

**Manual checks:**
- Generate menu → Settings → «Обновить» → entries present with request/response
- Restart `npm run dev` → entries still present
- «Очистить» → empty; DB has 0 rows for that user

## Suggested Review Order

**Schema**

- Per-user table + RLS own select/insert/delete; anon revoked
  [`20260725020000_ai_debug_logs.sql:3`](../../supabase/migrations/20260725020000_ai_debug_logs.sql#L3)

**Persist path**

- Fire-and-forget so OpenRouter never waits on DB
  [`client.ts:115`](../../src/lib/openrouter/client.ts#L115)

- Best-effort insert + paged prune to 24 newest
  [`debug-log.ts:64`](../../src/lib/openrouter/debug-log.ts#L64)

- Overflow prune via `.range` pages (not full-table select)
  [`debug-log.ts:110`](../../src/lib/openrouter/debug-log.ts#L110)

**Settings UI**

- Load/clear surface DB errors instead of fake empty success
  [`ai-debug-actions.ts:28`](../../src/domain/settings/ai-debug-actions.ts#L28)

**Verification**

- Anon select deny smoke wired into `verify:rls`
  [`verify-rls-ai-debug-logs.mjs:22`](../../scripts/verify-rls-ai-debug-logs.mjs#L22)
