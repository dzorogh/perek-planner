import type { SupabaseClient } from "@supabase/supabase-js";

import type { MealSlot } from "@/domain/menu/constants";
import {
  isPlateRole,
  type PlateRole,
} from "@/domain/menu/meal-templates";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  recipeFitsAvailableEquipment,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { passesFridgeKeep } from "@/domain/matching/eligibility";
import { normalizeRecipeBodyText } from "@/domain/recipes/format-body";
import {
  normalizeDishName,
  uniqueExactNames,
} from "@/domain/suggestions/dish-similarity";
import {
  isBreakfastMeal,
  looksLikeBreakfastDish,
  looksLikeHeavyAnimalProteinDish,
  mealsIncludeLunchOrDinner,
  stripHardcodedPairing,
} from "@/domain/suggestions/meal-fit";
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

/**
 * How many *fresh* dishes we want for a staggered batch menu.
 * Used when sizing invent batches / deficit checks.
 */
export function candidateDeficitThreshold(slotCount: number): number {
  return Math.max(5, Math.ceil(slotCount * 0.6));
}

/**
 * Always invent this many NEW recipes per menu via AI (covers all meal types).
 * Sized for staggered batch menus (~half the slots are unique dishes) plus a
 * small buffer for companion dishes (sides / protein add-ons).
 */
export function inventCountPerMenu(
  slotCount: number,
  meals: readonly MealSlot[] = [],
): number {
  const mealBonus = meals.length > 0 ? Math.min(2, meals.length) : 0;
  return Math.max(5, Math.ceil(slotCount * 0.55) + mealBonus) + 2;
}

export type InventIngredientDraft = {
  name: string;
  kind: "critical" | "pantry";
  /** Amount per 1 person serving. */
  amountPerServing: number | null;
  unit: "g" | "ml" | "pcs" | "tsp" | "tbsp" | null;
};

export type InventPlateRole = PlateRole;

export type InventRecipeDraft = {
  name: string;
  bodyText: string;
  fridgeKeepDays: number;
  ingredients: InventIngredientDraft[];
  /** Persisted on recipes.plate_role. */
  plateRole: PlateRole;
  /** Multi-role one-pot claim; persisted as recipes.covers_roles. */
  coversRoles: PlateRole[] | null;
  /** Equipment required to cook; must be ⊆ menu.available_equipment. */
  requiredEquipment: EquipmentId[];
  /** Estimated cost per 1 adult serving in kopecks; omit when uncertain. */
  priceCentsPerServing: number | null;
  caloriesKcalPerServing: number | null;
  proteinGPerServing: number | null;
  fatGPerServing: number | null;
  carbsGPerServing: number | null;
};

export type InventRecipesResult =
  | {
    ok: true;
    inventedIds: string[];
    eligibleIds: string[];
  }
  | { ok: false; reason: "query" | "openrouter" | "parse" | "persist" };

/** Parallel invent chunk size — keeps each OpenRouter response short. */
export const INVENT_CHUNK_SIZE = 4;

function coerceNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  return NaN;
}

