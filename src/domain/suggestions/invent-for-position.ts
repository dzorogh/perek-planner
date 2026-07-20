import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_DAY_COUNT,
  MEAL_LABELS_RU,
  mealAllowsCompanion,
  type MealSlot,
  type MenuDayPair,
} from "@/domain/menu/constants";
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
  looksLikeBreakfastDish,
  looksLikeLunchDinnerOnlyMain,
  looksLikeNoCookSnack,
  stripHardcodedPairing,
} from "@/domain/suggestions/meal-fit";
import { parsePlateKind } from "@/domain/suggestions/plate-complete";
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

export type PositionPlateKind = "complete" | "needs_companion";

export type InventPositionOk = {
  ok: true;
  recipeId: string;
  name: string;
  plateKind: PositionPlateKind | null;
};

export type InventPositionErr = {
  ok: false;
  reason: "openrouter" | "parse" | "persist" | "query";
};

export type InventPositionResult = InventPositionOk | InventPositionErr;

export type InventPositionContext = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  role: "main" | "companion";
  /** Required when role=companion — the main already invented for this pair. */
  mainDishName?: string;
  avoidNames?: string[];
  /** Dishes already planned on THIS menu (stronger than history avoid). */
  currentMenuDishes?: string[];
  previousMenusDishes?: string[];
  /** Short reason from variety analyzer when reinventing a flagged slot. */
  repairReason?: string;
  /** Full menu length — fridge_keep must cover it. */
  menuDayCount?: number;
  peoplePerMeal?: number;
  chat?: ChatCompletionsFn;
  userId: string;
};

const POSITION_MAIN_SYSTEM = `You invent ONE new Russian home-cooking recipe for a household meal planner.
This dish will be cooked once and eaten on TWO consecutive menu days (batch cook).
Respond with a single JSON object:
{"recipe":{"name":"...","body_text":"...","fridge_keep_days":N,"plate_role":"main","plate_kind":"complete"|"needs_companion","price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N},"critical_ingredients":[{"name":"...","kind":"critical"|"pantry","amount":N,"unit":"g"|"ml"|"pcs"|"tsp"|"tbsp"},...]}}.
Rules:
- Invent exactly ONE plate_role=main recipe for the requested meal only.
- HARD: never invent a near-duplicate of currentMenuDishes / avoidNames / previousMenusDishes (culinary form+base; topping swaps and word-order swaps are duplicates).
  Too close (FORBIDDEN): куриные рулеты с сыром и шпинатом ≈ куриные рулетики с шпинатом и сыром; котлеты из курицы ≈ куриные котлеты.
- HARD: if currentMenuDishes already has lunch/dinner mains for the SAME dayPair, invent a clearly DIFFERENT culinary form (not another рулет/котлета/запеканка of the same family).
- fridge_keep_days: integer 1..7, MUST be >= menuDayCount from the request (covers the full menu).
- body_text: SHORT Russian steps, each on its own line numbered "1. ", "2. ", … (3–5 steps). Cooking/heating required.
- HARD shopping-list completeness: every buyable food in name or body_text MUST appear in critical_ingredients with amount+unit per 1 adult serving.
- At least one kind=critical ingredient. Prefer 3–8 ingredients.
- price_rub_per_serving: integer RUBLES supermarket cost for 1 adult home serving; NEVER above 400; omit if uncertain (no zeros).
- nutrition_per_serving: realistic; omit fields if uncertain (no zero fillers).
- Breakfast / second_breakfast / afternoon_snack: morning food ONLY (яичница, омлет, сырники, оладьи, творожная запеканка, тосты с яйцом; каша only if taste notes allow). NEVER roast chicken, soup, plov, cutlets, pasta mains. For these meals set plate_kind="complete" always (no companion).
- Lunch / dinner / late_dinner: real savory meal. Prefer meat/fish/poultry as the protein. NEVER morning forms (сырники, творожные оладьи/запеканки, каши, омлет as the lunch/dinner main).
- plate_kind (lunch/dinner/late_dinner ONLY — YOU decide):
  - "complete": the dish is already a full plate (плов, лазанья, голубцы, пельмени, pasta with protein, stew with sides built in, casserole that is a full meal, etc.). No гарнир needed.
  - "needs_companion": the main alone is NOT a full plate (cutlets, schnitzel, fried fish, veg cutlets, simple protein) — a side or sauce will be invented separately.
- NEVER invent snacks / перекусы. Do not invent recipe ids.
- Honor operatorTasteNotes: constraint PRIMARY (generalize bans); exampleDish secondary; ban=hard never; wish=soft prefer.`;

