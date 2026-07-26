/**
 * Pure live-sync / refresh-gate / busy-broadcast helpers (no DB).
 * Usage: node scripts/verify-menu-live-sync-logic.mjs
 */

function shouldApplyRemoteMenuRefresh(isAnyBusy) {
  return !isAnyBusy;
}

function menuSlotDishEventMatchesMenu(menuSlotId, slotIds) {
  if (typeof menuSlotId !== "string" || menuSlotId.length === 0) return false;
  return slotIds.has(menuSlotId);
}

function shouldApplyRemoteBusy(senderId, selfId) {
  if (typeof senderId !== "string" || senderId.length === 0) return false;
  return senderId !== selfId;
}

function parseMenuBusyBroadcastPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw;
  const senderId = typeof o.senderId === "string" ? o.senderId.trim() : "";
  const kind = o.kind === "recipe" || o.kind === "snack" ? o.kind : null;
  const key = typeof o.key === "string" ? o.key.trim() : "";
  if (!senderId || !kind || !key) return null;
  if (o.label === null) {
    return { senderId, kind, key, label: null };
  }
  if (typeof o.label !== "string") return null;
  const label = o.label.trim();
  if (!label) return null;
  return { senderId, kind, key, label };
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

assert(
  shouldApplyRemoteMenuRefresh(false) === true,
  "idle → apply remote refresh",
);
assert(
  shouldApplyRemoteMenuRefresh(true) === false,
  "busy → skip remote refresh",
);

const slots = new Set(["slot-a", "slot-b"]);
assert(
  menuSlotDishEventMatchesMenu("slot-a", slots) === true,
  "dish event for open menu slot matches",
);
assert(
  menuSlotDishEventMatchesMenu("slot-other", slots) === false,
  "dish event for other menu slot ignored",
);
assert(
  menuSlotDishEventMatchesMenu(null, slots) === false,
  "missing menu_slot_id → ignore",
);
assert(
  menuSlotDishEventMatchesMenu("", slots) === false,
  "empty menu_slot_id → ignore",
);

assert(
  shouldApplyRemoteBusy("tab-a", "tab-b") === true,
  "busy from other tab → apply",
);
assert(
  shouldApplyRemoteBusy("tab-a", "tab-a") === false,
  "busy echo from self → ignore",
);
assert(
  shouldApplyRemoteBusy("", "tab-a") === false,
  "empty sender → ignore",
);
assert(
  shouldApplyRemoteBusy(null, "tab-a") === false,
  "missing sender → ignore",
);

assert(
  parseMenuBusyBroadcastPayload({
    senderId: "t1",
    kind: "recipe",
    key: "r1",
    label: "Заменяем…",
  })?.label === "Заменяем…",
  "parse recipe busy start",
);
assert(
  parseMenuBusyBroadcastPayload({
    senderId: "t1",
    kind: "snack",
    key: "яблоко",
    label: null,
  })?.label === null,
  "parse snack busy clear",
);
assert(
  parseMenuBusyBroadcastPayload({
    senderId: "t1",
    kind: "recipe",
    key: "r1",
    label: "   ",
  }) === null,
  "blank label rejected",
);
assert(
  parseMenuBusyBroadcastPayload({ kind: "recipe", key: "r1", label: "x" }) ===
    null,
  "missing sender rejected",
);

if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll menu live-sync logic checks PASS");