const INVENT_SYSTEM = `You invent NEW simple Russian home-cooking recipes for a household meal planner.
Every recipe is created from scratch via AI.
You alone judge culinary near-duplicates — there is no keyword filter in code. Be strict.
Cover the meal mix requested: breakfast-appropriate cooked dishes AND lunch/dinner role dishes in one batch.
Plate roles are FIXED vocabulary — invent recipe CONTENT, not meal architecture.
Use common grocery ingredients available in Russian supermarkets.
Respond with a single JSON object:
{"recipes":[{"name":"...","body_text":"...","fridge_keep_days":N,"plate_role":"main"|"soup"|"protein"|"veg"|"carb","covers_roles":["protein","carb"]?,"suitable_meals":["breakfast"|"lunch"|"dinner",...],"required_equipment":["stove"|"oven"|"air_fryer"|"grill"|"multicooker"|"pressure_cooker"|"microwave",...],"price_rub_per_serving":N,"nutrition_per_serving":{"kcal":N,"protein_g":N,"fat_g":N,"carbs_g":N},"critical_ingredients":[{"name":"...","kind":"critical"|"pantry","amount":N,"unit":"g"|"ml"|"pcs"|"tsp"|"tbsp"},...]}]}.
Rules:
- required_equipment: non-empty array of equipment ids REQUIRED to cook the dish (subset of availableEquipment from the request). Use only: stove, oven, air_fryer, grill, multicooker, pressure_cooker, microwave. HARD: never invent a dish that needs equipment outside availableEquipment.
- Prefer dishes that use the available set realistically; you need NOT use every available appliance in the batch.
- HARD variety: never invent a near-duplicate of previousMenusDishes, avoidNames, or currentMenuDishes. You judge similarity by culinary form + base, not by exact string match.
  Too close (FORBIDDEN): оладьи≈панкейки; творожная запеканка с ягодами≈творожные запеканки с изюмом; сырники с изюмом≈сырники с ягодами; овсяная каша с яблоком≈овсянка с грушей; куриные котлеты≈котлеты из курицы.
  Distinct enough (OK): творожная запеканка vs сырники; оладьи vs яичница; картофельная запеканка vs творожная запеканка; каша vs омлет.
  A topping/mix-in swap on the same form+base is NOT a new dish.
- When currentMenuDishes is non-empty (slot replace): invent a clearly different form for that meal.
- Include breakfast-suitable and lunch/dinner recipes as needed by meals. When breakfast is in meals, at least ~1/3 of plate_role=main must be true morning food.
- When lunch and/or dinner are in meals: at least ONE plate_role=protein MUST be a meat/fish/heavy-animal dish. Egg/dairy/mushroom-only proteins do NOT satisfy this quota.
- Lunch/dinner protein MUST prefer meat/fish/poultry. NEVER mark сырники, творожные оладьи/запеканки, каши, омлеты as lunch/dinner protein.
- Breakfast = cooked morning food ONLY with plate_role=main. NEVER invent roast chicken, soups, plov, cutlets as breakfast.
- plate_role values: main (breakfast family), soup, protein, veg, carb. NEVER plate_role=snack or companion. Legacy "companion" means carb.
- One-pots (плов, лазанья, голубцы, пельмени): plate_role=protein with covers_roles including protein+carb (and other roles they truly cover). Do NOT invent a separate carb for the same one-pot.
- For lunch/dinner also invent soup, veg, carb sides when not covered. Sauces/подливы are carb or veg — never breakfast mains.
- Name sides by the dish itself («Грибной соус», «Картофельное пюре»). NEVER hardcode a pairing in the name («к пасте», «к мясу»).
- NEVER invent snacks / перекусы / no-cook ready-to-eat plates. Snacks are a separate pipeline.
- body_text: SHORT cooking steps in Russian. EACH step on its OWN line, numbered "1. ", "2. ", etc. Protein/main: 3–5 short steps. Soup/veg/carb: 2–4. Cooking/heating required.
- fridge_keep_days: integer 1..7, and must be >= menuDayCount when menuDayCount is set.
- At least one ingredient with kind=critical per recipe.
- Prefer 3–8 ingredients; pantry for salt/spices/oil when needed. Sides may have 2–5.
- HARD shopping-list completeness: every buyable food in name or body_text MUST be in critical_ingredients with amount+unit per 1 adult serving.
- price_rub_per_serving: integer RUBLES; NEVER above 400. OMIT price/nutrition when uncertain — no zero fillers.
- Within this batch, each recipe must feel clearly different from the others.
- Respect operatorTasteNotes: constraint PRIMARY (generalize bans); exampleDish secondary; ban=hard never; wish=soft prefer.
- Do not invent recipe ids. NEVER invent plate_kind / needs_companion.`;

/** Split invent count into parallel chunk sizes (max INVENT_CHUNK_SIZE each). */
export function inventChunkSizes(count: number): number[] {
  if (count < 1) return [];
  const chunks: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const size = Math.min(INVENT_CHUNK_SIZE, remaining);
    chunks.push(size);
    remaining -= size;
  }
  return chunks;
}

/**
 * Ask OpenRouter for new recipes, persist to library, return fridge-gated ids.
 */
