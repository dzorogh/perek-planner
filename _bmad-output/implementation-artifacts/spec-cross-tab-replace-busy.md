---
title: 'Cross-tab replace busy overlay'
type: 'feature'
created: '2026-07-26'
status: 'done'
route: 'one-shot'
baseline_commit: 'bc88255773f65c1ed631c28a2e7d5ce76b3a3cef'
---

# Cross-tab replace busy overlay

## Intent

**Problem:** When «Заменить» runs in one window, peer tabs on the same menu stay idle until the dish row changes — no shared busy animation.

**Approach:** Broadcast local recipe/snack busy over the existing Realtime channel; peers apply a remote overlay that does not gate refresh, and clear it on broadcast, dish refresh, or short TTL.

## Suggested Review Order

**Busy split (local vs remote)**

- Local busy gates refresh; remote only feeds overlay labels.
  [`menu-slot-busy.tsx:191`](../../src/components/menu/menu-slot-busy.tsx#L191)

- Publish on local set; applyRemoteBusy never re-broadcasts.
  [`menu-slot-busy.tsx:123`](../../src/components/menu/menu-slot-busy.tsx#L123)

**Realtime wire**

- Broadcast listen/send on `menu-live:${menuId}` + queue until SUBSCRIBED.
  [`menu-live-sync.tsx:256`](../../src/components/menu/menu-live-sync.tsx#L256)

- Clear remote overlays when dish refresh runs (lost-clear safety).
  [`menu-live-sync.tsx:118`](../../src/components/menu/menu-live-sync.tsx#L118)

**Pure helpers**

- Payload parse + self-echo ignore.
  [`menu-live-sync-logic.ts:31`](../../src/domain/menu/menu-live-sync-logic.ts#L31)
