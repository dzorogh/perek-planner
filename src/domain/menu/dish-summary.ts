import type { MenuSlotView } from "@/domain/menu/load-menu";
import { recipeBatchScale } from "@/domain/recipes/batch-scale";
import {
  EMPTY_PER_SERVING,
  scalePerServing,
  type RecipePerServingValue,
  type ScaledRecipeTotals,
} from "@/domain/recipes/scale-totals";

export type MenuDishSummary = {
  recipeId: string;
  name: string;
  dayCount: number;
  days: number[];
  value: RecipePerServingValue;
  batchTotals: ScaledRecipeTotals;
};

/** Aggregate cookable recipes in a menu with how many distinct days each spans. */
export function summarizeMenuDishes(slots: MenuSlotView[]): MenuDishSummary[] {
  const byRecipe = new Map<
    string,
    { name: string; days: Set<number>; value: RecipePerServingValue }
  >();

  for (const slot of slots) {
    const dishes: Array<{
      id: string;
      name: string;
      value: RecipePerServingValue;
    }> = [];
    if (slot.recipeId && slot.recipeName) {
      dishes.push({
        id: slot.recipeId,
        name: slot.recipeName,
        value: slot.recipeValue,
      });
    }
    if (slot.companionRecipeId && slot.companionRecipeName) {
      dishes.push({
        id: slot.companionRecipeId,
        name: slot.companionRecipeName,
        value: slot.companionRecipeValue,
      });
    }
    for (const dish of dishes) {
      const entry = byRecipe.get(dish.id) ?? {
        name: dish.name,
        days: new Set<number>(),
        value: dish.value ?? { ...EMPTY_PER_SERVING },
      };
      entry.days.add(slot.dayIndex);
      byRecipe.set(dish.id, entry);
    }
  }

  const out: MenuDishSummary[] = [];
  for (const [recipeId, entry] of byRecipe) {
    const days = [...entry.days].sort((a, b) => a - b);
    const batch = recipeBatchScale(slots, recipeId);
    out.push({
      recipeId,
      name: entry.name,
      dayCount: days.length,
      days,
      value: entry.value,
      batchTotals: scalePerServing(entry.value, batch.totalServings),
    });
  }

  out.sort((a, b) => {
    if (b.dayCount !== a.dayCount) return b.dayCount - a.dayCount;
    return a.name.localeCompare(b.name, "ru");
  });

  return out;
}

/** Russian day-count label: 1 день / 2 дня / 5 дней. */
export function formatDishDayCount(dayCount: number): string {
  const n = Math.max(0, Math.floor(dayCount));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}
