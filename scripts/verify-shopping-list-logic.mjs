/**
 * Pure logic checks for Shopping list quantity, dish-source merge, curated copy.
 * Usage: node scripts/verify-shopping-list-logic.mjs
 */

const UNIT_LABEL_RU = {
  g: "г",
  ml: "мл",
  pcs: "шт",
  tsp: "ч. л.",
  tbsp: "ст. л.",
};

function roundQuantity(amount, unit) {
  if (unit === "pcs") return Math.max(1, Math.ceil(amount));
  if (unit === "tsp" || unit === "tbsp") return Math.round(amount * 2) / 2;
  if (amount >= 100) return Math.round(amount / 5) * 5;
  if (amount >= 10) return Math.round(amount);
  return Math.round(amount * 10) / 10;
}

function formatQuantity(amount, unit) {
  if (amount == null || unit == null) return null;
  if (amount <= 0) return null;
  const rounded = roundQuantity(amount, unit);
  const num =
    Number.isInteger(rounded) || rounded >= 10
      ? String(Math.round(rounded))
      : String(rounded).replace(".", ",");
  return `${num} ${UNIT_LABEL_RU[unit]}`;
}

function formatLineLabel(ingredientName, amount, unit) {
  const qty = formatQuantity(amount, unit);
  return qty ? `${ingredientName} — ${qty}` : ingredientName;
}

/** Mirror of src/domain/suggestions/dish-similarity.ts normalizeDishName */
function normalizeDishName(name) {
  return name
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shoppingProductKey(name, unit) {
  return `${normalizeDishName(name)}|${unit ?? ""}`;
}

function contributionKey(dishId, productKey) {
  return `${dishId}::${productKey}`;
}

function formatCuratedShoppingCopy(lines) {
  if (lines.length === 0) return "Список покупок пуст.";
  const body = lines.map(
    (line) =>
      `• ${formatLineLabel(line.ingredientName, line.quantityAmount, line.quantityUnit)}`,
  );
  return ["Список покупок", "", ...body].join("\n");
}

function addProductContribution(cart, contributed, dishId, product) {
  const cKey = contributionKey(dishId, product.productKey);
  if (contributed.has(cKey)) return;
  const existing = cart.get(product.productKey);
  if (!existing) {
    cart.set(product.productKey, {
      productKey: product.productKey,
      ingredientName: product.name,
      quantityAmount: product.quantityAmount,
      quantityUnit: product.quantityUnit,
    });
  } else if (
    existing.quantityAmount != null &&
    product.quantityAmount != null &&
    existing.quantityUnit === product.quantityUnit
  ) {
    existing.quantityAmount += product.quantityAmount;
  }
  contributed.add(cKey);
}

function addProductAcrossAllDishes(cart, contributed, dishes, productKey) {
  for (const dish of dishes) {
    const product = dish.products.find((p) => p.productKey === productKey);
    if (!product) continue;
    addProductContribution(cart, contributed, dish.id, product);
  }
}

function removeCuratedProduct(cart, contributed, productKey) {
  cart.delete(productKey);
  for (const key of [...contributed]) {
    if (key.endsWith(`::${productKey}`)) contributed.delete(key);
  }
}

function pruneOrphanProductKeys(dishes, productKeys) {
  const present = new Set();
  for (const dish of dishes) {
    for (const product of dish.products) {
      present.add(product.productKey);
    }
  }
  const seen = new Set();
  const kept = [];
  for (const key of productKeys) {
    if (!present.has(key) || seen.has(key)) continue;
    seen.add(key);
    kept.push(key);
  }
  return kept;
}

function hydrateCuratedCartFromKeys(dishes, productKeys) {
  const cart = new Map();
  const contributed = new Set();
  const appliedKeys = [];
  for (const key of pruneOrphanProductKeys(dishes, productKeys)) {
    addProductAcrossAllDishes(cart, contributed, dishes, key);
    if (cart.has(key)) appliedKeys.push(key);
  }
  return { cart, contributed, appliedKeys };
}

/** Mirror of shopping-live-sync-logic shouldApplyRemoteShoppingRefresh */
function shouldApplyRemoteShoppingRefresh(isPending) {
  return !isPending;
}

/** Aggregate amount_per_serving × servings by name+unit (legacy flat snapshot). */
function scaledIngredientAmount(row, servings) {
  if (!row.unit || row.amount_per_serving <= 0) return null;
  return row.amount_per_serving * servings;
}

function ingredientKey(row, scaled) {
  const unit = scaled == null ? "" : row.unit;
  return `${row.kind}|${row.name.toLowerCase()}|${unit}`;
}

function createShoppingLine(row, scaled) {
  return {
    ingredientName: row.name,
    lineKind: row.kind === "pantry" ? "pantry" : "ingredient",
    quantityAmount: scaled,
    quantityUnit: scaled == null ? null : row.unit,
  };
}

function addToExistingLine(existing, scaled, unit) {
  if (
    existing.quantityAmount != null &&
    scaled != null &&
    existing.quantityUnit === unit
  ) {
    existing.quantityAmount += scaled;
  }
}

function aggregateLines(slots, ingredientsByRecipe) {
  const byKey = new Map();
  for (const slot of slots) {
    const ings = ingredientsByRecipe[slot.recipe_id] ?? [];
    for (const row of ings) {
      const scaled = scaledIngredientAmount(row, slot.servings);
      const key = ingredientKey(row, scaled);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, createShoppingLine(row, scaled));
        continue;
      }
      addToExistingLine(existing, scaled, row.unit);
    }
  }
  return [...byKey.values()];
}

const empty = formatCuratedShoppingCopy([]);
if (empty !== "Список покупок пуст.") {
  console.error("FAIL empty", empty);
  process.exit(1);
}

