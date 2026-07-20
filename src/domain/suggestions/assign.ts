import type { SupabaseClient } from "@supabase/supabase-js";

import { maxMenuDaysForRecipes, passesFridgeKeep } from "@/domain/matching/eligibility";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import type { ProposedAssignment } from "@/domain/suggestions/openrouter-generate";
import { isHardSuppressed, type SuppressSets } from "@/domain/suggestions/suppress";

export type AssignResult = {
  assignedCount: number;
  failedSlots: string[];
};

/**
 * Assign proposed recipes to slots (fridge-keep + suppress only).
 * On suppressed / fridge-fail proposal, try next ranked candidate for that slot.
 * Companion is written when valid; otherwise cleared.
 */
export async function assignProposalsToSlots(
  supabase: SupabaseClient,
  menuId: string,
  proposals: ProposedAssignment[],
  candidates: SuggestionCandidate[],
  suppress: Pick<SuppressSets, "refusedIds" | "dislikedIds">,
): Promise<AssignResult> {
  const rankedIds = candidates.map((c) => c.recipeId);
  const fridgeById = new Map(
    candidates.map((c) => [c.recipeId, c.fridgeKeepDays] as const),
  );
  let assignedCount = 0;
  const failedSlots: string[] = [];
  const selectedFridge: number[] = [];

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("day_count")
    .eq("id", menuId)
    .maybeSingle();
  if (menuError || !menu?.day_count) {
    return {
      assignedCount: 0,
      failedSlots: proposals.map((p) => p.slotId),
    };
  }
  const dayCount = menu.day_count;

  for (const proposal of proposals) {
    const placed = await assignProposal(
      supabase, menuId, proposal, rankedIds, fridgeById, suppress, dayCount, selectedFridge,
    );
    if (placed) assignedCount += 1;
    else failedSlots.push(proposal.slotId);
  }

  return { assignedCount, failedSlots };
}

async function assignProposal(
  supabase: SupabaseClient,
  menuId: string,
  proposal: ProposedAssignment,
  rankedIds: string[],
  fridgeById: Map<string, number>,
  suppress: Pick<SuppressSets, "refusedIds" | "dislikedIds">,
  dayCount: number,
  selectedFridge: number[],
): Promise<boolean> {
  const tryOrder = uniquePreserve([
    proposal.recipeId,
    ...rankedIds.filter((id) => id !== proposal.recipeId),
  ]);
  for (const recipeId of tryOrder) {
    const fridge = usableFridge(recipeId, fridgeById, suppress, dayCount, selectedFridge);
    if (fridge == null) continue;
    const companionRecipeId = resolveCompanionId(
      proposal.companionRecipeId, recipeId, fridgeById, suppress, dayCount, [...selectedFridge, fridge],
    );
    const updated = await updateSlot(
      supabase, menuId, proposal.slotId, recipeId, companionRecipeId,
    );
    if (!updated) continue;
    selectedFridge.push(fridge);
    const companionFridge = companionRecipeId ? fridgeById.get(companionRecipeId) : null;
    if (companionFridge != null) selectedFridge.push(companionFridge);
    return true;
  }
  return false;
}

function usableFridge(
  recipeId: string,
  fridgeById: ReadonlyMap<string, number>,
  suppress: Pick<SuppressSets, "refusedIds" | "dislikedIds">,
  dayCount: number,
  selectedFridge: number[],
): number | null {
  if (isHardSuppressed(recipeId, suppress)) return null;
  const fridge = fridgeById.get(recipeId);
  if (fridge == null || !passesFridgeKeep(fridge, dayCount)) return null;
  return maxMenuDaysForRecipes([...selectedFridge, fridge]) >= dayCount ? fridge : null;
}

async function updateSlot(
  supabase: SupabaseClient,
  menuId: string,
  slotId: string,
  recipeId: string,
  companionRecipeId: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("menu_slots")
    .update({ recipe_id: recipeId, companion_recipe_id: companionRecipeId })
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .select("id");
  return !error && Boolean(data?.length);
}

function resolveCompanionId(
  requested: string | null | undefined,
  mainRecipeId: string,
  fridgeById: Map<string, number>,
  suppress: Pick<SuppressSets, "refusedIds" | "dislikedIds">,
  dayCount: number,
  selectedFridgeWithMain: number[],
): string | null {
  if (!requested || requested === mainRecipeId) return null;
  if (isHardSuppressed(requested, suppress)) return null;
  const fridge = fridgeById.get(requested);
  if (fridge == null) return null;
  if (!passesFridgeKeep(fridge, dayCount)) return null;
  if (maxMenuDaysForRecipes([...selectedFridgeWithMain, fridge]) < dayCount) {
    return null;
  }
  return requested;
}

function uniquePreserve(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