export async function inventAndPersistRecipes(
  supabase: SupabaseClient,
  menuId: string,
  count: number,
  options: {
    chat?: ChatCompletionsFn;
    userId?: string;
    /** Soft avoid list for the AI (recent menus, siblings, refused). */
    avoidNames?: string[];
    /** Exact library names — reject only exact normalized duplicates in code. */
    exactAvoidNames?: string[];
    /** Dish names from previous menus (AI variety context). */
    previousMenusDishes?: string[];
    /** Other dishes already on this menu (AI variety context). */
    currentMenuDishes?: string[];
    meals?: readonly MealSlot[];
    contextMeal?: MealSlot;
    /** People / servings per meal for this menu. */
    peoplePerMeal?: number;
  } = {},
): Promise<InventRecipesResult> {
  if (count < 1) {
    return { ok: true, inventedIds: [], eligibleIds: [] };
  }

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("day_count, user_id, default_servings_per_meal, available_equipment")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError || !menu) {
    return { ok: false, reason: "query" };
  }

  const availableEquipment =
    normalizeEquipmentList(menu.available_equipment as string[]) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];

  const userId = options.userId ?? menu.user_id;
  const tasteNotes = await loadInventTasteNotes(supabase, userId);
  if (!tasteNotes) return { ok: false, reason: "query" };
  const avoidNames = options.avoidNames ?? [];
  const exactAvoidNames = options.exactAvoidNames ?? [];
  const peopleFromMenu = positiveInteger(menu.default_servings_per_meal);
  const peoplePerMeal = positiveInteger(options.peoplePerMeal) ?? peopleFromMenu ?? 2;

  const chat = options.chat ?? openRouterChatCompletions;
  const inventContext = {
    meals: options.meals,
    contextMeal: options.contextMeal,
    avoidNames,
    previousMenusDishes: options.previousMenusDishes ?? [],
    currentMenuDishes: options.currentMenuDishes ?? [],
    menuDayCount: menu.day_count,
    peoplePerMeal,
    availableEquipment,
  };

  let drafts: InventRecipeDraft[];
  try {
    drafts = await proposeInventDraftsWithMealMix(
      count,
      chat,
      tasteNotes,
      inventContext,
      exactAvoidNames,
    );
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: "openrouter" };
    }
    throw err;
  }

  drafts = filterDraftsByAvailableEquipment(drafts, availableEquipment);

  const meals = options.meals ?? [];
  drafts = finalizeInventDraftsForPersist(
    drafts,
    exactAvoidNames,
    count,
    meals,
  );
  if (drafts.length === 0) {
    return { ok: false, reason: "parse" };
  }

  const inventedIds: string[] = [];
  const eligibleIds: string[] = [];

  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i]!;
    const row = await persistInventedRecipe(supabase, draft);
    if (!row.ok) {
      if (inventedIds.length > 0) {
        await supabase.from("recipes").delete().in("id", inventedIds);
      }
      return { ok: false, reason: "persist" };
    }
    inventedIds.push(row.recipeId);
    if (passesFridgeKeep(draft.fridgeKeepDays, menu.day_count)) {
      eligibleIds.push(row.recipeId);
    }
  }

  return { ok: true, inventedIds, eligibleIds };
}

async function loadInventTasteNotes(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<TasteNote[] | null> {
  if (!userId) return [];
  return loadTasteNotes(supabase, userId);
}

function positiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || value < 1) return null;
  return Math.trunc(value);
}

/** Keep drafts with unique exact names vs exactAvoid and vs each other. */
export function selectExactUniqueDrafts(
  drafts: InventRecipeDraft[],
  exactAvoid: string[],
  limit: number,
): InventRecipeDraft[] {
  const exact = new Set(
    exactAvoid.map((n) => normalizeDishName(n)).filter(Boolean),
  );
  const kept: InventRecipeDraft[] = [];
  for (const draft of drafts) {
    const norm = normalizeDishName(draft.name);
    if (!norm || exact.has(norm)) continue;
    exact.add(norm);
    kept.push(draft);
    if (kept.length >= limit) break;
  }
  return kept;
}

/** Count protein/main drafts that signal meat/fish. */
export function countHeavyAnimalMainsInDrafts(
  drafts: readonly InventRecipeDraft[],
): number {
  return drafts.filter(
    (d) =>
      (d.plateRole === "protein" || d.plateRole === "main") &&
      looksLikeHeavyAnimalProteinDish(d.name),
  ).length;
}

