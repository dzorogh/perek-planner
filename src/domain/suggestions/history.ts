import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LONG_IDLE_DAYS,
  RECENT_MENUS_COOLDOWN,
} from "@/domain/suggestions/constants";

/**
 * Last Menu assignment date per recipe for this user (cook-recency proxy).
 * Uses menus.created_at when the recipe appeared on a slot.
 * Prefer menu_dishes; fall back to menu_slots.recipe_id.
 * Fail-closed: null on query error (caller must not treat as “all long-idle”).
 */
export async function loadLastAssignedAt(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, Date> | null> {
  const last = new Map<string, Date>();

  const { data, error } = await supabase
    .from("menu_slots")
    .select(
      `recipe_id, menus!inner(user_id, created_at),
       menu_dishes(recipe_id)`,
    )
    .eq("menus.user_id", userId);

  if (error || !data) {
    return null;
  }

  for (const row of data) updateLastAssignedAt(last, row);

  return last;
}

function updateLastAssignedAt(
  last: Map<string, Date>,
  row: {
    recipe_id: unknown;
    menus: unknown;
    menu_dishes?: Array<{ recipe_id?: unknown }> | null;
  },
): void {
  const menu = unwrapMenu(row.menus);
  const at = menu?.created_at ? new Date(menu.created_at) : null;
  if (!at || Number.isNaN(at.getTime())) return;

  const ids = new Set<string>();
  for (const d of row.menu_dishes ?? []) {
    if (typeof d.recipe_id === "string" && d.recipe_id) ids.add(d.recipe_id);
  }
  if (ids.size === 0 && typeof row.recipe_id === "string" && row.recipe_id) {
    ids.add(row.recipe_id);
  }
  for (const recipeId of ids) {
    const previous = last.get(recipeId);
    if (!previous || at > previous) last.set(recipeId, at);
  }
}

function unwrapMenu(
  value: unknown,
): { user_id: string; created_at: string } | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (value && typeof value === "object") {
    return value as { user_id: string; created_at: string };
  }
  return null;
}

/**
 * Recipe ids that appeared on the user's most recent menus (cross-menu cooldown).
 * Prefer menu_dishes; fall back to menu_slots.recipe_id.
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
    .select("id, recipe_id, menu_dishes(recipe_id)")
    .in("menu_id", recentMenuIds);

  if (slotsError || !slots) {
    return null;
  }

  const ids = new Set<string>();
  for (const row of slots) {
    const dishIds = (row.menu_dishes ?? [])
      .map((d: { recipe_id?: unknown }) => d.recipe_id)
      .filter((id: unknown): id is string => typeof id === "string" && !!id);
    if (dishIds.length > 0) {
      for (const id of dishIds) ids.add(id);
      continue;
    }
    if (typeof row.recipe_id === "string" && row.recipe_id) {
      ids.add(row.recipe_id);
    }
  }
  return ids;
}

/**
 * Dish names from the user's most recent menus (for AI invent/assign context).
 * Prefer menu_dishes; fall back to primary recipe join.
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
      `recipe_id,
       recipes!menu_slots_recipe_id_fkey(name),
       menu_dishes(recipe_id, recipes(name))`,
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
    const dishes = (
      row as {
        menu_dishes?: Array<{
          recipes?: { name: string } | { name: string }[] | null;
        }> | null;
      }
    ).menu_dishes;
    if (dishes && dishes.length > 0) {
      for (const d of dishes) push(d.recipes);
      continue;
    }
    push(row.recipes as { name: string } | { name: string }[] | null);
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

  const { data: slots, error: slotsError } = await supabase
    .from("menu_slots")
    .select("menu_dishes(snack_label)")
    .in("menu_id", recentMenuIds)
    .eq("meal", "snack");

  if (slotsError || !slots) {
    return null;
  }

  const labels = new Set<string>();
  for (const row of slots) {
    const dishes = (
      row as { menu_dishes?: Array<{ snack_label?: unknown }> | null }
    ).menu_dishes;
    for (const d of dishes ?? []) {
      if (typeof d.snack_label === "string" && d.snack_label.trim()) {
        labels.add(d.snack_label.trim().toLocaleLowerCase("ru"));
      }
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
