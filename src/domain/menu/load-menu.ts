import type { SupabaseClient } from "@supabase/supabase-js";

import type { MealSlot } from "@/domain/menu/constants";
import {
  isMealSlot,
  maxSlotCount,
  MEAL_SLOTS,
} from "@/domain/menu/constants";
import {
  mapIngredientRows,
  RECIPE_WITH_INGREDIENTS_SELECT,
  type RecipeIngredientView,
} from "@/domain/recipes/load-recipe";
import {
  EMPTY_PER_SERVING,
  mapPerServingValue,
  type RecipePerServingValue,
} from "@/domain/recipes/scale-totals";

export type MenuSlotView = {
  id: string;
  dayIndex: number;
  meal: MealSlot;
  recipeId: string | null;
  recipeName: string | null;
  recipeBodyText: string | null;
  recipeIngredients: RecipeIngredientView[];
  recipeValue: RecipePerServingValue;
  companionRecipeId: string | null;
  companionRecipeName: string | null;
  companionRecipeBodyText: string | null;
  companionRecipeIngredients: RecipeIngredientView[];
  companionRecipeValue: RecipePerServingValue;
  servings: number;
};

export type MenuSnackView = {
  id: string;
  dayIndex: number;
  label: string;
  value: RecipePerServingValue;
};

export type MenuSkeletonView = {
  id: string;
  dayCount: number;
  slots: MenuSlotView[];
  snacks: MenuSnackView[];
};

type RecipeJoin = {
  name: string;
  body_text: string;
  price_cents_per_serving?: unknown;
  calories_kcal_per_serving?: unknown;
  protein_g_per_serving?: unknown;
  fat_g_per_serving?: unknown;
  carbs_g_per_serving?: unknown;
  critical_ingredients?: Parameters<typeof mapIngredientRows>[0];
} | null;

function unwrapRecipe(
  recipes: RecipeJoin | RecipeJoin[] | null | undefined,
): RecipeJoin {
  if (!recipes) return null;
  return Array.isArray(recipes) ? (recipes[0] ?? null) : recipes;
}

/** Load an owned Menu with slots, recipe names, and snacks. */
export async function loadMenuSkeleton(
  supabase: SupabaseClient,
  menuId: string,
): Promise<{ menu: MenuSkeletonView | null; error: string | null }> {
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id, day_count")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError) {
    return { menu: null, error: "Не удалось загрузить меню." };
  }

  if (!menu) {
    return { menu: null, error: "Меню не найдено." };
  }

  const [slotsRes, snacksRes] = await Promise.all([
    supabase
      .from("menu_slots")
      .select(
        `id, day_index, meal, recipe_id, companion_recipe_id, servings,
         recipes!menu_slots_recipe_id_fkey(${RECIPE_WITH_INGREDIENTS_SELECT}),
         companion:recipes!menu_slots_companion_recipe_id_fkey(${RECIPE_WITH_INGREDIENTS_SELECT})`,
      )
      .eq("menu_id", menuId)
      .order("day_index", { ascending: true }),
    supabase
      .from("menu_snacks")
      .select(
        "id, day_index, label, price_cents_per_serving, calories_kcal_per_serving, protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving",
      )
      .eq("menu_id", menuId)
      .order("day_index", { ascending: true }),
  ]);

  if (slotsRes.error) {
    return { menu: null, error: "Не удалось загрузить слоты меню." };
  }
  if (snacksRes.error) {
    return { menu: null, error: "Не удалось загрузить Snacks." };
  }

  const mapped: MenuSlotView[] = [];
  for (const row of slotsRes.data ?? []) {
    if (!isMealSlot(row.meal)) {
      return { menu: null, error: "Слоты меню повреждены." };
    }
    if (row.day_index < 1 || row.day_index > menu.day_count) {
      return { menu: null, error: "Слоты меню повреждены." };
    }
    const recipeRow = unwrapRecipe(
      row.recipes as RecipeJoin | RecipeJoin[] | null,
    );
    const companionRow = unwrapRecipe(
      (row as { companion?: RecipeJoin | RecipeJoin[] | null }).companion,
    );
    mapped.push({
      id: row.id,
      dayIndex: row.day_index,
      meal: row.meal,
      recipeId: row.recipe_id,
      recipeName: recipeRow?.name ?? null,
      recipeBodyText: recipeRow?.body_text ?? null,
      recipeIngredients: mapIngredientRows(recipeRow?.critical_ingredients),
      recipeValue: recipeRow
        ? mapPerServingValue(recipeRow)
        : { ...EMPTY_PER_SERVING },
      companionRecipeId: row.companion_recipe_id ?? null,
      companionRecipeName: companionRow?.name ?? null,
      companionRecipeBodyText: companionRow?.body_text ?? null,
      companionRecipeIngredients: mapIngredientRows(
        companionRow?.critical_ingredients,
      ),
      companionRecipeValue: companionRow
        ? mapPerServingValue(companionRow)
        : { ...EMPTY_PER_SERVING },
      servings: typeof row.servings === "number" ? row.servings : 2,
    });
  }

  if (mapped.length > maxSlotCount(menu.day_count)) {
    return { menu: null, error: "Слоты меню повреждены." };
  }

  const mealOrder = new Map(MEAL_SLOTS.map((m, i) => [m, i]));
  mapped.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return (mealOrder.get(a.meal) ?? 0) - (mealOrder.get(b.meal) ?? 0);
  });

  const snacks: MenuSnackView[] = (snacksRes.data ?? []).map((row) => ({
    id: row.id,
    dayIndex: row.day_index,
    label: row.label,
    value: mapPerServingValue(row),
  }));

  return {
    menu: {
      id: menu.id,
      dayCount: menu.day_count,
      slots: mapped,
      snacks,
    },
    error: null,
  };
}
