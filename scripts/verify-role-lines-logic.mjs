/**
 * Menu sheet role lines: one-pot cover rows must not duplicate.
 * Usage: node scripts/verify-role-lines-logic.mjs
 */

const MEAL_TEMPLATES = {
  breakfast: ["main", "fruit"],
  lunch: ["soup", "protein", "veg", "carb"],
  dinner: ["protein", "veg", "carb"],
  snack: ["snack"],
};

function isTemplateMeal(value) {
  return Object.hasOwn(MEAL_TEMPLATES, value);
}

function rolesForMeal(meal) {
  return MEAL_TEMPLATES[meal];
}

function primaryDishByRole(dishes) {
  const byRole = new Map();
  for (const dish of dishes) {
    const prev = byRole.get(dish.plateRole);
    if (!prev || (!prev.recipeId && dish.recipeId)) {
      byRole.set(dish.plateRole, dish);
    }
  }
  return byRole;
}

function rolesCoveredByOnePots(dishes) {
  const covered = new Set();
  for (const dish of dishes) {
    if (!dish.recipeId) continue;
    for (const r of dish.coversRoles ?? []) {
      if (r !== dish.plateRole) covered.add(r);
    }
  }
  return covered;
}

function roleLinesForDishes(meal, dishes) {
  const template = isTemplateMeal(meal) ? rolesForMeal(meal) : ["main"];
  const primaryByRole = primaryDishByRole(dishes);
  const rolesFilledByCover = rolesCoveredByOnePots(dishes);
  const seenRecipeIds = new Set();
  const lines = [];
  for (const role of template) {
    const dish = primaryByRole.get(role) ?? null;
    if (dish?.recipeId) {
      if (seenRecipeIds.has(dish.recipeId)) continue;
      seenRecipeIds.add(dish.recipeId);
    } else if (rolesFilledByCover.has(role)) {
      continue;
    }
    lines.push({ role, dish, template });
  }
  return lines;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const onePot = {
  plateRole: "protein",
  recipeId: "beef-stew",
  coversRoles: ["protein", "carb"],
};
const onePotCarbRow = {
  plateRole: "carb",
  recipeId: "beef-stew",
  coversRoles: ["protein", "carb"],
};
const veg = {
  plateRole: "veg",
  recipeId: "salad",
  coversRoles: null,
};
const soup = {
  plateRole: "soup",
  recipeId: "shchi",
  coversRoles: null,
};

const lunchExpanded = roleLinesForDishes("lunch", [
  soup,
  onePot,
  veg,
  onePotCarbRow,
]);
assert(
  lunchExpanded.map((l) => l.role).join(",") === "soup,protein,veg",
  "expanded one-pot shows once on primary role",
);
assert(
  lunchExpanded.find((l) => l.role === "protein")?.dish?.recipeId ===
    "beef-stew",
  "one-pot kept on protein",
);
assert(
  !lunchExpanded.some((l) => l.role === "carb"),
  "carb cover row omitted",
);

const lunchCoverOnly = roleLinesForDishes("lunch", [soup, onePot, veg]);
assert(
  lunchCoverOnly.map((l) => l.role).join(",") === "soup,protein,veg",
  "empty carb covered by covers_roles omitted",
);

const lunchSeparate = roleLinesForDishes("lunch", [
  soup,
  { plateRole: "protein", recipeId: "chicken", coversRoles: null },
  veg,
  { plateRole: "carb", recipeId: "buckwheat", coversRoles: null },
]);
assert(
  lunchSeparate.map((l) => l.role).join(",") === "soup,protein,veg,carb",
  "distinct protein+carb both visible",
);

console.log("verify-role-lines-logic: ok");
