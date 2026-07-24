/**
 * Pure Plate role RU labels / coverage (Story 6.3).
 * Usage: node scripts/verify-plate-role-labels-logic.mjs
 */

const PLATE_ROLE_LABELS_RU = {
  soup: "Суп",
  protein: "Белок",
  veg: "Овощи",
  carb: "Углеводы",
  main: "Основное",
  snack: "Перекус",
};

const PLATE_ROLES = Object.keys(PLATE_ROLE_LABELS_RU);

function isPlateRole(r) {
  return PLATE_ROLES.includes(r);
}

function plateRoleLabelRu(role) {
  return PLATE_ROLE_LABELS_RU[role];
}

function formatRoleCoverage(roles, orderHint) {
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
  return unique.map(plateRoleLabelRu).join(" · ");
}

function dishLineRoleLabel(plateRole, coversRoles, templateOrder) {
  const covered = new Set([plateRole, ...(coversRoles ?? [])]);
  if (covered.size <= 1) return plateRoleLabelRu(plateRole);
  return formatRoleCoverage([...covered], templateOrder);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(plateRoleLabelRu("soup") === "Суп", "soup label");
assert(plateRoleLabelRu("main") === "Основное", "main = Полдник line");
assert(plateRoleLabelRu("snack") === "Перекус", "snack ≠ Полдник");
assert(
  formatRoleCoverage(["carb", "protein"], ["protein", "veg", "carb"]) ===
    "Белок · Углеводы",
  "coverage order follows template",
);
assert(
  dishLineRoleLabel("protein", ["protein", "carb"], [
    "soup",
    "protein",
    "veg",
    "carb",
  ]) === "Белок · Углеводы",
  "one-pot multi-role caption",
);
assert(
  dishLineRoleLabel("veg", null) === "Овощи",
  "single role stays simple",
);
assert(
  !Object.values(PLATE_ROLE_LABELS_RU).some((l) =>
    /гарнир|компаньон/i.test(l),
  ),
  "no abandoned companion copy in labels",
);

console.log("verify-plate-role-labels-logic: ok");
