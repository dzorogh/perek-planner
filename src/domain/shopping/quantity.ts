export type IngredientUnit = "g" | "ml" | "pcs" | "tsp" | "tbsp";

const UNIT_LABEL_RU: Record<IngredientUnit, string> = {
  g: "г",
  ml: "мл",
  pcs: "шт",
  tsp: "ч. л.",
  tbsp: "ст. л.",
};

export function isIngredientUnit(value: unknown): value is IngredientUnit {
  return (
    value === "g" ||
    value === "ml" ||
    value === "pcs" ||
    value === "tsp" ||
    value === "tbsp"
  );
}

/** Round grocery quantities for readable display. */
export function roundQuantity(amount: number, unit: IngredientUnit): number {
  if (unit === "pcs") {
    return Math.max(1, Math.ceil(amount));
  }
  if (unit === "tsp" || unit === "tbsp") {
    return Math.round(amount * 2) / 2;
  }
  if (amount >= 100) {
    return Math.round(amount / 5) * 5;
  }
  if (amount >= 10) {
    return Math.round(amount);
  }
  return Math.round(amount * 10) / 10;
}

export function formatQuantity(
  amount: number | null | undefined,
  unit: IngredientUnit | null | undefined,
): string | null {
  if (amount == null || unit == null || !isIngredientUnit(unit)) {
    return null;
  }
  if (!(amount > 0)) return null;
  const rounded = roundQuantity(amount, unit);
  const num =
    Number.isInteger(rounded) || rounded >= 10
      ? String(Math.round(rounded))
      : String(rounded).replace(".", ",");
  return `${num} ${UNIT_LABEL_RU[unit]}`;
}

export function formatLineLabel(
  ingredientName: string,
  amount: number | null | undefined,
  unit: IngredientUnit | null | undefined,
): string {
  const qty = formatQuantity(amount, unit);
  return qty ? `${ingredientName} — ${qty}` : ingredientName;
}
