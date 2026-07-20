/**
 * Pure-logic smoke for UJ-1 gate predicates (keep in sync with uj1-gate.ts).
 * Usage: node scripts/verify-uj1-gate-logic.mjs
 */

/** Mirrors `shoppingListAllowed` in src/domain/menu/uj1-gate.ts */
function shoppingListAllowed(slotEditPassedAt) {
  return slotEditPassedAt != null;
}

let failed = 0;
function check(name, cond) {
  if (cond) console.log(`PASS: ${name}`);
  else {
    console.log(`FAIL: ${name}`);
    failed += 1;
  }
}

check("blocked when null", !shoppingListAllowed(null));
check("blocked when undefined", !shoppingListAllowed(undefined));
check(
  "allowed when timestamp set",
  shoppingListAllowed("2026-07-20T02:00:00.000Z"),
);

if (failed > 0) {
  console.log(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All UJ-1 gate logic cases passed");
