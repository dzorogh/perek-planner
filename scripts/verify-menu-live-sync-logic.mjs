/**
 * Pure live-sync / refresh-gate helpers (no DB).
 * Usage: node scripts/verify-menu-live-sync-logic.mjs
 */

function shouldApplyRemoteMenuRefresh(isAnyBusy) {
  return !isAnyBusy;
}

function menuSlotDishEventMatchesMenu(menuSlotId, slotIds) {
  if (typeof menuSlotId !== "string" || menuSlotId.length === 0) return false;
  return slotIds.has(menuSlotId);
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

if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll menu live-sync logic checks PASS");
