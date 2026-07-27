import type { SupabaseClient } from "@supabase/supabase-js";

import type { MealSlot } from "@/domain/menu/constants";
import {
  isMealSlot,
  maxSlotCount,
  MEAL_SLOTS,
} from "@/domain/menu/constants";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  type EquipmentId,
} from "@/domain/menu/equipment";
import {
  isPlateRole,
  type PlateRole,
} from "@/domain/menu/meal-templates";
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

/** Per-menu cook feedback rating on a Menu dish. */
export type MenuDishRating = "like" | "dislike";

/** Universal menu line: cookable recipe or no-cook snack. */
export type MenuDishView = {
  id: string;
  plateRole: PlateRole;
  sortOrder: number;
  recipeId: string | null;
  recipeName: string | null;
  recipeBodyText: string | null;
  recipeIngredients: RecipeIngredientView[];
  recipeValue: RecipePerServingValue;
  /** Multi-role one-pot coverage from recipes.covers_roles. */
  coversRoles: PlateRole[] | null;
  snackLabel: string | null;
  prepared: boolean;
  rating: MenuDishRating | null;
};

export type MenuSlotView = {
  id: string;
  dayIndex: number;
  meal: MealSlot;
  dishes: MenuDishView[];
  /** Optional primary: protein/main from dishes (or recipe_id). */
  recipeId: string | null;
  recipeName: string | null;
  recipeBodyText: string | null;
  recipeIngredients: RecipeIngredientView[];
  recipeValue: RecipePerServingValue;
  servings: number;
};

/** Snack lane projection of a Menu dish (plate_role=snack). */
export type MenuSnackView = {
  id: string;
  dayIndex: number;
  label: string;
  value: RecipePerServingValue;
  prepared: boolean;
  rating: MenuDishRating | null;
};

export type MenuSkeletonView = {
  id: string;
  dayCount: number;
  availableEquipment: EquipmentId[];
  slots: MenuSlotView[];
  snacks: MenuSnackView[];
};

type RecipeRow = {
  name: string;
  body_text: string;
  covers_roles?: unknown;
  price_cents_per_serving?: unknown;
  calories_kcal_per_serving?: unknown;
  protein_g_per_serving?: unknown;
  fat_g_per_serving?: unknown;
  carbs_g_per_serving?: unknown;
  critical_ingredients?: Parameters<typeof mapIngredientRows>[0];
};

type RecipeJoin = RecipeRow | null;
type RecipeJoinInput = RecipeJoin | RecipeRow[] | null | undefined;

function unwrapRecipe(recipes: RecipeJoinInput): RecipeJoin {
  if (!recipes) return null;
  return Array.isArray(recipes) ? (recipes[0] ?? null) : recipes;
}

function perServingOrEmpty(recipe: RecipeJoin): RecipePerServingValue {
  return recipe ? mapPerServingValue(recipe) : { ...EMPTY_PER_SERVING };
}

function dishOrJoinValue(
  dish: MenuDishView | null,
  join: RecipeJoin,
): RecipePerServingValue {
  if (dish) return dish.recipeValue;
  return perServingOrEmpty(join);
}

function parseDishRating(raw: unknown): MenuDishRating | null {
  if (raw === "like" || raw === "dislike") return raw;
  return null;
}