function isPrimaryRole(role: PlateRole): boolean {
  return role === "protein" || role === "main";
}

function isSideRole(role: PlateRole): boolean {
  return role === "carb" || role === "veg" || role === "soup";
}

/** Snack/breakfast filters + meal-mix select; empty when L/D meat quota fails. */
function finalizeInventDraftsForPersist(
  drafts: InventRecipeDraft[],
  exactAvoidNames: string[],
  count: number,
  meals: readonly MealSlot[],
): InventRecipeDraft[] {
  // Do not hard-drop drafts by name heuristics (snack/breakfast shape) —
  // that rejects valid AI output. Prefer via selectInventDraftsForMeals.
  const kept = selectInventDraftsForMeals(
    drafts,
    exactAvoidNames,
    count,
    meals,
  );
  if (
    mealsIncludeLunchOrDinner(meals) &&
    countHeavyAnimalMainsInDrafts(kept) === 0
  ) {
    return [];
  }
  return kept;
}

/**
 * When lunch/dinner are requested, keep heavy-animal and L/D-eligible mains
 * before breakfast-only forms so morning dishes do not crowd out dinners.
 */
export function selectInventDraftsForMeals(
  drafts: InventRecipeDraft[],
  exactAvoid: string[],
  limit: number,
  meals: readonly MealSlot[],
): InventRecipeDraft[] {
  const unique = selectExactUniqueDrafts(drafts, exactAvoid, drafts.length);
  if (!mealsIncludeLunchOrDinner(meals)) {
    return unique.slice(0, limit);
  }

  const hasBreakfast = meals.some(isBreakfastMeal);
  const kept: InventRecipeDraft[] = [];
  const used = new Set<string>();

  const tryAdd = (draft: InventRecipeDraft): boolean => {
    if (kept.length >= limit) return false;
    const norm = normalizeDishName(draft.name);
    if (!norm || used.has(norm)) return false;
    used.add(norm);
    kept.push(draft);
    return true;
  };

  const mains = unique.filter((d) => isPrimaryRole(d.plateRole));
  const sides = unique.filter((d) => isSideRole(d.plateRole));
  const heavyAnimal = mains.filter((d) =>
    looksLikeHeavyAnimalProteinDish(d.name),
  );
  const ldEligible = mains.filter(
    (d) =>
      !looksLikeHeavyAnimalProteinDish(d.name) &&
      !looksLikeBreakfastDish(d.name),
  );
  const breakfastMains = mains.filter((d) => looksLikeBreakfastDish(d.name));

  for (const draft of heavyAnimal) tryAdd(draft);
  for (const draft of ldEligible) tryAdd(draft);
  if (hasBreakfast) {
    for (const draft of breakfastMains) tryAdd(draft);
  }
  for (const draft of sides) tryAdd(draft);
  // Fill remainder without reintroducing breakfast mains when breakfast is off.
  for (const draft of unique) {
    if (
      !hasBreakfast &&
      draft.plateRole === "main" &&
      looksLikeBreakfastDish(draft.name)
    ) {
      continue;
    }
    tryAdd(draft);
  }

  return kept;
}

async function proposeInventDraftsWithMealMix(
  count: number,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
  context: {
    meals?: readonly MealSlot[];
    contextMeal?: MealSlot;
    avoidNames?: string[];
    previousMenusDishes?: string[];
    currentMenuDishes?: string[];
    menuDayCount?: number;
    peoplePerMeal?: number;
    availableEquipment?: readonly EquipmentId[];
  },
  exactAvoidNames: string[] = [],
): Promise<InventRecipeDraft[]> {
  const meals = context.meals ?? [];
  let drafts = await fetchInventDraftChunks(count, chat, tasteNotes, context);

  const keptHeavy = () =>
    countHeavyAnimalMainsInDrafts(
      selectInventDraftsForMeals(drafts, exactAvoidNames, count, meals),
    );

  if (mealsIncludeLunchOrDinner(meals) && keptHeavy() === 0) {
    const retry = await fetchInventDraftChunks(count, chat, tasteNotes, {
      ...context,
      avoidNames: [
        ...(context.avoidNames ?? []),
        ...drafts.map((d) => d.name),
      ],
    });
    drafts = [...drafts, ...retry];
  }

  if (mealsIncludeLunchOrDinner(meals) && keptHeavy() === 0) {
    return [];
  }

  return drafts;
}

