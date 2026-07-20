import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_INCLUDE_SNACKS,
  expectedSlotCount,
  FIXED_MENU_DAY_COUNT,
  isMealSlot,
  mealAllowsCompanion,
  type MealSlot,
} from "@/domain/menu/constants";
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
};

/**
 * Create Menu skeleton + name-plan → variety audit → expand recipes → assign.
 * Fixed 4-day pairs. On failure: delete Menu (orphan rollback).
 */
export async function generateBuyableMenuForUser(
  supabase: SupabaseClient,
  userId: string,
  _dayCount: number,
  options: GenerateMenuOptions = {},
): Promise<GenerateMenuResult> {
  const dayCount = FIXED_MENU_DAY_COUNT;
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

  const created = await createMenuSkeletonForUser(supabase, userId, dayCount, {
    peopleCount: options.peopleCount,
    meals,
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

async function fillCookableSlots(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  dayCount: number,
  slotCount: number,
  options: GenerateMenuOptions & { meals: readonly MealSlot[] },
): Promise<void> {
  const now = options.now ?? new Date();
  const previousMenusDishes = await loadRecentMenuDishNames(supabase, userId, {
    excludeMenuId: menuId,
  });
  if (!previousMenusDishes) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) {
    throw new SuggestionError("query", SUGGESTIONS_RU.tasteNotesFail);
  }

  const slotByKey = await loadSlotKeyMap(supabase, menuId, dayCount, slotCount);

  // 1) Names only — cheap plan for the whole menu.
  const planned = await proposeMenuNamePlan(options.meals, {
    previousMenusDishes,
    avoidNames: previousMenusDishes,
    peoplePerMeal: options.peopleCount,
    tasteNotes,
    chat: options.chat,
  });
  if (!planned.ok) {
    throw new SuggestionError(planned.reason, SUGGESTION_FAIL_RU[planned.reason]);
  }

  let plan = planned.plan;

  // 2) Variety audit on names (before writing recipes).
  const audit = await analyzeMenuVariety(
    plan.map((d) => ({
      meal: d.meal,
      dayPair: d.dayPair,
      role: d.role,
      name: d.name,
      recipeId: planKey(d),
    })),
    { chat: options.chat },
  );

  if (audit.ok && audit.replace.length > 0) {
    const repaired = await repairMenuNamePlan(plan, audit.replace, {
      tasteNotes,
      chat: options.chat,
    });
    if (repaired.ok) {
      plan = repaired.plan;
    }
  }

  // 3) Expand locked names → full recipes (one batched AI call) + persist.
  const expanded = await expandMenuRecipes(supabase, plan, {
    peoplePerMeal: options.peopleCount,
    tasteNotes,
    chat: options.chat,
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

function buildProposalsFromExpanded(
  dishes: Array<PlannedDish & { recipeId: string }>,
  slotByKey: Map<string, SlotPrompt>,
): ProposedAssignment[] {
  const mains = dishes.filter((d) => d.role === "main");
  const companions = dishes.filter((d) => d.role === "companion");
  const companionByMainKey = new Map<string, string>();
  for (const c of companions) {
    companionByMainKey.set(
      `${c.meal}:${c.dayPair[0]}-${c.dayPair[1]}`,
      c.recipeId,
    );
  }

  const proposals: ProposedAssignment[] = [];
  for (const main of mains) {
    const key = `${main.meal}:${main.dayPair[0]}-${main.dayPair[1]}`;
    const companionRecipeId = mealAllowsCompanion(main.meal)
      ? (companionByMainKey.get(key) ?? null)
      : null;
    const plateKind = resolveAssignPlateKind(main, companionRecipeId);

    for (const day of main.dayPair) {
      const slot = slotByKey.get(`${day}:${main.meal}`);
      if (!slot) {
        throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
      }
      proposals.push({
        slotId: slot.slotId,
        recipeId: main.recipeId,
        companionRecipeId,
        plateKind,
      });
    }
  }
  return proposals;
}

async function loadSlotKeyMap(
  supabase: SupabaseClient,
  menuId: string,
  dayCount: number,
  slotCount: number,
): Promise<Map<string, SlotPrompt>> {
  const { data: slotRows, error: slotsError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal")
    .eq("menu_id", menuId)
    .order("day_index", { ascending: true });

  if (slotsError || !slotRows?.length || slotRows.length !== slotCount) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }
  const slots = buildSlotPrompts(slotRows, dayCount);
  return new Map(slots.map((s) => [`${s.dayIndex}:${s.meal}`, s] as const));
}

function resolveAssignPlateKind(
  main: PlannedDish,
  companionRecipeId: string | null,
): ProposedAssignment["plateKind"] {
  if (!mealAllowsCompanion(main.meal)) return null;
  if (main.plateKind) return main.plateKind;
  return companionRecipeId ? "needs_companion" : "complete";
}

function dropHeavyHeavyCompanions(
  proposals: ProposedAssignment[],
  nameById: Map<string, string>,
): ProposedAssignment[] {
  return proposals.map((p) => {
    if (!p.companionRecipeId) return p;
    const mainName = nameById.get(p.recipeId) ?? "";
    const sideName = nameById.get(p.companionRecipeId) ?? "";
    if (
      looksLikeHeavyAnimalProteinDish(mainName) &&
      looksLikeHeavyAnimalProteinDish(sideName)
    ) {
      return { ...p, companionRecipeId: null, plateKind: "complete" as const };
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
  const built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
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

  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
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
