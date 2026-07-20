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
    const tryOrder = uniquePreserve([
      proposal.recipeId,
      ...rankedIds.filter((id) => id !== proposal.recipeId),
    ]);

    let placed = false;
    for (const recipeId of tryOrder) {
      if (isHardSuppressed(recipeId, suppress)) continue;
      const fridge = fridgeById.get(recipeId);
      if (fridge == null) continue;
      if (!passesFridgeKeep(fridge, dayCount)) continue;
      // FR12: shortest selected fridge-keep must still cover Menu length.
      if (maxMenuDaysForRecipes([...selectedFridge, fridge]) < dayCount) {
        continue;
      }

      const companionRecipeId = resolveCompanionId(
        proposal.companionRecipeId,
        recipeId,
        fridgeById,
        suppress,
        dayCount,
        [...selectedFridge, fridge],
      );

      const companionFridge =
        companionRecipeId != null
          ? fridgeById.get(companionRecipeId)
          : undefined;

      const { data: updated, error } = await supabase
        .from("menu_slots")
        .update({
          recipe_id: recipeId,
          companion_recipe_id: companionRecipeId,
        })
        .eq("id", proposal.slotId)
        .eq("menu_id", menuId)
        .select("id");

      if (error || !updated?.length) {
        continue;
      }
      selectedFridge.push(fridge);
      if (companionFridge != null) selectedFridge.push(companionFridge);
      placed = true;
      assignedCount += 1;
      break;
    }

    if (!placed) {
      failedSlots.push(proposal.slotId);
    }
  }

  return { assignedCount, failedSlots };
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
