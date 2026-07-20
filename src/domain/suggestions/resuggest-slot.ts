import type { SupabaseClient } from "@supabase/supabase-js";

import { mealAllowsCompanion, type MealSlot } from "@/domain/menu/constants";
import { passesFridgeKeep } from "@/domain/matching/eligibility";
import { assignProposalsToSlots } from "@/domain/suggestions/assign";
import {
  buildCandidates,
  type SuggestionCandidate,
} from "@/domain/suggestions/candidates";
import { SUGGESTIONS_RU } from "@/domain/suggestions/constants";
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

function resuggestFailMessage(err: unknown): string {
  if (err instanceof SuggestionError) return err.message;
  if (err instanceof OpenRouterError) return SUGGESTION_FAIL_RU.openrouter;
  return SUGGESTION_FAIL_RU.openrouter;
}

export type ResuggestSlotResult =
  | { ok: true }
  | { ok: false; error: string };

export type SlotDishTarget = "main" | "companion";

type SlotRow = {
  id: string;
  day_index: number;
  meal: string;
  recipe_id: string | null;
  companion_recipe_id: string | null;
};

type InventRebuildOk = {
  ok: true;
  candidates: SuggestionCandidate[];
  inventedIds: Set<string>;
  siblingNames: string[];
  previousMenusDishes: string[];
};

type InventRebuildResult = InventRebuildOk | { ok: false; error: string };

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

  data.forEach((row) => {
    pushName(
      row.recipe_id,
      row.recipes as { name: string } | { name: string }[] | null,
    );
    pushName(
      row.companion_recipe_id,
      (row as { companion?: { name: string } | { name: string }[] | null })
        .companion,
    );
  });
  return names;
}

function requireOpenRouter(
  chat?: ChatCompletionsFn,
): ResuggestSlotResult | null {
  if (!getOpenRouterApiKey() && !chat) {
    return { ok: false, error: SUGGESTION_FAIL_RU.no_key };
  }
  return null;
}

/**
 * Shared invent → rebuild candidates pipeline used by resuggest / replace.
 */
async function inventAndRebuildCandidates(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  meal: MealSlot,
  excludeRecipeId: string | null | undefined,
  inventN: number,
  options: {
    chat?: ChatCompletionsFn;
    now?: Date;
    extraAvoidNames?: string[];
  },
): Promise<InventRebuildResult> {
  const now = options.now ?? new Date();
  let built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const siblingNames = await loadMenuRecipeNames(supabase, menuId, {
    excludeRecipeId: excludeRecipeId ?? undefined,
  });
  const previousMenusDishes =
    (await loadRecentMenuDishNames(supabase, userId, {
      excludeMenuId: menuId,
    })) ?? [];
  const avoidNames = [
    ...previousMenusDishes,
    ...siblingNames,
    ...(options.extraAvoidNames ?? []),
  ];
  const exactAvoid = built.candidates.map((c) => c.name);

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
  if (!invented.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU[invented.reason] };
  }

  built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  return {
    ok: true,
    candidates: built.candidates,
    inventedIds: new Set(invented.inventedIds),
    siblingNames,
    previousMenusDishes,
  };
}

function selectMainPool<T extends { recipeId: string; name: string }>(
  mealMains: T[],
  withoutCurrent: T[],
  allCandidates: T[],
  currentRecipeId: string | null,
): T[] {
  if (mealMains.length > 0) return mealMains;
  if (withoutCurrent.length > 0) return withoutCurrent;
  return allCandidates.filter(
    (candidate) =>
      candidate.recipeId !== currentRecipeId &&
      !looksLikeNoCookSnack(candidate.name),
  );
}

function preferMainCandidates(
  allCandidates: SuggestionCandidate[],
  meal: MealSlot,
  excludeRecipeId: string | null,
  inventedIds: Set<string>,
): SuggestionCandidate[] {
  const withoutCurrent = allCandidates.filter(
    (c) =>
      c.recipeId !== excludeRecipeId &&
      !looksLikeNoCookSnack(c.name) &&
      !looksLikeCompanionOnly(c.name),
  );
  const mealMains = mainsForMeal(meal, withoutCurrent);
  const pool = selectMainPool(
    mealMains,
    withoutCurrent,
    allCandidates,
    excludeRecipeId,
  );
  return preferInventedCandidates(pool, inventedIds);
}

