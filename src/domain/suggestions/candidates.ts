import type { SupabaseClient } from "@supabase/supabase-js";

import { passesFridgeKeep } from "@/domain/matching/eligibility";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  recipeFitsAvailableEquipment,
} from "@/domain/menu/equipment";
import {
  isLongIdle,
  loadLastAssignedAt,
  loadRecentMenuRecipeIds,
} from "@/domain/suggestions/history";
import {
  rankCandidates,
  type RankableCandidate,
} from "@/domain/suggestions/rank";
import {
  isHardSuppressed,
  loadSuppressSets,
} from "@/domain/suggestions/suppress";

export type SuggestionCandidate = RankableCandidate;

/**
 * Build library candidates for a Menu: suppress → fridge-keep → rank.
 * No store/product buyability gate.
 * Marks recipes from recent menus as recentlyUsed for cross-menu variety.
 * Recipes are paged (PostgREST 1000-row cap).
 */
export async function buildCandidates(
  supabase: SupabaseClient,
  userId: string,
  menuId: string,
  now: Date = new Date(),
): Promise<
  | { ok: true; candidates: SuggestionCandidate[] }
  | { ok: false; reason: "query" }
> {
  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("day_count, available_equipment")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError || !menu) {
    return { ok: false, reason: "query" };
  }

  const available =
    normalizeEquipmentList(menu.available_equipment as string[]) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ];

  const recipes = await fetchAllRecipes(supabase);
  if (!recipes) {
    return { ok: false, reason: "query" };
  }

  const [suppress, lastAssigned, recentIds] = await Promise.all([
    loadSuppressSets(supabase, userId),
    loadLastAssignedAt(supabase, userId),
    loadRecentMenuRecipeIds(supabase, userId, { excludeMenuId: menuId }),
  ]);

  if (!suppress || !lastAssigned || !recentIds) {
    return { ok: false, reason: "query" };
  }

  const eligible: SuggestionCandidate[] = [];

  for (const recipe of recipes) {
    if (isHardSuppressed(recipe.id, suppress)) {
      continue;
    }
    if (!passesFridgeKeep(recipe.fridge_keep_days, menu.day_count)) {
      continue;
    }
    if (
      !recipeFitsAvailableEquipment(recipe.required_equipment, available)
    ) {
      continue;
    }

    const plateRole =
      typeof recipe.plate_role === "string" && recipe.plate_role.length > 0
        ? recipe.plate_role
        : null;
    eligible.push({
      recipeId: recipe.id,
      name: recipe.name,
      fridgeKeepDays: recipe.fridge_keep_days,
      longIdle: isLongIdle(lastAssigned.get(recipe.id), now),
      recentlyUsed: recentIds.has(recipe.id),
      plateRole,
    });
  }

  return { ok: true, candidates: rankCandidates(eligible) };
}

/** Page through recipes — PostgREST default max rows is 1000. */
async function fetchAllRecipes(
  supabase: SupabaseClient,
): Promise<
  | {
      id: string;
      name: string;
      fridge_keep_days: number;
      plate_role: string | null;
      required_equipment: string[] | null;
    }[]
  | null
> {
  const pageSize = 1000;
  const all: {
    id: string;
    name: string;
    fridge_keep_days: number;
    plate_role: string | null;
    required_equipment: string[] | null;
  }[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("recipes")
      .select("id, name, fridge_keep_days, plate_role, required_equipment")
      .order("name", { ascending: true })
      .range(from, to);
    if (error || !data) return null;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
