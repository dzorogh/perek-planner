/**
 * Pure logic checks for Shopping list quantity formatting + copy.
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
  if (!(amount > 0)) return null;
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

function formatShoppingListCopy(list) {
  if (list.lines.length === 0) {
    return "Список покупок пуст.";
  }
  const sections = {
    ingredient: [],
    pantry: [],
    snack: [],
  };
  for (const line of list.lines) {
    sections[line.lineKind].push(
      `• ${formatLineLabel(line.ingredientName, line.quantityAmount, line.quantityUnit)}`,
    );
  }
  const parts = ["Список покупок"];
  if (sections.ingredient.length) {
    parts.push("", "Блюда:", ...sections.ingredient);
  }
  if (sections.pantry.length) {
    parts.push("", "Базовые продукты:", ...sections.pantry);
  }
  if (sections.snack.length) {
    parts.push("", "Перекусы:", ...sections.snack);
  }
  return parts.join("\n");
}

/** Aggregate amount_per_serving × servings by name+unit. */
function aggregateLines(slots, ingredientsByRecipe) {
  const byKey = new Map();
  for (const slot of slots) {
    const ings = ingredientsByRecipe[slot.recipe_id] ?? [];
    for (const row of ings) {
      const scaled =
        row.unit && row.amount_per_serving > 0
          ? row.amount_per_serving * slot.servings
          : null;
      const key =
        scaled != null
          ? `${row.kind}|${row.name.toLowerCase()}|${row.unit}`
          : `${row.kind}|${row.name.toLowerCase()}|`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          ingredientName: row.name,
          lineKind: row.kind === "pantry" ? "pantry" : "ingredient",
          quantityAmount: scaled,
          quantityUnit: scaled != null ? row.unit : null,
        });
      } else if (
        existing.quantityAmount != null &&
        scaled != null &&
        existing.quantityUnit === row.unit
      ) {
        existing.quantityAmount += scaled;
      }
    }
  }
  return [...byKey.values()];
}

const empty = formatShoppingListCopy({ lines: [] });
if (empty !== "Список покупок пуст.") {
  console.error("FAIL empty", empty);
  process.exit(1);
}

const text = formatShoppingListCopy({
  lines: [
    {
      ingredientName: "курица",
      lineKind: "ingredient",
      quantityAmount: 360,
      quantityUnit: "g",
    },
    {
      ingredientName: "соль",
      lineKind: "pantry",
      quantityAmount: 4,
      quantityUnit: "g",
    },
    {
      ingredientName: "йогурт",
      lineKind: "snack",
      quantityAmount: null,
      quantityUnit: null,
    },
  ],
});

if (!text.includes("курица — 360 г") || !text.includes("соль — 4 г")) {
  console.error("FAIL qty copy", text);
  process.exit(1);
}
if (!text.includes("йогурт") || text.includes("йогурт —")) {
  console.error("FAIL snack no qty", text);
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

console.log("PASS: shopping list quantity + copy logic");
