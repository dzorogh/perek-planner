import type { SupabaseClient } from "@supabase/supabase-js";

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

type RecipeServing = { recipeId: string; servings: number };

type IngAgg = {
  ingredient_name: string;
  line_kind: "ingredient" | "pantry";
  quantity_amount: number | null;
  quantity_unit: IngredientUnit | null;
};

function collectRecipeServings(
  slots: ReadonlyArray<{
    id: string;
    recipe_id: string | null;
    servings: number;
  }>,
  dishRows: ReadonlyArray<{
    menu_slot_id: string;
    recipe_id: string | null;
  }>,
  servingsBySlot: ReadonlyMap<string, number>,
): RecipeServing[] {
  const out: RecipeServing[] = [];

  for (const d of dishRows) {
    if (typeof d.recipe_id !== "string") continue;
    out.push({
      recipeId: d.recipe_id,
      servings: servingsBySlot.get(d.menu_slot_id) ?? 2,
    });
  }

  const slotsWithDishRecipe = new Set(
    dishRows
      .filter((d) => typeof d.recipe_id === "string")
      .map((d) => d.menu_slot_id),
  );

  for (const s of slots) {
    // Prefer dishes for slots that have them; else primary recipe_id shim.
    if (slotsWithDishRecipe.has(s.id)) continue;
    const servings = servingsBySlot.get(s.id) ?? 2;
    if (typeof s.recipe_id === "string") {
      out.push({ recipeId: s.recipe_id, servings });
    }
  }

  return out;
}

function addIngredientToAgg(
  byKey: Map<string, IngAgg>,
  row: {
    name: unknown;
    kind: unknown;
    unit: unknown;
    amount_per_serving: unknown;
  },
  servings: number,
): void {
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
    return;
  }
  if (
    existing.quantity_amount != null &&
    scaled != null &&
    existing.quantity_unit === unit
  ) {
    existing.quantity_amount += scaled;
  }
}

function appendSnackDrafts(
  drafts: LineDraft[],
  sortStart: number,
  dishRows: ReadonlyArray<{ snack_label: string | null }>,
  snackTable: ReadonlyArray<{ label: unknown }>,
): number {
  let sort = sortStart;
  const seen = new Set<string>();
  const names = [
    ...dishRows
      .map((d) =>
        typeof d.snack_label === "string" ? d.snack_label.trim() : "",
      )
      .filter(Boolean),
    ...snackTable.map((row) =>
      typeof row.label === "string" ? row.label.trim() : "",
    ),
  ];
  for (const name of names) {
    if (!name) continue;
    const key = name.toLocaleLowerCase("ru");
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({
      ingredient_name: name,
      line_kind: "snack",
      quantity_amount: null,
      quantity_unit: null,
      sort_order: sort++,
    });
  }
  return sort;
}

type DishRow = {
  menu_slot_id: string;
  recipe_id: string | null;
  snack_label: string | null;
};

async function loadShoppingSources(
  supabase: SupabaseClient,
  menuId: string,
): Promise<
  | {
    ok: true;
    dishRows: DishRow[];
    snacksTable: Array<{ label: unknown }>;
    recipeServings: RecipeServing[];
  }
  | { ok: false; error: string }
> {
  const [slotsRes, snacksRes] = await Promise.all([
    supabase
      .from("menu_slots")
      .select("id, recipe_id, servings")
      .eq("menu_id", menuId),
    supabase.from("menu_snacks").select("id, label").eq("menu_id", menuId),
  ]);

  if (slotsRes.error || snacksRes.error) {
    return { ok: false, error: "Не удалось собрать список покупок." };
  }

  const slots = (slotsRes.data ?? []) as Array<{
    id: string;
    recipe_id: string | null;
    servings: number;
  }>;
  const slotIds = slots.map((s) => s.id);
  const servingsBySlot = new Map(
    slots.map((s) => [
      s.id,
      typeof s.servings === "number" && s.servings >= 1 ? s.servings : 2,
    ]),
  );

  const dishesRes =
    slotIds.length > 0
      ? await supabase
        .from("menu_slot_dishes")
        .select("menu_slot_id, recipe_id, snack_label")
        .in("menu_slot_id", slotIds)
      : { data: [] as DishRow[], error: null };

  if (dishesRes.error) {
    return { ok: false, error: "Не удалось собрать список покупок." };
  }

  const dishRows = (dishesRes.data ?? []) as DishRow[];
  return {
    ok: true,
    dishRows,
    snacksTable: snacksRes.data ?? [],
    recipeServings: collectRecipeServings(slots, dishRows, servingsBySlot),
  };
}

async function fillIngredientAgg(
  supabase: SupabaseClient,
  recipeIds: string[],
  recipeServings: RecipeServing[],
  byKey: Map<string, IngAgg>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: ingredients, error: ingError } = await supabase
    .from("critical_ingredients")
    .select("recipe_id, name, kind, amount_per_serving, unit, sort_order")
    .in("recipe_id", recipeIds)
    .order("sort_order", { ascending: true });

  if (ingError) {
    return { ok: false, error: "Не удалось собрать список покупок." };
  }

  const ingsByRecipe = new Map<string, NonNullable<typeof ingredients>>();
  (ingredients ?? []).forEach((row) => {
    const rid = row.recipe_id as string;
    const list = ingsByRecipe.get(rid) ?? [];
    list.push(row);
    ingsByRecipe.set(rid, list);
  });

  for (const { recipeId, servings } of recipeServings) {
    for (const row of ingsByRecipe.get(recipeId) ?? []) {
      addIngredientToAgg(byKey, row, servings);
    }
  }
  return { ok: true };
}

/**
 * Materialize (or regenerate) Shopping list from recipe ingredients + snacks.
 * Quantities = amount_per_serving × slot servings, aggregated by name+unit.
 */
export async function buildShoppingList(
  supabase: SupabaseClient,
  menuId: string,
): Promise<BuildResult> {
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError || !menu) {
    return { ok: false, error: "Меню не найдено." };
  }

  const sources = await loadShoppingSources(supabase, menuId);
  if (!sources.ok) return sources;

  const { dishRows, snacksTable, recipeServings } = sources;
  const recipeIds = [...new Set(recipeServings.map((r) => r.recipeId))];
  const byKey = new Map<string, IngAgg>();

  if (recipeIds.length > 0) {
    const filled = await fillIngredientAgg(
      supabase,
      recipeIds,
      recipeServings,
      byKey,
    );
    if (!filled.ok) return filled;
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

  appendSnackDrafts(drafts, sort, dishRows, snacksTable);

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

/** Flat copy of persisted lines (no kind sections). Prefer formatCuratedShoppingCopy for UI cart. */
export function formatShoppingListCopy(list: ShoppingListView): string {
  if (list.lines.length === 0) {
    return "Список покупок пуст.";
  }
  const body = list.lines.map(
    (line) =>
      `• ${formatLineLabel(line.ingredientName, line.quantityAmount, line.quantityUnit)}`,
  );
  return ["Список покупок", "", ...body].join("\n");
}
