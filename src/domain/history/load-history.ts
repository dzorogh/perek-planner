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

type HistRecipe = {
  id: string;
  name: string;
  body_text: string;
  critical_ingredients?: Parameters<typeof mapIngredientRows>[0];
};

type RecipeMeta = {
  name: string;
  bodyText: string;
  ingredients: RecipeIngredientView[];
};

type HistRecipeJoin = HistRecipe | HistRecipe[] | null | undefined;

type ScaleSlot = {
  recipeId: string | null;
  dishes?: ReadonlyArray<{ recipeId: string | null }>;
  dayIndex: number;
  servings: number;
};

type SlotScaleMeta = {
  menuId: string;
  dayIndex: number;
  servings: number;
  primaryId: string | null;
};

function mergeDishRecipesIntoHistory(
  dishRows: ReadonlyArray<{
    menu_slot_id: unknown;
    recipes?: unknown;
  }>,
  slotIdToMenu: ReadonlyMap<string, string>,
  slotScaleMeta: ReadonlyMap<string, SlotScaleMeta>,
  recipeMetaByMenu: Map<string, Map<string, RecipeMeta>>,
  seenRecipe: Map<string, Set<string>>,
  scaleSlotsByMenu: Map<string, ScaleSlot[]>,
  slotsWithDishes: Set<string>,
  unwrapHist: (recipes: HistRecipeJoin) => HistRecipe | null,
): void {
  const scaledOnSlot = new Set<string>();
  for (const d of dishRows) {
    const slotId = d.menu_slot_id as string;
    const menuId = slotIdToMenu.get(slotId);
    if (!menuId) continue;
    const recipe = unwrapHist(
      d.recipes as HistRecipe | HistRecipe[] | null | undefined,
    );
    if (!recipe?.id) continue;
    slotsWithDishes.add(slotId);
    let meta = recipeMetaByMenu.get(menuId);
    if (!meta) {
      meta = new Map();
      recipeMetaByMenu.set(menuId, meta);
    }
    let seen = seenRecipe.get(menuId);
    if (!seen) {
      seen = new Set();
      seenRecipe.set(menuId, seen);
    }
    if (!meta.has(recipe.id)) {
      meta.set(recipe.id, {
        name: recipe.name,
        bodyText: recipe.body_text ?? "",
        ingredients: mapIngredientRows(recipe.critical_ingredients),
      });
    }
    seen.add(recipe.id);

    const slotMeta = slotScaleMeta.get(slotId);
    if (!slotMeta) continue;
    const dedupeKey = `${slotId}:${recipe.id}`;
    if (scaledOnSlot.has(dedupeKey)) continue;
    scaledOnSlot.add(dedupeKey);
    const scaleSlots = scaleSlotsByMenu.get(menuId) ?? [];
    scaleSlots.push({
      recipeId: recipe.id,
      dayIndex: slotMeta.dayIndex,
      servings: slotMeta.servings,
    });
    scaleSlotsByMenu.set(menuId, scaleSlots);
  }
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

  const [slotsRes, ratingsRes, snackRatingsRes] = await Promise.all([
    supabase
      .from("menu_slots")
      .select(
        `id, menu_id, recipe_id, day_index, servings, meal,
         recipes!menu_slots_recipe_id_fkey(${RECIPE_HISTORY_WITH_INGREDIENTS_SELECT}),
         menu_dishes(snack_label)`,
      )
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

  if (slotsRes.error) {
    return { menus: [], error: "Не удалось загрузить историю." };
  }

  const slotIdToMenu = new Map<string, string>();
  const slotIds: string[] = [];
  for (const row of slotsRes.data ?? []) {
    if (row.id && row.menu_id) {
      slotIdToMenu.set(row.id, row.menu_id);
      slotIds.push(row.id);
    }
  }

  const dishesRes =
    slotIds.length > 0
      ? await supabase
        .from("menu_dishes")
        .select(
          `menu_slot_id, recipe_id, snack_label,
         recipes(${RECIPE_HISTORY_WITH_INGREDIENTS_SELECT})`,
        )
        .in("menu_slot_id", slotIds)
        .not("recipe_id", "is", null)
      : { data: [] as Array<{ menu_slot_id: string }>, error: null };

  const dishRows = dishesRes.error ? [] : (dishesRes.data ?? []);

  const warningParts: string[] = [];
  if (ratingsRes.error || snackRatingsRes.error) {
    warningParts.push("Не удалось загрузить оценки — меню показаны без звёзд.");
  }
  if (dishesRes.error) {
    warningParts.push("Не удалось загрузить блюда слотов — масштабирование по ролям может быть неполным.");
  }
  const ratingsWarning =
    warningParts.length > 0 ? warningParts.join(" ") : null;

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
  const scaleSlotsByMenu = new Map<string, ScaleSlot[]>();
  const slotScaleMeta = new Map<string, SlotScaleMeta>();
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

  function unwrapHist(recipes: HistRecipeJoin): HistRecipe | null {
    if (!recipes) return null;
    return Array.isArray(recipes) ? (recipes[0] ?? null) : recipes;
  }

  (slotsRes.data ?? []).forEach((row) => {
    if (!row.menu_id) return;

    const main = unwrapHist(row.recipes as HistRecipe | HistRecipe[] | null);
    const dayIndex = typeof row.day_index === "number" ? row.day_index : 1;
    const servings = typeof row.servings === "number" ? row.servings : 2;
    const primaryId = main?.id ?? row.recipe_id ?? null;

    if (typeof row.id === "string") {
      slotScaleMeta.set(row.id, {
        menuId: row.menu_id,
        dayIndex,
        servings,
        primaryId,
      });
    }

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

    if (main?.id) {
      if (!meta.has(main.id)) {
        meta.set(main.id, {
          name: main.name,
          bodyText: main.body_text ?? "",
          ingredients: mapIngredientRows(main.critical_ingredients),
        });
      }
      seen.add(main.id);
    }
  });

  const slotsWithDishes = new Set<string>();
  mergeDishRecipesIntoHistory(
    dishRows,
    slotIdToMenu,
    slotScaleMeta,
    recipeMetaByMenu,
    seenRecipe,
    scaleSlotsByMenu,
    slotsWithDishes,
    unwrapHist,
  );

  // Primary recipe_id shim for slots without dish rows.
  for (const [slotId, meta] of slotScaleMeta) {
    if (slotsWithDishes.has(slotId) || !meta.primaryId) continue;
    const scaleSlots = scaleSlotsByMenu.get(meta.menuId) ?? [];
    scaleSlots.push({
      recipeId: meta.primaryId,
      dayIndex: meta.dayIndex,
      servings: meta.servings,
    });
    scaleSlotsByMenu.set(meta.menuId, scaleSlots);
  }

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

  for (const row of slotsRes.data ?? []) {
    if (row.meal !== "snack" || !row.menu_id) continue;
    const dishes = (
      row as { menu_dishes?: Array<{ snack_label?: unknown }> | null }
    ).menu_dishes;
    for (const d of dishes ?? []) {
      const label =
        typeof d.snack_label === "string" ? d.snack_label.trim() : "";
      if (!label) continue;
      const key = label.toLocaleLowerCase("ru");
      let seen = seenSnack.get(row.menu_id);
      if (!seen) {
        seen = new Set();
        seenSnack.set(row.menu_id, seen);
      }
      if (seen.has(key)) continue;
      seen.add(key);
      const r = snackRating.get(key);
      const list = snacksByMenu.get(row.menu_id) ?? [];
      list.push({
        label,
        rating: r?.rating ?? null,
        reason: r?.reason ?? null,
      });
      snacksByMenu.set(row.menu_id, list);
    }
  }

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
