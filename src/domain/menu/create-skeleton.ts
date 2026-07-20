import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_SERVINGS_PER_MEAL,
  isValidDayCount,
  isValidPeopleCount,
  type MealSlot,
} from "@/domain/menu/constants";

export type CreateSkeletonOk = { ok: true; menuId: string };
export type CreateSkeletonErr = { ok: false; error: string };
export type CreateSkeletonResult = CreateSkeletonOk | CreateSkeletonErr;

export type CreateSkeletonOptions = {
  peopleCount?: number;
  /** Selected cookable meal slots; empty allowed for snacks-only menus. */
  meals?: readonly MealSlot[];
};

/**
 * Persist Menu + empty slots for the authenticated user.
 * `userId` is unused: RPC `create_menu_skeleton` uses `auth.uid()` for ownership.
 * Callers must pass the same session user that owns the Supabase client.
 */
export async function createMenuSkeletonForUser(
  supabase: SupabaseClient,
  userId: string,
  dayCount: number,
  options: CreateSkeletonOptions = {},
): Promise<CreateSkeletonResult> {
  if (!userId) {
    return { ok: false, error: "Сессия истекла. Войдите снова." };
  }
  const peopleCount = options.peopleCount ?? DEFAULT_SERVINGS_PER_MEAL;
  const meals = options.meals ?? (["breakfast", "lunch", "dinner"] as const);

  if (!isValidDayCount(dayCount)) {
    return { ok: false, error: "Выберите длину меню: 2, 4 или 6 дней." };
  }
  if (!isValidPeopleCount(peopleCount)) {
    return { ok: false, error: "Укажите число человек от 1 до 8." };
  }

  const { data: menuId, error } = await supabase.rpc("create_menu_skeleton", {
    p_day_count: dayCount,
    p_servings: peopleCount,
    p_meals: [...meals],
  });

  if (error || !menuId || typeof menuId !== "string") {
    return {
      ok: false,
      error: "Не удалось создать меню. Попробуйте снова.",
    };
  }

  return { ok: true, menuId };
}
