/**
 * Per-serving price + KBJU on a recipe. Null fields must stay omitted in UI.
 */
export type RecipePerServingValue = {
  priceCentsPerServing: number | null;
  caloriesKcalPerServing: number | null;
  proteinGPerServing: number | null;
  fatGPerServing: number | null;
  carbsGPerServing: number | null;
};

export type ScaledRecipeTotals = {
  priceCents: number | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
};

export const EMPTY_PER_SERVING: RecipePerServingValue = {
  priceCentsPerServing: null,
  caloriesKcalPerServing: null,
  proteinGPerServing: null,
  fatGPerServing: null,
  carbsGPerServing: null,
};

function scaleNullable(
  perServing: number | null,
  servings: number,
): number | null {
  if (perServing == null) return null;
  if (!Number.isFinite(perServing) || perServing < 0) return null;
  if (!Number.isFinite(servings) || servings < 1) return null;
  return perServing * Math.trunc(servings);
}

/** Scale per-serving fields by a batch / slot servings count. */
export function scalePerServing(
  fields: RecipePerServingValue,
  totalServings: number,
): ScaledRecipeTotals {
  return {
    priceCents: scaleNullable(fields.priceCentsPerServing, totalServings),
    caloriesKcal: scaleNullable(fields.caloriesKcalPerServing, totalServings),
    proteinG: scaleNullable(fields.proteinGPerServing, totalServings),
    fatG: scaleNullable(fields.fatGPerServing, totalServings),
    carbsG: scaleNullable(fields.carbsGPerServing, totalServings),
  };
}

function addKnown(
  acc: number | null,
  next: number | null,
): number | null {
  if (next == null) return acc;
  return (acc ?? 0) + next;
}

type SlotLike = {
  dayIndex?: number;
  servings: number;
  recipeId: string | null;
  companionRecipeId?: string | null;
  recipeValue?: RecipePerServingValue | null;
  companionRecipeValue?: RecipePerServingValue | null;
};

type SnackLike = {
  dayIndex: number;
  value: RecipePerServingValue;
};

export type SumMenuTotalsOptions = {
  snacks?: readonly SnackLike[];
  /** People per meal — same scale as snack slot cards. Default 2. */
  snackServings?: number;
};

const EMPTY_TOTALS: ScaledRecipeTotals = {
  priceCents: null,
  caloriesKcal: null,
  proteinG: null,
  fatG: null,
  carbsG: null,
};

function resolveServings(raw: number | undefined, fallback: number): number {
  if (Number.isFinite(raw) && (raw as number) >= 1) {
    return Math.trunc(raw as number);
  }
  return fallback;
}

function accumulateValue(
  acc: ScaledRecipeTotals,
  value: RecipePerServingValue | null | undefined,
  servings: number,
): ScaledRecipeTotals {
  if (!value) return acc;
  const scaled = scalePerServing(value, servings);
  return {
    priceCents: addKnown(acc.priceCents, scaled.priceCents),
    caloriesKcal: addKnown(acc.caloriesKcal, scaled.caloriesKcal),
    proteinG: addKnown(acc.proteinG, scaled.proteinG),
    fatG: addKnown(acc.fatG, scaled.fatG),
    carbsG: addKnown(acc.carbsG, scaled.carbsG),
  };
}

/**
 * Sum menu totals across main + companion placements (+ optional snacks).
 * Only known values contribute; missing fields stay null if never seen.
 */
export function sumMenuTotals(
  slots: readonly SlotLike[],
  options: SumMenuTotalsOptions = {},
): ScaledRecipeTotals {
  const snacks = options.snacks ?? [];
  const snackServings = resolveServings(options.snackServings, 2);
  let acc: ScaledRecipeTotals = { ...EMPTY_TOTALS };

  for (const slot of slots) {
    const servings = resolveServings(slot.servings, 2);
    if (slot.recipeId) {
      acc = accumulateValue(acc, slot.recipeValue, servings);
    }
    if (slot.companionRecipeId) {
      acc = accumulateValue(acc, slot.companionRecipeValue, servings);
    }
  }

  for (const snack of snacks) {
    acc = accumulateValue(acc, snack.value, snackServings);
  }

  return acc;
}

