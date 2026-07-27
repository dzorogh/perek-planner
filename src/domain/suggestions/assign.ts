import type { SupabaseClient } from "@supabase/supabase-js";

import { maxMenuDaysForRecipes, passesFridgeKeep } from "@/domain/matching/eligibility";
import { isMealSlot } from "@/domain/menu/constants";
import type { PlateRole } from "@/domain/menu/meal-templates";
import {
  isTemplateMeal,
  rolesForMeal,
} from "@/domain/menu/meal-templates";
import { replaceSlotDishes } from "@/domain/menu/menu-dishes";
import type { SuggestionCandidate } from "@/domain/suggestions/candidates";
import type { ProposedAssignment } from "@/domain/suggestions/openrouter-generate";
import { primaryRecipeIdFromDishes } from "@/domain/suggestions/role-slots";
import { isHardSuppressed, type SuppressSets } from "@/domain/suggestions/suppress";

export type AssignResult = {
  assignedCount: number;
  failedSlots: string[];
};

/**
 * Assign proposed recipes to slots (fridge-keep + suppress on EVERY dish id).
 * Writes full Harvard dishes + optional primary recipe_id shim.
 */
export async function assignProposalsToSlots(
  supabase: SupabaseClient,
  menuId: string,
  proposals: ProposedAssignment[],
  candidates: SuggestionCandidate[],
  suppress: Pick<SuppressSets, "refusedIds">,
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
  suppress: Pick<SuppressSets, "refusedIds">,
  dayCount: number,
  selectedFridge: number[],
): Promise<boolean> {
  const dishes = resolveProposalDishes(proposal);
  if (dishes.length === 0) return false;

  // Validate every recipe id in dishes (hard-suppress + fridge-keep).
  const fridgeAdds: number[] = [];
  const running = [...selectedFridge];
  for (const d of dishes) {
    const fridge = usableFridge(d.recipeId, fridgeById, suppress, dayCount, running);
    if (fridge == null) {
      // Try fallback only for primary when dishes came from legacy single-id path.
      if (dishes.length === 1) {
        return tryFallbackPrimary(
          supabase,
          menuId,
          proposal,
          rankedIds,
          fridgeById,
          suppress,
          dayCount,
          selectedFridge,
        );
      }
      return false;
    }
    fridgeAdds.push(fridge);
    running.push(fridge);
  }

  const { recipeId } = primaryRecipeIdFromDishes(dishes);
  const updated = await updateSlot(
    supabase,
    menuId,
    proposal.slotId,
    dishes,
    recipeId,
  );
  if (!updated) return false;
  selectedFridge.push(...fridgeAdds);
  return true;
}

async function tryFallbackPrimary(
  supabase: SupabaseClient,
  menuId: string,
  proposal: ProposedAssignment,
  rankedIds: string[],
  fridgeById: Map<string, number>,
  suppress: Pick<SuppressSets, "refusedIds">,
  dayCount: number,
  selectedFridge: number[],
): Promise<boolean> {
  const primary =
    proposal.dishes?.[0]?.recipeId ?? proposal.recipeId ?? null;
  if (!primary) return false;
  const plateRole = proposal.dishes?.[0]?.plateRole ?? "main";
  const tryOrder = uniquePreserve([
    primary,
    ...rankedIds.filter((id) => id !== primary),
  ]);
  for (const recipeId of tryOrder) {
    const fridge = usableFridge(recipeId, fridgeById, suppress, dayCount, selectedFridge);
    if (fridge == null) continue;
    const dishes = [{ plateRole, recipeId }];
    const { recipeId: primaryId } = primaryRecipeIdFromDishes(dishes);
    const updated = await updateSlot(
      supabase,
      menuId,
      proposal.slotId,
      dishes,
      primaryId,
    );
    if (!updated) continue;
    selectedFridge.push(fridge);
    return true;
  }
  return false;
}

function resolveProposalDishes(
  proposal: ProposedAssignment,
): Array<{ plateRole: PlateRole; recipeId: string }> {
  if (proposal.dishes?.length) {
    return proposal.dishes.filter((d) => d.recipeId);
  }
  if (!proposal.recipeId) return [];
  return [{ plateRole: "protein", recipeId: proposal.recipeId }];
}

/** Map legacy protein→main for breakfast-family; drop roles outside template. */
export function adaptDishesToMeal(
  meal: string,
  dishes: ReadonlyArray<{ plateRole: PlateRole; recipeId: string }>,
): Array<{ plateRole: PlateRole; recipeId: string }> {
  if (!isTemplateMeal(meal) || meal === "snack") return [...dishes];
  const template = new Set(rolesForMeal(meal));
  const out: Array<{ plateRole: PlateRole; recipeId: string }> = [];
  const seen = new Set<PlateRole>();
  for (const d of dishes) {
    let role = d.plateRole;
    if (!template.has(role) && role === "protein" && template.has("main")) {
      role = "main";
    }
    // Template already defines breakfast = main+fruit; keep fruit, drop carb/etc.
    if (!template.has(role) || seen.has(role)) continue;
    seen.add(role);
    out.push({ plateRole: role, recipeId: d.recipeId });
  }
  return out;
}

function usableFridge(
  recipeId: string,
  fridgeById: ReadonlyMap<string, number>,
  suppress: Pick<SuppressSets, "refusedIds">,
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
  dishes: Array<{ plateRole: PlateRole; recipeId: string }>,
  recipeId: string | null,
): Promise<boolean> {
  const { data: slotRow, error: slotError } = await supabase
    .from("menu_slots")
    .select("id, meal")
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .maybeSingle();
  if (slotError || !slotRow) return false;

  const meal = slotRow.meal;

  const { data, error } = await supabase
    .from("menu_slots")
    .update({ recipe_id: recipeId })
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .select("id, meal");
  if (error || !data?.length) return false;

  if (typeof meal === "string" && isMealSlot(meal) && meal !== "snack") {
    const adapted = adaptDishesToMeal(meal, dishes);
    const dishesOk = await replaceSlotDishes(supabase, slotId, meal, adapted);
    if (!dishesOk) return false;
  }
  return true;
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
