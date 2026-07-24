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

export type MenuSlotDishView = {
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
};

export type MenuSlotView = {
  id: string;
  dayIndex: number;
  meal: MealSlot;
  /** Role-labeled dishes (Story 6.1). */
  dishes: MenuSlotDishView[];
  /** Legacy shim: primary cookable dish (protein or main). */
  recipeId: string | null;
  recipeName: string | null;
  recipeBodyText: string | null;
  recipeIngredients: RecipeIngredientView[];
  recipeValue: RecipePerServingValue;
  /** Legacy shim: secondary cookable dish if present. */
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
  dish: MenuSlotDishView | null,
  join: RecipeJoin,
): RecipePerServingValue {
  if (dish) return dish.recipeValue;
  return perServingOrEmpty(join);
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

  const [slotsRes, snacksRes] = await Promise.all([
    supabase
      .from("menu_slots")
      .select(
        `id, day_index, meal, recipe_id, companion_recipe_id, servings,
         recipes!menu_slots_recipe_id_fkey(${RECIPE_WITH_INGREDIENTS_SELECT}),
         companion:recipes!menu_slots_companion_recipe_id_fkey(${RECIPE_WITH_INGREDIENTS_SELECT}),
         menu_slot_dishes(
           id, plate_role, sort_order, recipe_id, snack_label,
           recipes(covers_roles, ${RECIPE_WITH_INGREDIENTS_SELECT})
         )`,
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

  const cookable: MenuSlotView[] = [];
  const snacksFromDishes: MenuSnackView[] = [];

  for (const row of slotsRes.data ?? []) {
    const slot = mapMenuSlot(row, menu.day_count);
    if (!slot) {
      return { menu: null, error: "Слоты меню повреждены." };
    }
    if (slot.meal === "snack") {
      const snackDish = slot.dishes.find((d) => d.plateRole === "snack");
      if (snackDish?.snackLabel) {
        snacksFromDishes.push({
          id: snackDish.id,
          dayIndex: slot.dayIndex,
          label: snackDish.snackLabel,
          value: { ...EMPTY_PER_SERVING },
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

  const snacksFromTable: MenuSnackView[] = (snacksRes.data ?? []).map((row) => ({
    id: row.id,
    dayIndex: row.day_index,
    label: row.label,
    value: mapPerServingValue(row),
  }));

  // Merge by day: dish label wins; nutrition from menu_snacks when present.
  const snacks = mergeSnacksByDay(snacksFromDishes, snacksFromTable);

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
    companion_recipe_id: string | null;
    servings: unknown;
    recipes: unknown;
    companion?: unknown;
    menu_slot_dishes?: unknown;
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

  const dishes = mapDishes(row.menu_slot_dishes);
  const recipe = unwrapRecipe(row.recipes as RecipeJoinInput);
  const companion = unwrapRecipe(row.companion as RecipeJoinInput);
  const primary = pickPrimaryDish(dishes);
  const secondary = pickSecondaryDish(dishes, primary?.id ?? null);

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
    companionRecipeId: secondary?.recipeId ?? row.companion_recipe_id ?? null,
    companionRecipeName: secondary?.recipeName ?? companion?.name ?? null,
    companionRecipeBodyText:
      secondary?.recipeBodyText ?? companion?.body_text ?? null,
    companionRecipeIngredients:
      secondary?.recipeIngredients ??
      mapIngredientRows(companion?.critical_ingredients),
    companionRecipeValue: dishOrJoinValue(secondary, companion),
    servings: typeof row.servings === "number" ? row.servings : 2,
  };
}

/** Per-day merge: dish label preferred; keep menu_snacks nutrition when available. */
function mergeSnacksByDay(
  fromDishes: ReadonlyArray<MenuSnackView>,
  fromTable: ReadonlyArray<MenuSnackView>,
): MenuSnackView[] {
  const byDay = new Map<number, MenuSnackView>();
  for (const s of fromTable) {
    byDay.set(s.dayIndex, s);
  }
  for (const s of fromDishes) {
    const existing = byDay.get(s.dayIndex);
    if (!existing) {
      byDay.set(s.dayIndex, s);
      continue;
    }
    byDay.set(s.dayIndex, {
      // Keep menu_snacks.id — snack actions query that table, not dish row ids.
      id: existing.id,
      dayIndex: s.dayIndex,
      label: s.label,
      value: existing.value,
    });
  }
  return [...byDay.values()].sort((a, b) => a.dayIndex - b.dayIndex);
}

function pickPrimaryDish(dishes: MenuSlotDishView[]): MenuSlotDishView | null {
  return (
    dishes.find((d) => d.plateRole === "protein" || d.plateRole === "main") ??
    dishes.find((d) => d.recipeId) ??
    null
  );
}

function pickSecondaryDish(
  dishes: MenuSlotDishView[],
  primaryId: string | null,
): MenuSlotDishView | null {
  return (
    dishes.find(
      (d) =>
        d.recipeId &&
        d.id !== primaryId &&
        (d.plateRole === "carb" ||
          d.plateRole === "veg" ||
          d.plateRole === "soup"),
    ) ?? null
  );
}

type DishRowRaw = {
  id?: unknown;
  plate_role?: unknown;
  sort_order?: unknown;
  recipe_id?: unknown;
  snack_label?: unknown;
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

function mapOneDish(r: DishRowRaw): MenuSlotDishView | null {
  if (typeof r.id !== "string") return null;
  if (typeof r.plate_role !== "string" || !isPlateRole(r.plate_role)) {
    return null;
  }
  const recipe = unwrapRecipe(r.recipes as RecipeJoinInput);
  return {
    id: r.id,
    plateRole: r.plate_role,
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    recipeId: typeof r.recipe_id === "string" ? r.recipe_id : null,
    recipeName: recipe?.name ?? null,
    recipeBodyText: recipe?.body_text ?? null,
    recipeIngredients: mapIngredientRows(recipe?.critical_ingredients),
    recipeValue: perServingOrEmpty(recipe),
    coversRoles: parseCoversRolesFromRecipe(recipe?.covers_roles),
    snackLabel: typeof r.snack_label === "string" ? r.snack_label : null,
  };
}

function mapDishes(raw: unknown): MenuSlotDishView[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuSlotDishView[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const dish = mapOneDish(row as DishRowRaw);
    if (dish) out.push(dish);
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
}
