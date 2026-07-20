import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LONG_IDLE_DAYS,
  RECENT_MENUS_COOLDOWN,
} from "@/domain/suggestions/constants";

/**
 * Last Menu assignment date per recipe for this user (cook-recency proxy).
 * Uses menus.created_at when the recipe appeared on a slot.
 * Fail-closed: null on query error (caller must not treat as “all long-idle”).
 */
export async function loadLastAssignedAt(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, Date> | null> {
  const last = new Map<string, Date>();

  const { data, error } = await supabase
    .from("menu_slots")
    .select("recipe_id, companion_recipe_id, menus!inner(user_id, created_at)")
    .eq("menus.user_id", userId);

  if (error || !data) {
    return null;
  }

  for (const row of data) {
    const menus = row.menus as
      | { user_id: string; created_at: string }
      | { user_id: string; created_at: string }[]
      | null;
    const menu = Array.isArray(menus) ? menus[0] : menus;
    if (!menu?.created_at) continue;
    const at = new Date(menu.created_at);
    if (Number.isNaN(at.getTime())) continue;
    for (const recipeId of [row.recipe_id, row.companion_recipe_id]) {
      if (typeof recipeId !== "string" || !recipeId) continue;
      const prev = last.get(recipeId);
      if (!prev || at > prev) {
        last.set(recipeId, at);
      }
    }
  }

  return last;
}

/**
 * Recipe ids that appeared on the user's most recent menus (cross-menu cooldown).
 * `excludeMenuId` skips the menu currently being filled (usually empty slots).
 * Fail-closed: null on query error.
 */
export async function loadRecentMenuRecipeIds(
  supabase: SupabaseClient,
  userId: string,
  options: {
    menuLimit?: number;
    excludeMenuId?: string;
  } = {},
): Promise<Set<string> | null> {
  const menuLimit = options.menuLimit ?? RECENT_MENUS_COOLDOWN;

  const { data: menus, error: menusError } = await supabase
    .from("menus")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(menuLimit + (options.excludeMenuId ? 1 : 0));
  if (menusError || !menus) {
    return null;
  }

  const recentMenuIds = menus
    .map((m) => m.id as string)
    .filter((id) => id !== options.excludeMenuId)
    .slice(0, menuLimit);

  if (recentMenuIds.length === 0) {
    return new Set();
  }

  const { data: slots, error: slotsError } = await supabase
    .from("menu_slots")
    .select("recipe_id, companion_recipe_id")
    .in("menu_id", recentMenuIds);

  if (slotsError || !slots) {
    return null;
  }

  const ids = new Set<string>();
  for (const row of slots) {
    for (const recipeId of [row.recipe_id, row.companion_recipe_id]) {
      if (typeof recipeId === "string" && recipeId) {
        ids.add(recipeId);
      }
    }
  }
  return ids;
}

/**
 * Dish names from the user's most recent menus (for AI invent/assign context).
 * Fail-closed: null on query error.
 */
export async function loadRecentMenuDishNames(
  supabase: SupabaseClient,
  userId: string,
  options: {
    menuLimit?: number;
    excludeMenuId?: string;
  } = {},
): Promise<string[] | null> {
  const menuLimit = options.menuLimit ?? RECENT_MENUS_COOLDOWN;

  const { data: menus, error: menusError } = await supabase
    .from("menus")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(menuLimit + (options.excludeMenuId ? 1 : 0));

  if (menusError || !menus) {
    return null;
  }

  const recentMenuIds = menus
    .map((m) => m.id as string)
    .filter((id) => id !== options.excludeMenuId)
    .slice(0, menuLimit);

  if (recentMenuIds.length === 0) {
    return [];
  }

  const { data: slots, error: slotsError } = await supabase
    .from("menu_slots")
    .select(
      `recipe_id, companion_recipe_id,
       recipes!menu_slots_recipe_id_fkey(name),
       companion:recipes!menu_slots_companion_recipe_id_fkey(name)`,
    )
    .in("menu_id", recentMenuIds);

  if (slotsError || !slots) {
    return null;
  }

  const names: string[] = [];
  const seen = new Set<string>();
  const push = (
    recipes: { name: string } | { name: string }[] | null | undefined,
  ) => {
    const recipe = Array.isArray(recipes) ? recipes[0] : recipes;
    const name = recipe?.name?.trim();
    if (!name) return;
    const key = name.toLocaleLowerCase("ru");
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  };
  for (const row of slots) {
    push(row.recipes as { name: string } | { name: string }[] | null);
    push(
      (row as { companion?: { name: string } | { name: string }[] | null })
        .companion,
    );
  }
  return names;
}

/**
 * Snack labels from the user's most recent menus (cross-menu cooldown).
 * Fail-closed: null on query error.
 */
export async function loadRecentSnackLabels(
  supabase: SupabaseClient,
  userId: string,
  options: {
    menuLimit?: number;
    excludeMenuId?: string;
  } = {},
): Promise<Set<string> | null> {
  const menuLimit = options.menuLimit ?? RECENT_MENUS_COOLDOWN;

  const { data: menus, error: menusError } = await supabase
    .from("menus")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(menuLimit + (options.excludeMenuId ? 1 : 0));

  if (menusError || !menus) {
    return null;
  }

  const recentMenuIds = menus
    .map((m) => m.id as string)
    .filter((id) => id !== options.excludeMenuId)
    .slice(0, menuLimit);

  if (recentMenuIds.length === 0) {
    return new Set();
  }

  const { data: snacks, error: snacksError } = await supabase
    .from("menu_snacks")
    .select("label")
    .in("menu_id", recentMenuIds);

  if (snacksError || !snacks) {
    return null;
  }

  const labels = new Set<string>();
  for (const row of snacks) {
    if (typeof row.label === "string" && row.label.trim()) {
      labels.add(row.label.trim().toLocaleLowerCase("ru"));
    }
  }
  return labels;
}

/** Pure: never cooked OR last assignment ≥ LONG_IDLE_DAYS ago. */
export function isLongIdle(
  lastAssignedAt: Date | undefined,
  now: Date,
  idleDays: number = LONG_IDLE_DAYS,
): boolean {
  if (!lastAssignedAt) return true;
  const ms = idleDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastAssignedAt.getTime() >= ms;
}