async function fetchInventDraftChunks(
  count: number,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[],
  context: Parameters<typeof proposeInventedRecipes>[3],
): Promise<InventRecipeDraft[]> {
  const chunkResults = await Promise.all(
    inventChunkSizes(count).map((chunkCount) =>
      proposeInventedRecipes(chunkCount, chat, tasteNotes, context),
    ),
  );
  return chunkResults.flat();
}

export async function proposeInventedRecipes(
  count: number,
  chat: ChatCompletionsFn,
  tasteNotes: TasteNote[] = [],
  context: {
    meals?: readonly MealSlot[];
    contextMeal?: MealSlot;
    avoidNames?: string[];
    previousMenusDishes?: string[];
    currentMenuDishes?: string[];
    menuDayCount?: number;
    peoplePerMeal?: number;
    availableEquipment?: readonly EquipmentId[];
  } = {},
): Promise<InventRecipeDraft[]> {
  const menuDayCount =
    context.menuDayCount != null && context.menuDayCount >= 1
      ? Math.trunc(context.menuDayCount)
      : null;
  const peoplePerMeal =
    context.peoplePerMeal != null && context.peoplePerMeal >= 1
      ? Math.trunc(context.peoplePerMeal)
      : null;
  const availableEquipment =
    normalizeEquipmentList(context.availableEquipment) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];

  const userContent = JSON.stringify({
    inventCount: count + 1,
    targetKeep: count,
    meals: context.meals ?? ["breakfast", "lunch", "dinner"],
    contextMeal: context.contextMeal ?? null,
    menuDayCount,
    peoplePerMeal,
    availableEquipment,
    previousMenusDishes: uniqueExactNames(context.previousMenusDishes ?? []).slice(
      0,
      60,
    ),
    currentMenuDishes: uniqueExactNames(context.currentMenuDishes ?? []).slice(
      0,
      40,
    ),
    avoidNames: uniqueExactNames(context.avoidNames ?? []).slice(0, 50),
    instruction:
      "Invent inventCount NEW cooked recipes via AI (extras so we can keep targetKeep). Mix plate_role=main (breakfast), protein/soup/veg/carb (lunch/dinner). One-pots may set covers_roles. HARD: you own near-duplicate judgment — never invent the same culinary form+base as anything in previousMenusDishes, currentMenuDishes, or avoidNames. If currentMenuDishes is set, invent a clearly different form for contextMeal. Cover cooked breakfast and lunch/dinner as needed by meals — when breakfast is requested, invent real morning food with plate_role=main. Never roast chicken/soup/plov/cutlets for breakfast. When lunch/dinner are in meals: include at least ONE meat/fish protein. NEVER mark morning forms as lunch/dinner protein. Never invent перекусы/no-cook snacks. Honor operatorTasteNotes. Keep body_text short. HARD: every buyable food in name or body_text MUST be in critical_ingredients. fridge_keep_days >= menuDayCount. HARD: required_equipment must be non-empty and ⊆ availableEquipment. NEVER plate_kind.",
    operatorTasteNotes: tasteNotesForPrompt(tasteNotes),
  });

  const content = await chat({
    messages: [
      { role: "system", content: INVENT_SYSTEM },
      { role: "user", content: userContent },
    ],
    responseFormatJson: true,
    temperature: 0.9,
  });

  return parseInventRecipesJson(content);
}