function preferCompanionCandidates(
  allCandidates: SuggestionCandidate[],
  excludeIds: Set<string>,
  dayCount: number,
  inventedIds: Set<string>,
): SuggestionCandidate[] {
  const fridgeOk = (c: SuggestionCandidate) =>
    passesFridgeKeep(c.fridgeKeepDays, dayCount);
  const sidePool = allCandidates.filter(
    (c) =>
      !excludeIds.has(c.recipeId) &&
      !looksLikeNoCookSnack(c.name) &&
      fridgeOk(c) &&
      (c.plateRole === "companion" || looksLikeCompanionOnly(c.name)),
  );
  const anyPool = allCandidates.filter(
    (c) =>
      !excludeIds.has(c.recipeId) &&
      !looksLikeNoCookSnack(c.name) &&
      fridgeOk(c),
  );
  const pool = sidePool.length > 0 ? sidePool : anyPool;
  return preferInventedCandidates(pool, inventedIds);
}

async function proposeSlotAssignments(
  promptSlots: SlotPrompt[],
  candidates: SuggestionCandidate[],
  chat: ChatCompletionsFn | undefined,
  tasteNotes: Awaited<ReturnType<typeof loadTasteNotes>>,
  inventedIds: Set<string>,
  previousMenusDishes: string[],
  siblingNames: string[],
): Promise<
  | { ok: true; proposals: ProposedAssignment[] }
  | { ok: false; error: string }
> {
  if (!tasteNotes) {
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }

  let proposals: ProposedAssignment[];
  try {
    proposals = await proposeAssignmentsViaOpenRouter(
      promptSlots,
      candidates,
      chat,
      tasteNotes,
      inventedIds,
      previousMenusDishes,
      siblingNames,
    );
  } catch (err) {
    return { ok: false, error: resuggestFailMessage(err) };
  }

  if (proposals.length === 0) {
    proposals = deterministicAssignments(promptSlots, candidates);
  } else {
    proposals = normalizePlateAssignments(promptSlots, proposals, candidates);
  }

  if (proposals.length === 0) {
    return { ok: false, error: SUGGESTION_FAIL_RU.parse };
  }
  return { ok: true, proposals };
}

async function assignProposalsOrFail(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  proposals: ProposedAssignment[],
  candidates: SuggestionCandidate[],
  forceSuppressIds: string[] = [],
): Promise<ResuggestSlotResult> {
  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }
  forceSuppressIds.forEach((id) => suppress.refusedIds.add(id));

  const assignResult = await assignProposalsToSlots(
    supabase,
    menuId,
    proposals,
    candidates,
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

  if (target === "companion") {
    return startCompanionResuggest(supabase, userId, menuId, slot, options);
  }

  return resuggestMainOnly(supabase, userId, menuId, slot, options);
}

async function startCompanionResuggest(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  options: { chat?: ChatCompletionsFn; now?: Date },
): Promise<ResuggestSlotResult> {
  const meal = slot.meal as MealSlot;
  if (!mealAllowsCompanion(meal)) {
    return { ok: false, error: "Для этого приёма компаньон не используется." };
  }
  if (!slot.recipe_id) {
    return { ok: false, error: "Сначала выберите основное блюдо." };
  }
  return resuggestCompanionOnly(supabase, userId, menuId, slot, options);
}

async function resuggestMainOnly(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  options: { chat?: ChatCompletionsFn; now?: Date },
): Promise<ResuggestSlotResult> {
  const meal = slot.meal as MealSlot;
  const inventN = mealAllowsCompanion(meal) ? 4 : 3;
  const rebuilt = await inventAndRebuildCandidates(
    supabase,
    userId,
    menuId,
    meal,
    slot.recipe_id,
    inventN,
    options,
  );
  if (!rebuilt.ok) return rebuilt;

  const candidates = preferMainCandidates(
    rebuilt.candidates,
    meal,
    slot.recipe_id,
    rebuilt.inventedIds,
  );
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
  const proposed = await proposeSlotAssignments(
    [promptSlot],
    candidates,
    options.chat,
    tasteNotes,
    rebuilt.inventedIds,
    rebuilt.previousMenusDishes,
    rebuilt.siblingNames,
  );
  if (!proposed.ok) return proposed;

  return assignProposalsOrFail(
    supabase,
    userId,
    menuId,
    proposed.proposals,
    candidates,
  );
}