/** Load an owned Menu with slots, dishes, recipe names, and snacks. */
export async function loadMenuSkeleton(
  supabase: SupabaseClient,
  menuId: string,
): Promise<{ menu: MenuSkeletonView | null; error: string | null }> {
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id, day_count, available_equipment")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError) {
    return { menu: null, error: "Не удалось загрузить меню." };
  }

  if (!menu) {
    return { menu: null, error: "Меню не найдено." };
  }

  const availableEquipment =
    normalizeEquipmentList(menu.available_equipment as string[]) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];

  const slotsRes = await supabase
    .from("menu_slots")
    .select(
      `id, day_index, meal, recipe_id, servings,
       recipes!menu_slots_recipe_id_fkey(${RECIPE_WITH_INGREDIENTS_SELECT}),
       menu_dishes(
         id, plate_role, sort_order, recipe_id, snack_label,
         prepared, rating,
         price_cents_per_serving, calories_kcal_per_serving,
         protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving,
         recipes(covers_roles, ${RECIPE_WITH_INGREDIENTS_SELECT})
       )`,
    )
    .eq("menu_id", menuId)
    .order("day_index", { ascending: true });

  if (slotsRes.error) {
    return { menu: null, error: "Не удалось загрузить слоты меню." };
  }

  const cookable: MenuSlotView[] = [];
  const snacks: MenuSnackView[] = [];

  for (const row of slotsRes.data ?? []) {
    const slot = mapMenuSlot(row, menu.day_count);
    if (!slot) {
      return { menu: null, error: "Слоты меню повреждены." };
    }
    if (slot.meal === "snack") {
      const snackDish = slot.dishes.find((d) => d.plateRole === "snack");
      if (snackDish?.snackLabel) {
        snacks.push({
          id: snackDish.id,
          dayIndex: slot.dayIndex,
          label: snackDish.snackLabel,
          value: snackDish.recipeValue,
          prepared: snackDish.prepared,
          rating: snackDish.rating,
        });
      }
      continue;
    }
    cookable.push(slot);
  }

  if (cookable.length > maxSlotCount(menu.day_count)) {
    return { menu: null, error: "Слоты меню повреждены." };
  }

  const mealOrder = new Map(MEAL_SLOTS.map((m, i) => [m, i]));
  cookable.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return (mealOrder.get(a.meal) ?? 0) - (mealOrder.get(b.meal) ?? 0);
  });

  snacks.sort((a, b) => a.dayIndex - b.dayIndex);

  return {
    menu: {
      id: menu.id,
      dayCount: menu.day_count,
      availableEquipment,
      slots: cookable,
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
    servings: unknown;
    recipes: unknown;
    menu_dishes?: unknown;
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

  const dishes = mapDishes(row.menu_dishes);
  const recipe = unwrapRecipe(row.recipes as RecipeJoinInput);
  const primary = pickPrimaryDish(dishes);

  return {
    id: row.id,
    dayIndex: row.day_index,
    meal: row.meal,
    dishes,
    recipeId: primary?.recipeId ?? row.recipe_id,
    recipeName: primary?.recipeName ?? recipe?.name ?? null,
    recipeBodyText: primary?.recipeBodyText ?? recipe?.body_text ?? null,
    recipeIngredients:
      primary?.recipeIngredients ??
      mapIngredientRows(recipe?.critical_ingredients),
    recipeValue: dishOrJoinValue(primary, recipe),
    servings: typeof row.servings === "number" ? row.servings : 2,
  };
}

function pickPrimaryDish(dishes: MenuDishView[]): MenuDishView | null {
  return (
    dishes.find((d) => d.plateRole === "protein" || d.plateRole === "main") ??
    dishes.find((d) => d.recipeId) ??
    null
  );
}

type DishRowRaw = {
  id?: unknown;
  plate_role?: unknown;
  sort_order?: unknown;
  recipe_id?: unknown;
  snack_label?: unknown;
  prepared?: unknown;
  rating?: unknown;
  price_cents_per_serving?: unknown;
  calories_kcal_per_serving?: unknown;
  protein_g_per_serving?: unknown;
  fat_g_per_serving?: unknown;
  carbs_g_per_serving?: unknown;
  recipes?: unknown;
};

function parseCoversRolesFromRecipe(raw: unknown): PlateRole[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PlateRole[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isPlateRole(item)) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out.length > 0 ? out : null;
}

function mapOneDish(r: DishRowRaw): MenuDishView | null {
  if (typeof r.id !== "string") return null;
  if (typeof r.plate_role !== "string" || !isPlateRole(r.plate_role)) {
    return null;
  }
  const recipe = unwrapRecipe(r.recipes as RecipeJoinInput);
  const snackLabel = typeof r.snack_label === "string" ? r.snack_label : null;
  const recipeValue = snackLabel
    ? mapPerServingValue(r)
    : perServingOrEmpty(recipe);
  return {
    id: r.id,
    plateRole: r.plate_role,
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    recipeId: typeof r.recipe_id === "string" ? r.recipe_id : null,
    recipeName: recipe?.name ?? null,
    recipeBodyText: recipe?.body_text ?? null,
    recipeIngredients: mapIngredientRows(recipe?.critical_ingredients),
    recipeValue,
    coversRoles: parseCoversRolesFromRecipe(recipe?.covers_roles),
    snackLabel,
    prepared: r.prepared === true,
    rating: parseDishRating(r.rating),
  };
}

function mapDishes(raw: unknown): MenuDishView[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuDishView[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const dish = mapOneDish(row as DishRowRaw);
    if (dish) out.push(dish);
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
}