/** Pure parser for invent JSON. */
export function parseInventRecipesJson(content: string): InventRecipeDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return [];
  }

  const root = parsed as { recipes?: unknown };
  if (!Array.isArray(root.recipes)) {
    return [];
  }

  const out: InventRecipeDraft[] = [];
  root.recipes.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const rawName = typeof row.name === "string" ? row.name.trim() : "";
    const name = rawName ? stripHardcodedPairing(rawName) : "";
    const bodyText = readString(row.body_text) ?? readString(row.bodyText) ?? "";
    const fridgeRaw = row.fridge_keep_days ?? row.fridgeKeepDays;
    const fridgeKeepDays = coerceNumber(fridgeRaw);
    const ingredientsRaw = row.critical_ingredients ?? row.criticalIngredients;
    if (!name || !bodyText || !Number.isFinite(fridgeKeepDays)) return;
    if (fridgeKeepDays < 1 || fridgeKeepDays > 7) return;
    if (!Array.isArray(ingredientsRaw)) return;

    const ingredients: InventIngredientDraft[] = [];
    ingredientsRaw.forEach((ing) => {
      if (!ing || typeof ing !== "object") return;
      const ingRow = ing as {
        name?: unknown;
        kind?: unknown;
        amount?: unknown;
        amount_per_serving?: unknown;
        amountPerServing?: unknown;
        unit?: unknown;
      };
      const ingName =
        typeof ingRow.name === "string" ? ingRow.name.trim() : "";
      const kind = ingRow.kind;
      if (!ingName || (kind !== "critical" && kind !== "pantry")) return;
      const amountRaw =
        ingRow.amount ?? ingRow.amount_per_serving ?? ingRow.amountPerServing;
      const amountNum = coerceNumber(amountRaw);
      const unitRaw = ingRow.unit;
      const unit =
        unitRaw === "g" ||
          unitRaw === "ml" ||
          unitRaw === "pcs" ||
          unitRaw === "tsp" ||
          unitRaw === "tbsp"
          ? unitRaw
          : null;
      const amountPerServing =
        unit && Number.isFinite(amountNum) && amountNum > 0
          ? amountNum
          : null;
      ingredients.push({
        name: ingName,
        kind,
        amountPerServing: amountPerServing != null ? amountPerServing : null,
        unit: amountPerServing != null ? unit : null,
      });
    });

    const critical = ingredients.filter((i) => i.kind === "critical");
    if (critical.length === 0) return;
    if (critical.some((i) => i.amountPerServing == null || i.unit == null)) {
      return;
    }

    const requiredEquipment = normalizeEquipmentList(
      (row.required_equipment ?? row.requiredEquipment) as
      | string[]
      | undefined,
    );
    if (!requiredEquipment) return;

    const plateRole = parseInventPlateRole(row.plate_role ?? row.plateRole);
    if (!plateRole) return;

    const coversRoles = parseCoversRoles(row.covers_roles ?? row.coversRoles);
    const priceCentsPerServing = inventPriceToKopecks(row);

    const nutritionRaw =
      row.nutrition_per_serving ?? row.nutritionPerServing;
    const nutrition =
      nutritionRaw && typeof nutritionRaw === "object"
        ? (nutritionRaw as Record<string, unknown>)
        : null;
    const caloriesKcalPerServing = parseOptionalNonNegInt(
      nutrition?.kcal ??
      row.calories_kcal_per_serving ??
      row.caloriesKcalPerServing,
    );
    const proteinGPerServing = parseOptionalNonNegNumber(
      nutrition?.protein_g ??
      nutrition?.proteinG ??
      row.protein_g_per_serving ??
      row.proteinGPerServing,
    );
    const fatGPerServing = parseOptionalNonNegNumber(
      nutrition?.fat_g ??
      nutrition?.fatG ??
      row.fat_g_per_serving ??
      row.fatGPerServing,
    );
    const carbsGPerServing = parseOptionalNonNegNumber(
      nutrition?.carbs_g ??
      nutrition?.carbsG ??
      row.carbs_g_per_serving ??
      row.carbsGPerServing,
    );

    out.push({
      name: name.slice(0, 120),
      bodyText: normalizeRecipeBodyText(bodyText),
      fridgeKeepDays: Math.trunc(fridgeKeepDays),
      ingredients,
      plateRole,
      coversRoles,
      requiredEquipment,
      priceCentsPerServing,
      caloriesKcalPerServing,
      proteinGPerServing,
      fatGPerServing,
      carbsGPerServing,
    });
  });

  return out;
}

/** Map invent JSON plate_role; legacy companion → carb. */
export function parseInventPlateRole(raw: unknown): PlateRole | null {
  if (typeof raw !== "string") return null;
  if (raw === "companion") return "carb";
  if (isPlateRole(raw) && raw !== "snack") return raw;
  return null;
}

