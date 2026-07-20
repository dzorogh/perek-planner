import type { SupabaseClient } from "@supabase/supabase-js";

import { hasSlotEditPassed } from "@/domain/menu/uj1-gate";
import {
  formatLineLabel,
  formatQuantity,
  isIngredientUnit,
  type IngredientUnit,
} from "@/domain/shopping/quantity";

export type ShoppingListLineView = {
  id: string;
  ingredientName: string;
  lineKind: "ingredient" | "pantry" | "snack";
  quantityAmount: number | null;
  quantityUnit: IngredientUnit | null;
  quantityLabel: string | null;
};

export type ShoppingListView = {
  id: string;
  menuId: string;
  lines: ShoppingListLineView[];
};

type BuildResult =
  | { ok: true; list: ShoppingListView }
  | { ok: false; error: string };

type LineDraft = {
  ingredient_name: string;
  line_kind: "ingredient" | "pantry" | "snack";
  quantity_amount: number | null;
  quantity_unit: IngredientUnit | null;
  sort_order: number;
};

type PreviousLine = {
  ingredient_name: string;
  line_kind: string;
  quantity_amount: number | string | null;
  quantity_unit: string | null;
  sort_order: number;
};

function coerceNumber(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  return null;
}

/**
 * Materialize (or regenerate) Shopping list from recipe ingredients + snacks.
 * Quantities = amount_per_serving × slot servings, aggregated by name+unit.
 */
export async function buildShoppingList(
  supabase: SupabaseClient,
  menuId: string,
): Promise<BuildResult> {
  const passed = await hasSlotEditPassed(supabase, menuId);
  if (!passed) {
    return {
      ok: false,
      error: "Сначала проверьте меню и перейдите к списку покупок.",
    };
  }

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError || !menu) {
    return { ok: false, error: "Меню не найдено." };
  }

  const [slotsRes, snacksRes] = await Promise.all([
    supabase
      .from("menu_slots")
      .select("recipe_id, companion_recipe_id, servings")
      .eq("menu_id", menuId)
      .not("recipe_id", "is", null),
    supabase.from("menu_snacks").select("id, label").eq("menu_id", menuId),
  ]);

  if (slotsRes.error || snacksRes.error) {
    return { ok: false, error: "Не удалось собрать список покупок." };
  }

  type SlotRow = {
    recipe_id: string;
    companion_recipe_id: string | null;
    servings: number;
  };

  const slots = (slotsRes.data ?? []).filter(
    (s): s is SlotRow => typeof s.recipe_id === "string",
  );

  const recipeIds = [
    ...new Set(
      slots.flatMap((s) =>
        [s.recipe_id, s.companion_recipe_id].filter(
          (id): id is string => typeof id === "string",
        ),
      ),
    ),
  ];

  type Agg = {
    ingredient_name: string;
    line_kind: "ingredient" | "pantry";
    quantity_amount: number | null;
    quantity_unit: IngredientUnit | null;
  };

  const byKey = new Map<string, Agg>();

  if (recipeIds.length > 0) {
    const { data: ingredients, error: ingError } = await supabase
      .from("critical_ingredients")
      .select("recipe_id, name, kind, amount_per_serving, unit, sort_order")
      .in("recipe_id", recipeIds)
      .order("sort_order", { ascending: true });

    if (ingError) {
      return { ok: false, error: "Не удалось собрать список покупок." };
    }

    const ingsByRecipe = new Map<string, typeof ingredients>();
    (ingredients ?? []).forEach((row) => {
      const rid = row.recipe_id as string;
      const list = ingsByRecipe.get(rid) ?? [];
      list.push(row);
      ingsByRecipe.set(rid, list);
    });

    slots.forEach((slot) => {
      const servings =
        typeof slot.servings === "number" && slot.servings >= 1
          ? slot.servings
          : 2;
      const slotRecipeIds = [slot.recipe_id, slot.companion_recipe_id].filter(
        (id): id is string => typeof id === "string",
      );
      slotRecipeIds.forEach((recipeId) => {
        const ings = ingsByRecipe.get(recipeId) ?? [];
        ings.forEach((row) => {
          const name = typeof row.name === "string" ? row.name.trim() : "";
          if (!name) return;
          const kind: "ingredient" | "pantry" =
            row.kind === "pantry" ? "pantry" : "ingredient";
          const unit = isIngredientUnit(row.unit) ? row.unit : null;
          const perServing = coerceNumber(row.amount_per_serving);
          const scaled =
            unit &&
              perServing != null &&
              Number.isFinite(perServing) &&
              perServing > 0
              ? perServing * servings
              : null;

          // Aggregate by name+unit when both have quantities; else by name only.
          const key =
            scaled != null && unit
              ? `${kind}|${name.toLocaleLowerCase("ru")}|${unit}`
              : `${kind}|${name.toLocaleLowerCase("ru")}|`;

          const existing = byKey.get(key);
          if (!existing) {
            byKey.set(key, {
              ingredient_name: name,
              line_kind: kind,
              quantity_amount: scaled,
              quantity_unit: scaled != null ? unit : null,
            });
          } else if (
            existing.quantity_amount != null &&
            scaled != null &&
            existing.quantity_unit === unit
          ) {
            existing.quantity_amount += scaled;
          }
          // If one side lacks quantity, keep the named line without inventing qty.
        });
      });
    });
  }

  const drafts: LineDraft[] = [];
  let sort = 0;
  byKey.forEach((agg) => {
    drafts.push({
      ingredient_name: agg.ingredient_name,
      line_kind: agg.line_kind,
      quantity_amount: agg.quantity_amount,
      quantity_unit: agg.quantity_unit,
      sort_order: sort++,
    });
  });

  // Snacks always get their own section lines. If a snack label collides with
  // an ingredient name, keep both — shopping sections distinguish them.
  const seenSnackLabels = new Set<string>();
  (snacksRes.data ?? []).forEach((row) => {
    const name = typeof row.label === "string" ? row.label.trim() : "";
    if (!name) return;
    const key = name.toLocaleLowerCase("ru");
    if (seenSnackLabels.has(key)) return;
    seenSnackLabels.add(key);
    drafts.push({
      ingredient_name: name,
      line_kind: "snack",
      quantity_amount: null,
      quantity_unit: null,
      sort_order: sort++,
    });
  });

  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("menu_id", menuId)
    .maybeSingle();

  const listState = await prepareShoppingList(supabase, menuId, existing?.id);
  if (!listState) {
    return { ok: false, error: "Не удалось создать список покупок." };
  }
  const { listId, previousLines } = listState;

  if (drafts.length > 0) {
    const { error: linesError } = await supabase
      .from("shopping_list_lines")
      .insert(
        drafts.map((d) => ({
          shopping_list_id: listId,
          ingredient_name: d.ingredient_name,
          line_kind: d.line_kind,
          quantity_amount: d.quantity_amount,
          quantity_unit: d.quantity_unit,
          sort_order: d.sort_order,
        })),
      );
    if (linesError) {
      if (previousLines && previousLines.length > 0) {
        await supabase.from("shopping_list_lines").insert(
          previousLines.map((l) => ({
            shopping_list_id: listId,
            ingredient_name: l.ingredient_name,
            line_kind: l.line_kind,
            quantity_amount: l.quantity_amount,
            quantity_unit: l.quantity_unit,
            sort_order: l.sort_order,
          })),
        );
      }
      return { ok: false, error: "Не удалось сохранить строки списка." };
    }
  }

  const { data: lines, error: loadError } = await supabase
    .from("shopping_list_lines")
    .select("id, ingredient_name, line_kind, quantity_amount, quantity_unit")
    .eq("shopping_list_id", listId)
    .order("sort_order", { ascending: true });

  if (loadError) {
    return { ok: false, error: "Не удалось загрузить список покупок." };
  }

  return {
    ok: true,
    list: {
      id: listId!,
      menuId,
      lines: (lines ?? []).map((l) => {
        const unit = isIngredientUnit(l.quantity_unit)
          ? l.quantity_unit
          : null;
        const amount = coerceNumber(l.quantity_amount);
        return {
          id: l.id,
          ingredientName: l.ingredient_name,
          lineKind: l.line_kind as ShoppingListLineView["lineKind"],
          quantityAmount: amount != null && Number.isFinite(amount) ? amount : null,
          quantityUnit: unit,
          quantityLabel: formatQuantity(amount, unit),
        };
      }),
    },
  };
}

