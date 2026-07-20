/**
 * Pure fridge-keep helpers (no store catalog).
 * Usage: node scripts/verify-fridge-keep-logic.mjs
 */

function passesFridgeKeep(fridgeKeepDays, menuDayCount) {
  return fridgeKeepDays >= menuDayCount;
}

function shortestFridgeKeepCapsLength(fridgeKeepDaysList) {
  if (fridgeKeepDaysList.length === 0) return null;
  return Math.min(...fridgeKeepDaysList);
}

function maxMenuDaysForRecipes(fridgeKeepDaysList) {
  const capped = shortestFridgeKeepCapsLength(fridgeKeepDaysList);
  if (capped === null) return 4;
  return Math.min(4, Math.max(1, capped));
}

let failed = 0;
function check(name, cond) {
  if (cond) console.log(`PASS: ${name}`);
  else {
    console.log(`FAIL: ${name}`);
    failed += 1;
  }
}

check("fridge ok 4>=3", passesFridgeKeep(4, 3));
check("fridge fail 1<3", !passesFridgeKeep(1, 3));
check("cap empty → 4", maxMenuDaysForRecipes([]) === 4);
check("cap [4,2] → 2", maxMenuDaysForRecipes([4, 2]) === 2);
check("cap [7] → 4", maxMenuDaysForRecipes([7]) === 4);

if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All fridge-keep logic cases passed");
