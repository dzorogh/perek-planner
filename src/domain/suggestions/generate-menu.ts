import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_INCLUDE_SNACKS,
  expectedSlotCount,
  isMealSlot,
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
import {
  candidateDeficitThreshold,
  inventAndPersistRecipes,
  inventCountPerMenu,
} from "@/domain/suggestions/invent-recipes";
import {
  deterministicAssignments,
  type ProposedAssignment,
  type SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";
import { generateSnacksForMenu } from "@/domain/suggestions/generate-snacks";
import { looksLikeNoCookSnack } from "@/domain/suggestions/meal-fit";
import { normalizePlateAssignments } from "@/domain/suggestions/plate-complete";
import { preferInventedCandidates } from "@/domain/suggestions/rank";
import { loadSuppressSets } from "@/domain/suggestions/suppress";
import { enforceDayVariety } from "@/domain/suggestions/variety";
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
 * Create Menu skeleton + AI-fill slots (library + invent-then-persist).
 * Eligibility: fridge-keep + Refusal/dislike suppress only.
 * On failure: delete Menu (orphan rollback).
 */
export async function generateBuyableMenuForUser(
  supabase: SupabaseClient,
  userId: string,
  dayCount: number,
  options: GenerateMenuOptions = {},
): Promise<GenerateMenuResult> {
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
      fillCookableSlots(
        supabase,
        userId,
        menuId,
        dayCount,
        slotCount,
        options,
      ),
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

  let built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  const previousMenusDishes = await loadRecentMenuDishNames(
    supabase,
    userId,
    { excludeMenuId: menuId },
  );
  if (!previousMenusDishes) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  // Invent the dish set via chunked AI calls (all meal types).
  const exactLibraryNames = built.candidates.map((c) => c.name);
  const inventedIds = new Set<string>();

  const inventN = inventCountPerMenu(slotCount, options.meals);
  const invented = await inventAndPersistRecipes(supabase, menuId, inventN, {
    chat: options.chat,
    userId,
    meals: options.meals,
    previousMenusDishes,
    avoidNames: previousMenusDishes,
    exactAvoidNames: exactLibraryNames,
    peoplePerMeal: options.peopleCount,
  });
  if (!invented.ok) {
    if (invented.reason === "openrouter") {
      throw new SuggestionError("openrouter", SUGGESTION_FAIL_RU.openrouter);
    }
    throw new SuggestionError(
      "zero_eligible",
      SUGGESTION_FAIL_RU.zero_eligible,
    );
  }
  for (const id of invented.inventedIds) inventedIds.add(id);

  built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  if (built.candidates.length === 0) {
    throw new SuggestionError(
      "zero_eligible",
      SUGGESTION_FAIL_RU.zero_eligible,
    );
  }

  // Prefer this menu's inventions so consecutive menus don't reshuffle the same stack.
  // Drop snack-like library leftovers — перекусы live in menu_snacks, not cookable slots.
  const cookable = built.candidates.filter((c) => !looksLikeNoCookSnack(c.name));
  const assignPool = preferInventedCandidates(
    cookable.length > 0 ? cookable : built.candidates,
    inventedIds,
    candidateDeficitThreshold(slotCount),
  );

  const { data: slotRows, error: slotsError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal")
    .eq("menu_id", menuId)
    .order("day_index", { ascending: true });

  if (slotsError || !slotRows?.length) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  if (slotRows.length !== slotCount) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  const slots: SlotPrompt[] = [];
  for (const row of slotRows) {
    if (!isMealSlot(row.meal)) {
      throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
    }
    if (row.day_index < 1 || row.day_index > dayCount) {
      throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
    }
    slots.push({
      slotId: row.id,
      dayIndex: row.day_index,
      meal: row.meal,
    });
  }

  // Create-flow: deterministic batch assign (LLM assign kept for resuggest only).
  let proposals = deterministicAssignments(slots, assignPool);
  proposals = enforceDayVariety(slots, proposals, assignPool);
  proposals = normalizePlateAssignments(slots, proposals, assignPool);

  if (proposals.length === 0) {
    throw new SuggestionError("parse", SUGGESTION_FAIL_RU.parse);
  }

  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    throw new SuggestionError("query", SUGGESTION_FAIL_RU.query);
  }

  const assignResult = await assignProposalsToSlots(
    supabase,
    menuId,
    proposals,
    assignPool,
    suppress,
  );

  if (assignResult.assignedCount === 0) {
    throw new SuggestionError("assign", SUGGESTION_FAIL_RU.assign);
  }
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
  return [
    ...proposals,
    ...deterministicAssignments(remaining, candidates),
  ];
}
