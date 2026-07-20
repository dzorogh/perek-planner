/**
 * Pure logic checks for recipe price/KBJU scale + format.
 * Usage: node scripts/verify-recipe-value-logic.mjs
 */

function scaleNullable(perServing, servings) {
  if (perServing == null) return null;
  if (!Number.isFinite(perServing) || perServing < 0) return null;
  if (!Number.isFinite(servings) || servings < 1) return null;
  return perServing * Math.trunc(servings);
}

function scalePerServing(fields, totalServings) {
  return {
    priceCents: scaleNullable(fields.priceCentsPerServing, totalServings),
    caloriesKcal: scaleNullable(fields.caloriesKcalPerServing, totalServings),
    proteinG: scaleNullable(fields.proteinGPerServing, totalServings),
    fatG: scaleNullable(fields.fatGPerServing, totalServings),
    carbsG: scaleNullable(fields.carbsGPerServing, totalServings),
  };
}

function addKnown(acc, next) {
  if (next == null) return acc;
  return (acc ?? 0) + next;
}

function sumMenuTotals(slots) {
  let priceCents = null;
  let caloriesKcal = null;
  let proteinG = null;
  let fatG = null;
  let carbsG = null;

  for (const slot of slots) {
    const servings =
      Number.isFinite(slot.servings) && slot.servings >= 1
        ? Math.trunc(slot.servings)
        : 2;
    const placements = [];
    if (slot.recipeId) placements.push(slot.recipeValue);
    if (slot.companionRecipeId) placements.push(slot.companionRecipeValue);
    for (const value of placements) {
      if (!value) continue;
      const scaled = scalePerServing(value, servings);
      priceCents = addKnown(priceCents, scaled.priceCents);
      caloriesKcal = addKnown(caloriesKcal, scaled.caloriesKcal);
      proteinG = addKnown(proteinG, scaled.proteinG);
      fatG = addKnown(fatG, scaled.fatG);
      carbsG = addKnown(carbsG, scaled.carbsG);
    }
  }

  return { priceCents, caloriesKcal, proteinG, fatG, carbsG };
}

function formatPriceRub(priceCents) {
  if (priceCents == null || !Number.isFinite(priceCents) || priceCents < 0) {
    return null;
  }
  const rub = Math.round(priceCents / 100);
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

function formatKbjuLine(totals) {
  const parts = [];
  if (totals.caloriesKcal != null && Number.isFinite(totals.caloriesKcal)) {
    parts.push(`${Math.round(totals.caloriesKcal)} ккал`);
  }
  if (totals.proteinG != null) parts.push(`Б ${Math.round(totals.proteinG)}`);
  if (totals.fatG != null) parts.push(`Ж ${Math.round(totals.fatG)}`);
  if (totals.carbsG != null) parts.push(`У ${Math.round(totals.carbsG)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failed += 1;
  } else {
    console.log(`ok: ${name}`);
  }
}

const chicken = {
  priceCentsPerServing: 18000,
  caloriesKcalPerServing: 450,
  proteinGPerServing: 35,
  fatGPerServing: 15,
  carbsGPerServing: 40,
};
const omelette = {
  priceCentsPerServing: 6000,
  caloriesKcalPerServing: 220,
  proteinGPerServing: 14,
  fatGPerServing: 16,
  carbsGPerServing: 3,
};
const unknown = {
  priceCentsPerServing: null,
  caloriesKcalPerServing: null,
  proteinGPerServing: null,
  fatGPerServing: null,
  carbsGPerServing: null,
};

const scaled2 = scalePerServing(chicken, 2);
assert("scale price ×2", scaled2.priceCents === 36000);
assert("scale kcal ×2", scaled2.caloriesKcal === 900);
assert("null stays null", scalePerServing(unknown, 3).priceCents === null);

const totals = sumMenuTotals([
  {
    servings: 2,
    recipeId: "a",
    recipeValue: chicken,
    companionRecipeId: "b",
    companionRecipeValue: omelette,
  },
  {
    servings: 2,
    recipeId: "a",
    recipeValue: chicken,
    companionRecipeId: null,
    companionRecipeValue: null,
  },
]);
assert(
  "menu sum price = 2×chicken + omelette + chicken",
  totals.priceCents === 18000 * 2 + 6000 * 2 + 18000 * 2,
);
assert(
  "menu sum kcal",
  totals.caloriesKcal === 450 * 2 + 220 * 2 + 450 * 2,
);

const partial = sumMenuTotals([
  {
    servings: 2,
    recipeId: "a",
    recipeValue: chicken,
  },
  {
    servings: 2,
    recipeId: "x",
    recipeValue: unknown,
  },
]);
assert("partial sum uses known only", partial.priceCents === 36000);
assert(
  "all-null menu totals stay null",
  sumMenuTotals([
    { servings: 2, recipeId: "x", recipeValue: unknown },
  ]).priceCents === null,
);

assert("format price", formatPriceRub(18000) === "180 ₽");
assert("format null price", formatPriceRub(null) === null);

/** Mirrors inventPriceToKopecks in invent-recipes.ts */
function inventPriceToKopecks(row) {
  const MAX_RUB = 400;
  const LEGACY_MAX = 5000;
  const parseInt = (raw) => {
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(n) || n < 0 || n === 0) return null;
    return Math.trunc(n);
  };
  const rub = parseInt(row.price_rub_per_serving ?? row.priceRubPerServing);
  if (rub != null) {
    if (rub > MAX_RUB) return null;
    return rub * 100;
  }
  const cents = parseInt(
    row.price_cents_per_serving ?? row.priceCentsPerServing,
  );
  if (cents == null) return null;
  if (cents < LEGACY_MAX) {
    if (cents > MAX_RUB) return null;
    return cents * 100;
  }
  if (cents > MAX_RUB * 100) return null;
  return cents;
}

assert(
  "invent price_rub → kopecks",
  inventPriceToKopecks({ price_rub_per_serving: 200 }) === 20000,
);
assert(
  "legacy cents-as-rubles heuristic",
  inventPriceToKopecks({ price_cents_per_serving: 200 }) === 20000,
);
assert(
  "legacy real kopecks kept",
  inventPriceToKopecks({ price_cents_per_serving: 18000 }) === 18000,
);
assert(
  "restaurant-like rub omitted",
  inventPriceToKopecks({ price_rub_per_serving: 900 }) === null,
);
assert(
  "absurd rub omitted",
  inventPriceToKopecks({ price_rub_per_serving: 9000 }) === null,
);
assert(
  "format kbju",
  formatKbjuLine({
    caloriesKcal: 450,
    proteinG: 35,
    fatG: 15,
    carbsG: 40,
  }) === "450 ккал · Б 35 · Ж 15 · У 40",
);
assert(
  "omit empty kbju",
  formatKbjuLine({
    caloriesKcal: null,
    proteinG: null,
    fatG: null,
    carbsG: null,
  }) === null,
);

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll recipe-value checks passed.");
