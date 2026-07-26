---
title: 'Live menu sync (same account, two tabs/devices)'
type: 'feature'
created: '2026-07-26'
status: 'done'
baseline_commit: '509b1054a47b35b70969c99ff33eea93e861e9e7'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When the same operator has the menu open on two tabs/devices, edits on one side stay invisible on the other until a manual reload. In-process `withMenuMutationLock` also does not serialize AI mutations across Next instances.

**Approach:** Keep Postgres + server actions as the write path. Add Supabase Realtime `postgres_changes` (listen-only) on menu tables so the open menu page refreshes when another session changes the same `menu_id`. Replace the in-process mutex with a Postgres advisory lock for AI slot mutations. Conflict model: row-level last-write-wins (no merge UI).

## Boundaries & Constraints

**Always:**
- Mutations stay in server actions / domain; browser client never writes menu rows.
- Same-account MVP only: RLS `auth.uid()` ownership unchanged (AD-5).
- Subscribe only while `/plan/menu` is mounted for that `menuId`.
- Debounce remote events and skip refresh while local slot busy / pending action to avoid fighting own writes.
- Enable Realtime via migration: add `menus`, `menu_slots`, `menu_slot_dishes`, `menu_snacks` to `supabase_realtime` publication.
- Russian UI copy only for any visible sync notice; do not narrate deferred/cut scope.

**Ask First:**
- Expanding beyond same-account (household / shared menu RLS).
- Adding a toast library (sonner etc.) instead of existing inline `role="alert"` patterns.
- Listening on shopping-list or other routes in this change.

**Never:**
- New realtime vendors (Ably, Pusher, PartyKit), CRDT/Yjs/OT, or client-side collaborative cursors/presence in this ship.
- Client-side menu mutations “for latency”.
- Weakening RLS or inventing shared-menu tenancy.
- Advertising “without X” / out-of-scope notes in UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Remote dish change | Tab A assigns/replaces a dish; Tab B open on same menu | Tab B refreshes grid within ~2s; shows current dishes | If channel errors, fail soft (keep last UI); no blocking modal |
| Own-tab echo | Tab A completes action → Realtime event for same write | No disruptive double-refresh; busy UI completes normally | Debounce + busy skip |
| Concurrent same role | Two tabs write different recipes into same slot/role | Last committed row wins; both tabs eventually show winner | No merge dialog |
| Parallel AI invent | Two AI resuggests on same menu (multi-instance) | Serialized via advisory lock; both complete without interleaved assign | Lock wait then proceed; surface existing action errors |
| Snacks / equipment | Remote snack or equipment change | Tab B refreshes and reflects change | Same soft fail as above |
| Stale subscription | Navigate away from menu | Channel unsubscribed; no leaks | Cleanup on unmount |

</frozen-after-approval>

## Code Map

