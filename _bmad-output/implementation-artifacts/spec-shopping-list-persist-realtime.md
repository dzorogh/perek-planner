---
title: 'Persist curated shopping list + live sync'
type: 'feature'
created: '2026-07-26'
status: 'done'
review_resolved: '2026-07-26'
baseline_commit: '471404057c6fb040a80cf1372744d1d8c9e724fa'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The curated shopping cart lives only in React state and resets on every visit; another tab never sees adds/removes until a manual reload.

**Approach:** Persist selected product keys per Menu in Postgres (server actions). Rebuild quantities from the live dish SOURCE on load. On `/plan/shopping-list`: same-browser cart sync via `BroadcastChannel` after successful persist; listen-only Supabase `postgres_changes` for SOURCE (and best-effort cart CDC across browsers/devices).

## Boundaries & Constraints

**Always:**
- Mutations via server actions / domain; browser client never writes shopping or menu rows (Realtime listen-only for Postgres; `BroadcastChannel` is same-origin tab signaling only, not cart SoT).
- Persist selection keys only; quantities always re-aggregated from `buildShoppingSourceFromMenu` on hydrate/refresh.
- One curated cart per `menu_id` (reuse `shopping_lists` header uniqueness).
- Subscribe / open tab channel only while `/plan/shopping-list` is mounted for that `menuId`.
- Debounce remote events; suppress disruptive refresh during in-flight local cart mutations.
- Enable Realtime via migration for tables that store curated selection; also listen to existing menu publication tables so SOURCE updates when the menu changes elsewhere.
- Same-browser cross-tab cart: publish on `BroadcastChannel` after successful persist (Supabase Realtime Broadcast is not required for this path).
- Cross-browser / cross-device cart sync: best-effort via `postgres_changes` on `shopping_lists` (not a hard AC).
- Delete the orphaned snapshot `buildShoppingList` path and any dual “materialized full list vs curated cart” semantics — no legacy dual path.
- Update `project-context.md`: cart persists; not “empty on visit”.
- Russian UI copy only; do not narrate deferred/cut scope.

**Ask First:**
- Household / shared-menu tenancy beyond same-account RLS.
- Keeping `shopping_list_lines` snapshot regenerate semantics alongside curated selection.
- Client-side optimistic writes that skip server actions.
- Hard real-time cart sync across different browsers/devices (requires working Supabase Broadcast or equivalent).

**Never:**
- localStorage / IndexedDB as SoT for the cart.
- New realtime vendors, CRDT, or collaborative cursors.
- Weakening RLS or inventing shared-menu ownership.
- Advertising “without X” / out-of-scope notes in UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reload | Cart had products; reopen `/plan/shopping-list?menuId=` | Same products selected; qty from current SOURCE | Soft fail load → empty cart + RU status if load errors |
| Cross-tab cart (same browser) | Tab A adds/removes product; Tab B open on same list | Tab B reflects change within ~2s via BroadcastChannel | Channel missing: keep last UI; local actions still work; CDC may still refresh |
| Cross-browser / device cart | Same account, different browser/device | Best-effort via `postgres_changes`; not guaranteed | Persistence still works; manual reload restores |
| Menu SOURCE change | Tab A edits menu dishes; Tab B on shopping list | Tab B SOURCE (+ cart qty) refresh; orphan productKeys pruned | Same soft fail |
| Orphan key | Saved productKey no longer in any dish | Drop from cart on hydrate; persist prune on next write | No ghost rows in UI |
| Own-tab echo | Tab A action completes → remote event for same write | No disruptive double-refresh mid-action | Debounce + pending skip |
| Leave page | Navigate away | Realtime channel + BroadcastChannel removed | Cleanup on unmount |

</frozen-after-approval>

## Code Map