const POSITION_COMPANION_SYSTEM = `You invent ONE simple Russian companion dish (гарнир, simple protein add-on, or sauce) for a household meal planner.
It will be cooked once and eaten on TWO consecutive menu days with a given main.
Respond with a single JSON object:
{"recipe":{"name":"...","body_text":"...","fridge_keep_days":N,"plate_role":"companion","price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N},"critical_ingredients":[{"name":"...","kind":"critical"|"pantry","amount":N,"unit":"g"|"ml"|"pcs"|"tsp"|"tbsp"},...]}}.
Rules:
- Invent exactly ONE plate_role=companion. NEVER a second complex main or one-pot (плов, лазанья).
- Name the dish itself («Картофельное пюре», «Грибной соус») — NEVER «к пасте» / «к мясу» / «под курицу».
- When the main already has meat/fish, invent a carb/veg/sauce side — NOT a second meat/fish dish.
- When the main is vegetable/carb-only, invent a simple protein add-on (chicken, fish, eggs, mushrooms) OR a fitting side — your judgment.
- fridge_keep_days >= menuDayCount. body_text: 2–4 short numbered Russian cooking steps.
- HARD shopping-list completeness for name+steps. Amounts per 1 adult serving.
- Never invent snacks. Honor operatorTasteNotes (constraint PRIMARY).
- HARD: never near-duplicate of avoidNames / previousMenusDishes / the main dish.`;

/**
 * Invent + persist one recipe for a fixed (meal × day-pair × role) position.
 */
export async function inventForPosition(
  supabase: SupabaseClient,
  context: InventPositionContext,
): Promise<InventPositionResult> {
  const tasteNotes = await loadTasteNotes(supabase, context.userId);
  if (!tasteNotes) return { ok: false, reason: "query" };

  const chat = context.chat ?? openRouterChatCompletions;
  let draft: InventRecipeDraft;
  let plateKind: PositionPlateKind | null;

  try {
    const proposed = await proposePositionRecipe(chat, tasteNotes, context);
    if (!proposed) return { ok: false, reason: "parse" };
    draft = proposed.draft;
    plateKind = proposed.plateKind;
  } catch (err) {
    if (err instanceof OpenRouterError) return { ok: false, reason: "openrouter" };
    throw err;
  }

  if (!passesPositionMealFit(draft, context)) {
    return { ok: false, reason: "parse" };
  }

  const persisted = await persistInventedRecipe(supabase, draft);
  if (!persisted.ok) return { ok: false, reason: "persist" };

  return {
    ok: true,
    recipeId: persisted.recipeId,
    name: draft.name,
    plateKind:
      context.role === "main" && mealAllowsCompanion(context.meal)
        ? plateKind ?? "needs_companion"
        : null,
  };
}

async function proposePositionRecipe(
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
  context: InventPositionContext,
): Promise<{ draft: InventRecipeDraft; plateKind: PositionPlateKind | null } | null> {
  const mealRu = MEAL_LABELS_RU[context.meal];
  const daysLabel = `${context.dayPair[0]}–${context.dayPair[1]}`;
  const system =
    context.role === "companion" ? POSITION_COMPANION_SYSTEM : POSITION_MAIN_SYSTEM;

  const menuDayCount = context.menuDayCount ?? DEFAULT_DAY_COUNT;
  const userContent = JSON.stringify({
    meal: context.meal,
    mealLabelRu: mealRu,
    dayPair: [...context.dayPair],
    daysLabel,
    role: context.role,
    mainDishName: context.mainDishName ?? null,
    menuDayCount,
    peoplePerMeal: context.peoplePerMeal ?? 2,
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
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    responseFormatJson: true,
    temperature: 0.85,
  });

  return parsePositionInventJson(content, { ...context, menuDayCount });
}

