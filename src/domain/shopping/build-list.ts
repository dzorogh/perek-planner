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
    for (const row of ingredients ?? []) {
      const rid = row.recipe_id as string;
      const list = ingsByRecipe.get(rid) ?? [];
      list.push(row);
      ingsByRecipe.set(rid, list);
    }

    for (const slot of slots) {
      const servings =
        typeof slot.servings === "number" && slot.servings >= 1
          ? slot.servings
          : 2;
      const slotRecipeIds = [slot.recipe_id, slot.companion_recipe_id].filter(
        (id): id is string => typeof id === "string",
      );
      for (const recipeId of slotRecipeIds) {
        const ings = ingsByRecipe.get(recipeId) ?? [];
        for (const row of ings) {
          const name = typeof row.name === "string" ? row.name.trim() : "";
          if (!name) continue;
          const kind: "ingredient" | "pantry" =
            row.kind === "pantry" ? "pantry" : "ingredient";
          const unit = isIngredientUnit(row.unit) ? row.unit : null;
          const perServing =
            typeof row.amount_per_serving === "number"
              ? row.amount_per_serving
              : typeof row.amount_per_serving === "string"
                ? Number(row.amount_per_serving)
                : null;
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
        }
      }
    }
  }

  const drafts: LineDraft[] = [];
  let sort = 0;
  for (const agg of byKey.values()) {
    drafts.push({
      ingredient_name: agg.ingredient_name,
      line_kind: agg.line_kind,
      quantity_amount: agg.quantity_amount,
      quantity_unit: agg.quantity_unit,
      sort_order: sort++,
    });
  }

  const seenSnack = new Set(
    drafts.map((d) => d.ingredient_name.toLocaleLowerCase("ru")),
  );
  for (const row of snacksRes.data ?? []) {
    const name = typeof row.label === "string" ? row.label.trim() : "";
    if (!name) continue;
    const key = name.toLocaleLowerCase("ru");
    if (seenSnack.has(key)) continue;
    seenSnack.add(key);
    drafts.push({
      ingredient_name: name,
      line_kind: "snack",
      quantity_amount: null,
      quantity_unit: null,
      sort_order: sort++,
    });
  }

  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("menu_id", menuId)
    .maybeSingle();

  let listId = existing?.id as string | undefined;
  if (!listId) {
    const { data: created, error: createError } = await supabase
      .from("shopping_lists")
      .insert({ menu_id: menuId })
      .select("id")
      .single();
    if (createError || !created) {
      return { ok: false, error: "Не удалось создать список покупок." };
    }
    listId = created.id;
  } else {
    await supabase
      .from("shopping_lists")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", listId);
    await supabase
      .from("shopping_list_lines")
      .delete()
      .eq("shopping_list_id", listId);
  }

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
        const amount =
          typeof l.quantity_amount === "number"
            ? l.quantity_amount
            : typeof l.quantity_amount === "string"
              ? Number(l.quantity_amount)
              : null;
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
