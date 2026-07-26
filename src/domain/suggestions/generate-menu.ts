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
  normalizeEquipmentList,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { createMenuSkeletonForUser } from "@/domain/menu/create-skeleton";
import { assignProposalsToSlots } from "@/domain/suggestions/assign";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import { SUGGESTIONS_RU } from "@/domain/suggestions/constants";
import {
  SUGGESTION_FAIL_RU,
  SuggestionError,
} from "@/domain/suggestions/errors";
import { loadRecentMenuDishNames } from "@/domain/suggestions/history";
import { expandMenuRecipes } from "@/domain/suggestions/expand-menu-recipes";
import {
  proposeMenuNamePlan,
  type PlannedDish,
} from "@/domain/suggestions/plan-menu-names";
import {
  deterministicAssignments,
  type ProposedAssignment,
  type SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";
import { generateSnacksForMenu } from "@/domain/suggestions/generate-snacks";
import { looksLikeHeavyAnimalProteinDish } from "@/domain/suggestions/meal-fit";
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
import { slog, slogError } from "@/lib/server-log";

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

  const pipelineStarted = Date.now();
  slog("generate", "skeleton:start", {
    userId,
    dayCount,
    meals: [...meals],
    includeSnacks,
    equipment,
  });

  const created = await createMenuSkeletonForUser(supabase, userId, dayCount, {
    peopleCount: options.peopleCount,
    meals: mealsForSkeleton(meals, includeSnacks),
    equipment,
  });
  if (!created.ok) {
    slogError("generate", "skeleton:fail", { error: created.error });
    return created;
  }

  const menuId = created.menuId;
  slog("generate", "skeleton:ok", { menuId, ms: Date.now() - pipelineStarted });

  try {
    await fillMenuSlots(supabase, userId, menuId, dayCount, {
      ...options,
      meals,
      includeSnacks,
    });
    slog("generate", "ok", { menuId, ms: Date.now() - pipelineStarted });
    return { ok: true, menuId };
  } catch (err) {
    const detail =
      err instanceof SuggestionError
        ? { kind: "suggestion", reason: err.reason, message: err.message }
        : err instanceof OpenRouterError
          ? { kind: "openrouter", message: err.message, status: err.causeStatus }
          : {
            kind: "unknown",
            message: err instanceof Error ? err.message : String(err),
          };
    slogError("generate", "fill:fail", { menuId, ...detail });

    const { error: deleteError } = await supabase
      .from("menus")
      .delete()
      .eq("id", menuId)
      .eq("user_id", userId);

    if (deleteError) {
      slogError("generate", "rollback:fail", {
        menuId,
        deleteError: deleteError.message,
      });
      return { ok: false, error: SUGGESTIONS_RU.rollbackFail };
    }
    slog("generate", "rollback:ok", { menuId });

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

  // Snacks are independent of cookable expand — overlap to hide ~10s snack AI.
  // On any failure the outer generate path deletes the whole menu (cascade).
  const cookablePromise =
    slotCount > 0
      ? fillCookableSlots(
        supabase,
        userId,
        menuId,
        dayCount,
        slotCount,
        options,
      )
      : Promise.resolve();

  const snacksPromise = includeSnacks
    ? (async () => {
      slog("generate", "snacks:start", { menuId, dayCount });
      const snacksStarted = Date.now();
      const snacks = await generateSnacksForMenu(
        supabase,
        userId,
        menuId,
        dayCount,
        { chat: options.chat },
      );
      if (!snacks.ok) {
        slogError("generate", "snacks:fail", {
          menuId,
          error: snacks.error,
          ms: Date.now() - snacksStarted,
        });
        throw new SuggestionError("assign", snacks.error);
      }
      slog("generate", "snacks:ok", {
        menuId,
        labels: snacks.labels,
        ms: Date.now() - snacksStarted,
      });
    })()
    : Promise.resolve();

  await Promise.all([cookablePromise, snacksPromise]);
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

  slog("generate", "plan:start", {
    menuId,
    dayCount,
    mealCount: options.meals.length,
    slotCount,
    tasteNotes: tasteNotes.length,
    previousDishNames: previousMenusDishes.length,
  });
  const planStarted = Date.now();
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
    slogError("generate", "plan:fail", {
      menuId,
      reason: planned.reason,
      ms: Date.now() - planStarted,
    });
    throw new SuggestionError(planned.reason, SUGGESTION_FAIL_RU[planned.reason]);
  }
  slog("generate", "plan:ok", {
    menuId,
    dishes: planned.plan.length,
    ms: Date.now() - planStarted,
  });

  slog("generate", "expand:start", {
    menuId,
    dishes: planned.plan.length,
  });
  const expandStarted = Date.now();
  const expanded = await expandMenuRecipes(supabase, planned.plan, {
    menuDayCount: dayCount,
    peoplePerMeal: options.peopleCount,
    tasteNotes,
    chat: options.chat,
    availableEquipment: equipment,
  });
  if (!expanded.ok) {
    slogError("generate", "expand:fail", {
      menuId,
      reason: expanded.reason,
      ms: Date.now() - expandStarted,
    });
    throw new SuggestionError(
      expanded.reason,
      SUGGESTION_FAIL_RU[expanded.reason],
    );
  }
  slog("generate", "expand:ok", {
    menuId,
    recipes: expanded.dishes.length,
    ms: Date.now() - expandStarted,
  });

  const inventedIds = expanded.dishes.map((d) => d.recipeId);
  try {
    const proposals = buildProposalsFromExpanded(expanded.dishes, slotByKey);
    slog("generate", "assign:start", {
      menuId,
      proposals: proposals.length,
      inventedIds: inventedIds.length,
    });
    const assignStarted = Date.now();
    await assignPositionProposals(
      supabase,
      userId,
      menuId,
      now,
      proposals,
      inventedIds,
    );
    slog("generate", "assign:ok", {
      menuId,
      ms: Date.now() - assignStarted,
    });
  } catch (err) {
    slogError("generate", "assign:fail", {
      menuId,
      inventedIds: inventedIds.length,
      message: err instanceof Error ? err.message : String(err),
    });
    if (inventedIds.length > 0) {
      await supabase.from("recipes").delete().in("id", inventedIds);
      slog("generate", "assign:cleanup-recipes", {
        menuId,
        deleted: inventedIds.length,
      });
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
  _now: Date,
  proposals: ProposedAssignment[],
  inventedIds: string[],
): Promise<void> {
  // Invented recipes were just gated at expand — load by id. Do NOT re-run the
  // full library candidate pipeline (it can drop fresh rows and zero the pool).
  const [{ data: inventedRows, error: inventedError }, suppress] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, fridge_keep_days, plate_role")
        .in("id", inventedIds),
      loadSuppressSets(supabase, userId),
    ]);
  if (inventedError || !inventedRows?.length) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }
  if (!suppress) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  const assignPool: SuggestionCandidate[] = inventedRows.map((row) => ({
    recipeId: row.id,
    name: row.name,
    fridgeKeepDays: row.fridge_keep_days,
    longIdle: false,
    recentlyUsed: false,
    rating: "none",
    plateRole:
      typeof row.plate_role === "string" && row.plate_role.length > 0
        ? row.plate_role
        : null,
  }));
  if (assignPool.length === 0) {
    slogError("generate", "assign:zero-pool", {
      menuId,
      inventedIds: inventedIds.length,
      inventedRows: inventedRows?.length ?? 0,
    });
    throw new SuggestionError(
      "zero_eligible",
      SUGGESTION_FAIL_RU.zero_eligible,
    );
  }

  const nameById = new Map(
    assignPool.map((c) => [c.recipeId, c.name] as const),
  );
  const sanitized = dropHeavyHeavyCompanions(proposals, nameById);
  if (sanitized.length === 0) {
    slogError("generate", "assign:sanitized-empty", {
      menuId,
      proposals: proposals.length,
    });
    throw new SuggestionError("parse", SUGGESTION_FAIL_RU.parse);
  }

  slog("generate", "assign:write", {
    menuId,
    proposals: sanitized.length,
    pool: assignPool.length,
  });
  const assignResult = await assignProposalsToSlots(
    supabase,
    menuId,
    sanitized,
    assignPool,
    suppress,
  );
  if (assignResult.assignedCount === 0) {
    slogError("generate", "assign:zero-assigned", {
      menuId,
      proposals: sanitized.length,
    });
    throw new SuggestionError("assign", SUGGESTION_FAIL_RU.assign);
  }
  slog("generate", "assign:write-ok", {
    menuId,
    assignedCount: assignResult.assignedCount,
  });
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
