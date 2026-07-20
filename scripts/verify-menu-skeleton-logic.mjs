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
const FIXED_MENU_DAY_COUNT = 4;
const MENU_DAY_PAIRS = [
  [1, 2],
  [3, 4],
];

function isValidDayCount(value) {
  return Number.isInteger(value) && value >= 1 && value <= 4;
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
  { day: 1, meals: DEFAULT_MEALS, slots: 3 },
  { day: 2, meals: DEFAULT_MEALS, slots: 6 },
  { day: 3, meals: DEFAULT_MEALS, slots: 9 },
  { day: 4, meals: DEFAULT_MEALS, slots: 12 },
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
  { day: 3, meals: ["lunch", "dinner"], slots: 6 },
  { day: 1, meals: [], slots: 0 },
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

for (const bad of [0, 5, 1.5, NaN]) {
  if (isValidDayCount(bad)) {
    console.error(`FAIL: ${bad} should be invalid`);
    failed += 1;
  } else {
    console.log(`PASS: reject dayCount=${bad}`);
  }
}

{
  const createSlots = expectedSlotCount(FIXED_MENU_DAY_COUNT, DEFAULT_MEALS);
  if (createSlots !== 12) {
    console.error(`FAIL: fixed 4-day B/L/D should be 12 slots, got ${createSlots}`);
    failed += 1;
  } else {
    console.log("PASS: fixed create menu is 4 days × 3 meals = 12 slots");
  }
  const covered = new Set(MENU_DAY_PAIRS.flat());
  if (
    MENU_DAY_PAIRS.length !== 2 ||
    covered.size !== FIXED_MENU_DAY_COUNT ||
    ![1, 2, 3, 4].every((d) => covered.has(d))
  ) {
    console.error("FAIL: MENU_DAY_PAIRS must cover days 1–4 as [1,2] and [3,4]");
    failed += 1;
  } else {
    console.log("PASS: MENU_DAY_PAIRS are hard 1–2 and 3–4");
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
  if (
    !p1 ||
    p1[0] !== 1 ||
    p1[1] !== 2 ||
    !p3 ||
    p3[0] !== 3 ||
    p3[1] !== 4 ||
    p5 != null
  ) {
    console.error("FAIL: menuDayPairForDay mapping");
    failed += 1;
  } else {
    console.log("PASS: menuDayPairForDay maps 1→[1,2], 3→[3,4]");
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
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

const dishSlots = [
  { recipeId: "a", recipeName: "Каша", dayIndex: 1 },
  { recipeId: "a", recipeName: "Каша", dayIndex: 2 },
  { recipeId: "b", recipeName: "Суп", dayIndex: 1 },
  { recipeId: "b", recipeName: "Суп", dayIndex: 2 },
  { recipeId: "b", recipeName: "Суп", dayIndex: 3 },
  { recipeId: null, recipeName: null, dayIndex: 3 },
];
const dishes = summarizeMenuDishes(dishSlots);
if (
  dishes.length === 2 &&
  dishes[0].name === "Суп" &&
  dishes[0].dayCount === 3 &&
  dishes[1].name === "Каша" &&
  dishes[1].dayCount === 2
) {
  console.log("PASS: summarizeMenuDishes aggregates day counts");
} else {
  console.error("FAIL: summarizeMenuDishes", dishes);
  failed += 1;
}

for (const [n, label] of [
  [1, "1 день"],
  [2, "2 дня"],
  [3, "3 дня"],
  [5, "5 дней"],
  [11, "11 дней"],
  [21, "21 день"],
]) {
  const got = formatDishDayCount(n);
  if (got === label) {
    console.log(`PASS: formatDishDayCount(${n})`);
  } else {
    console.error(`FAIL: formatDishDayCount(${n}) → ${got}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}

console.log("All menu skeleton logic cases passed");