- `app/(authenticated)/plan/menu/page.tsx` -- RSC loader; mount live-sync client next to grid
- `src/components/menu/menu-sheet-grid.tsx` -- client grid + `MenuSlotBusyProvider` / `menuId`
- `src/components/menu/menu-live-sync.tsx` -- NEW listen-only Realtime → debounced `router.refresh()` + optional inline notice
- `src/lib/supabase/client.ts` -- existing browser client (reuse for Realtime only)
- `src/domain/menu/menu-mutation-lock.ts` -- swap Map mutex → `pg_advisory_xact_lock` (or RPC) keyed by menu
- `src/domain/menu/slot-actions.ts` -- existing `withMenuMutationLock` call sites (keep API)
- `supabase/migrations/YYYYMMDDHHMMSS_realtime_menu_tables.sql` -- publication add tables
- `_bmad-output/project-context.md` -- carve-out: browser client may listen Realtime for UI sync only

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/*_realtime_menu_tables.sql` -- add four menu tables to `supabase_realtime`; apply via Supabase MCP -- publication currently empty
- [x] `src/domain/menu/menu-mutation-lock.ts` -- implement Postgres advisory lock behind same `withMenuMutationLock` signature -- cross-instance AI serialization
- [x] `src/components/menu/menu-live-sync.tsx` -- subscribe `postgres_changes` for menu tables filtered by `menuId`; debounce; respect busy; `router.refresh()`; subtle RU inline notice -- other-tab visibility
- [x] `app/(authenticated)/plan/menu/page.tsx` (+ grid wiring if needed) -- render `MenuLiveSync` with `menuId` -- mount point
- [x] `_bmad-output/project-context.md` -- document listen-only Realtime exception -- keep agent rules honest
- [x] `scripts/verify-menu-live-sync-logic.mjs` -- unit-test refresh-gate / dish-scope / debounce helpers from matrix -- no network in verifier

**Acceptance Criteria:**
- Given two browsers signed in as the same user on the same menu, when Tab A changes a dish/snack/equipment, then Tab B’s menu view updates without manual reload within ~2 seconds.
- Given a local pending slot action, when a Realtime event arrives (including echo), then the UI does not tear down busy/error state mid-action.
- Given two concurrent AI resuggest actions on one menu across instances, when both run, then invent→assign does not interleave (advisory lock).
- Given the operator leaves `/plan/menu`, when the component unmounts, then the Realtime channel is removed.
- Given Realtime is unavailable, when the page stays open, then local edits via server actions still work; sync is best-effort.

## Spec Change Log

## Design Notes

- Prefer refresh-on-any-change over timestamp LWW in the client: `menu_snacks` has no `updated_at`; dish writes already set it. DB commit order is the conflict resolver.
- Filter strategy: subscribe to `menu_slots` / `menu_slot_dishes` / `menu_snacks` / `menus` with filters that Realtime supports (often `menu_id=eq.…` on tables that have the column; for `menu_slot_dishes` filter via slot join is unavailable — subscribe broader and ignore events whose slot is not in the loaded menu, or refresh on any dish event for owned menus only via RLS-delivered payloads).
- Do not add Presence/avatars in this ship.

## Verification

**Commands:**
- `npm run verify:logic` -- expected: PASS including new/extended lock verifier
- `npm run lint` -- expected: no new errors on touched files
- Apply migration via Supabase MCP `apply_migration` -- expected: success; publication lists the four tables

**Manual checks:**
- Two tabs on `http://localhost:3100/plan/menu`: change a dish in A → B updates; run resuggest in both quickly → no corrupt dual assign; leave page → no lingering channel errors in console.

## Suggested Review Order

**Realtime listen path**

- Client subscribe + debounce + busy/echo suppress → `router.refresh()`
  [`menu-live-sync.tsx:26`](../../src/components/menu/menu-live-sync.tsx#L26)

- Mount inside busy provider with current slot ids
  [`menu-sheet-grid.tsx:265`](../../src/components/menu/menu-sheet-grid.tsx#L265)

- Pure refresh-gate / dish-scope helpers
  [`menu-live-sync-logic.ts:3`](../../src/domain/menu/menu-live-sync-logic.ts#L3)

**Write serialization**

- In-process queue + Postgres lease token acquire/release
  [`menu-mutation-lock.ts:81`](../../src/domain/menu/menu-mutation-lock.ts#L81)

- Token lease + 10m TTL + same-holder reclaim
  [`20260726163000_menu_mutation_lease_hardening.sql:12`](../../supabase/migrations/20260726163000_menu_mutation_lease_hardening.sql#L12)

- Publication enable for menu tables
  [`20260726160000_realtime_menu_tables.sql:6`](../../supabase/migrations/20260726160000_realtime_menu_tables.sql#L6)

**Busy gate**

- Local action busy keys feed `isAnyBusy`
  [`menu-slot-busy.tsx:66`](../../src/components/menu/menu-slot-busy.tsx#L66)

- Slot actions register pending into the gate
  [`slot-card-actions.tsx:228`](../../src/components/menu/slot-card-actions.tsx#L228)

**Peripherals**

- Browser listen-only Realtime carve-out
  [`project-context.md:57`](../project-context.md#L57)

- Verifier wired into `verify:logic`
  [`package.json:12`](../../package.json#L12)
