/**
 * Pure-logic smoke for Story 2.1 day/slot counts (no DB).
 * Usage: node scripts/verify-menu-skeleton-logic.mjs
 */

const MEAL_SLOTS = [
  "breakfast",
  "second_breakfast",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late_dinner",
];
const DEFAULT_MEALS = ["breakfast", "lunch", "dinner"];
const CREATE_MENU_DAY_COUNTS = [2, 4, 6];
const DEFAULT_DAY_COUNT = 4;
const MENU_DAY_PAIRS = [
  [1, 2],
  [3, 4],
  [5, 6],
];

function isValidDayCount(value) {
  return CREATE_MENU_DAY_COUNTS.includes(value);
}

function menuDayPairsForCount(dayCount) {
  return MENU_DAY_PAIRS.filter((pair) => pair[1] <= dayCount);
}

function expectedSlotCount(dayCount, meals = MEAL_SLOTS) {
  return dayCount * meals.length;
}

function buildSlotKeys(dayCount, meals = DEFAULT_MEALS) {
  const keys = [];
  for (let day = 1; day <= dayCount; day += 1) {
    for (const meal of meals) {
      keys.push(`${day}:${meal}`);
    }
  }
  return keys;
}

const cases = [
  { day: 2, meals: DEFAULT_MEALS, slots: 6 },
  { day: 4, meals: DEFAULT_MEALS, slots: 12 },
  { day: 6, meals: DEFAULT_MEALS, slots: 18 },
  {
    day: 2,
    meals: [
      "breakfast",
      "second_breakfast",
      "lunch",
      "afternoon_snack",
      "dinner",
      "late_dinner",
    ],
    slots: 12,
  },
  { day: 4, meals: ["lunch", "dinner"], slots: 8 },
  { day: 6, meals: [], slots: 0 },
];

let failed = 0;

for (const c of cases) {
  if (!isValidDayCount(c.day)) {
    console.error(`FAIL: ${c.day} should be valid`);
    failed += 1;
    continue;
  }
  const count = expectedSlotCount(c.day, c.meals);
  const keys = buildSlotKeys(c.day, c.meals);
  if (count !== c.slots || keys.length !== c.slots) {
    console.error(`FAIL day=${c.day}: count=${count} keys=${keys.length}`);
    failed += 1;
  } else {
    console.log(`PASS: day=${c.day} meals=${c.meals.length} → ${c.slots} slots`);
  }
}

for (const bad of [0, 1, 3, 5, 1.5, NaN, 8]) {
  if (isValidDayCount(bad)) {
    console.error(`FAIL: ${bad} should be invalid`);
    failed += 1;
  } else {
    console.log(`PASS: reject dayCount=${bad}`);
  }
}

{
  const createSlots = expectedSlotCount(DEFAULT_DAY_COUNT, DEFAULT_MEALS);
  if (createSlots !== 12) {
    console.error(`FAIL: default 4-day B/L/D should be 12 slots, got ${createSlots}`);
    failed += 1;
  } else {
    console.log("PASS: default create menu is 4 days × 3 meals = 12 slots");
  }

  const pairs2 = menuDayPairsForCount(2);
  const pairs4 = menuDayPairsForCount(4);
  const pairs6 = menuDayPairsForCount(6);
  if (
    pairs2.length !== 1 ||
    pairs4.length !== 2 ||
    pairs6.length !== 3 ||
    pairs6[2][0] !== 5 ||
    pairs6[2][1] !== 6
  ) {
    console.error("FAIL: menuDayPairsForCount must yield 1/2/3 pairs for 2/4/6");
    failed += 1;
  } else {
    console.log("PASS: menuDayPairsForCount → 2:[1,2], 4:+[3,4], 6:+[5,6]");
  }

  const covered = new Set(MENU_DAY_PAIRS.flat());
  if (
    MENU_DAY_PAIRS.length !== 3 ||
    covered.size !== 6 ||
    ![1, 2, 3, 4, 5, 6].every((d) => covered.has(d))
  ) {
    console.error("FAIL: MENU_DAY_PAIRS must cover days 1–6 as [1,2],[3,4],[5,6]");
    failed += 1;
  } else {
    console.log("PASS: MENU_DAY_PAIRS are hard 1–2, 3–4, 5–6");
  }

  function menuDayPairForDay(dayIndex) {
    for (const pair of MENU_DAY_PAIRS) {
      if (pair[0] === dayIndex || pair[1] === dayIndex) return pair;
    }
    return null;
  }
  const p1 = menuDayPairForDay(1);
  const p3 = menuDayPairForDay(3);
  const p5 = menuDayPairForDay(5);
  const p7 = menuDayPairForDay(7);
  if (
    !p1 ||
    p1[0] !== 1 ||
    p1[1] !== 2 ||
    !p3 ||
    p3[0] !== 3 ||
    p3[1] !== 4 ||
    !p5 ||
    p5[0] !== 5 ||
    p5[1] !== 6 ||
    p7 != null
  ) {
    console.error("FAIL: menuDayPairForDay mapping");
    failed += 1;
  } else {
    console.log("PASS: menuDayPairForDay maps 1→[1,2], 3→[3,4], 5→[5,6]");
  }
}

function summarizeMenuDishes(slots) {
  const byRecipe = new Map();
  for (const slot of slots) {
    if (!slot.recipeId || !slot.recipeName) continue;
    const entry = byRecipe.get(slot.recipeId) ?? {
      name: slot.recipeName,
      days: new Set(),
    };
    entry.days.add(slot.dayIndex);
    byRecipe.set(slot.recipeId, entry);
  }
  const out = [];
  for (const [recipeId, entry] of byRecipe) {
    const days = [...entry.days].sort((a, b) => a - b);
    out.push({
      recipeId,
      name: entry.name,
      dayCount: days.length,
      days,
    });
  }
  out.sort((a, b) => {
    if (b.dayCount !== a.dayCount) return b.dayCount - a.dayCount;
    return a.name.localeCompare(b.name, "ru");
  });
  return out;
}

function formatDishDayCount(dayCount) {
  const n = Math.max(0, Math.floor(dayCount));
  if (n === 1) return "1 день";
  if (n >= 2 && n <= 4) return `${n} дня`;
  return `${n} дней`;
}

{
  const dishes = summarizeMenuDishes([
    { recipeId: "a", recipeName: "Суп", dayIndex: 1 },
    { recipeId: "a", recipeName: "Суп", dayIndex: 2 },
    { recipeId: "a", recipeName: "Суп", dayIndex: 3 },
    { recipeId: "b", recipeName: "Каша", dayIndex: 1 },
    { recipeId: "b", recipeName: "Каша", dayIndex: 2 },
  ]);
  if (
    dishes[0].dayCount === 3 &&
    dishes[0].name === "Суп" &&
    dishes[1].dayCount === 2
  ) {
    console.log("PASS: summarizeMenuDishes sorts by dayCount");
  } else {
    console.error("FAIL: summarizeMenuDishes");
    failed += 1;
  }
  if (
    formatDishDayCount(1) === "1 день" &&
    formatDishDayCount(2) === "2 дня" &&
    formatDishDayCount(5) === "5 дней"
  ) {
    console.log("PASS: formatDishDayCount");
  } else {
    console.error("FAIL: formatDishDayCount");
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll menu-skeleton logic checks passed.");
