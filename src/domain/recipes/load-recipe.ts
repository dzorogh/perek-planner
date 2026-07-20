import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapPerServingValue,
  type RecipePerServingValue,
} from "@/domain/recipes/scale-totals";
import {
  isIngredientUnit,
  type IngredientUnit,
} from "@/domain/shopping/quantity";

export type RecipeIngredientView = {
  name: string;
  kind: "critical" | "pantry";
  amountPerServing: number | null;
  unit: IngredientUnit | null;
};

export type RecipeTextView = {
  id: string;
  name: string;
  bodyText: string;
  ingredients: RecipeIngredientView[];
  value: RecipePerServingValue;
};

const VALUE_SELECT =
  "price_cents_per_serving, calories_kcal_per_serving, protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving" as const;

type IngredientRow = {
  name?: unknown;
  kind?: unknown;
  amount_per_serving?: unknown;
  unit?: unknown;
  sort_order?: unknown;
};

function coerceNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  return NaN;
}

function mapIngredientRow(
  row: IngredientRow,
  sort: number,
): RecipeIngredientView & { sort: number } | null {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name || (row.kind !== "critical" && row.kind !== "pantry")) return null;

  const amountNum = coerceNumber(row.amount_per_serving);
  const unit = isIngredientUnit(row.unit) ? row.unit : null;
  const amountPerServing =
    unit && Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null;
  return {
    name,
    kind: row.kind,
    amountPerServing,
    unit: amountPerServing != null ? unit : null,
    sort,
  };
}

export function mapIngredientRows(
  rows: IngredientRow[] | null | undefined,
): RecipeIngredientView[] {
  if (!rows?.length) return [];

  const mapped: Array<RecipeIngredientView & { sort: number }> = [];
  for (const row of rows) {
    const sort =
      typeof row.sort_order === "number" && Number.isFinite(row.sort_order)
        ? row.sort_order
        : mapped.length + 1;
    const mappedRow = mapIngredientRow(row, sort);
    if (mappedRow) mapped.push(mappedRow);
  }

  mapped.sort((a, b) => a.sort - b.sort);
  return mapped.map((row) => ({
    name: row.name,
    kind: row.kind,
    amountPerServing: row.amountPerServing,
    unit: row.unit,
  }));
}

const INGREDIENT_SELECT =
  "name, kind, amount_per_serving, unit, sort_order" as const;

export async function loadRecipeText(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<{ recipe: RecipeTextView | null; error: string | null }> {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      `id, name, body_text, ${VALUE_SELECT}, critical_ingredients(${INGREDIENT_SELECT})`,
    )
    .eq("id", recipeId)
    .maybeSingle();

  if (error) {
    return { recipe: null, error: "Не удалось загрузить рецепт." };
  }
  if (!data) {
    return { recipe: null, error: "Рецепт не найден." };
  }

  return {
    recipe: {
      id: data.id,
      name: data.name,
      bodyText: data.body_text ?? "",
      ingredients: mapIngredientRows(
        data.critical_ingredients as IngredientRow[] | null,
      ),
      value: mapPerServingValue(data),
    },
    error: null,
  };
}

/** Nested select fragment for recipes + ingredients + value. */
export const RECIPE_WITH_INGREDIENTS_SELECT =
  `name, body_text, ${VALUE_SELECT}, critical_ingredients(${INGREDIENT_SELECT})` as const;

export const RECIPE_HISTORY_WITH_INGREDIENTS_SELECT =
  `id, name, body_text, ${VALUE_SELECT}, critical_ingredients(${INGREDIENT_SELECT})` as const;
