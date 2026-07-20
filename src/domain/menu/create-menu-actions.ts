"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isValidDayCount,
  isValidPeopleCount,
  parseSelectedMeals,
} from "@/domain/menu/constants";
import { generateBuyableMenuForUser } from "@/domain/suggestions/generate-menu";
import { createClient } from "@/lib/supabase/server";

export type CreateMenuSkeletonActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

/** In-process dedupe for double-submit (same form idempotency key). */
const recentCreates = new Map<string, { menuId: string; at: number }>();
const IDEMPOTENCY_TTL_MS = 120_000;

/**
 * Create Menu skeleton + AI-fill slots, then redirect to slot edit.
 * Day length is 2, 4, or 6 (hard cook pairs).
 */
export async function createMenuSkeletonAction(
  _prev: CreateMenuSkeletonActionState,
  formData: FormData,
): Promise<CreateMenuSkeletonActionState> {
  const rawDay = formData.get("dayCount");
  const dayCount = typeof rawDay === "string" ? Number(rawDay) : Number.NaN;
  const rawPeople = formData.get("peopleCount");
  const peopleCount =
    typeof rawPeople === "string" ? Number(rawPeople) : Number.NaN;
  const meals = parseSelectedMeals(formData.get("meals"));
  const includeSnacks = formData.get("includeSnacks") === "1";
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();

  if (!isValidDayCount(dayCount)) {
    return { ok: false, error: "Выберите длину меню: 2, 4 или 6 дней." };
  }
  if (!isValidPeopleCount(peopleCount)) {
    return { ok: false, error: "Укажите число человек от 1 до 8." };
  }
  if (meals.length === 0 && !includeSnacks) {
    return {
      ok: false,
      error: "Выберите хотя бы один приём пищи или снеки.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Сессия истекла. Войдите снова." };
  }

  if (idempotencyKey) {
    const cacheKey = `${user.id}:${idempotencyKey}`;
    const hit = recentCreates.get(cacheKey);
    if (hit && Date.now() - hit.at < IDEMPOTENCY_TTL_MS) {
      revalidatePath("/history");
      revalidatePath("/plan/menu");
      redirect(`/plan/menu?menuId=${hit.menuId}`);
    }
  }

  const result = await generateBuyableMenuForUser(
    supabase,
    user.id,
    dayCount,
    { peopleCount, meals, includeSnacks },
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (idempotencyKey) {
    recentCreates.set(`${user.id}:${idempotencyKey}`, {
      menuId: result.menuId,
      at: Date.now(),
    });
  }

  revalidatePath("/history");
  revalidatePath("/plan/menu");
  redirect(`/plan/menu?menuId=${result.menuId}`);
}