/** Pure parser for single-recipe position invent JSON. */
export function parsePositionInventJson(
  content: string,
  context: Pick<InventPositionContext, "role" | "meal" | "menuDayCount">,
): { draft: InventRecipeDraft; plateKind: PositionPlateKind | null } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;

  // Accept {"recipe":{...}} or {"recipes":[{...}]} with one item.
  let row: Record<string, unknown> | null = null;
  if (root.recipe && typeof root.recipe === "object") {
    row = root.recipe as Record<string, unknown>;
  } else if (Array.isArray(root.recipes) && root.recipes[0] && typeof root.recipes[0] === "object") {
    row = root.recipes[0] as Record<string, unknown>;
  }
  if (!row) return null;

  // Reuse batch parser by wrapping as recipes array.
  const drafts = parseInventRecipesJson(
    JSON.stringify({
      recipes: [
        {
          ...row,
          plate_role:
            context.role === "companion"
              ? "companion"
              : row.plate_role ?? row.plateRole ?? "main",
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

  // Force role from position context.
  draft.plateRole = context.role;
  const minFridge = context.menuDayCount ?? DEFAULT_DAY_COUNT;
  if (draft.fridgeKeepDays < minFridge) {
    draft.fridgeKeepDays = minFridge;
  }

  let plateKind: PositionPlateKind | null = null;
  if (context.role === "main" && mealAllowsCompanion(context.meal)) {
    plateKind = parsePlateKind(row.plate_kind ?? row.plateKind);
    if (!plateKind) plateKind = "needs_companion";
  } else if (context.role === "main") {
    plateKind = "complete";
  }

  // Normalize name pairing strip already in parseInventRecipesJson path —
  // re-apply if we mutated.
  draft.name = stripHardcodedPairing(draft.name);
  draft.bodyText = normalizeRecipeBodyText(draft.bodyText);

  return { draft, plateKind };
}

function coerceFridgeKeep(raw: unknown, menuDayCount?: number): number {
  const min = menuDayCount ?? DEFAULT_DAY_COUNT;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(7, Math.max(min, Math.trunc(n)));
}

function positionInventInstruction(
  context: InventPositionContext,
  mealRu: string,
  daysLabel: string,
): string {
  const repair = context.repairReason
    ? ` REPAIR: previous pick failed variety audit — ${context.repairReason}. Invent a clearly different culinary form.`
    : "";
  if (context.role === "companion") {
    return `Invent ONE companion for «${context.mainDishName ?? "main"}» on ${mealRu}, days ${daysLabel}. plate_role=companion. fridge_keep_days>=4. Respect currentMenuDishes — no near-duplicates.${repair}`;
  }
  const plateKindHint = mealAllowsCompanion(context.meal)
    ? "Set plate_kind to complete OR needs_companion."
    : "Set plate_kind=complete.";
  return `Invent ONE main for ${mealRu}, days ${daysLabel}. plate_role=main. ${plateKindHint} fridge_keep_days>=4. Respect currentMenuDishes — different form from other meals on the same dayPair.${repair}`;
}

function passesPositionMealFit(
  draft: InventRecipeDraft,
  context: InventPositionContext,
): boolean {
  const name = draft.name;
  if (!normalizeDishName(name) || looksLikeNoCookSnack(name)) return false;
  if (context.role === "companion") return draft.plateRole === "companion";
  if (isBreakfastMeal(context.meal) || context.meal === "afternoon_snack") {
    return !looksLikeLunchDinnerOnlyMain(name);
  }
  return !looksLikeBreakfastDish(name);
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
