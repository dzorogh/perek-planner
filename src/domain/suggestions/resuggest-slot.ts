import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mealAllowsCompanion,
  menuDayPairForDay,
  type MealSlot,
  type MenuDayPair,
} from "@/domain/menu/constants";
import { isPlateRole, type PlateRole } from "@/domain/menu/meal-templates";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { assignProposalsToSlots } from "@/domain/suggestions/assign";
import { buildCandidates } from "@/domain/suggestions/candidates";
import {
  SUGGESTION_FAIL_RU,
  SuggestionError,
} from "@/domain/suggestions/errors";
import { recordTasteBanFromFeedback } from "@/domain/settings/taste-preferences";
import {
  analyzeMenuVariety,
  type MenuPlanDish,
} from "@/domain/suggestions/analyze-menu-variety";
import { namesEqual } from "@/domain/suggestions/dish-similarity";
import {
  expandMenuRecipes,
  type ExpandedDish,
} from "@/domain/suggestions/expand-menu-recipes";
import { loadRecentMenuDishNames } from "@/domain/suggestions/history";
import {
  isLunchDinnerMeal,
  looksLikeHeavyAnimalProteinDish,
  looksLikeNoCookSnack,
} from "@/domain/suggestions/meal-fit";
import type { ProposedAssignment } from "@/domain/suggestions/openrouter-generate";
import {
  planKey,
  proposePositionModifyPlan,
  proposePositionNamePlan,
  type PositionModifySource,
} from "@/domain/suggestions/plan-menu-names";
import {
  expandDishAssignments,
  mergeDishAssignments,
  type SlotDishAssignment,
  legacyFksFromDishes,
} from "@/domain/suggestions/role-slots";
import { loadSuppressSets } from "@/domain/suggestions/suppress";
import { loadTasteNotes } from "@/domain/suggestions/taste-notes";
import {
  isValidFeedbackComment,
  normalizeFeedbackComment,
} from "@/domain/history/constants";
import {
  getOpenRouterApiKey,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

function resuggestFailMessage(err: unknown): string {
  if (err instanceof SuggestionError) return err.message;
  if (err instanceof OpenRouterError) return SUGGESTION_FAIL_RU.openrouter;
  return SUGGESTION_FAIL_RU.openrouter;
}

export type ResuggestSlotResult =
  | { ok: true }
  | { ok: false; error: string };

/** UI still uses main|companion; mapped to protein|main / carb internally. */
export type SlotDishTarget = "main" | "companion" | PlateRole;

function plateRoleForTarget(meal: MealSlot, target: SlotDishTarget): PlateRole {
  if (target === "companion" || target === "carb") return "carb";
  if (target === "main") {
    return isLunchDinnerMeal(meal) ? "protein" : "main";
  }
  if (target === "snack") return isLunchDinnerMeal(meal) ? "protein" : "main";
  return target;
}

function isCarbTarget(target: SlotDishTarget): boolean {
  return target === "companion" || target === "carb";
}

function isPrimaryTarget(meal: MealSlot, target: SlotDishTarget): boolean {
  return (
    plateRoleForTarget(meal, target) === plateRoleForTarget(meal, "main")
  );
}

/** Resolve the recipe on a slot for an overflow target (dishes first, FK shim fallback). */
async function resolveRecipeIdForTarget(
  supabase: SupabaseClient,
  slot: SlotRow,
  target: SlotDishTarget,
): Promise<string | null> {
  const meal = slot.meal as MealSlot;
  const role = plateRoleForTarget(meal, target);
  const { data } = await supabase
    .from("menu_slot_dishes")
    .select("recipe_id")
    .eq("menu_slot_id", slot.id)
    .eq("plate_role", role)
    .not("recipe_id", "is", null)
    .maybeSingle();
  if (typeof data?.recipe_id === "string") return data.recipe_id;
  if (role === "carb") return slot.companion_recipe_id;
  if (role === "protein" || role === "main") return slot.recipe_id;
  return null;
}

type SlotRow = {
  id: string;
  day_index: number;
  meal: string;
  recipe_id: string | null;
  companion_recipe_id: string | null;
};

type ResuggestOptions = {
  chat?: ChatCompletionsFn;
  now?: Date;
  forceSuppressIds?: string[];
};

function requireOpenRouter(
  chat?: ChatCompletionsFn,
): ResuggestSlotResult | null {
  if (!getOpenRouterApiKey() && !chat) {
    return { ok: false, error: SUGGESTION_FAIL_RU.no_key };
  }
  return null;
}

type MenuSlotNameRow = {
  day_index: number;
  meal: string;
  recipe_id: string | null;
  companion_recipe_id: string | null;
  recipes: { name: string } | { name: string }[] | null;
  companion: { name: string } | { name: string }[] | null;
};

/**
 * Cookable dishes currently on the menu (names + positions) for audit/avoid.
 */
async function loadMenuPlanDishes(
  supabase: SupabaseClient,
  menuId: string,
  options: { excludeRecipeIds?: ReadonlySet<string> } = {},
): Promise<MenuPlanDish[] | null> {
  const { data, error } = await supabase
    .from("menu_slots")
    .select(
      `id, day_index, meal, recipe_id, companion_recipe_id,
       recipes!menu_slots_recipe_id_fkey(name),
       companion:recipes!menu_slots_companion_recipe_id_fkey(name),
       menu_slot_dishes(plate_role, recipe_id, recipes(name))`,
    )
    .eq("menu_id", menuId);

  if (error || !data) return null;

  const exclude = options.excludeRecipeIds ?? new Set<string>();
  const byKey = new Map<string, MenuPlanDish>();

  const push = (
    meal: string,
    dayIndex: number,
    plateRole: PlateRole,
    recipeId: string | null,
    recipes: { name: string } | { name: string }[] | null | undefined,
  ) => {
    if (!recipeId || exclude.has(recipeId)) return;
    const dayPair = menuDayPairForDay(dayIndex);
    if (!dayPair) return;
    const recipe = Array.isArray(recipes) ? recipes[0] : recipes;
    const name = recipe?.name?.trim();
    if (!name) return;
    const key = `${meal}:${dayPair[0]}-${dayPair[1]}:${plateRole}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      meal: meal as MealSlot,
      dayPair,
      plateRole,
      name,
      recipeId,
    });
  };

  for (const row of data as Array<
    MenuSlotNameRow & {
      menu_slot_dishes?: Array<{
        plate_role?: string;
        recipe_id?: string | null;
        recipes?: { name: string } | { name: string }[] | null;
      }> | null;
    }
  >) {
    const meal = row.meal as MealSlot;
    const primaryRole: PlateRole = isLunchDinnerMeal(meal) ? "protein" : "main";
    push(row.meal, row.day_index, primaryRole, row.recipe_id, row.recipes);
    push(
      row.meal,
      row.day_index,
      "carb",
      row.companion_recipe_id,
      row.companion,
    );
    for (const dish of row.menu_slot_dishes ?? []) {
      if (typeof dish.plate_role !== "string" || !isPlateRole(dish.plate_role)) {
        continue;
      }
      if (dish.plate_role === "snack") continue;
      push(
        row.meal,
        row.day_index,
        dish.plate_role,
        typeof dish.recipe_id === "string" ? dish.recipe_id : null,
        dish.recipes,
      );
    }
  }
  return [...byKey.values()];
}

async function loadExistingDishAssignments(
  supabase: SupabaseClient,
  slotIds: string[],
): Promise<Map<string, SlotDishAssignment[]>> {
  const bySlot = new Map<string, SlotDishAssignment[]>();
  if (slotIds.length === 0) return bySlot;
  const { data } = await supabase
    .from("menu_slot_dishes")
    .select("menu_slot_id, plate_role, recipe_id")
    .in("menu_slot_id", slotIds)
    .not("recipe_id", "is", null);
  for (const row of data ?? []) {
    if (
      typeof row.menu_slot_id !== "string" ||
      typeof row.plate_role !== "string" ||
      !isPlateRole(row.plate_role) ||
      row.plate_role === "snack" ||
      typeof row.recipe_id !== "string"
    ) {
      continue;
    }
    const list = bySlot.get(row.menu_slot_id) ?? [];
    list.push({ plateRole: row.plate_role, recipeId: row.recipe_id });
    bySlot.set(row.menu_slot_id, list);
  }
  return bySlot;
}

function proposalsMergingExisting(
  pairSlots: SlotRow[],
  incoming: SlotDishAssignment[],
  existingBySlot: Map<string, SlotDishAssignment[]>,
): ProposedAssignment[] {
  return pairSlots.map((s) => {
    const merged = mergeDishAssignments(
      existingBySlot.get(s.id) ?? [],
      incoming,
    );
    const fks = legacyFksFromDishes(merged);
    return {
      slotId: s.id,
      dishes: merged,
      recipeId: fks.recipeId ?? incoming[0]?.recipeId,
      companionRecipeId: fks.companionRecipeId,
    };
  });
}

async function loadMenuMeta(
  supabase: SupabaseClient,
  menuId: string,
): Promise<{
  peoplePerMeal?: number;
  dayCount: number;
  availableEquipment: EquipmentId[];
} | null> {
  const { data } = await supabase
    .from("menus")
    .select("default_servings_per_meal, day_count, available_equipment")
    .eq("id", menuId)
    .maybeSingle();
  const dayCount = data?.day_count;
  if (typeof dayCount !== "number" || dayCount < 1) return null;
  const n = data?.default_servings_per_meal;
  return {
    dayCount: Math.trunc(dayCount),
    peoplePerMeal:
      typeof n === "number" && n >= 1 ? Math.trunc(n) : undefined,
    availableEquipment:
      normalizeEquipmentList(data?.available_equipment as string[]) ?? [
        ...DEFAULT_AVAILABLE_EQUIPMENT,
      ],
  };
}

async function loadPairSlots(
  supabase: SupabaseClient,
  menuId: string,
  meal: MealSlot,
  dayPair: MenuDayPair,
): Promise<SlotRow[] | null> {
  const { data, error } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("menu_id", menuId)
    .eq("meal", meal)
    .in("day_index", [...dayPair]);

  if (error || !data || data.length === 0) return null;
  return data as SlotRow[];
}

async function loadRecipeNamesByIds(
  supabase: SupabaseClient,
  ids: ReadonlySet<string>,
): Promise<string[]> {
  if (ids.size === 0) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("name")
    .in("id", [...ids]);
  if (error || !data) return [];
  return data
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));
}

async function resuggestNameContext(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  excludeRecipeIds: ReadonlySet<string>,
): Promise<{
  keepDishes: MenuPlanDish[];
  avoidNames: string[];
  previousMenusDishes: string[];
} | null> {
  const previousMenusDishes =
    (await loadRecentMenuDishNames(supabase, userId, {
      excludeMenuId: menuId,
    })) ?? null;
  if (!previousMenusDishes) return null;
  const keepDishes = await loadMenuPlanDishes(supabase, menuId, {
    excludeRecipeIds,
  });
  if (!keepDishes) return null;
  // Excluded ids leave keepDishes — still ban their names so replace ≠ same label.
  const replacedNames = await loadRecipeNamesByIds(supabase, excludeRecipeIds);
  return {
    keepDishes,
    previousMenusDishes,
    avoidNames: [
      ...previousMenusDishes,
      ...keepDishes.map((d) => d.name),
      ...replacedNames,
    ],
  };
}

/** Like resuggest context, but source recipe names stay allowed (variant path). */
async function modifyNameContext(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  excludeRecipeIds: ReadonlySet<string>,
): Promise<{
  keepDishes: MenuPlanDish[];
  avoidNames: string[];
  previousMenusDishes: string[];
} | null> {
  const previousMenusDishes =
    (await loadRecentMenuDishNames(supabase, userId, {
      excludeMenuId: menuId,
    })) ?? null;
  if (!previousMenusDishes) return null;
  const keepDishes = await loadMenuPlanDishes(supabase, menuId, {
    excludeRecipeIds,
  });
  if (!keepDishes) return null;
  return {
    keepDishes,
    previousMenusDishes,
    avoidNames: [...previousMenusDishes, ...keepDishes.map((d) => d.name)],
  };
}

async function loadRecipeSource(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<PositionModifySource | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select("name, body_text")
    .eq("id", recipeId)
    .maybeSingle();
  if (error || !data?.name?.trim()) return null;
  return {
    name: data.name.trim(),
    bodyText:
      typeof data.body_text === "string" ? data.body_text.trim() : undefined,
  };
}

type InventNamePlanErr = { ok: false; error: string };

function planFail(
  reason: "openrouter" | "parse" | "persist" | "query",
): InventNamePlanErr {
  return { ok: false, error: SUGGESTION_FAIL_RU[reason] };
}

function positionTouchesReplace(
  position: { meal: MealSlot; dayPair: MenuDayPair },
  replace: Array<{ meal: MealSlot; dayPair: MenuDayPair }>,
): boolean {
  return replace.some(
    (r) =>
      r.meal === position.meal &&
      r.dayPair[0] === position.dayPair[0] &&
      r.dayPair[1] === position.dayPair[1],
  );
}

/**
 * Names → variety audit (vs rest of menu) → expand recipes for one position.
 */
async function inventPositionViaNamePlan(
  supabase: SupabaseClient,
  userId: string,
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    plateRole: PlateRole;
  },
  ctx: {
    keepDishes: MenuPlanDish[];
    avoidNames: string[];
    previousMenusDishes: string[];
  },
  options: ResuggestOptions & {
    peoplePerMeal?: number;
    menuDayCount: number;
    availableEquipment: readonly EquipmentId[];
  },
): Promise<
  | { ok: true; dishes: ExpandedDish[]; inventedIds: string[] }
  | { ok: false; error: string }
> {
  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) return planFail("query");

  const proposeOnce = (avoidNames: string[]) =>
    proposePositionNamePlan(position, {
      keepDishes: ctx.keepDishes,
      previousMenusDishes: ctx.previousMenusDishes,
      avoidNames,
      peoplePerMeal: options.peoplePerMeal,
      tasteNotes,
      chat: options.chat,
    });

  const planned = await proposeOnce(ctx.avoidNames);
  if (!planned.ok) return planFail(planned.reason);

  let plan = planned.plan;

  const planHitsAvoid = (names: readonly { name: string }[]) =>
    names.some((d) => ctx.avoidNames.some((a) => namesEqual(a, d.name)));

  // Soft prompt can still echo the replaced label — force a different name.
  if (planHitsAvoid(plan)) {
    const repaired = await proposeOnce([
      ...ctx.avoidNames,
      ...plan.map((d) => d.name),
    ]);
    if (!repaired.ok) return planFail(repaired.reason);
    plan = repaired.plan;
    if (planHitsAvoid(plan)) return planFail("parse");
  }

  const audit = await analyzeMenuVariety(
    [
      ...ctx.keepDishes,
      ...plan.map((d) => ({
        meal: d.meal,
        dayPair: d.dayPair,
        plateRole: d.plateRole,
        name: d.name,
        recipeId: planKey(d),
      })),
    ],
    { chat: options.chat },
  );

  if (
    audit.ok &&
    audit.replace.length > 0 &&
    positionTouchesReplace(position, audit.replace)
  ) {
    const rejected = plan.map((d) => d.name);
    const repaired = await proposeOnce([...ctx.avoidNames, ...rejected]);
    if (repaired.ok) plan = repaired.plan;
    if (planHitsAvoid(plan)) return planFail("parse");
  }

  const expanded = await expandMenuRecipes(supabase, plan, {
    menuDayCount: options.menuDayCount,
    peoplePerMeal: options.peoplePerMeal,
    tasteNotes,
    chat: options.chat,
    availableEquipment: options.availableEquipment,
  });
  if (!expanded.ok) return planFail(expanded.reason);

  return {
    ok: true,
    dishes: expanded.dishes,
    inventedIds: expanded.dishes.map((d) => d.recipeId),
  };
}

/**
 * Variant path: names from source+wish → expand with wish (no harsh variety replace).
 */
async function inventPositionViaModifyPlan(
  supabase: SupabaseClient,
  userId: string,
  position: {
    meal: MealSlot;
    dayPair: MenuDayPair;
    plateRole: PlateRole;
  },
  ctx: {
    keepDishes: MenuPlanDish[];
    avoidNames: string[];
    previousMenusDishes: string[];
    sourceDish: PositionModifySource;
    userWish: string;
    keepExistingCarb?: boolean;
  },
  options: ResuggestOptions & {
    peoplePerMeal?: number;
    menuDayCount: number;
    availableEquipment: readonly EquipmentId[];
  },
): Promise<
  | { ok: true; dishes: ExpandedDish[]; inventedIds: string[] }
  | { ok: false; error: string }
> {
  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) return planFail("query");

  const planned = await proposePositionModifyPlan(position, {
    sourceDish: ctx.sourceDish,
    userWish: ctx.userWish,
    keepExistingCarb: ctx.keepExistingCarb,
    keepDishes: ctx.keepDishes,
    previousMenusDishes: ctx.previousMenusDishes,
    avoidNames: ctx.avoidNames,
    peoplePerMeal: options.peoplePerMeal,
    tasteNotes,
    chat: options.chat,
  });
  if (!planned.ok) return planFail(planned.reason);

  const plan = planned.plan;
  const hitsOtherMenu = plan.some((d) =>
    ctx.avoidNames.some(
      (a) =>
        namesEqual(a, d.name) && !namesEqual(a, ctx.sourceDish.name),
    ),
  );
  if (hitsOtherMenu) return planFail("parse");

  const expanded = await expandMenuRecipes(supabase, plan, {
    menuDayCount: options.menuDayCount,
    peoplePerMeal: options.peoplePerMeal,
    tasteNotes,
    chat: options.chat,
    availableEquipment: options.availableEquipment,
    modification: {
      wish: ctx.userWish,
      sourceRecipe: ctx.sourceDish.bodyText
        ? { name: ctx.sourceDish.name, bodyText: ctx.sourceDish.bodyText }
        : undefined,
    },
  });
  if (!expanded.ok) return planFail(expanded.reason);

  return {
    ok: true,
    dishes: expanded.dishes,
    inventedIds: expanded.dishes.map((d) => d.recipeId),
  };
}

async function assignPairProposals(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  proposals: ProposedAssignment[],
  inventedIds: string[],
  forceSuppressIds: string[] = [],
): Promise<ResuggestSlotResult> {
  const now = new Date();
  const built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const nameById = new Map(
    built.candidates
      .filter((c) => !looksLikeNoCookSnack(c.name))
      .map((c) => [c.recipeId, c.name] as const),
  );
  const sanitized = proposals.map((p) => {
    const dishes = p.dishes ?? [];
    const protein = dishes.find((d) => d.plateRole === "protein");
    const carb = dishes.find((d) => d.plateRole === "carb");
    if (!protein || !carb) return p;
    if (protein.recipeId === carb.recipeId) return p;
    const proteinName = nameById.get(protein.recipeId) ?? "";
    const carbName = nameById.get(carb.recipeId) ?? "";
    if (
      looksLikeHeavyAnimalProteinDish(proteinName) &&
      looksLikeHeavyAnimalProteinDish(carbName)
    ) {
      const next = dishes.filter((d) => d.plateRole !== "carb");
      const fks = legacyFksFromDishes(next);
      return {
        ...p,
        dishes: next,
        recipeId: fks.recipeId ?? p.recipeId,
        companionRecipeId: null,
      };
    }
    return p;
  });

  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }
  forceSuppressIds.forEach((id) => suppress.refusedIds.add(id));

  const neededIds = new Set<string>(inventedIds);
  for (const p of sanitized) {
    if (p.recipeId) neededIds.add(p.recipeId);
    for (const d of p.dishes ?? []) neededIds.add(d.recipeId);
    if (p.companionRecipeId) neededIds.add(p.companionRecipeId);
  }
  const assignPool = built.candidates.filter((c) => neededIds.has(c.recipeId));

  if (assignPool.length === 0) {
    return { ok: false, error: SUGGESTION_FAIL_RU.zero_eligible };
  }

  const assignResult = await assignProposalsToSlots(
    supabase,
    menuId,
    sanitized,
    assignPool,
    suppress,
  );
  if (
    assignResult.assignedCount === 0 ||
    assignResult.failedSlots.length > 0
  ) {
    return { ok: false, error: SUGGESTION_FAIL_RU.assign };
  }
  return { ok: true };
}

/**
 * AI replace for a single Menu slot dish (main or companion).
 * Pipeline: names → variety audit vs menu → expand recipes → assign.
 * Always updates the full day-pair (1–2 or 3–4) for that meal.
 */
export async function resuggestSlotForUser(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slotId: string,
  options: {
    chat?: ChatCompletionsFn;
    now?: Date;
    target?: SlotDishTarget;
  } = {},
): Promise<ResuggestSlotResult> {
  const keyError = requireOpenRouter(options.chat);
  if (keyError) return keyError;

  const target: SlotDishTarget = options.target ?? "main";
  const { data: slot, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id, menu_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const meal = slot.meal as MealSlot;
  if (isCarbTarget(target)) {
    return resuggestCompanionForPair(supabase, userId, menuId, slot, options);
  }
  if (isPrimaryTarget(meal, target)) {
    return resuggestMainForPair(supabase, userId, menuId, slot, options);
  }
  return resuggestRoleForPair(
    supabase,
    userId,
    menuId,
    slot,
    plateRoleForTarget(meal, target),
    options,
  );
}

async function resuggestMainForPair(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const meal = slot.meal as MealSlot;
  const dayPair = menuDayPairForDay(slot.day_index);
  if (!dayPair) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const pairSlots = await loadPairSlots(supabase, menuId, meal, dayPair);
  if (!pairSlots?.length) {
    return { ok: false, error: "Слот не найден." };
  }

  const excludeIds = new Set(
    pairSlots
      .flatMap((s) => [s.recipe_id, s.companion_recipe_id])
      .filter((id): id is string => typeof id === "string"),
  );
  const ctx = await resuggestNameContext(supabase, userId, menuId, excludeIds);
  if (!ctx) return planFail("query");

  const menuMeta = await loadMenuMeta(supabase, menuId);
  if (!menuMeta) return planFail("query");
  const inventedIds: string[] = [];

  try {
    const plateRole = plateRoleForTarget(meal, "main");
    const invented = await inventPositionViaNamePlan(
      supabase,
      userId,
      { meal, dayPair, plateRole },
      ctx,
      {
        ...options,
        peoplePerMeal: menuMeta.peoplePerMeal,
        menuDayCount: menuMeta.dayCount,
        availableEquipment: menuMeta.availableEquipment,
      },
    );
    if (!invented.ok) return invented;
    inventedIds.push(...invented.inventedIds);

    const primary = invented.dishes.find((d) => d.plateRole === plateRole);
    if (!primary) {
      await cleanupRecipes(supabase, inventedIds);
      return planFail("parse");
    }
    const dishRows = expandDishAssignments(
      primary.plateRole,
      primary.recipeId,
      primary.coversRoles,
    );
    // Keep existing carb FK when invent didn't cover carb.
    for (const s of pairSlots) {
      if (s.companion_recipe_id && !dishRows.some((d) => d.plateRole === "carb")) {
        dishRows.push({ plateRole: "carb", recipeId: s.companion_recipe_id });
        break;
      }
    }
    const existingBySlot = await loadExistingDishAssignments(
      supabase,
      pairSlots.map((s) => s.id),
    );
    const proposals = proposalsMergingExisting(
      pairSlots,
      dishRows,
      existingBySlot,
    );

    const assigned = await assignPairProposals(
      supabase,
      userId,
      menuId,
      proposals,
      inventedIds,
      options.forceSuppressIds,
    );
    if (!assigned.ok) {
      await cleanupRecipes(supabase, inventedIds);
    }
    return assigned;
  } catch (err) {
    await cleanupRecipes(supabase, inventedIds);
    return { ok: false, error: resuggestFailMessage(err) };
  }
}

async function resuggestCompanionForPair(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const meal = slot.meal as MealSlot;
  if (!mealAllowsCompanion(meal)) {
    return {
      ok: false,
      error: "Для этого приёма углеводная роль не используется.",
    };
  }
  if (!slot.recipe_id) {
    return { ok: false, error: "Сначала выберите основное блюдо." };
  }

  const dayPair = menuDayPairForDay(slot.day_index);
  if (!dayPair) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const pairSlots = await loadPairSlots(supabase, menuId, meal, dayPair);
  if (!pairSlots?.length) {
    return { ok: false, error: "Слот не найден." };
  }

  // Pair must share the same main (batch model).
  const mainIds = new Set(
    pairSlots
      .map((s) => s.recipe_id)
      .filter((id): id is string => typeof id === "string"),
  );
  if (mainIds.size !== 1 || !mainIds.has(slot.recipe_id)) {
    return {
      ok: false,
      error: "Пара дней должна иметь одно основное блюдо.",
    };
  }

  const { data: mainRecipe } = await supabase
    .from("recipes")
    .select("name")
    .eq("id", slot.recipe_id)
    .maybeSingle();
  const mainDishName = mainRecipe?.name?.trim();
  if (!mainDishName) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  // Keep the main recipe id so audit sees it; exclude only old companion(s).
  const excludeCompanions = new Set(
    pairSlots
      .map((s) => s.companion_recipe_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const ctx = await resuggestNameContext(
    supabase,
    userId,
    menuId,
    excludeCompanions,
  );
  if (!ctx) return planFail("query");

  const menuMeta = await loadMenuMeta(supabase, menuId);
  if (!menuMeta) return planFail("query");
  const inventedIds: string[] = [];

  try {
    const invented = await inventPositionViaNamePlan(
      supabase,
      userId,
      {
        meal,
        dayPair,
        plateRole: "carb",
      },
      {
        ...ctx,
        avoidNames: [...ctx.avoidNames, mainDishName],
      },
      {
        ...options,
        peoplePerMeal: menuMeta.peoplePerMeal,
        menuDayCount: menuMeta.dayCount,
        availableEquipment: menuMeta.availableEquipment,
      },
    );
    if (!invented.ok) return invented;
    inventedIds.push(...invented.inventedIds);

    const companion = invented.dishes.find((d) => d.plateRole === "carb");
    if (!companion) {
      await cleanupRecipes(supabase, inventedIds);
      return planFail("parse");
    }

    const primaryRole: PlateRole = isLunchDinnerMeal(meal) ? "protein" : "main";
    const dishRows: SlotDishAssignment[] = [
      { plateRole: primaryRole, recipeId: slot.recipe_id! },
      { plateRole: "carb", recipeId: companion.recipeId },
    ];
    const existingBySlot = await loadExistingDishAssignments(
      supabase,
      pairSlots.map((s) => s.id),
    );
    const proposals = proposalsMergingExisting(
      pairSlots,
      dishRows,
      existingBySlot,
    );

    const assigned = await assignPairProposals(
      supabase,
      userId,
      menuId,
      proposals,
      [...inventedIds, slot.recipe_id!],
      options.forceSuppressIds,
    );
    if (!assigned.ok) {
      await cleanupRecipes(supabase, inventedIds);
    }
    return assigned;
  } catch (err) {
    await cleanupRecipes(supabase, inventedIds);
    return { ok: false, error: resuggestFailMessage(err) };
  }
}

function excludeRecipeIdsFromPair(
  pairSlots: SlotRow[],
  existingBySlot: Map<string, SlotDishAssignment[]>,
): Set<string> {
  const excludeIds = new Set<string>();
  for (const s of pairSlots) {
    if (s.recipe_id) excludeIds.add(s.recipe_id);
    if (s.companion_recipe_id) excludeIds.add(s.companion_recipe_id);
    for (const d of existingBySlot.get(s.id) ?? []) {
      excludeIds.add(d.recipeId);
    }
  }
  return excludeIds;
}

/** Invent / replace a non-primary role (soup, veg, …) on the day-pair. */
async function resuggestRoleForPair(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  plateRole: PlateRole,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const meal = slot.meal as MealSlot;
  if (plateRole === "snack") {
    return { ok: false, error: "Перекус меняется в своей линии." };
  }
  const dayPair = menuDayPairForDay(slot.day_index);
  if (!dayPair) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const pairSlots = await loadPairSlots(supabase, menuId, meal, dayPair);
  if (!pairSlots?.length) {
    return { ok: false, error: "Слот не найден." };
  }

  const existingBySlot = await loadExistingDishAssignments(
    supabase,
    pairSlots.map((s) => s.id),
  );
  const ctx = await resuggestNameContext(
    supabase,
    userId,
    menuId,
    excludeRecipeIdsFromPair(pairSlots, existingBySlot),
  );
  if (!ctx) return planFail("query");

  const menuMeta = await loadMenuMeta(supabase, menuId);
  if (!menuMeta) return planFail("query");
  const inventedIds: string[] = [];

  try {
    const invented = await inventPositionViaNamePlan(
      supabase,
      userId,
      { meal, dayPair, plateRole },
      ctx,
      {
        ...options,
        peoplePerMeal: menuMeta.peoplePerMeal,
        menuDayCount: menuMeta.dayCount,
        availableEquipment: menuMeta.availableEquipment,
      },
    );
    if (!invented.ok) return invented;
    inventedIds.push(...invented.inventedIds);

    const dish = invented.dishes.find((d) => d.plateRole === plateRole);
    if (!dish) {
      await cleanupRecipes(supabase, inventedIds);
      return planFail("parse");
    }

    const assigned = await assignPairProposals(
      supabase,
      userId,
      menuId,
      proposalsMergingExisting(
        pairSlots,
        expandDishAssignments(dish.plateRole, dish.recipeId, dish.coversRoles),
        existingBySlot,
      ),
      inventedIds,
      options.forceSuppressIds,
    );
    if (!assigned.ok) {
      await cleanupRecipes(supabase, inventedIds);
    }
    return assigned;
  } catch (err) {
    await cleanupRecipes(supabase, inventedIds);
    return { ok: false, error: resuggestFailMessage(err) };
  }
}

async function resuggestForJobRole(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  job: PairReplaceJob,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const anchor = job.slots[0]!;
  if (isCarbTarget(job.role)) {
    return resuggestCompanionForPair(supabase, userId, menuId, anchor, options);
  }
  if (isPrimaryTarget(job.meal, job.role)) {
    return resuggestMainForPair(supabase, userId, menuId, anchor, options);
  }
  return resuggestRoleForPair(
    supabase,
    userId,
    menuId,
    anchor,
    plateRoleForTarget(job.meal, job.role),
    options,
  );
}

async function cleanupRecipes(
  supabase: SupabaseClient,
  recipeIds: string[],
): Promise<void> {
  if (recipeIds.length === 0) return;
  await supabase.from("recipes").delete().in("id", recipeIds);
}

/** Clear companion dish for the whole day-pair (main stays). */
export async function clearCompanionForSlot(
  supabase: SupabaseClient,
  menuId: string,
  slotId: string,
): Promise<ResuggestSlotResult> {
  const { data: slot, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Не удалось убрать углеводное блюдо." };
  }

  const dayPair = menuDayPairForDay(slot.day_index);
  if (!dayPair) {
    return { ok: false, error: "Не удалось убрать углеводное блюдо." };
  }

  const { data: updated, error } = await supabase
    .from("menu_slots")
    .update({ companion_recipe_id: null })
    .eq("menu_id", menuId)
    .eq("meal", slot.meal)
    .in("day_index", [...dayPair])
    .select("id");

  if (error || !updated?.length) {
    return { ok: false, error: "Не удалось убрать углеводное блюдо." };
  }

  const slotIds = updated.map((u) => u.id as string);
  if (slotIds.length > 0) {
    const { error: dishError } = await supabase
      .from("menu_slot_dishes")
      .delete()
      .in("menu_slot_id", slotIds)
      .eq("plate_role", "carb");
    if (dishError) {
      return { ok: false, error: "Не удалось убрать углеводное блюдо." };
    }
  }
  return { ok: true };
}

/**
 * Replace every occurrence of the recipe in `slotId` (main or companion target)
 * with a name-plan → expand dish applied to each affected day-pair.
 */
export async function resuggestRecipeAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slotId: string,
  options: ResuggestOptions & { target?: SlotDishTarget } = {},
): Promise<ResuggestSlotResult> {
  const keyError = requireOpenRouter(options.chat);
  if (keyError) return keyError;

  const target: SlotDishTarget = options.target ?? "main";
  const { data: slot, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const recipeId = await resolveRecipeIdForTarget(
    supabase,
    slot as SlotRow,
    target,
  );
  if (!recipeId) {
    return { ok: false, error: missingTargetMessage(target) };
  }

  return replaceRecipeIdAcrossMenu(
    supabase,
    userId,
    menuId,
    recipeId,
    target,
    options,
  );
}

/**
 * Invent a variant of the recipe in `slotId` from a user wish, then apply it to
 * every menu occurrence of that recipe (same role as target).
 */
export async function modifyRecipeAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slotId: string,
  options: ResuggestOptions & {
    comment?: string;
    target?: SlotDishTarget;
  } = {},
): Promise<ResuggestSlotResult> {
  const keyError = requireOpenRouter(options.chat);
  if (keyError) return keyError;

  const comment = normalizeFeedbackComment(options.comment ?? "");
  if (!isValidFeedbackComment(comment)) {
    return {
      ok: false,
      error: "Напишите пожелание — без него изменение не запускаем.",
    };
  }

  const target: SlotDishTarget = options.target ?? "main";
  const { data: slot, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const recipeId = await resolveRecipeIdForTarget(
    supabase,
    slot as SlotRow,
    target,
  );
  if (!recipeId) {
    return { ok: false, error: missingTargetMessage(target) };
  }

  const sourceDish = await loadRecipeSource(supabase, recipeId);
  if (!sourceDish) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  return modifyRecipeIdAcrossMenu(
    supabase,
    userId,
    menuId,
    recipeId,
    target,
    sourceDish,
    comment,
    options,
  );
}

/**
 * Hard-refuse a recipe, then replace it (names → audit → expand) on every
 * occurrence on this Menu (as main and/or companion).
 */
export async function refuseAndReplaceRecipeAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slotId: string,
  options: {
    chat?: ChatCompletionsFn;
    now?: Date;
    comment?: string;
    target?: SlotDishTarget;
  } = {},
): Promise<ResuggestSlotResult> {
  const keyError = requireOpenRouter(options.chat);
  if (keyError) return keyError;

  const comment = normalizeFeedbackComment(options.comment ?? "");
  if (!isValidFeedbackComment(comment)) {
    return {
      ok: false,
      error: "Укажите причину — без комментария отказ не принимаем.",
    };
  }

  const target: SlotDishTarget = options.target ?? "main";
  const { data: slot, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const refusedRecipeId = await resolveRecipeIdForTarget(
    supabase,
    slot as SlotRow,
    target,
  );
  if (!refusedRecipeId) {
    return { ok: false, error: missingTargetMessage(target) };
  }

  const { error: refuseError } = await supabase.from("recipe_refusals").upsert(
    {
      user_id: userId,
      recipe_id: refusedRecipeId,
      comment,
    },
    { onConflict: "user_id,recipe_id" },
  );
  if (refuseError) {
    return { ok: false, error: "Не удалось запомнить отказ." };
  }

  const { data: recipeRow } = await supabase
    .from("recipes")
    .select("name")
    .eq("id", refusedRecipeId)
    .maybeSingle();
  await recordTasteBanFromFeedback(supabase, userId, {
    subject: recipeRow?.name ?? null,
    comment,
  });

  const replaced = await replaceRecipeIdAcrossMenu(
    supabase,
    userId,
    menuId,
    refusedRecipeId,
    target,
    {
      chat: options.chat,
      now: options.now,
      forceSuppressIds: [refusedRecipeId],
    },
  );
  if (!replaced.ok) {
    await supabase
      .from("recipe_refusals")
      .delete()
      .eq("user_id", userId)
      .eq("recipe_id", refusedRecipeId);
  }
  return replaced;
}

function missingTargetMessage(target: SlotDishTarget): string {
  if (isCarbTarget(target)) return "В слоте нет углеводного блюда.";
  if (target === "soup") return "В слоте нет супа.";
  if (target === "veg") return "В слоте нет овощного блюда.";
  return "В слоте нет блюда.";
}

type PairReplaceJob = {
  meal: MealSlot;
  dayPair: MenuDayPair;
  role: SlotDishTarget;
  slots: SlotRow[];
};

async function replaceRecipeIdAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  recipeId: string,
  preferredTarget: SlotDishTarget,
  options: ResuggestOptions = {},
): Promise<ResuggestSlotResult> {
  const { data: allSlots, error: slotsError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("menu_id", menuId);

  if (slotsError || !allSlots?.length) {
    return { ok: false, error: "Не удалось найти слоты с этим блюдом." };
  }

  const jobs = await collectPairReplaceJobs(
    supabase,
    allSlots as SlotRow[],
    recipeId,
    preferredTarget,
  );
  if (jobs.length === 0) {
    return { ok: false, error: "Не удалось найти слоты с этим блюдом." };
  }

  // Replace each unique meal×pair×role once (covers both days).
  for (const job of jobs) {
    const result = await resuggestForJobRole(
      supabase,
      userId,
      menuId,
      job,
      options,
    );
    if (!result.ok) return result;
  }
  return { ok: true };
}

async function modifyRecipeIdAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  recipeId: string,
  preferredTarget: SlotDishTarget,
  sourceDish: PositionModifySource,
  userWish: string,
  options: ResuggestOptions = {},
): Promise<ResuggestSlotResult> {
  const { data: allSlots, error: slotsError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("menu_id", menuId);

  if (slotsError || !allSlots?.length) {
    return { ok: false, error: "Не удалось найти слоты с этим блюдом." };
  }

  const jobs = await collectPairReplaceJobs(
    supabase,
    allSlots as SlotRow[],
    recipeId,
    preferredTarget,
  );
  if (jobs.length === 0) {
    return { ok: false, error: "Не удалось найти слоты с этим блюдом." };
  }

  const modifyOpts: ResuggestOptions = {
    ...options,
    forceSuppressIds: [...(options.forceSuppressIds ?? []), recipeId],
  };

  // One invent per meal×role — same variant recipe ids applied to every pair.
  for (const group of groupModifyJobsByMealRole(jobs)) {
    const result = await modifyGroupForRole(
      supabase,
      userId,
      menuId,
      recipeId,
      group,
      sourceDish,
      userWish,
      modifyOpts,
    );
    if (!result.ok) return result;
  }
  return { ok: true };
}

async function modifyGroupForRole(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  recipeId: string,
  group: { meal: MealSlot; role: SlotDishTarget; jobs: PairReplaceJob[] },
  sourceDish: PositionModifySource,
  userWish: string,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  if (isCarbTarget(group.role)) {
    return modifyCompanionGroup(
      supabase,
      userId,
      menuId,
      recipeId,
      group.jobs,
      sourceDish,
      userWish,
      options,
    );
  }
  if (isPrimaryTarget(group.meal, group.role)) {
    return modifyMainGroup(
      supabase,
      userId,
      menuId,
      recipeId,
      group.jobs,
      sourceDish,
      userWish,
      options,
    );
  }
  return modifyRoleGroup(
    supabase,
    userId,
    menuId,
    recipeId,
    plateRoleForTarget(group.meal, group.role),
    group.jobs,
    sourceDish,
    userWish,
    options,
  );
}

function groupModifyJobsByMealRole(
  jobs: PairReplaceJob[],
): Array<{ meal: MealSlot; role: SlotDishTarget; jobs: PairReplaceJob[] }> {
  const groups = new Map<
    string,
    { meal: MealSlot; role: SlotDishTarget; jobs: PairReplaceJob[] }
  >();
  for (const job of jobs) {
    const key = `${job.meal}:${job.role}`;
    const existing = groups.get(key);
    if (existing) {
      existing.jobs.push(job);
      continue;
    }
    groups.set(key, { meal: job.meal, role: job.role, jobs: [job] });
  }
  return [...groups.values()];
}

function pairSlotsMatchSourceFk(
  pairSlots: SlotRow[],
  sourceRecipeId: string,
  role: SlotDishTarget,
): boolean {
  if (isCarbTarget(role)) {
    return pairSlots.every((s) => s.companion_recipe_id === sourceRecipeId);
  }
  return pairSlots.every((s) => s.recipe_id === sourceRecipeId);
}

function pairSlotsMatchSourceDishes(
  pairSlots: SlotRow[],
  sourceRecipeId: string,
  plateRole: PlateRole,
  existingBySlot: Map<string, SlotDishAssignment[]>,
): boolean {
  return pairSlots.every((s) =>
    (existingBySlot.get(s.id) ?? []).some(
      (d) => d.plateRole === plateRole && d.recipeId === sourceRecipeId,
    ),
  );
}

function collectCompanionIds(
  jobs: PairReplaceJob[],
  sourceRecipeId: string,
): Set<string> {
  const ids = new Set<string>([sourceRecipeId]);
  for (const job of jobs) {
    for (const s of job.slots) {
      if (s.companion_recipe_id) ids.add(s.companion_recipe_id);
    }
  }
  return ids;
}

async function loadValidatedPairSlots(
  supabase: SupabaseClient,
  menuId: string,
  meal: MealSlot,
  dayPair: MenuDayPair,
  sourceRecipeId: string,
  role: SlotDishTarget,
): Promise<{ ok: true; slots: SlotRow[] } | { ok: false; error: string }> {
  const pairSlots = await loadPairSlots(supabase, menuId, meal, dayPair);
  if (!pairSlots?.length) {
    return { ok: false, error: "Слот не найден." };
  }
  const plateRole = plateRoleForTarget(meal, role);
  if (
    (isCarbTarget(role) || isPrimaryTarget(meal, role)) &&
    pairSlotsMatchSourceFk(pairSlots, sourceRecipeId, role)
  ) {
    return { ok: true, slots: pairSlots };
  }
  const existingBySlot = await loadExistingDishAssignments(
    supabase,
    pairSlots.map((s) => s.id),
  );
  if (
    pairSlotsMatchSourceDishes(
      pairSlots,
      sourceRecipeId,
      plateRole,
      existingBySlot,
    )
  ) {
    return { ok: true, slots: pairSlots };
  }
  return {
    ok: false,
    error: isCarbTarget(role)
      ? "Пара дней должна иметь одно углеводное блюдо."
      : "Пара дней должна иметь одно основное блюдо.",
  };
}

async function assignModifiedDishesToJobs(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  meal: MealSlot,
  jobs: PairReplaceJob[],
  sourceRecipeId: string,
  role: SlotDishTarget,
  buildProposals: (pairSlots: SlotRow[]) => ProposedAssignment[] | null,
  inventedIds: string[],
  forceSuppressIds: string[] | undefined,
): Promise<ResuggestSlotResult> {
  for (const job of jobs) {
    const result = await assignOneModifiedJob(
      supabase,
      userId,
      menuId,
      meal,
      job,
      sourceRecipeId,
      role,
      buildProposals,
      inventedIds,
      forceSuppressIds,
    );
    if (!result.ok) return result;
  }
  return { ok: true };
}

async function assignOneModifiedJob(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  meal: MealSlot,
  job: PairReplaceJob,
  sourceRecipeId: string,
  role: SlotDishTarget,
  buildProposals: (pairSlots: SlotRow[]) => ProposedAssignment[] | null,
  inventedIds: string[],
  forceSuppressIds: string[] | undefined,
): Promise<ResuggestSlotResult> {
  const loaded = await loadValidatedPairSlots(
    supabase,
    menuId,
    meal,
    job.dayPair,
    sourceRecipeId,
    role,
  );
  if (!loaded.ok) {
    await cleanupRecipes(supabase, inventedIds);
    return loaded;
  }
  const proposals = buildProposals(loaded.slots);
  if (!proposals?.length) {
    await cleanupRecipes(supabase, inventedIds);
    return {
      ok: false,
      error: "Пара дней должна иметь одно основное блюдо.",
    };
  }
  const existingBySlot = await loadExistingDishAssignments(
    supabase,
    loaded.slots.map((s) => s.id),
  );
  const merged = proposals.map((p) => {
    const incoming = p.dishes ?? [];
    const dishes = mergeDishAssignments(
      existingBySlot.get(p.slotId) ?? [],
      incoming,
    );
    const fks = legacyFksFromDishes(dishes);
    return {
      ...p,
      dishes,
      recipeId: fks.recipeId ?? p.recipeId,
      companionRecipeId: fks.companionRecipeId,
    };
  });
  const assigned = await assignPairProposals(
    supabase,
    userId,
    menuId,
    merged,
    [...collectProposalRecipeIds(merged, inventedIds)],
    forceSuppressIds,
  );
  if (!assigned.ok) {
    await cleanupRecipes(supabase, inventedIds);
    return assigned;
  }
  return { ok: true };
}

function collectProposalRecipeIds(
  proposals: ProposedAssignment[],
  inventedIds: string[],
): Set<string> {
  const poolIds = new Set(inventedIds);
  for (const p of proposals) {
    if (p.recipeId) poolIds.add(p.recipeId);
    for (const d of p.dishes ?? []) poolIds.add(d.recipeId);
    if (p.companionRecipeId) poolIds.add(p.companionRecipeId);
  }
  return poolIds;
}

function jobsHaveCompanion(jobs: PairReplaceJob[]): boolean {
  return jobs.some((job) =>
    job.slots.some((s) => typeof s.companion_recipe_id === "string"),
  );
}

async function modifyMainGroup(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  sourceRecipeId: string,
  jobs: PairReplaceJob[],
  sourceDish: PositionModifySource,
  userWish: string,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const anchor = jobs[0];
  if (!anchor) return { ok: false, error: "Слот не найден." };
  const meal = anchor.meal;
  const keepExistingCarb = jobsHaveCompanion(jobs);
  const plateRole = plateRoleForTarget(meal, "main");

  // When keeping the side, leave companion recipes in keepDishes (name context).
  const excludeIds = keepExistingCarb
    ? new Set([sourceRecipeId])
    : collectCompanionIds(jobs, sourceRecipeId);

  const ctx = await modifyNameContext(supabase, userId, menuId, excludeIds);
  if (!ctx) return planFail("query");

  const menuMeta = await loadMenuMeta(supabase, menuId);
  if (!menuMeta) return planFail("query");
  const inventedIds: string[] = [];

  try {
    const invented = await inventPositionViaModifyPlan(
      supabase,
      userId,
      { meal, dayPair: anchor.dayPair, plateRole },
      { ...ctx, sourceDish, userWish, keepExistingCarb },
      {
        ...options,
        peoplePerMeal: menuMeta.peoplePerMeal,
        menuDayCount: menuMeta.dayCount,
        availableEquipment: menuMeta.availableEquipment,
      },
    );
    if (!invented.ok) return invented;
    inventedIds.push(...invented.inventedIds);

    const main = invented.dishes.find((d) => d.plateRole === plateRole);
    if (!main) {
      await cleanupRecipes(supabase, inventedIds);
      return planFail("parse");
    }
    const inventedCarb = invented.dishes.find((d) => d.plateRole === "carb");
    // Modify targets the protein/main only — never drop an existing carb.
    if (keepExistingCarb && inventedCarb) {
      await cleanupRecipes(supabase, [inventedCarb.recipeId]);
      const idx = inventedIds.indexOf(inventedCarb.recipeId);
      if (idx >= 0) inventedIds.splice(idx, 1);
    }

    return assignModifiedDishesToJobs(
      supabase,
      userId,
      menuId,
      meal,
      jobs,
      sourceRecipeId,
      "main",
      (pairSlots) =>
        pairSlots.map((s) => {
          const dishRows = expandDishAssignments(
            main.plateRole,
            main.recipeId,
            keepExistingCarb ? null : main.coversRoles,
          );
          const companionRecipeId = keepExistingCarb
            ? s.companion_recipe_id
            : (inventedCarb?.recipeId ?? s.companion_recipe_id ?? null);
          if (
            companionRecipeId &&
            !dishRows.some((d) => d.plateRole === "carb")
          ) {
            dishRows.push({ plateRole: "carb", recipeId: companionRecipeId });
          }
          const fks = legacyFksFromDishes(dishRows);
          return {
            slotId: s.id,
            dishes: dishRows,
            recipeId: fks.recipeId ?? main.recipeId,
            companionRecipeId: fks.companionRecipeId,
          };
        }),
      inventedIds,
      options.forceSuppressIds,
    );
  } catch (err) {
    await cleanupRecipes(supabase, inventedIds);
    return { ok: false, error: resuggestFailMessage(err) };
  }
}

async function modifyCompanionGroup(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  sourceRecipeId: string,
  jobs: PairReplaceJob[],
  sourceDish: PositionModifySource,
  userWish: string,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const anchor = jobs[0];
  if (!anchor) return { ok: false, error: "Слот не найден." };
  const meal = anchor.meal;
  if (!mealAllowsCompanion(meal)) {
    return {
      ok: false,
      error: "Для этого приёма углеводная роль не используется.",
    };
  }

  const anchorSlot = anchor.slots[0];
  if (!anchorSlot?.recipe_id) {
    return { ok: false, error: "Сначала выберите основное блюдо." };
  }

  const { data: mainRecipe } = await supabase
    .from("recipes")
    .select("name")
    .eq("id", anchorSlot.recipe_id)
    .maybeSingle();
  const mainDishName = mainRecipe?.name?.trim();
  if (!mainDishName) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const ctx = await modifyNameContext(
    supabase,
    userId,
    menuId,
    collectCompanionIds(jobs, sourceRecipeId),
  );
  if (!ctx) return planFail("query");

  const menuMeta = await loadMenuMeta(supabase, menuId);
  if (!menuMeta) return planFail("query");
  const inventedIds: string[] = [];

  try {
    const invented = await inventPositionViaModifyPlan(
      supabase,
      userId,
      {
        meal,
        dayPair: anchor.dayPair,
        plateRole: "carb",
      },
      {
        ...ctx,
        avoidNames: [...ctx.avoidNames, mainDishName],
        sourceDish,
        userWish,
      },
      {
        ...options,
        peoplePerMeal: menuMeta.peoplePerMeal,
        menuDayCount: menuMeta.dayCount,
        availableEquipment: menuMeta.availableEquipment,
      },
    );
    if (!invented.ok) return invented;
    inventedIds.push(...invented.inventedIds);

    const companion = invented.dishes.find((d) => d.plateRole === "carb");
    if (!companion) {
      await cleanupRecipes(supabase, inventedIds);
      return planFail("parse");
    }

    return assignModifiedDishesToJobs(
      supabase,
      userId,
      menuId,
      meal,
      jobs,
      sourceRecipeId,
      "companion",
      (pairSlots) => {
        const mainIds = new Set(
          pairSlots
            .map((s) => s.recipe_id)
            .filter((id): id is string => typeof id === "string"),
        );
        if (mainIds.size !== 1) return null;
        const mainRecipeId = [...mainIds][0]!;
        const primaryRole: PlateRole = isLunchDinnerMeal(meal)
          ? "protein"
          : "main";
        const dishRows = [
          { plateRole: primaryRole, recipeId: mainRecipeId },
          { plateRole: "carb" as const, recipeId: companion.recipeId },
        ];
        return pairSlots.map((s) => ({
          slotId: s.id,
          dishes: dishRows,
          recipeId: mainRecipeId,
          companionRecipeId: companion.recipeId,
        }));
      },
      inventedIds,
      options.forceSuppressIds,
    );
  } catch (err) {
    await cleanupRecipes(supabase, inventedIds);
    return { ok: false, error: resuggestFailMessage(err) };
  }
}

/** Modify a non-primary role (soup, veg, …) across matching pairs. */
async function modifyRoleGroup(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  sourceRecipeId: string,
  plateRole: PlateRole,
  jobs: PairReplaceJob[],
  sourceDish: PositionModifySource,
  userWish: string,
  options: ResuggestOptions,
): Promise<ResuggestSlotResult> {
  const anchor = jobs[0];
  if (!anchor) return { ok: false, error: "Слот не найден." };
  const meal = anchor.meal;

  const ctx = await modifyNameContext(
    supabase,
    userId,
    menuId,
    new Set([sourceRecipeId]),
  );
  if (!ctx) return planFail("query");

  const menuMeta = await loadMenuMeta(supabase, menuId);
  if (!menuMeta) return planFail("query");
  const inventedIds: string[] = [];

  try {
    const invented = await inventPositionViaModifyPlan(
      supabase,
      userId,
      { meal, dayPair: anchor.dayPair, plateRole },
      { ...ctx, sourceDish, userWish },
      {
        ...options,
        peoplePerMeal: menuMeta.peoplePerMeal,
        menuDayCount: menuMeta.dayCount,
        availableEquipment: menuMeta.availableEquipment,
      },
    );
    if (!invented.ok) return invented;
    inventedIds.push(...invented.inventedIds);

    const dish = invented.dishes.find((d) => d.plateRole === plateRole);
    if (!dish) {
      await cleanupRecipes(supabase, inventedIds);
      return planFail("parse");
    }

    return assignModifiedDishesToJobs(
      supabase,
      userId,
      menuId,
      meal,
      jobs,
      sourceRecipeId,
      plateRole,
      (pairSlots) => {
        const dishRows = expandDishAssignments(
          dish.plateRole,
          dish.recipeId,
          dish.coversRoles,
        );
        const fks = legacyFksFromDishes(dishRows);
        return pairSlots.map((s) => ({
          slotId: s.id,
          dishes: dishRows,
          recipeId: fks.recipeId ?? s.recipe_id ?? undefined,
          companionRecipeId:
            fks.companionRecipeId ?? s.companion_recipe_id ?? undefined,
        }));
      },
      inventedIds,
      options.forceSuppressIds,
    );
  } catch (err) {
    await cleanupRecipes(supabase, inventedIds);
    return { ok: false, error: resuggestFailMessage(err) };
  }
}

type DishRoleHit = { menu_slot_id: string; plate_role: string };

function pushPairReplaceJob(
  jobs: Map<string, PairReplaceJob>,
  slot: SlotRow,
  role: SlotDishTarget,
): void {
  const meal = slot.meal as MealSlot;
  const dayPair = menuDayPairForDay(slot.day_index);
  if (!dayPair) return;
  const key = `${meal}:${dayPair[0]}-${dayPair[1]}:${role}`;
  const existing = jobs.get(key);
  if (existing) {
    if (!existing.slots.some((s) => s.id === slot.id)) {
      existing.slots.push(slot);
    }
    return;
  }
  jobs.set(key, { meal, dayPair, role, slots: [slot] });
}

function cookableDishRole(value: string): PlateRole | null {
  if (!isPlateRole(value) || value === "snack") return null;
  return value;
}

function pushJobsFromDishHits(
  jobs: Map<string, PairReplaceJob>,
  dishRows: DishRoleHit[],
  slotById: Map<string, SlotRow>,
  preferredTarget: SlotDishTarget | null,
): void {
  for (const d of dishRows) {
    const plateRole = cookableDishRole(d.plate_role);
    if (!plateRole) continue;
    const slot = slotById.get(d.menu_slot_id);
    if (!slot) continue;
    if (
      preferredTarget &&
      plateRole !== plateRoleForTarget(slot.meal as MealSlot, preferredTarget)
    ) {
      continue;
    }
    pushPairReplaceJob(jobs, slot, plateRole);
  }
}

function pushJobsFromLegacyFks(
  jobs: Map<string, PairReplaceJob>,
  allSlots: SlotRow[],
  recipeId: string,
  preferredTarget: SlotDishTarget | null,
): void {
  for (const slot of allSlots) {
    const asMain = slot.recipe_id === recipeId;
    const asCompanion = slot.companion_recipe_id === recipeId;
    if (preferredTarget) {
      if (isPrimaryTarget(slot.meal as MealSlot, preferredTarget) && asMain) {
        pushPairReplaceJob(jobs, slot, "main");
      }
      if (isCarbTarget(preferredTarget) && asCompanion) {
        pushPairReplaceJob(jobs, slot, "companion");
      }
      continue;
    }
    if (asMain) pushPairReplaceJob(jobs, slot, "main");
    if (asCompanion) pushPairReplaceJob(jobs, slot, "companion");
  }
}

async function collectPairReplaceJobs(
  supabase: SupabaseClient,
  allSlots: SlotRow[],
  recipeId: string,
  preferredTarget: SlotDishTarget,
): Promise<PairReplaceJob[]> {
  const jobs = new Map<string, PairReplaceJob>();
  const slotIds = allSlots.map((s) => s.id);
  const slotById = new Map(allSlots.map((s) => [s.id, s]));
  const { data: dishRows } =
    slotIds.length === 0
      ? { data: [] as DishRoleHit[] }
      : await supabase
        .from("menu_slot_dishes")
        .select("menu_slot_id, plate_role")
        .in("menu_slot_id", slotIds)
        .eq("recipe_id", recipeId);

  const hits = (dishRows ?? []).filter(
    (d): d is DishRoleHit =>
      typeof d.menu_slot_id === "string" && typeof d.plate_role === "string",
  );

  pushJobsFromDishHits(jobs, hits, slotById, preferredTarget);
  if (jobs.size > 0) return [...jobs.values()];

  pushJobsFromDishHits(jobs, hits, slotById, null);
  if (jobs.size > 0) return [...jobs.values()];

  pushJobsFromLegacyFks(jobs, allSlots, recipeId, preferredTarget);
  if (jobs.size > 0) return [...jobs.values()];

  pushJobsFromLegacyFks(jobs, allSlots, recipeId, null);
  return [...jobs.values()];
}
