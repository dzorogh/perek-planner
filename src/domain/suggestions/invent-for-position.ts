import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_DAY_COUNT,
  MEAL_LABELS_RU,
  type MealSlot,
  type MenuDayPair,
} from "@/domain/menu/constants";
import type { PlateRole } from "@/domain/menu/meal-templates";
import {
  clampRequiredEquipmentToAvailable,
  recipeFitsAvailableEquipment,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { normalizeRecipeBodyText } from "@/domain/recipes/format-body";
import {
  normalizeDishName,
  uniqueExactNames,
} from "@/domain/suggestions/dish-similarity";
import {
  parseInventRecipesJson,
  persistInventedRecipe,
  type InventRecipeDraft,
} from "@/domain/suggestions/invent-recipes";
import {
  isBreakfastMeal,
  isLunchDinnerMeal,
  looksLikeBreakfastDish,
  looksLikeLunchDinnerOnlyMain,
  looksLikeNoCookSnack,
  stripHardcodedPairing,
} from "@/domain/suggestions/meal-fit";
import { resolvePositionPlateRole } from "@/domain/suggestions/plan-menu-names";
import { parseCoversRoles } from "@/domain/suggestions/role-slots";
import {
  loadTasteNotes,
  tasteNotesForPrompt,
  type TasteNote,
} from "@/domain/suggestions/taste-notes";
import {
  openRouterChatCompletions,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type InventPositionOk = {
  ok: true;
  recipeId: string;
  name: string;
  plateRole: PlateRole;
  coversRoles: PlateRole[] | null;
};

export type InventPositionErr = {
  ok: false;
  reason: "openrouter" | "parse" | "persist" | "query";
};

export type InventPositionResult = InventPositionOk | InventPositionErr;

export type InventPositionContext = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  plateRole: PlateRole;
  /** @deprecated mapped to plateRole via resolvePositionPlateRole */
  role?: "main" | "companion";
  avoidNames?: string[];
  currentMenuDishes?: string[];
  previousMenusDishes?: string[];
  repairReason?: string;
  menuDayCount?: number;
  peoplePerMeal?: number;
  availableEquipment: readonly EquipmentId[];
  chat?: ChatCompletionsFn;
  userId: string;
};

const POSITION_SYSTEM = `You invent ONE new Russian home-cooking recipe for a household meal planner.
This dish will be cooked once and eaten on TWO consecutive menu days (batch cook).
Plate role is FIXED by the app — invent recipe content for that role only.
Respond with a single JSON object:
{"recipe":{"name":"...","body_text":"...","fridge_keep_days":N,"plate_role":"main"|"soup"|"protein"|"veg"|"carb","covers_roles":["protein","carb"]?,"required_equipment":["stove"|"oven"|"air_fryer"|"grill"|"multicooker"|"pressure_cooker"|"microwave",...],"price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N},"critical_ingredients":[{"name":"...","kind":"critical"|"pantry","amount":N,"unit":"g"|"ml"|"pcs"|"tsp"|"tbsp"},...]}}.
Rules:
- required_equipment: non-empty; MUST be ⊆ availableEquipment. HARD: never invent a dish needing equipment outside availableEquipment.
- Invent exactly ONE recipe for the requested plate_role.
- Optional covers_roles for one-pots (e.g. плов as protein covering protein+carb). Only claim roles the dish truly covers.
- HARD: never invent a near-duplicate of currentMenuDishes / avoidNames / previousMenusDishes.
- fridge_keep_days: integer 1..7, MUST be >= menuDayCount from the request.
- body_text: SHORT Russian steps, each on its own line numbered "1. ", "2. ", … (protein/main 3–5; soup/veg/carb 2–4).
- HARD shopping-list completeness: every buyable food in name or body_text MUST appear in critical_ingredients with amount+unit per 1 adult serving.
- At least one kind=critical ingredient. Prefer 3–8 ingredients (sides 2–5).
- price_rub_per_serving: integer RUBLES; NEVER above 400; omit if uncertain (no zeros).
- Breakfast / second_breakfast / afternoon_snack: morning food ONLY; plate_role=main. NEVER roast chicken, soup, plov, cutlets.
- Lunch / dinner / late_dinner protein: real savory meal; prefer meat/fish. NEVER morning forms.
- NEVER invent snacks / перекусы. Do not invent recipe ids. NEVER plate_kind / companion.
- Honor operatorTasteNotes: constraint PRIMARY; exampleDish secondary.`;

/**
 * Invent + persist one recipe for a fixed (meal × day-pair × plateRole) position.
 */
export async function inventForPosition(
  supabase: SupabaseClient,
  context: InventPositionContext,
): Promise<InventPositionResult> {
  const plateRole =
    context.plateRole ??
    (context.role
      ? resolvePositionPlateRole(context.meal, context.role)
      : null);
  if (!plateRole) return { ok: false, reason: "parse" };

  const tasteNotes = await loadTasteNotes(supabase, context.userId);
  if (!tasteNotes) return { ok: false, reason: "query" };

  const chat = context.chat ?? openRouterChatCompletions;
  let draft: InventRecipeDraft;

  try {
    const proposed = await proposePositionRecipe(chat, tasteNotes, {
      ...context,
      plateRole,
    });
    if (!proposed) return { ok: false, reason: "parse" };
    draft = proposed;
  } catch (err) {
    if (err instanceof OpenRouterError) return { ok: false, reason: "openrouter" };
    throw err;
  }

  if (!passesPositionMealFit(draft, { ...context, plateRole })) {
    return { ok: false, reason: "parse" };
  }
  if (context.availableEquipment?.length) {
    draft.requiredEquipment = clampRequiredEquipmentToAvailable(
      draft.requiredEquipment,
      context.availableEquipment,
    );
  }
  if (
    !recipeFitsAvailableEquipment(
      draft.requiredEquipment,
      context.availableEquipment,
    )
  ) {
    return { ok: false, reason: "parse" };
  }

  const persisted = await persistInventedRecipe(supabase, draft);
  if (!persisted.ok) return { ok: false, reason: "persist" };

  return {
    ok: true,
    recipeId: persisted.recipeId,
    name: draft.name,
    plateRole,
    coversRoles: draft.coversRoles,
  };
}

async function proposePositionRecipe(
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
  context: InventPositionContext & { plateRole: PlateRole },
): Promise<InventRecipeDraft | null> {
  const mealRu = MEAL_LABELS_RU[context.meal];
  const daysLabel = `${context.dayPair[0]}–${context.dayPair[1]}`;
  const menuDayCount = context.menuDayCount ?? DEFAULT_DAY_COUNT;
  const userContent = JSON.stringify({
    meal: context.meal,
    mealLabelRu: mealRu,
    dayPair: [...context.dayPair],
    daysLabel,
    plate_role: context.plateRole,
    menuDayCount,
    peoplePerMeal: context.peoplePerMeal ?? 2,
    availableEquipment: [...context.availableEquipment],
    previousMenusDishes: uniqueExactNames(context.previousMenusDishes ?? []).slice(
      0,
      60,
    ),
    currentMenuDishes: uniqueExactNames(context.currentMenuDishes ?? []).slice(
      0,
      40,
    ),
    avoidNames: uniqueExactNames(context.avoidNames ?? []).slice(0, 50),
    repairReason: context.repairReason ?? null,
    instruction: positionInventInstruction(context, mealRu, daysLabel),
    operatorTasteNotes: tasteNotesForPrompt(tasteNotes),
  });

  const content = await chat({
    messages: [
      { role: "system", content: POSITION_SYSTEM },
      { role: "user", content: userContent },
    ],
    responseFormatJson: true,
    temperature: 0.85,
  });

  return parsePositionInventJson(content, {
    plateRole: context.plateRole,
    meal: context.meal,
    menuDayCount,
  });
}

/** Pure parser for single-recipe position invent JSON. */
export function parsePositionInventJson(
  content: string,
  context: {
    plateRole: PlateRole;
    meal: MealSlot;
    menuDayCount?: number;
    role?: "main" | "companion";
  },
): InventRecipeDraft | null {
  const plateRole =
    context.plateRole ??
    (context.role
      ? resolvePositionPlateRole(context.meal, context.role)
      : null);
  if (!plateRole) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;

  let row: Record<string, unknown> | null = null;
  if (root.recipe && typeof root.recipe === "object") {
    row = root.recipe as Record<string, unknown>;
  } else if (Array.isArray(root.recipes) && root.recipes[0] && typeof root.recipes[0] === "object") {
    row = root.recipes[0] as Record<string, unknown>;
  }
  if (!row) return null;

  const drafts = parseInventRecipesJson(
    JSON.stringify({
      recipes: [
        {
          ...row,
          plate_role: plateRole,
          covers_roles: row.covers_roles ?? row.coversRoles ?? null,
          fridge_keep_days: coerceFridgeKeep(
            row.fridge_keep_days ?? row.fridgeKeepDays,
            context.menuDayCount,
          ),
        },
      ],
    }),
  );
  const draft = drafts[0];
  if (!draft) return null;

  draft.plateRole = plateRole;
  draft.coversRoles =
    parseCoversRoles(row.covers_roles ?? row.coversRoles) ?? draft.coversRoles;
  const minFridge = context.menuDayCount ?? DEFAULT_DAY_COUNT;
  if (draft.fridgeKeepDays < minFridge) {
    draft.fridgeKeepDays = minFridge;
  }

  draft.name = stripHardcodedPairing(draft.name);
  draft.bodyText = normalizeRecipeBodyText(draft.bodyText);

  return draft;
}

function coerceFridgeKeep(raw: unknown, menuDayCount?: number): number {
  const min = menuDayCount ?? DEFAULT_DAY_COUNT;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(7, Math.max(min, Math.trunc(n)));
}

function positionInventInstruction(
  context: InventPositionContext & { plateRole: PlateRole },
  mealRu: string,
  daysLabel: string,
): string {
  const repair = context.repairReason
    ? ` REPAIR: previous pick failed variety audit — ${context.repairReason}. Invent a clearly different culinary form.`
    : "";
  return `Invent ONE ${context.plateRole} dish for ${mealRu}, days ${daysLabel}. plate_role=${context.plateRole}. fridge_keep_days>=4. Respect currentMenuDishes — different form from other meals on the same dayPair.${repair}`;
}

function passesPositionMealFit(
  draft: InventRecipeDraft,
  context: InventPositionContext & { plateRole: PlateRole },
): boolean {
  const name = draft.name;
  if (!normalizeDishName(name) || looksLikeNoCookSnack(name)) return false;
  if (draft.plateRole !== context.plateRole) return false;
  if (isBreakfastMeal(context.meal) || context.meal === "afternoon_snack") {
    return context.plateRole === "main" && !looksLikeLunchDinnerOnlyMain(name);
  }
  if (
    isLunchDinnerMeal(context.meal) &&
    (context.plateRole === "protein" || context.plateRole === "main")
  ) {
    return !looksLikeBreakfastDish(name);
  }
  return true;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