- `app/(authenticated)/plan/shopping-list/page.tsx` -- load source + persisted selection; mount live sync
- `src/components/shopping/shopping-list-view.tsx` -- wire cart to server actions; accept initial selection
- `src/components/shopping/shopping-live-sync.tsx` -- BroadcastChannel (same-browser cart) + listen-only `postgres_changes` → debounced `router.refresh()`
- `src/domain/shopping/source.ts` -- hydrate helpers (replay keys → cart/contributed); prune orphans
- `src/domain/shopping/shopping-actions.ts` -- NEW add/remove/set selection; ensure list row; revalidatePath
- `src/domain/shopping/load-shopping-selection.ts` -- NEW load product keys for menu
- `src/domain/shopping/build-list.ts` -- DELETE (orphaned snapshot path)
- `src/components/menu/menu-live-sync.tsx` + `src/domain/menu/menu-live-sync-logic.ts` -- pattern reference (debounce, setAuth)
- `supabase/migrations/*_shopping_list_curated_selection.sql` -- store curated keys; drop/reshape obsolete snapshot line model as needed; RLS
- `supabase/migrations/*_realtime_shopping_list.sql` -- add curated storage table(s) to `supabase_realtime`
- `_bmad-output/project-context.md` -- persist + BroadcastChannel + shopping CDC
- `scripts/verify-shopping-list-logic.mjs` -- hydrate/prune/edge matrix
- `scripts/verify-rls-shopping-lists.mjs` -- update for new shape/grants

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/*_shopping_list_curated_selection.sql` -- persist curated `product_key`s per menu (prefer lean column/array or reshaped lines); apply via Supabase MCP; RLS owner-only -- SoT for cart
- [x] `supabase/migrations/*_realtime_shopping_list.sql` -- publication add curated table(s); apply via MCP -- cross-tab cart events
- [x] `src/domain/shopping/build-list.ts` -- delete orphaned snapshot builder + dead types/call sites/comments -- no dual path
- [x] `src/domain/shopping/source.ts` (+ tiny pure helpers if cleaner) -- hydrate from keys; prune orphans; keep merge/copy pure -- reload fidelity
- [x] `src/domain/shopping/load-shopping-selection.ts` + `shopping-actions.ts` -- load/ensure/add/remove; `revalidatePath` shopping-list -- server write path
- [x] `src/components/shopping/shopping-list-view.tsx` + `plan/shopping-list/page.tsx` -- initial selection; actions on toggle/add-all/remove; mount live sync -- UI persistence
- [x] `src/components/shopping/shopping-live-sync.tsx` -- BroadcastChannel after persist; `postgres_changes` on curated store + menu tables; debounce; pending-gate; `setAuth`; cleanup -- live UI
- [x] `_bmad-output/project-context.md` -- replace “empty cart on visit”; document BroadcastChannel + CDC -- agent rules honest
- [x] `scripts/verify-shopping-list-logic.mjs` (+ rls script / `verify:logic` wiring) -- matrix hydrate/prune/echo-gate helpers -- no network in logic verifier

**Acceptance Criteria:**
- Given a curated cart with products, when the operator reloads or revisits the shopping list for that menu, then the same products are selected with quantities from the current SOURCE.
- Given two same-browser tabs (same account) on the same shopping list, when Tab A adds or removes a product, then Tab B updates within ~2 seconds without manual reload (BroadcastChannel).
- Given Tab A changes menu dishes while Tab B is on the shopping list, when the change commits, then Tab B’s SOURCE and cart quantities update; keys missing from SOURCE disappear from the cart UI.
- Given a local in-flight cart mutation, when a remote sync event arrives, then the UI does not tear down mid-action.
- Given sync transports are unavailable, when the operator uses add/remove, then persistence via server actions still works; cross-tab sync is best-effort beyond same-browser BroadcastChannel.
- Given the operator leaves `/plan/shopping-list`, when the component unmounts, then the Realtime channel and BroadcastChannel are removed.
- Given the orphaned snapshot builder previously existed, when this ships, then no dual snapshot regenerate path remains in code.

## Spec Change Log

- 2026-07-26: Renegotiated live-sync transport — same-browser cart via `BroadcastChannel`; cross-browser/device cart CDC best-effort (not hard AC). Supabase Realtime Broadcast not required.

### Review Findings

- [x] [Review][Decision] Cross-tab SoT: BroadcastChannel vs frozen listen-only Realtime — resolved: accept BroadcastChannel for same-browser; CDC best-effort cross-device; frozen Intent/AC updated 2026-07-26.
- [x] [Review][Patch] Own-echo suppress drops remote `router.refresh` (not only notice) [`src/components/shopping/shopping-live-sync.tsx`] — fixed: suppress notice only
- [x] [Review][Patch] `isDirty` gates live sync forever after failed persist [`src/components/shopping/shopping-list-view.tsx`] — fixed: `isPending` only
- [x] [Review][Patch] UPDATE RLS on `shopping_lists` no longer requires menu ownership / allows `menu_id` reassignment — fixed: `20260726194000_shopping_lists_update_menu_ownership.sql`
- [x] [Review][Patch] Soft-fail load blocks all curation — fixed: loadError is status-only; edits allowed
- [x] [Review][Patch] Unmount before persist ack skips BroadcastChannel publish — fixed: publish before alive gate + fallback `publishShoppingTabSelection`
- [x] [Review][Defer] Concurrent tabs last-write-wins on full key replace [`src/domain/shopping/shopping-actions.ts:114`] — deferred, pre-existing design
- [x] [Review][Defer] Recipe `critical_ingredients` changes without menu-row CDC leave shopping SOURCE stale — deferred, pre-existing (already in deferred-work)
- [x] [Review][Defer] Logic verify duplicates hydrate/prune instead of importing domain helpers [`scripts/verify-shopping-list-logic.mjs`] — deferred, pre-existing pattern
- [x] [Review][Defer] Anon RLS verify does not cover denormalized `user_id` policies [`scripts/verify-rls-shopping-lists.mjs`] — deferred, pre-existing coverage gap

## Design Notes

**Selection-only persistence:** UI always adds a product across all dishes that contain it (`addProductAcrossAllDishes`). Persist `product_key[]` (or equivalent unique rows). On hydrate, replay `addProductAcrossAllDishes` for each key against current SOURCE; drop keys with zero matches.

**Lean storage preference:** Prefer a curated-keys field (or reshaped lines with `product_key`) on the existing one-row-per-menu `shopping_lists` model over resurrecting full snapshot regenerate. Delete `build-list.ts` in the same change.

**Live sync:** Same-browser cart — `BroadcastChannel` after successful persist. SOURCE (+ best-effort cart CDC) — JWT `setAuth`, debounce ~350ms, `router.refresh()`, listen-only `postgres_changes` on curated + menu tables (mirror menu pattern; no client DB writes).

## Verification

**Commands:**
- `node scripts/verify-shopping-list-logic.mjs` -- PASS; hydrate/prune/matrix covered
- `npm run verify:rls` -- shopping RLS script PASS (with operator env)
- `npm run verify` -- logic + rls + lint + build green when those surfaces change

**Manual checks:**
- Two same-browser tabs, same user, same `menuId`: add/remove on A → B updates; reload restores cart; edit menu on A → shopping SOURCE on B updates.

## Suggested Review Order

**Schema**

- Selection SoT: `curated_product_keys` on one row per menu; drop snapshot lines.
  [`20260726170000_shopping_list_curated_selection.sql:5`](../../supabase/migrations/20260726170000_shopping_list_curated_selection.sql#L5)

- Idempotent Realtime publication for cart cross-tab events.
  [`20260726170100_realtime_shopping_list.sql:3`](../../supabase/migrations/20260726170100_realtime_shopping_list.sql#L3)

**Server write path**

- Full-key replace with owned-menu check and updated-row verify.
  [`shopping-actions.ts:95`](../../src/domain/shopping/shopping-actions.ts#L95)

- Load keys for SSR hydrate (empty if no row yet).
  [`load-shopping-selection.ts:22`](../../src/domain/shopping/load-shopping-selection.ts#L22)

**Domain hydrate**

- Replay keys against live SOURCE; prune orphans.
  [`source.ts:303`](../../src/domain/shopping/source.ts#L303)

**UI binding**

- Page wires source + selection + slotIds into client.
  [`page.tsx:57`](../../app/(authenticated)/plan/shopping-list/page.tsx#L57)

- Ref-based cart commits + queued persist; block edits on loadError; dirty gate.
  [`shopping-list-view.tsx:113`](../../src/components/shopping/shopping-list-view.tsx#L113)

**Live sync**

- BroadcastChannel after persist + listen-only shopping/menu CDC; debounce; pending + own-echo suppress.
  [`shopping-live-sync.tsx`](../../src/components/shopping/shopping-live-sync.tsx)

**Peripherals**

- Hydrate/prune verify coverage.
  [`verify-shopping-list-logic.mjs:102`](../../scripts/verify-shopping-list-logic.mjs#L102)

- RLS: anon deny + lines table must be absent.
  [`verify-rls-shopping-lists.mjs:19`](../../scripts/verify-rls-shopping-lists.mjs#L19)
