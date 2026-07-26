/**
 * Pure meal template / composition matrix (Story 6.1).
 * Usage: node scripts/verify-meal-composition-logic.mjs
 */

const PLATE_ROLES = ["main", "soup", "protein", "veg", "carb", "fruit", "snack"];

const MEAL_TEMPLATES = {
  breakfast: ["main", "fruit"],
  second_breakfast: ["main"],
  afternoon_snack: ["main"],
  lunch: ["soup", "protein", "veg", "carb"],
  dinner: ["protein", "veg", "carb"],
  late_dinner: ["protein", "veg", "carb"],
  snack: ["snack"],
};

function openRolesAfterCovers(templateRoles, coversRoles) {
  if (!coversRoles?.length) return [...templateRoles];
  const covered = new Set(coversRoles);
  return templateRoles.filter((r) => !covered.has(r));
}

function assertTemplateShape(meal) {
  const roles = MEAL_TEMPLATES[meal];
  const HARVARD = ["protein", "veg", "carb"];
  if (meal === "lunch") {
    return (
      roles[0] === "soup" &&
      roles.slice(1).every((r, i) => r === HARVARD[i])
    );
  }
  if (meal === "dinner" || meal === "late_dinner") {
    return (
      !roles.includes("soup") &&
      roles.every((r, i) => r === HARVARD[i])
    );
  }
  if (meal === "breakfast") {
    return (
      roles.length === 2 && roles[0] === "main" && roles[1] === "fruit"
    );
  }
  if (meal === "second_breakfast" || meal === "afternoon_snack") {
    return roles.length === 1 && roles[0] === "main";
  }
  if (meal === "snack") {
    return roles.length === 1 && roles[0] === "snack";
  }
  return false;
}

let failed = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failed += 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

check("lunch has soup + Harvard", assertTemplateShape("lunch"));
check("dinner Harvard no soup", assertTemplateShape("dinner"));
check("late_dinner Harvard no soup", assertTemplateShape("late_dinner"));
check("breakfast main + fruit", assertTemplateShape("breakfast"));
check("afternoon_snack is main (Полдник ≠ Перекус)", assertTemplateShape("afternoon_snack"));
check("snack is snack (Перекус)", assertTemplateShape("snack"));

const plovOpen = openRolesAfterCovers(MEAL_TEMPLATES.lunch, [
  "protein",
  "carb",
]);
check(
  "plov covers protein+carb → lunch open soup+veg",
  plovOpen.length === 2 &&
    plovOpen.includes("soup") &&
    plovOpen.includes("veg") &&
    !plovOpen.includes("protein") &&
    !plovOpen.includes("carb"),
);

const dinnerOpen = openRolesAfterCovers(MEAL_TEMPLATES.dinner, [
  "protein",
  "carb",
]);
check(
  "plov on dinner → open veg only",
  dinnerOpen.length === 1 && dinnerOpen[0] === "veg",
);

check(
  "plate roles vocabulary",
  PLATE_ROLES.includes("soup") &&
    PLATE_ROLES.includes("fruit") &&
    PLATE_ROLES.includes("snack"),
);

/** emitRoleSlots-equivalent (inline): open roles × meals × day pairs. */
function emitRoleSlots(meals, dayPairs, priorCoversByKey) {
  const out = [];
  for (const dayPair of dayPairs) {
    for (const meal of meals) {
      if (!MEAL_TEMPLATES[meal] || meal === "snack") continue;
      const key = `${meal}:${dayPair[0]}-${dayPair[1]}`;
      const open = openRolesAfterCovers(
        MEAL_TEMPLATES[meal],
        priorCoversByKey?.get(key),
      );
      for (const plateRole of open) {
        out.push({ meal, dayPair, plateRole });
      }
    }
  }
  return out;
}

function filterCoversToMeal(meal, covers) {
  if (!covers?.length) return null;
  const template = new Set(MEAL_TEMPLATES[meal] ?? []);
  const out = covers.filter((r) => template.has(r));
  return out.length > 0 ? out : null;
}

function remainingOpenRoles(meal, dishes) {
  const template = new Set(MEAL_TEMPLATES[meal] ?? []);
  const covered = new Set();
  for (const d of dishes) {
    if (template.has(d.plateRole)) covered.add(d.plateRole);
    for (const r of filterCoversToMeal(meal, d.coversRoles) ?? []) {
      covered.add(r);
    }
  }
  return openRolesAfterCovers(MEAL_TEMPLATES[meal], [...covered]);
}

const lunchSlots = emitRoleSlots(["lunch"], [[1, 2]]);
check(
  "emitRoleSlots lunch = soup+harvard",
  lunchSlots.map((s) => s.plateRole).join(",") === "soup,protein,veg,carb",
);

const dinnerSlots = emitRoleSlots(["dinner"], [[1, 2]]);
check(
  "emitRoleSlots dinner = harvard no soup",
  dinnerSlots.map((s) => s.plateRole).join(",") === "protein,veg,carb" &&
    !dinnerSlots.some((s) => s.plateRole === "soup"),
);

const afternoonSlots = emitRoleSlots(["afternoon_snack"], [[1, 2]]);
check(
  "emitRoleSlots afternoon_snack = main (≠ snack)",
  afternoonSlots.length === 1 && afternoonSlots[0].plateRole === "main",
);

const snackSlots = emitRoleSlots(["snack"], [[1, 2]]);
check("emitRoleSlots never emits snack meal", snackSlots.length === 0);

const plovPlan = [
  { plateRole: "protein", coversRoles: ["protein", "carb"] },
];
const plovRemaining = remainingOpenRoles("lunch", plovPlan);
check(
  "plov covers leave soup+veg open",
  plovRemaining.join(",") === "soup,veg",
);

const coversPrior = new Map([
  ["lunch:1-2", ["protein", "carb"]],
]);
const lunchAfterPlov = emitRoleSlots(["lunch"], [[1, 2]], coversPrior);
check(
  "emitRoleSlots with prior covers skips protein+carb",
  lunchAfterPlov.map((s) => s.plateRole).join(",") === "soup,veg",
);

check(
  "covers_roles soup on dinner ignored for completeness",
  remainingOpenRoles("dinner", [
    { plateRole: "protein", coversRoles: ["protein", "carb", "soup"] },
  ]).join(",") === "veg",
);

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("All meal composition checks passed");
