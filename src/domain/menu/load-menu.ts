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
    const slot = mapMenuSlot(row, menu.day_count);
    if (!slot) {
      return { menu: null, error: "Слоты меню повреждены." };
    }
    mapped.push(slot);
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

function mapMenuSlot(
  row: {
    id: string;
    day_index: number;
    meal: unknown;
    recipe_id: string | null;
    companion_recipe_id: string | null;
    servings: unknown;
    recipes: unknown;
    companion?: unknown;
  },
  dayCount: number,
): MenuSlotView | null {
  if (
    typeof row.meal !== "string" ||
    !isMealSlot(row.meal) ||
    row.day_index < 1 ||
    row.day_index > dayCount
  ) {
    return null;
  }
  const recipe = unwrapRecipe(row.recipes as RecipeJoin | RecipeJoin[] | null);
  const companion = unwrapRecipe(row.companion as RecipeJoin | RecipeJoin[] | null);
  return {
    id: row.id,
    dayIndex: row.day_index,
    meal: row.meal,
    recipeId: row.recipe_id,
    recipeName: recipe?.name ?? null,
    recipeBodyText: recipe?.body_text ?? null,
    recipeIngredients: mapIngredientRows(recipe?.critical_ingredients),
    recipeValue: recipe ? mapPerServingValue(recipe) : { ...EMPTY_PER_SERVING },
    companionRecipeId: row.companion_recipe_id ?? null,
    companionRecipeName: companion?.name ?? null,
    companionRecipeBodyText: companion?.body_text ?? null,
    companionRecipeIngredients: mapIngredientRows(companion?.critical_ingredients),
    companionRecipeValue: companion
      ? mapPerServingValue(companion)
      : { ...EMPTY_PER_SERVING },
    servings: typeof row.servings === "number" ? row.servings : 2,
  };
}