async function resuggestCompanionOnly(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  options: { chat?: ChatCompletionsFn; now?: Date },
): Promise<ResuggestSlotResult> {
  const meal = slot.meal as MealSlot;
  const rebuilt = await inventAndRebuildCandidates(
    supabase,
    userId,
    menuId,
    meal,
    slot.companion_recipe_id,
    2,
    options,
  );
  if (!rebuilt.ok) return rebuilt;

  const dayCount = await loadMenuDayCount(supabase, menuId);
  if (dayCount == null) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const exclude = new Set(
    [slot.recipe_id, slot.companion_recipe_id].filter(
      (id): id is string => typeof id === "string",
    ),
  );
  const candidates = preferCompanionCandidates(
    rebuilt.candidates,
    exclude,
    dayCount,
    rebuilt.inventedIds,
  );
  if (candidates.length === 0) {
    return {
      ok: false,
      error: "Нет другого доступного компаньона для этого слота.",
    };
  }

  const companionId = await chooseCompanionId(
    slot,
    candidates,
    options.chat,
    rebuilt,
    userId,
    supabase,
  );
  if (!companionId) {
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }

  return persistCompanionId(
    supabase,
    userId,
    menuId,
    slot,
    companionId,
    candidates,
    dayCount,
  );
}

async function loadMenuDayCount(
  supabase: SupabaseClient,
  menuId: string,
): Promise<number | null> {
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("day_count")
    .eq("id", menuId)
    .maybeSingle();
  if (menuError || !menu?.day_count) return null;
  return menu.day_count;
}

async function chooseCompanionId(
  slot: SlotRow,
  candidates: SuggestionCandidate[],
  chat: ChatCompletionsFn | undefined,
  rebuilt: InventRebuildOk,
  userId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const meal = slot.meal as MealSlot;
  const promptSlot: SlotPrompt = {
    slotId: slot.id,
    dayIndex: slot.day_index,
    meal,
  };
  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) return null;

  try {
    const proposals = await proposeAssignmentsViaOpenRouter(
      [promptSlot],
      candidates,
      chat,
      tasteNotes,
      rebuilt.inventedIds,
      rebuilt.previousMenusDishes,
      rebuilt.siblingNames,
    );
    return companionIdFromProposal(proposals[0], slot.recipe_id, candidates);
  } catch {
    return candidates[0]!.recipeId;
  }
}

function companionIdFromProposal(
  chosen: ProposedAssignment | undefined,
  mainRecipeId: string | null,
  candidates: SuggestionCandidate[],
): string {
  if (chosen?.companionRecipeId && chosen.companionRecipeId !== mainRecipeId) {
    return chosen.companionRecipeId;
  }
  if (
    chosen?.recipeId &&
    chosen.recipeId !== mainRecipeId &&
    candidates.some((c) => c.recipeId === chosen.recipeId)
  ) {
    // Model may put the companion in recipeId when asked for a side-only pick.
    return chosen.recipeId;
  }
  return candidates[0]!.recipeId;
}

async function persistCompanionId(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  slot: SlotRow,
  companionId: string,
  candidates: SuggestionCandidate[],
  dayCount: number,
): Promise<ResuggestSlotResult> {
  const suppress = await loadSuppressSets(supabase, userId);
  if (!suppress) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }

  const usableId = resolveUsableCompanionId(
    companionId,
    candidates,
    suppress.refusedIds,
    suppress.dislikedIds,
    dayCount,
  );
  if (!usableId) {
    return { ok: false, error: SUGGESTION_FAIL_RU.assign };
  }

  const { data: updated, error } = await supabase
    .from("menu_slots")
    .update({ companion_recipe_id: usableId })
    .eq("id", slot.id)
    .eq("menu_id", menuId)
    .select("id");

  if (error || !updated?.length) {
    return { ok: false, error: SUGGESTION_FAIL_RU.assign };
  }
  return { ok: true };
}

