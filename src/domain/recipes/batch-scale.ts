export type RecipeBatchScale = {
  /** Sum of slot servings for this recipe (people × meal occurrences). */
  totalServings: number;
  /** Typical people count per meal slot (mode / average of slot servings). */
  peoplePerMeal: number;
  /** Distinct calendar days this recipe appears on. */
  dayCount: number;
};

type SlotLike = {
  recipeId: string | null;
  /** All dish recipe ids on the slot (soup/veg/carb/…). */
  dishRecipeIds?: readonly (string | null | undefined)[] | null;
  dishes?: ReadonlyArray<{ recipeId: string | null }> | null;
  dayIndex: number;
  servings: number;
};

function slotUsesRecipe(slot: SlotLike, recipeId: string): boolean {
  if (slot.recipeId === recipeId) return true;
  if (slot.dishRecipeIds?.includes(recipeId)) return true;
  if (slot.dishes?.some((d) => d.recipeId === recipeId)) return true;
  return false;
}

/**
 * Batch scale for a recipe on a menu — matches shopping-list aggregation
 * (amount_per_serving × each slot's servings, summed). Counts primary
 * shim and role-labeled dish placements.
 */
export function recipeBatchScale(
  slots: readonly SlotLike[],
  recipeId: string,
): RecipeBatchScale {
  let totalServings = 0;
  const days = new Set<number>();
  const peopleCounts: number[] = [];

  for (const slot of slots) {
    if (!slotUsesRecipe(slot, recipeId)) continue;
    const people =
      Number.isFinite(slot.servings) && slot.servings >= 1
        ? Math.trunc(slot.servings)
        : 2;
    // Count once per slot even if the recipe covers multiple plate roles.
    totalServings += people;
    days.add(slot.dayIndex);
    peopleCounts.push(people);
  }

  if (peopleCounts.length === 0) {
    return { totalServings: 1, peoplePerMeal: 1, dayCount: 1 };
  }

  // Mode of per-slot people (fallback to first).
  const freq = new Map<number, number>();
  for (const p of peopleCounts) {
    freq.set(p, (freq.get(p) ?? 0) + 1);
  }
  let peoplePerMeal = peopleCounts[0]!;
  let best = 0;
  for (const [p, n] of freq) {
    if (n > best) {
      best = n;
      peoplePerMeal = p;
    }
  }

  return {
    totalServings: Math.max(1, totalServings),
    peoplePerMeal: Math.max(1, peoplePerMeal),
    dayCount: Math.max(1, days.size),
  };
}
