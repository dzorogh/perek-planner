import type { SupabaseClient } from "@supabase/supabase-js";

import { mealAllowsCompanion, type MealSlot } from "@/domain/menu/constants";
import { assignProposalsToSlots } from "@/domain/suggestions/assign";
import { buildCandidates } from "@/domain/suggestions/candidates";
import {
  SUGGESTION_FAIL_RU,
  SuggestionError,
} from "@/domain/suggestions/errors";
import { recordTasteBanFromFeedback } from "@/domain/settings/taste-preferences";
import { loadRecentMenuDishNames } from "@/domain/suggestions/history";
import { inventAndPersistRecipes } from "@/domain/suggestions/invent-recipes";
import {
  looksLikeCompanionOnly,
  looksLikeNoCookSnack,
  mainsForMeal,
} from "@/domain/suggestions/meal-fit";
import {
  deterministicAssignments,
  proposeAssignmentsViaOpenRouter,
  type ProposedAssignment,
  type SlotPrompt,
} from "@/domain/suggestions/openrouter-generate";
import { normalizePlateAssignments } from "@/domain/suggestions/plate-complete";
import { preferInventedCandidates } from "@/domain/suggestions/rank";
import { loadSuppressSets } from "@/domain/suggestions/suppress";
import {
  isValidFeedbackComment,
  normalizeFeedbackComment,
} from "@/domain/history/constants";
import { loadTasteNotes } from "@/domain/suggestions/taste-notes";
import {
  getOpenRouterApiKey,
  OpenRouterError,
  type ChatCompletionsFn,
} from "@/lib/openrouter/client";

export type ResuggestSlotResult =
  | { ok: true }
  | { ok: false; error: string };

export type SlotDishTarget = "main" | "companion";

/**
 * Recipe names currently on the menu (AI invent/assign variety context).
 */
