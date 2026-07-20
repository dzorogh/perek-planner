import type { SupabaseClient } from "@supabase/supabase-js";

import type { RatingValue } from "@/domain/history/constants";
import { recipeBatchScale } from "@/domain/recipes/batch-scale";
import {
  mapIngredientRows,
  RECIPE_HISTORY_WITH_INGREDIENTS_SELECT,
  type RecipeIngredientView,
} from "@/domain/recipes/load-recipe";

export type HistoryRecipeRow = {
  recipeId: string;
  recipeName: string;
  bodyText: string;
  ingredients: RecipeIngredientView[];
  totalServings: number;
  peoplePerMeal: number;
  dayCount: number;
  rating: RatingValue | null;
  /** Free-text comment; required for dislike. */
  reason: string | null;
};

export type HistorySnackRow = {
  label: string;
  rating: RatingValue | null;
  reason: string | null;
};

export type HistoryMenuCard = {
  menuId: string;
  dayCount: number;
  createdAt: string;
  recipes: HistoryRecipeRow[];
  snacks: HistorySnackRow[];
};

function asRating(v: string | null): RatingValue | null {
  if (v === "like" || v === "medium" || v === "dislike") return v;
  return null;
}

function asReason(v: string | null): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function loadHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  menus: HistoryMenuCard[];
  error: string | null;
  /** Soft degradation (e.g. ratings query failed) — menus still render. */
  warning?: string | null;
}> {
  const { data: menus, error: menusError } = await supabase
    .from("menus")
    .select("id, day_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (menusError) {
    return { menus: [], error: "Не удалось загрузить историю." };
  }

  if (!menus?.length) {
    return { menus: [], error: null };
  }

  const menuIds = menus.map((m) => m.id);

  const [slotsRes, snacksRes, ratingsRes, snackRatingsRes] = await Promise.all([
    supabase
      .from("menu_slots")
      .select(
        `menu_id, recipe_id, companion_recipe_id, day_index, servings,
         recipes!menu_slots_recipe_id_fkey(${RECIPE_HISTORY_WITH_INGREDIENTS_SELECT}),
         companion:recipes!menu_slots_companion_recipe_id_fkey(${RECIPE_HISTORY_WITH_INGREDIENTS_SELECT})`,
      )
      .in("menu_id", menuIds)
      .not("recipe_id", "is", null),
    supabase
      .from("menu_snacks")
      .select("menu_id, label")
      .in("menu_id", menuIds),
    supabase
      .from("recipe_ratings")
      .select("recipe_id, rating, reason")
      .eq("user_id", userId),
    supabase
      .from("snack_ratings")
      .select("label, rating, reason")
      .eq("user_id", userId),
  ]);

  if (slotsRes.error || snacksRes.error) {
    return { menus: [], error: "Не удалось загрузить историю." };
  }

  const ratingsWarning =
    ratingsRes.error || snackRatingsRes.error
      ? "Не удалось загрузить оценки — меню показаны без звёзд."
      : null;

  const recipeRating = new Map<
    string,
    { rating: RatingValue | null; reason: string | null }
  >();
  (ratingsRes.data ?? []).forEach((row) => {
    recipeRating.set(row.recipe_id, {
      rating: asRating(row.rating),
      reason: asReason(row.reason),
    });
  });

  const snackRating = new Map<
    string,
    { rating: RatingValue | null; reason: string | null }
  >();
  (snackRatingsRes.data ?? []).forEach((row) => {
    snackRating.set(row.label.toLocaleLowerCase("ru"), {
      rating: asRating(row.rating),
      reason: asReason(row.reason),
    });
  });

  const recipesByMenu = new Map<string, HistoryRecipeRow[]>();
  const seenRecipe = new Map<string, Set<string>>();
  const scaleSlotsByMenu = new Map<
    string,
    Array<{
      recipeId: string | null;
      companionRecipeId?: string | null;
      dayIndex: number;
      servings: number;
    }>
  >();
  const recipeMetaByMenu = new Map<
    string,
    Map<
      string,
      {
        name: string;
        bodyText: string;
        ingredients: RecipeIngredientView[];
      }
    >
  >();

  type HistRecipe = {
    id: string;
    name: string;
    body_text: string;
    critical_ingredients?: Parameters<typeof mapIngredientRows>[0];
  };

  function unwrapHist(
    recipes: HistRecipe | HistRecipe[] | null | undefined,
  ): HistRecipe | null {
    if (!recipes) return null;
    return Array.isArray(recipes) ? (recipes[0] ?? null) : recipes;
  }

  (slotsRes.data ?? []).forEach((row) => {
    if (!row.menu_id) return;

    const main = unwrapHist(row.recipes as HistRecipe | HistRecipe[] | null);
    const companion = unwrapHist(
      (row as { companion?: HistRecipe | HistRecipe[] | null }).companion,
    );

    const scaleSlots = scaleSlotsByMenu.get(row.menu_id) ?? [];
    scaleSlots.push({
      recipeId: main?.id ?? row.recipe_id ?? null,
      companionRecipeId:
        companion?.id ??
        (typeof row.companion_recipe_id === "string"
          ? row.companion_recipe_id
          : null),
      dayIndex: typeof row.day_index === "number" ? row.day_index : 1,
      servings: typeof row.servings === "number" ? row.servings : 2,
    });
    scaleSlotsByMenu.set(row.menu_id, scaleSlots);

    let meta = recipeMetaByMenu.get(row.menu_id);
    if (!meta) {
      meta = new Map();
      recipeMetaByMenu.set(row.menu_id, meta);
    }

    let seen = seenRecipe.get(row.menu_id);
    if (!seen) {
      seen = new Set();
      seenRecipe.set(row.menu_id, seen);
    }

    [main, companion].forEach((recipe) => {
      if (!recipe?.id) return;
      if (!meta.has(recipe.id)) {
        meta.set(recipe.id, {
          name: recipe.name,
          bodyText: recipe.body_text ?? "",
          ingredients: mapIngredientRows(recipe.critical_ingredients),
        });
      }
      if (!seen.has(recipe.id)) seen.add(recipe.id);
    });
  });

  recipeMetaByMenu.forEach((meta, menuId) => {
    const scaleSlots = scaleSlotsByMenu.get(menuId) ?? [];
    const list: HistoryRecipeRow[] = [];
    meta.forEach((info, recipeId) => {
      const batch = recipeBatchScale(scaleSlots, recipeId);
      const r = recipeRating.get(recipeId);
      list.push({
        recipeId,
        recipeName: info.name,
        bodyText: info.bodyText,
        ingredients: info.ingredients,
        totalServings: batch.totalServings,
        peoplePerMeal: batch.peoplePerMeal,
        dayCount: batch.dayCount,
        rating: r?.rating ?? null,
        reason: r?.reason ?? null,
      });
    });
    recipesByMenu.set(menuId, list);
  });

  const snacksByMenu = new Map<string, HistorySnackRow[]>();
  const seenSnack = new Map<string, Set<string>>();

  (snacksRes.data ?? []).forEach((row) => {
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label || !row.menu_id) return;
    const key = label.toLocaleLowerCase("ru");
    let seen = seenSnack.get(row.menu_id);
    if (!seen) {
      seen = new Set();
      seenSnack.set(row.menu_id, seen);
    }
    if (seen.has(key)) return;
    seen.add(key);
    const r = snackRating.get(key);
    const list = snacksByMenu.get(row.menu_id) ?? [];
    list.push({
      label,
      rating: r?.rating ?? null,
      reason: r?.reason ?? null,
    });
    snacksByMenu.set(row.menu_id, list);
  });

  return {
    menus: menus.map((m) => ({
      menuId: m.id,
      dayCount: m.day_count,
      createdAt: m.created_at,
      recipes: recipesByMenu.get(m.id) ?? [],
      snacks: snacksByMenu.get(m.id) ?? [],
    })),
    error: null,
    warning: ratingsWarning,
  };
}
