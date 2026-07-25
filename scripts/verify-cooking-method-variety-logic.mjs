/**
 * Pure cooking-method variety helpers.
 * Usage: node scripts/verify-cooking-method-variety-logic.mjs
 */

function normalizeDishName(name) {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase("ru");
}

function cookingMethodKey(name) {
  const n = normalizeDishName(name);
  if (!n) return null;
  if (/запеч|в\s+духовк|гратен/.test(n)) return "bake";
  if (/на\s+гриле|гриль/.test(n)) return "grill";
  if (/жар[её]н|жарк|обжар/.test(n)) return "fry";
  if (/туш[её]н/.test(n)) return "stew";
  if (/на\s+пару|паровик/.test(n)) return "steam";
  if (/вар[её]н|отварн|в\s+бульон/.test(n)) return "boil";
  return null;
}

function replacePriority(d) {
  const roleRank = {
    veg: 0,
    carb: 1,
    soup: 2,
    snack: 3,
    protein: 4,
    main: 5,
  };
  return (roleRank[d.plateRole] ?? 9) * 10 - d.dayPair[0];
}

function cookingMethodSpamReplaceTargets(dishes, maxPerMethod = 2) {
  const byMethod = new Map();
  for (const d of dishes) {
    const method = cookingMethodKey(d.name);
    if (!method) continue;
    const list = byMethod.get(method) ?? [];
    list.push(d);
    byMethod.set(method, list);
  }
  const targets = [];
  for (const [, list] of byMethod) {
    if (list.length <= maxPerMethod) continue;
    const sorted = [...list].sort(
      (a, b) => replacePriority(b) - replacePriority(a),
    );
    for (const d of sorted.slice(maxPerMethod)) {
      targets.push({
        meal: d.meal,
        dayPair: d.dayPair,
        plateRole: d.plateRole,
      });
    }
  }
  return targets.slice(0, 6);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(cookingMethodKey("Запечённая курица с пряностями") === "bake", "bake");
assert(cookingMethodKey("Тушёные овощи") === "stew", "stew");
assert(cookingMethodKey("Салат из свежих овощей") === null, "salad no method");
assert(cookingMethodKey("Кус-кус с травами") === null, "couscous no method");

const dinnerSpam = [
  {
    meal: "dinner",
    dayPair: [1, 2],
    plateRole: "protein",
    name: "Запечённая курица с пряностями",
  },
  {
    meal: "dinner",
    dayPair: [1, 2],
    plateRole: "veg",
    name: "Салат из свежих овощей",
  },
  {
    meal: "dinner",
    dayPair: [1, 2],
    plateRole: "carb",
    name: "Картофель, запечённый с розмарином",
  },
  {
    meal: "dinner",
    dayPair: [3, 4],
    plateRole: "protein",
    name: "Свинина, запечённая с грибами",
  },
  {
    meal: "dinner",
    dayPair: [3, 4],
    plateRole: "veg",
    name: "Запечённые овощи",
  },
  {
    meal: "dinner",
    dayPair: [3, 4],
    plateRole: "carb",
    name: "Кус-кус с травами",
  },
];

const targets = cookingMethodSpamReplaceTargets(dinnerSpam, 2);
assert(targets.length === 2, `expected 2 replace targets, got ${targets.length}`);
assert(
  targets.every((t) => t.plateRole === "veg" || t.plateRole === "carb"),
  "prefer replacing sides, not proteins",
);

console.log("verify-cooking-method-variety-logic: ok");