async function loadMenuRecipeNames(
  supabase: SupabaseClient,
  menuId: string,
  options: { excludeRecipeId?: string } = {},
): Promise<string[]> {
  const { data, error } = await supabase
    .from("menu_slots")
    .select(
      `recipe_id, companion_recipe_id,
       recipes!menu_slots_recipe_id_fkey(name),
       companion:recipes!menu_slots_companion_recipe_id_fkey(name)`,
    )
    .eq("menu_id", menuId);

  if (error || !data) return [];

  const names: string[] = [];
  const seen = new Set<string>();

  const pushName = (
    recipeId: string | null,
    recipes: { name: string } | { name: string }[] | null | undefined,
  ) => {
    if (!recipeId) return;
    if (options.excludeRecipeId && recipeId === options.excludeRecipeId) {
      return;
    }
    const recipe = Array.isArray(recipes) ? recipes[0] : recipes;
    const name = recipe?.name?.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  for (const row of data) {
    pushName(
      row.recipe_id,
      row.recipes as { name: string } | { name: string }[] | null,
    );
    pushName(
      row.companion_recipe_id,
      (row as { companion?: { name: string } | { name: string }[] | null })
        .companion,
    );
  }
  return names;
}

/**
 * AI replace for a single Menu slot dish (main or companion).
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
  if (!getOpenRouterApiKey() && !options.chat) {
    return { ok: false, error: SUGGESTION_FAIL_RU.no_key };
  }

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

  if (target === "companion") {
    if (!mealAllowsCompanion(meal)) {
      return { ok: false, error: "Для этого приёма компаньон не используется." };
    }
    if (!slot.recipe_id) {
      return { ok: false, error: "Сначала выберите основное блюдо." };
    }
    return resuggestCompanionOnly(
      supabase,
      userId,
      menuId,
      slot,
      options,
    );
  }

  const now = options.now ?? new Date();
  let built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const siblingNames = await loadMenuRecipeNames(supabase, menuId, {
    excludeRecipeId: slot.recipe_id ?? undefined,
  });
  const previousMenusDishes =
    (await loadRecentMenuDishNames(supabase, userId, {
      excludeMenuId: menuId,
    })) ?? [];
  const avoidNames = [...previousMenusDishes, ...siblingNames];
  const exactAvoid = built.candidates.map((c) => c.name);

  // Companion meals need extras so AI can return complete OR main+companion.
  const inventN = mealAllowsCompanion(meal) ? 4 : 3;
  const invented = await inventAndPersistRecipes(supabase, menuId, inventN, {
    chat: options.chat,
    userId,
    contextMeal: meal,
    meals: [meal],
    previousMenusDishes,
    currentMenuDishes: siblingNames,
    avoidNames,
    exactAvoidNames: exactAvoid,
  });

  const inventedIds = new Set<string>();
  if (invented.ok) {
    for (const id of invented.inventedIds) inventedIds.add(id);
    built = await buildCandidates(supabase, userId, menuId, now);
    if (!built.ok) {
      return { ok: false, error: SUGGESTION_FAIL_RU.query };
    }
  }

  const withoutCurrent = built.candidates.filter(
    (c) =>
      c.recipeId !== slot.recipe_id &&
      !looksLikeNoCookSnack(c.name) &&
      !looksLikeCompanionOnly(c.name),
  );
  const mealMains = mainsForMeal(meal, withoutCurrent);
  const pool =
    mealMains.length > 0
      ? mealMains
      : withoutCurrent.length > 0
        ? withoutCurrent
        : built.candidates.filter(
          (c) =>
            c.recipeId !== slot.recipe_id && !looksLikeNoCookSnack(c.name),
        );
  const minNeeded = mealAllowsCompanion(meal) ? 2 : 1;
  let candidates = preferInventedCandidates(pool, inventedIds, minNeeded);

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "Нет другого доступного блюда для этого слота.",
    };
  }

  const promptSlot: SlotPrompt = {
    slotId: slot.id,
    dayIndex: slot.day_index,
    meal,
  };

  const tasteNotes = await loadTasteNotes(supabase, userId);

  let proposals;
  try {
    proposals = await proposeAssignmentsViaOpenRouter(
      [promptSlot],
      candidates,
      options.chat,
      tasteNotes,
      inventedIds,
      previousMenusDishes,
      siblingNames,
    );
  } catch (err) {
    if (err instanceof OpenRouterError || err instanceof SuggestionError) {
      return { ok: false, error: SUGGESTION_FAIL_RU.openrouter };
    }
    return { ok: false, error: SUGGESTION_FAIL_RU.openrouter };
  }

  if (proposals.length === 0) {
    proposals = deterministicAssignments([promptSlot], candidates);
  } else {
    // proposeAssignmentsViaOpenRouter already normalizes; re-run if pool grew.
    proposals = normalizePlateAssignments(
      [promptSlot],
      proposals,
      candidates,
    );
  }

  if (proposals.length === 0) {
    return { ok: false, error: SUGGESTION_FAIL_RU.parse };
  }

  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const assignResult = await assignProposalsToSlots(
    supabase,
    menuId,
    proposals,
    candidates,
    suppress,
  );

  if (assignResult.assignedCount === 0) {
    return { ok: false, error: SUGGESTION_FAIL_RU.assign };
  }

  return { ok: true };
}

async function resuggestCompanionOnly(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: {
    id: string;
    day_index: number;
    meal: string;
    recipe_id: string | null;
    companion_recipe_id: string | null;
  },
  options: { chat?: ChatCompletionsFn; now?: Date },
): Promise<ResuggestSlotResult> {
  const now = options.now ?? new Date();
  let built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const meal = slot.meal as MealSlot;
  const siblingNames = await loadMenuRecipeNames(supabase, menuId, {
    excludeRecipeId: slot.companion_recipe_id ?? undefined,
  });
  const previousMenusDishes =
    (await loadRecentMenuDishNames(supabase, userId, {
      excludeMenuId: menuId,
    })) ?? [];
  const avoidNames = [...previousMenusDishes, ...siblingNames];
  const exactAvoid = built.candidates.map((c) => c.name);

  const invented = await inventAndPersistRecipes(supabase, menuId, 2, {
    chat: options.chat,
    userId,
    contextMeal: meal,
    meals: [meal],
    previousMenusDishes,
    currentMenuDishes: siblingNames,
    avoidNames,
    exactAvoidNames: exactAvoid,
  });

  const inventedIds = new Set<string>();
  if (invented.ok) {
    for (const id of invented.inventedIds) inventedIds.add(id);
    built = await buildCandidates(supabase, userId, menuId, now);
    if (!built.ok) {
      return { ok: false, error: SUGGESTION_FAIL_RU.query };
    }
  }

  const exclude = new Set(
    [slot.recipe_id, slot.companion_recipe_id].filter(
      (id): id is string => typeof id === "string",
    ),
  );
  const sidePool = built.candidates.filter(
    (c) =>
      !exclude.has(c.recipeId) &&
      !looksLikeNoCookSnack(c.name) &&
      looksLikeCompanionOnly(c.name),
  );
  const anyPool = built.candidates.filter(
    (c) => !exclude.has(c.recipeId) && !looksLikeNoCookSnack(c.name),
  );
  const pool = sidePool.length > 0 ? sidePool : anyPool;
  const candidates = preferInventedCandidates(pool, inventedIds, 1);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: "Нет другого доступного компаньона для этого слота.",
    };
  }

  const promptSlot: SlotPrompt = {
    slotId: slot.id,
    dayIndex: slot.day_index,
    meal,
  };
  const tasteNotes = await loadTasteNotes(supabase, userId);

  let companionId: string | null = null;
  try {
    const proposals = await proposeAssignmentsViaOpenRouter(
      [promptSlot],
      candidates,
      options.chat,
      tasteNotes,
      inventedIds,
      previousMenusDishes,
      siblingNames,
    );
    const chosen = proposals[0];
    if (chosen?.companionRecipeId && chosen.companionRecipeId !== slot.recipe_id) {
      companionId = chosen.companionRecipeId;
    } else if (
      chosen?.recipeId &&
      chosen.recipeId !== slot.recipe_id &&
      candidates.some((c) => c.recipeId === chosen.recipeId)
    ) {
      // Model may put the companion in recipeId when asked for a side-only pick.
      companionId = chosen.recipeId;
    }
  } catch {
    // fall through to deterministic pick
  }

  if (!companionId) {
    companionId = candidates[0]!.recipeId;
  }

  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }
  if (suppress.refusedIds.has(companionId) || suppress.dislikedIds.has(companionId)) {
    const alt = candidates.find(
      (c) =>
        !suppress.refusedIds.has(c.recipeId) &&
        !suppress.dislikedIds.has(c.recipeId),
    );
    if (!alt) {
      return { ok: false, error: SUGGESTION_FAIL_RU.assign };
    }
    companionId = alt.recipeId;
  }

  const { data: updated, error } = await supabase
    .from("menu_slots")
    .update({ companion_recipe_id: companionId })
    .eq("id", slot.id)
    .eq("menu_id", menuId)
    .select("id");

  if (error || !updated?.length) {
    return { ok: false, error: SUGGESTION_FAIL_RU.assign };
  }

  return { ok: true };
}

/** Clear companion dish for a slot (main stays). */
export async function clearCompanionForSlot(
  supabase: SupabaseClient,
  menuId: string,
  slotId: string,
): Promise<ResuggestSlotResult> {
  const { data: updated, error } = await supabase
    .from("menu_slots")
    .update({ companion_recipe_id: null })
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .select("id");

  if (error || !updated?.length) {
    return { ok: false, error: "Не удалось убрать компаньон." };
  }
  return { ok: true };
}

type ReplaceAcrossOptions = {
  chat?: ChatCompletionsFn;
  now?: Date;
  /**
   * Treat as hard-suppressed during assign (refusal path + replica lag).
   * Soft «Заменить все» does not set this.
   */
  forceSuppressIds?: string[];
};

/**
 * Replace every occurrence of the recipe in `slotId` (main or companion target)
 * with one other dish across the menu.
 */
export async function resuggestRecipeAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slotId: string,
  options: ReplaceAcrossOptions & { target?: SlotDishTarget } = {},
): Promise<ResuggestSlotResult> {
  if (!getOpenRouterApiKey() && !options.chat) {
    return { ok: false, error: SUGGESTION_FAIL_RU.no_key };
  }

  const target: SlotDishTarget = options.target ?? "main";

  const { data: slot, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, recipe_id, companion_recipe_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const recipeId =
    target === "companion" ? slot.companion_recipe_id : slot.recipe_id;
  if (!recipeId) {
    return {
      ok: false,
      error:
        target === "companion"
          ? "В слоте нет компаньона."
          : "В слоте нет блюда.",
    };
  }

  return replaceRecipeIdAcrossMenu(
    supabase,
    userId,
    menuId,
    recipeId,
    options,
  );
}

/**
 * Hard-refuse a recipe, then invent a replacement and apply it to every
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
  if (!getOpenRouterApiKey() && !options.chat) {
    return { ok: false, error: SUGGESTION_FAIL_RU.no_key };
  }

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
    .select("id, recipe_id, companion_recipe_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const refusedRecipeId =
    target === "companion" ? slot.companion_recipe_id : slot.recipe_id;
  if (!refusedRecipeId) {
    return {
      ok: false,
      error:
        target === "companion"
          ? "В слоте нет компаньона."
          : "В слоте нет блюда.",
    };
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

  return replaceRecipeIdAcrossMenu(supabase, userId, menuId, refusedRecipeId, {
    chat: options.chat,
    now: options.now,
    forceSuppressIds: [refusedRecipeId],
  });
}

async function replaceRecipeIdAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  recipeId: string,
  options: ReplaceAcrossOptions = {},
): Promise<ResuggestSlotResult> {
  const { data: allSlots, error: slotsError } = await supabase
    .from("menu_slots")
    .select("id, day_index, meal, recipe_id, companion_recipe_id")
    .eq("menu_id", menuId);

  if (slotsError || !allSlots?.length) {
    return { ok: false, error: "Не удалось найти слоты с этим блюдом." };
  }

  const asMain = allSlots.filter((s) => s.recipe_id === recipeId);
  const asCompanion = allSlots.filter((s) => s.companion_recipe_id === recipeId);

  if (asMain.length === 0 && asCompanion.length === 0) {
    return { ok: false, error: "Не удалось найти слоты с этим блюдом." };
  }

  const now = options.now ?? new Date();
  let built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const contextMeal = (asMain[0] ?? asCompanion[0])!.meal as MealSlot;
  const siblingNames = await loadMenuRecipeNames(supabase, menuId, {
    excludeRecipeId: recipeId,
  });
  const previousMenusDishes =
    (await loadRecentMenuDishNames(supabase, userId, {
      excludeMenuId: menuId,
    })) ?? [];
  const refusedName =
    built.candidates.find((c) => c.recipeId === recipeId)?.name ?? "";
  const avoidNames = [
    ...previousMenusDishes,
    ...siblingNames,
    ...(refusedName ? [refusedName] : []),
  ];
  const exactAvoid = built.candidates.map((c) => c.name);

  const inventN = mealAllowsCompanion(contextMeal) ? 4 : 3;
  const invented = await inventAndPersistRecipes(supabase, menuId, inventN, {
    chat: options.chat,
    userId,
    contextMeal,
    meals: [contextMeal],
    previousMenusDishes,
    currentMenuDishes: siblingNames,
    avoidNames,
    exactAvoidNames: exactAvoid,
  });

  const inventedIds = new Set<string>();
  if (invented.ok) {
    for (const id of invented.inventedIds) inventedIds.add(id);
    built = await buildCandidates(supabase, userId, menuId, now);
    if (!built.ok) {
      return { ok: false, error: SUGGESTION_FAIL_RU.query };
    }
  }

  const withoutRefused = built.candidates.filter(
    (c) =>
      c.recipeId !== recipeId &&
      !looksLikeNoCookSnack(c.name) &&
      !looksLikeCompanionOnly(c.name),
  );
  const mealMains = mainsForMeal(contextMeal, withoutRefused);
  const replacePool =
    mealMains.length > 0
      ? mealMains
      : withoutRefused.length > 0
        ? withoutRefused
        : built.candidates.filter(
          (c) => c.recipeId !== recipeId && !looksLikeNoCookSnack(c.name),
        );
  const minNeeded = mealAllowsCompanion(contextMeal) ? 2 : 1;
  const candidates = preferInventedCandidates(
    replacePool,
    inventedIds,
    minNeeded,
  );

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "Нет другого доступного блюда для замены.",
    };
  }

  const sharedId =
    [...inventedIds].find((id) =>
      candidates.some((c) => c.recipeId === id),
    ) ?? candidates[0]!.recipeId;

  let chosenId = sharedId;
  let chosenCompanionId: string | null = null;
  let chosenPlateKind: ProposedAssignment["plateKind"] = mealAllowsCompanion(
    contextMeal,
  )
    ? "complete"
    : null;

  if (asMain.length > 0) {
    const promptSlots: SlotPrompt[] = asMain.map((row) => ({
      slotId: row.id,
      dayIndex: row.day_index,
      meal: row.meal as MealSlot,
    }));
    const tasteNotes = await loadTasteNotes(supabase, userId);
    try {
      const llm = await proposeAssignmentsViaOpenRouter(
        promptSlots,
        candidates,
        options.chat,
        tasteNotes,
        inventedIds,
        previousMenusDishes,
        siblingNames,
      );
      if (llm.length > 0) {
        const first = llm[0]!;
        chosenId = first.recipeId;
        chosenCompanionId = first.companionRecipeId ?? null;
        chosenPlateKind = first.plateKind ?? chosenPlateKind;
      }
    } catch (err) {
      if (!(err instanceof OpenRouterError || err instanceof SuggestionError)) {
        return { ok: false, error: SUGGESTION_FAIL_RU.openrouter };
      }
    }

    const suppress = await loadSuppressSets(supabase, userId);
    if (!suppress) {
      return { ok: false, error: SUGGESTION_FAIL_RU.query };
    }
    for (const id of options.forceSuppressIds ?? []) {
      suppress.refusedIds.add(id);
    }

    // Same replacement plate across all days that had the refused main.
    let proposals: ProposedAssignment[] = asMain.map((row) => ({
      slotId: row.id,
      recipeId: chosenId,
      companionRecipeId: chosenCompanionId,
      plateKind: chosenPlateKind,
    }));
    proposals = normalizePlateAssignments(promptSlots, proposals, candidates);

    const assignResult = await assignProposalsToSlots(
      supabase,
      menuId,
      proposals,
      candidates,
      suppress,
    );

    if (assignResult.assignedCount === 0) {
      return { ok: false, error: SUGGESTION_FAIL_RU.assign };
    }

    // Keep chosenCompanionId in sync with what normalize produced.
    chosenCompanionId = proposals[0]?.companionRecipeId ?? null;
  }

  // Replace companion placements (including slots that only had it as companion).
  for (const row of asCompanion) {
    // Skip if we already rewrote this slot as main above.
    if (asMain.some((m) => m.id === row.id)) {
      continue;
    }
    const nextCompanion =
      chosenId === row.recipe_id ? null : (chosenCompanionId ?? chosenId);
    const { error } = await supabase
      .from("menu_slots")
      .update({ companion_recipe_id: nextCompanion })
      .eq("id", row.id)
      .eq("menu_id", menuId);
    if (error) {
      return { ok: false, error: SUGGESTION_FAIL_RU.assign };
    }
  }

  return { ok: true };
}