async function prepareShoppingList(
  supabase: SupabaseClient,
  menuId: string,
  existingId: string | undefined,
): Promise<{ listId: string; previousLines: PreviousLine[] | null } | null> {
  if (!existingId) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ menu_id: menuId })
      .select("id")
      .single();
    return error || !data ? null : { listId: data.id, previousLines: null };
  }
  await supabase
    .from("shopping_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", existingId);
  const { data } = await supabase
    .from("shopping_list_lines")
    .select("ingredient_name, line_kind, quantity_amount, quantity_unit, sort_order")
    .eq("shopping_list_id", existingId)
    .order("sort_order", { ascending: true });
  await supabase.from("shopping_list_lines").delete().eq("shopping_list_id", existingId);
  return {
    listId: existingId,
    previousLines: (data as PreviousLine[] | null) ?? [],
  };
}

export function formatShoppingListCopy(list: ShoppingListView): string {
  if (list.lines.length === 0) {
    return "Список покупок пуст.";
  }
  const sections = {
    ingredient: [] as string[],
    pantry: [] as string[],
    snack: [] as string[],
  };
  for (const line of list.lines) {
    sections[line.lineKind].push(
      `• ${formatLineLabel(line.ingredientName, line.quantityAmount, line.quantityUnit)}`,
    );
  }
  const parts: string[] = ["Список покупок"];
  if (sections.ingredient.length) {
    parts.push("", "Блюда:", ...sections.ingredient);
  }
  if (sections.pantry.length) {
    parts.push("", "Базовые продукты:", ...sections.pantry);
  }
  if (sections.snack.length) {
    parts.push("", "Перекусы:", ...sections.snack);
  }
  return parts.join("\n");
}