/** Keep invent drafts cookable with the menu's available equipment. */
export function filterDraftsByAvailableEquipment(
  drafts: InventRecipeDraft[],
  available: readonly EquipmentId[],
): InventRecipeDraft[] {
  return drafts.filter((d) =>
    recipeFitsAvailableEquipment(d.requiredEquipment, available),
  );
}

function parseOptionalNonNegInt(raw: unknown): number | null {
  const n = coerceNumber(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  // Treat exact 0 as "omitted filler" — keep null.
  if (n === 0) return null;
  return Math.trunc(n);
}

/** Above this, a home-cooking per-serving estimate is not credible. */
const MAX_PRICE_RUB_PER_SERVING = 400;

/**
 * Values below this in a legacy "cents/kopecks" field are almost always
 * rubles the model put in the wrong unit (e.g. 200 → meant 200 ₽, not 2 ₽).
 * Real kopecks for a cooked serving are typically ≥ 5000 (50 ₽).
 */
const LEGACY_CENTS_RUBLE_HEURISTIC_MAX = 5000;

/**
 * Normalize invent JSON price fields to kopecks for DB storage.
 * Prefers `price_rub_per_serving`. Legacy `price_cents_per_serving` is
 * accepted, with a rubles→kopecks heuristic when the value looks too small
 * to already be kopecks.
 */
export function inventPriceToKopecks(
  row: Record<string, unknown>,
): number | null {
  const rubRaw = row.price_rub_per_serving ?? row.priceRubPerServing;
  const rub = parseOptionalNonNegInt(rubRaw);
  if (rub != null) {
    if (rub > MAX_PRICE_RUB_PER_SERVING) return null;
    return rub * 100;
  }

  const centsRaw =
    row.price_cents_per_serving ?? row.priceCentsPerServing;
  const cents = parseOptionalNonNegInt(centsRaw);
  if (cents == null) return null;

  if (cents < LEGACY_CENTS_RUBLE_HEURISTIC_MAX) {
    if (cents > MAX_PRICE_RUB_PER_SERVING) return null;
    return cents * 100;
  }

  if (cents > MAX_PRICE_RUB_PER_SERVING * 100) return null;
  return cents;
}

function parseOptionalNonNegNumber(raw: unknown): number | null {
  const n = coerceNumber(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return null;
  return n;
}

function readString(raw: unknown): string | null {
  return typeof raw === "string" ? raw.trim() : null;
}

export async function persistInventedRecipe(
  supabase: SupabaseClient,
  draft: InventRecipeDraft,
): Promise<{ ok: true; recipeId: string } | { ok: false }> {
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      name: draft.name,
      body_text: draft.bodyText,
      fridge_keep_days: draft.fridgeKeepDays,
      plate_role: draft.plateRole,
      covers_roles: draft.coversRoles,
      required_equipment: draft.requiredEquipment,
      price_cents_per_serving: draft.priceCentsPerServing,
      calories_kcal_per_serving: draft.caloriesKcalPerServing,
      protein_g_per_serving: draft.proteinGPerServing,
      fat_g_per_serving: draft.fatGPerServing,
      carbs_g_per_serving: draft.carbsGPerServing,
    })
    .select("id")
    .single();

  if (recipeError || !recipe?.id) {
    return { ok: false };
  }

  const rows = draft.ingredients.map((ing, index) => ({
    recipe_id: recipe.id,
    name: ing.name,
    kind: ing.kind,
    amount_per_serving: ing.amountPerServing,
    unit: ing.unit,
    sort_order: index + 1,
  }));

  const { error: ingError } = await supabase
    .from("critical_ingredients")
    .insert(rows);

  if (ingError) {
    await supabase.from("recipes").delete().eq("id", recipe.id);
    return { ok: false };
  }

  return { ok: true, recipeId: recipe.id };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/** Legacy helper when a caller only knows a deficit count. */
export function inventCountForDeficit(
  freshCount: number,
  slotCount: number,
  buffer = 3,
): number {
  const threshold = candidateDeficitThreshold(slotCount);
  if (freshCount >= threshold) return 0;
  return threshold - freshCount + buffer;
}
