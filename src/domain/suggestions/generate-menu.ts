import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_INCLUDE_SNACKS,
  expectedSlotCount,
  isMealSlot,
  isValidDayCount,
  mealsForSkeleton,
  type MealSlot,
} from "@/domain/menu/constants";
import type { PlateRole } from "@/domain/menu/meal-templates";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  dishNameEquipmentConflicts,
  normalizeEquipmentList,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { createMenuSkeletonForUser } from "@/domain/menu/create-skeleton";
import { assignProposalsToSlots } from "@/domain/suggestions/assign";
import { buildCandidates } from "@/domain/suggestions/candidates";
import { SUGGESTIONS_RU } from "@/domain/suggestions/constants";
import {
  SUGGESTION_FAIL_RU,
  SuggestionError,
} from "@/domain/suggestions/errors";
import { loadRecentMenuDishNames } from "@/domain/suggestions/history";
import { analyzeMenuVariety } from "@/domain/suggestions/analyze-menu-variety";
import { cookingMethodSpamReplaceTargets } from "@/domain/suggestions/cooking-method-variety";
import { expandMenuRecipes } from "@/domain/suggestions/expand-menu-recipes";
import {
  planKey,
  proposeMenuNamePlan,
  repairMenuNamePlan,
  type PlannedDish,
} from "@/domain/suggestions/plan-menu-names";
import {
  deterministicAssignments,
  type ProposedAssignment,
  type SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";
import { generateSnacksForMenu } from "@/domain/suggestions/generate-snacks";
import {
  looksLikeHeavyAnimalProteinDish,
  looksLikeNoCookSnack,
} from "@/domain/suggestions/meal-fit";
import {
  expandDishAssignmentsForMeal,
  isCookableTemplateMeal,
  primaryRecipeIdFromDishes,
  mealDayPairKey,
  type SlotDishAssignment,
} from "@/domain/suggestions/role-slots";
import { loadSuppressSets } from "@/domain/suggestions/suppress";
import { loadTasteNotes } from "@/domain/suggestions/taste-notes";
import {
  getOpenRouterApiKey,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type GenerateMenuOk = { ok: true; menuId: string };
export type GenerateMenuErr = { ok: false; error: string };
export type GenerateMenuResult = GenerateMenuOk | GenerateMenuErr;

export type GenerateMenuOptions = {
  /** Injectable chat for tests; defaults to OpenRouter. */
  chat?: ChatCompletionsFn;
  now?: Date;
  /** People / servings per meal (set at menu create). */
  peopleCount?: number;
  /** Cookable meal slots to create; empty = snacks-only. */
  meals?: readonly MealSlot[];
  /** Whether to generate no-cook snacks. */
  includeSnacks?: boolean;
  /** Kitchen equipment allowed for this menu (hard filter). */
  equipment?: readonly EquipmentId[];
};

/**
 * Create Menu skeleton + name-plan → variety audit → expand recipes → assign.
 * Day length 2 / 4 / 6 with hard pairs. On failure: delete Menu (orphan rollback).
 */
export async function generateBuyableMenuForUser(
  supabase: SupabaseClient,
  userId: string,
  dayCount: number,
  options: GenerateMenuOptions = {},
): Promise<GenerateMenuResult> {
  if (!isValidDayCount(dayCount)) {
    return { ok: false, error: "Выберите длину меню: 2, 4 или 6 дней." };
  }

  const meals = options.meals ?? (["breakfast", "lunch", "dinner"] as const);
  const includeSnacks = options.includeSnacks ?? DEFAULT_INCLUDE_SNACKS;

  if (meals.length === 0 && !includeSnacks) {
    return {
      ok: false,
      error: "Выберите хотя бы один приём пищи или снеки.",
    };
  }

  if (meals.length > 0 && !getOpenRouterApiKey() && !options.chat) {
    return { ok: false, error: SUGGESTION_FAIL_RU.no_key };
  }

  const equipment =
    normalizeEquipmentList(options.equipment) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];

  const created = await createMenuSkeletonForUser(supabase, userId, dayCount, {
    peopleCount: options.peopleCount,
    meals: mealsForSkeleton(meals, includeSnacks),
    equipment,
  });
  if (!created.ok) {
    return created;
  }

  const menuId = created.menuId;

  try {
    await fillMenuSlots(supabase, userId, menuId, dayCount, {
      ...options,
      meals,
      includeSnacks,
    });
    return { ok: true, menuId };
  } catch (err) {
    const { error: deleteError } = await supabase
      .from("menus")
      .delete()
      .eq("id", menuId)
      .eq("user_id", userId);

    if (deleteError) {
      return { ok: false, error: SUGGESTIONS_RU.rollbackFail };
    }

    if (err instanceof SuggestionError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof OpenRouterError) {
      return { ok: false, error: SUGGESTION_FAIL_RU.openrouter };
    }
    return { ok: false, error: SUGGESTION_FAIL_RU.assign };
  }
}

async function fillMenuSlots(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  dayCount: number,
  options: GenerateMenuOptions & {
    meals: readonly MealSlot[];
    includeSnacks: boolean;
  },
): Promise<void> {
  const { meals, includeSnacks } = options;
  const slotCount = expectedSlotCount(dayCount, meals);

  const tasks: Promise<void>[] = [];

  if (slotCount > 0) {
    tasks.push(
      fillCookableSlots(supabase, userId, menuId, dayCount, slotCount, options),
    );
  }

  if (includeSnacks) {
    tasks.push(
      (async () => {
        const snacks = await generateSnacksForMenu(
          supabase,
          userId,
          menuId,
          dayCount,
          { chat: options.chat },
        );
        if (!snacks.ok) {
          throw new SuggestionError("assign", snacks.error);
        }
      })(),
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

async function refineMenuNamePlan(
  initial: PlannedDish[],
  ctx: {
    dayCount: number;
    tasteNotes: Awaited<ReturnType<typeof loadTasteNotes>>;
    equipment: EquipmentId[];
    chat?: ChatCompletionsFn;
  },
): Promise<PlannedDish[]> {
  let plan = initial;
  if (!ctx.tasteNotes) return plan;

  const tryRepair = async (
    targets: Parameters<typeof repairMenuNamePlan>[1],
  ) => {
    if (targets.length === 0) return;
    const repaired = await repairMenuNamePlan(plan, targets, {
      dayCount: ctx.dayCount,
      tasteNotes: ctx.tasteNotes!,
      availableEquipment: ctx.equipment,
      chat: ctx.chat,
    });
    if (repaired.ok) plan = repaired.plan;
  };

  // Equipment + cooking-method spam: one repair call (same plan snapshot).
  const equipmentTargets = plan
    .filter((d) => dishNameEquipmentConflicts(d.name, ctx.equipment).length > 0)
    .map((d) => {
      const missing = dishNameEquipmentConflicts(d.name, ctx.equipment);
      return {
        meal: d.meal,
        dayPair: d.dayPair,
        plateRole: d.plateRole,
        reason: `Name implies ${missing.join(",")} but availableEquipment is only [${ctx.equipment.join(",")}]. Invent a clearly different name cookable with that set (no unavailable appliance words).`,
      };
    });
  await tryRepair(
    dedupeReplaceTargets([
      ...equipmentTargets,
      ...cookingMethodSpamReplaceTargets(plan, 2),
    ]),
  );

  const audit = await analyzeMenuVariety(
    plan.map((d) => ({
      meal: d.meal,
      dayPair: d.dayPair,
      plateRole: d.plateRole,
      name: d.name,
      recipeId: planKey(d),
    })),
    { chat: ctx.chat },
  );
  if (audit.ok && audit.replace.length > 0) {
    await tryRepair(audit.replace);
  }
  return plan;
}

/** Keep first reason when the same meal×dayPair×plateRole appears twice. */
function dedupeReplaceTargets(
  targets: Parameters<typeof repairMenuNamePlan>[1],
): Parameters<typeof repairMenuNamePlan>[1] {
  const seen = new Set<string>();
  const out: Parameters<typeof repairMenuNamePlan>[1] = [];
  for (const t of targets) {
    const plateRole = t.plateRole ?? "main";
    const key = `${t.meal}:${t.dayPair[0]}-${t.dayPair[1]}:${plateRole}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

async function fillCookableSlots(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  dayCount: number,
  slotCount: number,
  options: GenerateMenuOptions & { meals: readonly MealSlot[] },
): Promise<void> {
  const now = options.now ?? new Date();
  const equipment =
    normalizeEquipmentList(options.equipment) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];

  // Independent DB reads — overlap latency before the first LLM call.
  const [previousMenusDishes, tasteNotes, slotByKey] = await Promise.all([
    loadRecentMenuDishNames(supabase, userId, { excludeMenuId: menuId }),
    loadTasteNotes(supabase, userId),
    loadSlotKeyMap(supabase, menuId, dayCount, slotCount),
  ]);
  if (!previousMenusDishes) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }
  if (!tasteNotes) {
    throw new SuggestionError("query", SUGGESTIONS_RU.tasteNotesFail);
  }

  // 1) Names only — cheap plan for the whole menu.
  const planned = await proposeMenuNamePlan(options.meals, {
    dayCount,
    previousMenusDishes,
    avoidNames: previousMenusDishes,
    peoplePerMeal: options.peopleCount,
    availableEquipment: equipment,
    tasteNotes,
    chat: options.chat,
  });
  if (!planned.ok) {
    throw new SuggestionError(planned.reason, SUGGESTION_FAIL_RU[planned.reason]);
  }

  const plan = await refineMenuNamePlan(planned.plan, {
    dayCount,
    tasteNotes,
    equipment,
    chat: options.chat,
  });

  // Expand locked names → full recipes (one batched AI call) + persist.
  const expanded = await expandMenuRecipes(supabase, plan, {
    menuDayCount: dayCount,
    peoplePerMeal: options.peopleCount,
    tasteNotes,
    chat: options.chat,
    availableEquipment: equipment,
  });
  if (!expanded.ok) {
    throw new SuggestionError(
      expanded.reason,
      SUGGESTION_FAIL_RU[expanded.reason],
    );
  }

  const inventedIds = expanded.dishes.map((d) => d.recipeId);
  try {
    const proposals = buildProposalsFromExpanded(expanded.dishes, slotByKey);
    await assignPositionProposals(
      supabase,
      userId,
      menuId,
      now,
      proposals,
      inventedIds,
    );
  } catch (err) {
    if (inventedIds.length > 0) {
      await supabase.from("recipes").delete().in("id", inventedIds);
    }
    throw err;
  }
}

/** Exported for logic verify. */
export function buildProposalsFromExpanded(
  dishes: Array<PlannedDish & { recipeId: string }>,
  slotByKey: Map<string, SlotPrompt>,
): ProposedAssignment[] {
  const groups = groupExpandedByMealDayPair(dishes);
  const proposals: ProposedAssignment[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    const dishRows = flattenExpandedGroupToDishes(group);
    const { recipeId } = primaryRecipeIdFromDishes(dishRows);
    for (const day of first.dayPair) {
      const slot = slotByKey.get(`${day}:${first.meal}`);
      if (!slot) {
        throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
      }
      proposals.push({
        slotId: slot.slotId,
        dishes: dishRows,
        recipeId: recipeId ?? dishRows[0]?.recipeId,
      });
    }
  }
  return proposals;
}

function groupExpandedByMealDayPair(
  dishes: Array<PlannedDish & { recipeId: string }>,
): Map<string, Array<PlannedDish & { recipeId: string }>> {
  const groups = new Map<string, Array<PlannedDish & { recipeId: string }>>();
  for (const d of dishes) {
    const key = mealDayPairKey(d.meal, d.dayPair);
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  return groups;
}

function flattenExpandedGroupToDishes(
  group: Array<PlannedDish & { recipeId: string }>,
): SlotDishAssignment[] {
  const meal = group[0]?.meal;
  if (!meal || !isCookableTemplateMeal(meal)) return [];
  // Prefer cover-declaring dishes so one-pots claim roles before sides.
  const ordered = [...group].sort(
    (a, b) => (b.coversRoles?.length ?? 0) - (a.coversRoles?.length ?? 0),
  );
  const dishRows: SlotDishAssignment[] = [];
  const seenRoles = new Set<PlateRole>();
  for (const d of ordered) {
    for (const row of expandDishAssignmentsForMeal(
      meal,
      d.plateRole,
      d.recipeId,
      d.coversRoles,
    )) {
      if (seenRoles.has(row.plateRole)) continue;
      seenRoles.add(row.plateRole);
      dishRows.push(row);
    }
  }
  return dishRows;
}

async function loadSlotKeyMap(
  supabase: SupabaseClient,
  menuId: string,
  dayCount: number,
  slotCount: number,
): Promise<Map<string, SlotPrompt>> {
  // Skeleton may also create meal=snack rows for the Перекус lane; cookable fill
  // only uses non-snack slots (snacks are written via menu_snacks).
  const { data: slotRows, error: slotsError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal")
    .eq("menu_id", menuId)
    .neq("meal", "snack")
    .order("day_index", { ascending: true });

  if (slotsError || !slotRows?.length || slotRows.length !== slotCount) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }
  const slots = buildSlotPrompts(slotRows, dayCount);
  return new Map(slots.map((s) => [`${s.dayIndex}:${s.meal}`, s] as const));
}

/** Drop carb dish when both protein and carb are heavy animal (not one-pot covers). */
function dropHeavyHeavyCompanions(
  proposals: ProposedAssignment[],
  nameById: Map<string, string>,
): ProposedAssignment[] {
  return proposals.map((p) => {
    const dishes = p.dishes ?? [];
    const protein = dishes.find((d) => d.plateRole === "protein");
    const carb = dishes.find((d) => d.plateRole === "carb");
    if (!protein || !carb) return p;
    // One-pot covers: same recipe fills protein+carb — never strip.
    if (protein.recipeId === carb.recipeId) return p;
    const proteinName = nameById.get(protein.recipeId) ?? "";
    const carbName = nameById.get(carb.recipeId) ?? "";
    if (
      looksLikeHeavyAnimalProteinDish(proteinName) &&
      looksLikeHeavyAnimalProteinDish(carbName)
    ) {
      const next = dishes.filter((d) => d.plateRole !== "carb");
      const { recipeId } = primaryRecipeIdFromDishes(next);
      return {
        ...p,
        dishes: next,
        recipeId: recipeId ?? p.recipeId,
      };
    }
    return p;
  });
}

async function assignPositionProposals(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  now: Date,
  proposals: ProposedAssignment[],
  inventedIds: string[],
): Promise<void> {
  const [built, suppress] = await Promise.all([
    buildCandidates(supabase, userId, menuId, now),
    loadSuppressSets(supabase, userId),
  ]);
  if (!built.ok) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }
  if (!suppress) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }
  const nameById = new Map(
    built.candidates
      .filter((c) => !looksLikeNoCookSnack(c.name))
      .map((c) => [c.recipeId, c.name] as const),
  );
  const sanitized = dropHeavyHeavyCompanions(proposals, nameById);
  if (sanitized.length === 0) {
    throw new SuggestionError("parse", SUGGESTION_FAIL_RU.parse);
  }

  const inventedSet = new Set(inventedIds);
  const assignPool = built.candidates.filter((c) =>
    inventedSet.has(c.recipeId),
  );
  if (assignPool.length === 0) {
    throw new SuggestionError(
      "zero_eligible",
      SUGGESTION_FAIL_RU.zero_eligible,
    );
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
    throw new SuggestionError("assign", SUGGESTION_FAIL_RU.assign);
  }
}

function buildSlotPrompts(
  rows: Array<{ id: string; day_index: number; meal: unknown }>,
  dayCount: number,
): SlotPrompt[] {
  const slots: SlotPrompt[] = [];
  for (const row of rows) {
    if (
      typeof row.meal !== "string" ||
      !isMealSlot(row.meal) ||
      row.day_index < 1 ||
      row.day_index > dayCount
    ) {
      throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
    }
    slots.push({ slotId: row.id, dayIndex: row.day_index, meal: row.meal });
  }
  return slots;
}

/** Merge partial proposals with deterministic fill for omitted slots (resuggest / tests). */
export function mergeWithDeterministicFill(
  slots: SlotPrompt[],
  proposals: ProposedAssignment[],
  candidates: Parameters<typeof deterministicAssignments>[1],
): ProposedAssignment[] {
  const covered = new Set(proposals.map((p) => p.slotId));
  const remaining = slots.filter((s) => !covered.has(s.slotId));
  if (remaining.length === 0) return proposals;
  return [...proposals, ...deterministicAssignments(remaining, candidates)];
}