const text = formatCuratedShoppingCopy([
  {
    ingredientName: "курица",
    quantityAmount: 360,
    quantityUnit: "g",
  },
  {
    ingredientName: "соль",
    quantityAmount: 4,
    quantityUnit: "g",
  },
  {
    ingredientName: "йогурт",
    quantityAmount: null,
    quantityUnit: null,
  },
]);

if (!text.includes("курица — 360 г") || !text.includes("соль — 4 г")) {
  console.error("FAIL qty copy", text);
  process.exit(1);
}
if (!text.includes("йогурт") || text.includes("йогурт —")) {
  console.error("FAIL snack no qty", text);
  process.exit(1);
}
if (text.includes("Блюда:") || text.includes("Базовые продукты:") || text.includes("Перекусы:")) {
  console.error("FAIL no kind sections", text);
  process.exit(1);
}

const saltKey = shoppingProductKey("Соль", "g");
const dishes = [
  {
    id: "fish",
    products: [
      { productKey: saltKey, name: "Соль", quantityAmount: 4, quantityUnit: "g" },
    ],
  },
  {
    id: "carrot",
    products: [
      { productKey: saltKey, name: "соль", quantityAmount: 4, quantityUnit: "g" },
    ],
  },
  {
    id: "pasta",
    products: [
      { productKey: saltKey, name: "соль", quantityAmount: 8, quantityUnit: "g" },
    ],
  },
];
const cart = new Map();
const contributed = new Set();
addProductAcrossAllDishes(cart, contributed, dishes, saltKey);
// idempotent re-add
addProductAcrossAllDishes(cart, contributed, dishes, saltKey);

const salt = cart.get(saltKey);
if (!salt || salt.quantityAmount !== 16) {
  console.error("FAIL merge salt across dishes", salt);
  process.exit(1);
}
if (
  !contributed.has(contributionKey("fish", saltKey)) ||
  !contributed.has(contributionKey("carrot", saltKey)) ||
  !contributed.has(contributionKey("pasta", saltKey))
) {
  console.error("FAIL contributions", contributed);
  process.exit(1);
}

removeCuratedProduct(cart, contributed, saltKey);
if (cart.has(saltKey) || contributed.size !== 0) {
  console.error("FAIL remove clears contributions", cart, contributed);
  process.exit(1);
}

const pepperKeyYe = shoppingProductKey("Перец черный молотый", "g");
const pepperKeyYo = shoppingProductKey("Перец чёрный молотый", "g");
if (pepperKeyYe !== pepperKeyYo) {
  console.error("FAIL ё/е normalize", pepperKeyYe, pepperKeyYo);
  process.exit(1);
}
const pepperDishes = [
  {
    id: "salad",
    products: [
      {
        productKey: pepperKeyYe,
        name: "Перец черный молотый",
        quantityAmount: 4,
        quantityUnit: "g",
      },
    ],
  },
  {
    id: "fish2",
    products: [
      {
        productKey: pepperKeyYo,
        name: "Перец чёрный молотый",
        quantityAmount: 2,
        quantityUnit: "g",
      },
    ],
  },
];
const pepperCart = new Map();
const pepperContrib = new Set();
addProductAcrossAllDishes(pepperCart, pepperContrib, pepperDishes, pepperKeyYe);
const pepper = pepperCart.get(pepperKeyYe);
if (!pepper || pepper.quantityAmount !== 6) {
  console.error("FAIL merge pepper ё/е", pepper);
  process.exit(1);
}

const creamA = shoppingProductKey("сливки 20%", "ml");
const creamB = shoppingProductKey("сливки 20 %", "ml");
if (creamA !== creamB) {
  console.error("FAIL punctuation/space normalize", creamA, creamB);
  process.exit(1);
}

const agg = aggregateLines(
  [
    { recipe_id: "a", servings: 2 },
    { recipe_id: "a", servings: 2 },
  ],
  {
    a: [{ name: "курица", kind: "critical", amount_per_serving: 120, unit: "g" }],
  },
);
if (agg.length !== 1 || agg[0].quantityAmount !== 480) {
  console.error("FAIL aggregate", agg);
  process.exit(1);
}

if (formatQuantity(2.4, "pcs") !== "3 шт") {
  console.error("FAIL pcs ceil", formatQuantity(2.4, "pcs"));
  process.exit(1);
}

const orphanKey = shoppingProductKey("исчезнувший", "g");
const hydrate = hydrateCuratedCartFromKeys(dishes, [saltKey, orphanKey, saltKey]);
if (
  hydrate.appliedKeys.length !== 1 ||
  hydrate.appliedKeys[0] !== saltKey ||
  hydrate.cart.get(saltKey)?.quantityAmount !== 16
) {
  console.error("FAIL hydrate applies live keys + qty", hydrate);
  process.exit(1);
}
if (hydrate.cart.has(orphanKey)) {
  console.error("FAIL hydrate must drop orphans", hydrate.cart);
  process.exit(1);
}

const pruned = pruneOrphanProductKeys(dishes, [saltKey, orphanKey, saltKey]);
if (pruned.length !== 1 || pruned[0] !== saltKey) {
  console.error("FAIL prune orphans + dedupe", pruned);
  process.exit(1);
}

if (shouldApplyRemoteShoppingRefresh(false) !== true) {
  console.error("FAIL idle → apply remote shopping refresh");
  process.exit(1);
}
if (shouldApplyRemoteShoppingRefresh(true) !== false) {
  console.error("FAIL pending → skip remote shopping refresh");
  process.exit(1);
}

console.log(
  "PASS: shopping list quantity + curated merge + hydrate/prune + copy logic",
);