/** Day column total: slots + snacks for one dayIndex. */
export function sumDayTotals(
  slots: readonly SlotLike[],
  dayIndex: number,
  options: SumMenuTotalsOptions = {},
): ScaledRecipeTotals {
  return sumMenuTotals(
    slots.filter((slot) => slot.dayIndex === dayIndex),
    {
      ...options,
      snacks: (options.snacks ?? []).filter(
        (snack) => snack.dayIndex === dayIndex,
      ),
    },
  );
}

export function hasAnyTotal(totals: ScaledRecipeTotals): boolean {
  return (
    totals.priceCents != null ||
    totals.caloriesKcal != null ||
    totals.proteinG != null ||
    totals.fatG != null ||
    totals.carbsG != null
  );
}

/** Format kopecks as «1 800 ₽». Returns null when missing. */
export function formatPriceRub(priceCents: number | null): string | null {
  if (priceCents == null || !Number.isFinite(priceCents) || priceCents < 0) {
    return null;
  }
  const rub = Math.round(priceCents / 100);
  const formatted = rub.toLocaleString("ru-RU");
  return `${formatted} ₽`;
}

function formatMacroG(value: number | null): string | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  const rounded =
    value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(".", ",");
  return label;
}

/** «450 ккал · Б 25 · Ж 12 · У 40» — omit missing parts. Null if nothing known. */
export function formatKbjuLine(totals: {
  caloriesKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
}): string | null {
  const parts: string[] = [];
  if (totals.caloriesKcal != null && Number.isFinite(totals.caloriesKcal)) {
    parts.push(`${Math.round(totals.caloriesKcal)} ккал`);
  }
  const p = formatMacroG(totals.proteinG);
  const f = formatMacroG(totals.fatG);
  const c = formatMacroG(totals.carbsG);
  if (p != null) parts.push(`Б ${p}`);
  if (f != null) parts.push(`Ж ${f}`);
  if (c != null) parts.push(`У ${c}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Compact slot line: «360 ₽ · 900 ккал» (omit missing). */
export function formatCompactValueLine(totals: ScaledRecipeTotals): string | null {
  const parts: string[] = [];
  const price = formatPriceRub(totals.priceCents);
  if (price) parts.push(price);
  if (totals.caloriesKcal != null && Number.isFinite(totals.caloriesKcal)) {
    parts.push(`${Math.round(totals.caloriesKcal)} ккал`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Dish-dialog secondary line: per-serving price + KBJU.
 * «150 ₽ · 250 ккал · Б 4 · Ж 10 · У 40 на порцию»
 */
export function formatPerServingDetailLine(
  value: RecipePerServingValue,
): string | null {
  const perServing = scalePerServing(value, 1);
  const price = formatPriceRub(perServing.priceCents);
  const kbju = formatKbjuLine(perServing);
  if (!price && !kbju) return null;
  const core = [price, kbju].filter(Boolean).join(" · ");
  return `${core} на порцию`;
}

export function parseNonNegInt(raw: unknown): number | null {
  const n = coerceNumber(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

export function parseNonNegNumber(raw: unknown): number | null {
  const n = coerceNumber(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function coerceNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  return NaN;
}

export function mapPerServingValue(row: {
  price_cents_per_serving?: unknown;
  calories_kcal_per_serving?: unknown;
  protein_g_per_serving?: unknown;
  fat_g_per_serving?: unknown;
  carbs_g_per_serving?: unknown;
} | null | undefined): RecipePerServingValue {
  if (!row) return { ...EMPTY_PER_SERVING };
  return {
    priceCentsPerServing: parseNonNegInt(row.price_cents_per_serving),
    caloriesKcalPerServing: parseNonNegInt(row.calories_kcal_per_serving),
    proteinGPerServing: parseNonNegNumber(row.protein_g_per_serving),
    fatGPerServing: parseNonNegNumber(row.fat_g_per_serving),
    carbsGPerServing: parseNonNegNumber(row.carbs_g_per_serving),
  };
}
