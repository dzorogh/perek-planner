/**
 * Pure Plate role RU labels / coverage (Story 6.3 + Harvard rename).
 * Usage: node scripts/verify-plate-role-labels-logic.mjs
 */

const PLATE_ROLE_LABELS_RU = {
  soup: "Суп",
  protein: "Полезный белок",
  veg: "Овощи",
  carb: "Цельные злаки",
  fruit: "Фрукты",
  main: "Завтрак",
  snack: "Перекус",
};

const PLATE_ROLES = Object.keys(PLATE_ROLE_LABELS_RU);

function isPlateRole(r) {
  return PLATE_ROLES.includes(r);
}

function plateRoleLabelRu(role, meal) {
  if (role === "main" && meal && meal !== "breakfast") {
    return "Основное";
  }
  return PLATE_ROLE_LABELS_RU[role];
}

function formatRoleCoverage(roles, orderHint, meal) {
  const unique = [];
  for (const r of roles) {
    if (!isPlateRole(r) || unique.includes(r)) continue;
    unique.push(r);
  }
  if (unique.length === 0) return "";
  if (orderHint?.length) {
    const rank = new Map(orderHint.map((r, i) => [r, i]));
    unique.sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
  }
  return unique.map((r) => plateRoleLabelRu(r, meal)).join(" · ");
}

function dishLineRoleLabel(plateRole, coversRoles, templateOrder, meal) {
  const covered = new Set([plateRole, ...(coversRoles ?? [])]);
  if (covered.size <= 1) return plateRoleLabelRu(plateRole, meal);
  return formatRoleCoverage([...covered], templateOrder, meal);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(plateRoleLabelRu("soup") === "Суп", "soup label");
assert(plateRoleLabelRu("main") === "Завтрак", "main = Завтрак");
assert(
  plateRoleLabelRu("main", "afternoon_snack") === "Основное",
  "main on полдник ≠ Завтрак",
);
assert(plateRoleLabelRu("fruit") === "Фрукты", "fruit");
assert(plateRoleLabelRu("protein") === "Полезный белок", "protein Harvard");
assert(plateRoleLabelRu("carb") === "Цельные злаки", "carb Harvard");
assert(plateRoleLabelRu("snack") === "Перекус", "snack ≠ Полдник");
assert(
  formatRoleCoverage(["carb", "protein"], ["protein", "veg", "carb"]) ===
    "Полезный белок · Цельные злаки",
  "coverage order follows template",
);
assert(
  dishLineRoleLabel("protein", ["protein", "carb"], [
    "soup",
    "protein",
    "veg",
    "carb",
  ]) === "Полезный белок · Цельные злаки",
  "one-pot multi-role caption",
);
assert(
  dishLineRoleLabel("veg", null) === "Овощи",
  "single role stays simple",
);
assert(
  !Object.values(PLATE_ROLE_LABELS_RU).some((l) =>
    /гарнир|компаньон|основное/i.test(l),
  ),
  "no abandoned companion/old main copy in labels",
);

console.log("verify-plate-role-labels-logic: ok");
