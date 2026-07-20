import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_DAY_COUNT, MEAL_LABELS_RU } from "@/domain/menu/constants";
import { normalizeRecipeBodyText } from "@/domain/recipes/format-body";
import {
  parseInventRecipesJson,
  persistInventedRecipe,
  type InventRecipeDraft,
} from "@/domain/suggestions/invent-recipes";
import {
  normalizeDishName,
  namesEqual,
} from "@/domain/suggestions/dish-similarity";
import type { PlannedDish } from "@/domain/suggestions/plan-menu-names";
import { planKey } from "@/domain/suggestions/plan-menu-names";
import {
  tasteNotesForPrompt,
  type TasteNote,
} from "@/domain/suggestions/taste-notes";
import {
  openRouterChatCompletions,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type ExpandedDish = PlannedDish & {
  recipeId: string;
};

export type ExpandMenuRecipesResult =
  | { ok: true; dishes: ExpandedDish[] }
  | { ok: false; reason: "openrouter" | "parse" | "persist" };

const EXPAND_SYSTEM = `You write full Russian home-cooking recipes for LOCKED dish names on a household meal planner.
Names are final — do NOT rename, swap, or invent different dishes.
Respond with a single JSON object:
{"recipes":[{"key":"meal:1-2:main","name":"...","body_text":"...","fridge_keep_days":N,"plate_role":"main"|"companion","price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N},"critical_ingredients":[{"name":"...","kind":"critical"|"pantry","amount":N,"unit":"g"|"ml"|"pcs"|"tsp"|"tbsp"},...]}]}.

Rules:
- One recipe object per input dish. key MUST match the input key exactly. name MUST match the locked name (same dish).
- plate_role from input. fridge_keep_days integer 1..7, MUST be >= menuDayCount from the request.
- body_text: SHORT Russian steps, each on its own line numbered "1. ", "2. ", … Main 3–5 steps, companion 2–4. Cooking/heating required.
- HARD shopping-list completeness: every buyable food in name or body_text MUST be in critical_ingredients with amount+unit per 1 adult serving.
- At least one kind=critical. Prefer 3–8 ingredients (companions 2–5).
- price_rub_per_serving: integer RUBLES, never above 400; omit if uncertain (no zeros).
- nutrition_per_serving: realistic; omit if uncertain.
- Honor operatorTasteNotes for ingredients/technique when relevant, but keep the locked name.`;

/**
 * Expand locked menu names into full persisted recipes (batched AI call).
 */
export async function expandMenuRecipes(
  supabase: SupabaseClient,
  plan: PlannedDish[],
  context: {
    menuDayCount: number;
    peoplePerMeal?: number;
    tasteNotes: TasteNote[];
    chat?: ChatCompletionsFn;
  },
): Promise<ExpandMenuRecipesResult> {
  if (plan.length === 0) return { ok: true, dishes: [] };

  const menuDayCount = context.menuDayCount;
  const chat = context.chat ?? openRouterChatCompletions;
  const locked = plan.map((d) => ({
    key: planKey(d),
    meal: d.meal,
    mealLabelRu: MEAL_LABELS_RU[d.meal],
    dayPair: [...d.dayPair],
    role: d.role,
    name: d.name,
    plate_role: d.role,
  }));

  const userContent = JSON.stringify({
    dishes: locked,
    menuDayCount,
    peoplePerMeal: context.peoplePerMeal ?? 2,
    instruction: `Write a full recipe for EVERY locked dish. Keep names exactly. key must match. fridge_keep_days>=${menuDayCount}.`,
    operatorTasteNotes: tasteNotesForPrompt(context.tasteNotes),
  });

  let content: string;
  try {
    content = await chat({
      messages: [
        { role: "system", content: EXPAND_SYSTEM },
        { role: "user", content: userContent },
      ],
      responseFormatJson: true,
      temperature: 0.5,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  const draftsByKey = parseExpandRecipesJson(content, plan);
  if (!draftsByKey) return { ok: false, reason: "parse" };

  const expanded: ExpandedDish[] = [];
  const inventedIds: string[] = [];

  for (const dish of plan) {
    const key = planKey(dish);
    const draft = draftsByKey.get(key);
    if (!draft) {
      await cleanup(supabase, inventedIds);
      return { ok: false, reason: "parse" };
    }
    // Force locked name + role.
    draft.name = dish.name.slice(0, 120);
    draft.plateRole = dish.role;
    if (draft.fridgeKeepDays < menuDayCount) {
      draft.fridgeKeepDays = menuDayCount;
    }
    draft.bodyText = normalizeRecipeBodyText(draft.bodyText);

    const persisted = await persistInventedRecipe(supabase, draft);
    if (!persisted.ok) {
      await cleanup(supabase, inventedIds);
      return { ok: false, reason: "persist" };
    }
    inventedIds.push(persisted.recipeId);
    expanded.push({ ...dish, recipeId: persisted.recipeId });
  }

  return { ok: true, dishes: expanded };
}

/** Pure parser: map plan keys → drafts (name must match locked dish). */
export function parseExpandRecipesJson(
  content: string,
  plan: PlannedDish[],
): Map<string, InventRecipeDraft> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as { recipes?: unknown };
  if (!Array.isArray(root.recipes)) return null;

  const byKey = indexExpandRowsByKey(root.recipes);
  const draftsByName = parseInventRecipesJson(
    JSON.stringify({ recipes: normalizeExpandRecipeRows(root.recipes) }),
  );
  const used = new Set<InventRecipeDraft>();
  const out = new Map<string, InventRecipeDraft>();

  for (const dish of plan) {
    const key = planKey(dish);
    const draft =
      draftFromKeyedRow(byKey.get(key), dish) ??
      takeDraftByName(draftsByName, dish, used);
    if (!draft) return null;
    used.add(draft);
    out.set(key, draft);
  }

  return out.size === plan.length ? out : null;
}

function indexExpandRowsByKey(
  recipes: unknown[],
): Map<string, Record<string, unknown>> {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of recipes) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.trim() : "";
    if (key) byKey.set(key, row);
  }
  return byKey;
}

function normalizeExpandRecipeRows(recipes: unknown[]): unknown[] {
  return recipes.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row = item as Record<string, unknown>;
    return {
      ...row,
      plate_role: row.plate_role ?? row.plateRole ?? "main",
    };
  });
}

function draftFromKeyedRow(
  row: Record<string, unknown> | undefined,
  dish: PlannedDish,
): InventRecipeDraft | null {
  if (!row) return null;
  const one = parseInventRecipesJson(
    JSON.stringify({
      recipes: [
        {
          ...row,
          name: dish.name,
          plate_role: dish.role,
          fridge_keep_days:
            row.fridge_keep_days ?? row.fridgeKeepDays ?? DEFAULT_DAY_COUNT,
        },
      ],
    }),
  )[0];
  if (!one) return null;
  one.name = dish.name;
  one.plateRole = dish.role;
  return one;
}

function takeDraftByName(
  drafts: InventRecipeDraft[],
  dish: PlannedDish,
  used: Set<InventRecipeDraft>,
): InventRecipeDraft | null {
  const match = drafts.find(
    (d) =>
      !used.has(d) &&
      (namesEqual(d.name, dish.name) ||
        normalizeDishName(d.name) === normalizeDishName(dish.name)),
  );
  if (!match) return null;
  match.name = dish.name;
  match.plateRole = dish.role;
  return match;
}

async function cleanup(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from("recipes").delete().in("id", ids);
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