function resolveUsableCompanionId(
  companionId: string,
  candidates: SuggestionCandidate[],
  refusedIds: Set<string>,
  dislikedIds: Set<string>,
  dayCount: number,
): string | null {
  const isUsable = (id: string) => {
    if (refusedIds.has(id) || dislikedIds.has(id)) return false;
    const cand = candidates.find((c) => c.recipeId === id);
    return cand != null && passesFridgeKeep(cand.fridgeKeepDays, dayCount);
  };
  if (isUsable(companionId)) return companionId;
  return candidates.find((c) => isUsable(c.recipeId))?.recipeId ?? null;
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
  const keyError = requireOpenRouter(options.chat);
  if (keyError) return keyError;

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

  const recipeId = selectedRecipeId(slot, target);
  if (!recipeId) {
    return { ok: false, error: missingTargetMessage(target) };
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
    .select("id, recipe_id, companion_recipe_id")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();

  if (slotError || !slot) {
    return { ok: false, error: "Слот не найден." };
  }

  const refusedRecipeId = selectedRecipeId(slot, target);
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

function selectedRecipeId(
  slot: { recipe_id: string | null; companion_recipe_id: string | null },
  target: SlotDishTarget,
): string | null {
  return target === "companion" ? slot.companion_recipe_id : slot.recipe_id;
}

function missingTargetMessage(target: SlotDishTarget): string {
  if (target === "companion") return "В слоте нет компаньона.";
  return "В слоте нет блюда.";
}

async function replaceRecipeIdAcrossMenu(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  recipeId: string,
  options: ReplaceAcrossOptions = {},
): Promise<ResuggestSlotResult> {
  const slots = await loadSlotsWithRecipe(supabase, menuId, recipeId);
  if (!slots.ok) return slots;

  const contextMeal = (slots.asMain[0] ?? slots.asCompanion[0])!
    .meal as MealSlot;
  const rebuilt = await inventReplaceCandidates(
    supabase,
    userId,
    menuId,
    recipeId,
    contextMeal,
    options,
  );
  if (!rebuilt.ok) return rebuilt;

  const candidates = preferMainCandidates(
    rebuilt.candidates,
    contextMeal,
    recipeId,
    rebuilt.inventedIds,
  );
  if (candidates.length === 0) {
    return {
      ok: false,
      error: "Нет другого доступного блюда для замены.",
    };
  }

  const plate = await chooseReplacementPlate(
    supabase,
    userId,
    slots.asMain,
    candidates,
    contextMeal,
    rebuilt,
    options.chat,
  );
  if (!plate.ok) return plate;

  if (slots.asMain.length > 0) {
    const mainResult = await replaceMains(
      supabase,
      userId,
      menuId,
      slots.asMain,
      plate,
      candidates,
      options.forceSuppressIds ?? [],
    );
    if (!mainResult.ok) return mainResult;
    plate.chosenCompanionId = mainResult.chosenCompanionId;
  }

  return replaceCompanions(
    supabase,
    menuId,
    slots.asMain,
    slots.asCompanion,
    plate.chosenId,
    plate.chosenCompanionId,
  );
}

async function loadSlotsWithRecipe(
  supabase: SupabaseClient,
  menuId: string,
  recipeId: string,
): Promise<
  | { ok: true; asMain: SlotRow[]; asCompanion: SlotRow[] }
  | { ok: false; error: string }
> {
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
  return { ok: true, asMain, asCompanion };
}

async function inventReplaceCandidates(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  recipeId: string,
  contextMeal: MealSlot,
  options: ReplaceAcrossOptions,
): Promise<InventRebuildResult> {
  const now = options.now ?? new Date();
  const built = await buildCandidates(supabase, userId, menuId, now);
  if (!built.ok) {
    return { ok: false, error: SUGGESTION_FAIL_RU.query };
  }
  const refusedName =
    built.candidates.find((c) => c.recipeId === recipeId)?.name ?? "";
  const inventN = mealAllowsCompanion(contextMeal) ? 4 : 3;
  return inventAndRebuildCandidates(
    supabase,
    userId,
    menuId,
    contextMeal,
    recipeId,
    inventN,
    {
      chat: options.chat,
      now,
      extraAvoidNames: refusedName ? [refusedName] : [],
    },
  );
}

type ReplacementPlate = {
  ok: true;
  chosenId: string;
  chosenCompanionId: string | null;
  chosenPlateKind: ProposedAssignment["plateKind"];
};

async function chooseReplacementPlate(
  supabase: SupabaseClient,
  userId: string,
  asMain: SlotRow[],
  candidates: SuggestionCandidate[],
  contextMeal: MealSlot,
  rebuilt: InventRebuildOk,
  chat?: ChatCompletionsFn,
): Promise<ReplacementPlate | { ok: false; error: string }> {
  const sharedId =
    [...rebuilt.inventedIds].find((id) =>
      candidates.some((c) => c.recipeId === id),
    ) ?? candidates[0]!.recipeId;

  let chosenId = sharedId;
  let chosenCompanionId: string | null = null;
  let chosenPlateKind: ProposedAssignment["plateKind"] = mealAllowsCompanion(
    contextMeal,
  )
    ? "complete"
    : null;

  if (asMain.length === 0) {
    return { ok: true, chosenId, chosenCompanionId, chosenPlateKind };
  }

  const promptSlots: SlotPrompt[] = asMain.map((row) => ({
    slotId: row.id,
    dayIndex: row.day_index,
    meal: row.meal as MealSlot,
  }));
  const tasteNotes = await loadTasteNotes(supabase, userId);
  if (!tasteNotes) {
    return { ok: false, error: SUGGESTIONS_RU.tasteNotesFail };
  }

  try {
    const llm = await proposeAssignmentsViaOpenRouter(
      promptSlots,
      candidates,
      chat,
      tasteNotes,
      rebuilt.inventedIds,
      rebuilt.previousMenusDishes,
      rebuilt.siblingNames,
    );
    if (llm.length > 0) {
      const first = llm[0]!;
      chosenId = first.recipeId;
      chosenCompanionId = first.companionRecipeId ?? null;
      chosenPlateKind = first.plateKind ?? chosenPlateKind;
    }
  } catch (err) {
    if (!(err instanceof OpenRouterError || err instanceof SuggestionError)) {
      return { ok: false, error: resuggestFailMessage(err) };
    }
  }

  return { ok: true, chosenId, chosenCompanionId, chosenPlateKind };
}

async function replaceMains(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  asMain: SlotRow[],
  plate: ReplacementPlate,
  candidates: SuggestionCandidate[],
  forceSuppressIds: string[],
): Promise<
  | { ok: true; chosenCompanionId: string | null }
  | { ok: false; error: string }
> {
  const promptSlots: SlotPrompt[] = asMain.map((row) => ({
    slotId: row.id,
    dayIndex: row.day_index,
    meal: row.meal as MealSlot,
  }));

  let proposals: ProposedAssignment[] = asMain.map((row) => ({
    slotId: row.id,
    recipeId: plate.chosenId,
    companionRecipeId: plate.chosenCompanionId,
    plateKind: plate.chosenPlateKind,
  }));
  proposals = normalizePlateAssignments(promptSlots, proposals, candidates);

  const assigned = await assignProposalsOrFail(
    supabase,
    userId,
    menuId,
    proposals,
    candidates,
    forceSuppressIds,
  );
  if (!assigned.ok) return assigned;

  return {
    ok: true,
    chosenCompanionId: proposals[0]?.companionRecipeId ?? null,
  };
}

async function replaceCompanions(
  supabase: SupabaseClient,
  menuId: string,
  asMain: SlotRow[],
  asCompanion: SlotRow[],
  chosenId: string,
  chosenCompanionId: string | null,
): Promise<ResuggestSlotResult> {
  const mainIds = new Set(asMain.map((m) => m.id));
  for (const row of asCompanion) {
    if (mainIds.has(row.id)) continue;
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
