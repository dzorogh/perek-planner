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

/**
 * Create Menu skeleton + AI-fill slots, then redirect to slot edit.
 * (Story 2.3 — same CTA «Сгенерировать» as 2.1.)
 */
export async function createMenuSkeletonAction(
  _prev: CreateMenuSkeletonActionState,
  formData: FormData,
): Promise<CreateMenuSkeletonActionState> {
  const rawDays = formData.get("dayCount");
  const dayCount = typeof rawDays === "string" ? Number(rawDays) : Number.NaN;
  const rawPeople = formData.get("peopleCount");
  const peopleCount =
    typeof rawPeople === "string" ? Number(rawPeople) : Number.NaN;
  const meals = parseSelectedMeals(formData.get("meals"));
  const includeSnacks = formData.get("includeSnacks") === "1";

  if (!isValidDayCount(dayCount)) {
    return { ok: false, error: "Выберите длину меню от 1 до 4 дней." };
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

  const result = await generateBuyableMenuForUser(
    supabase,
    user.id,
    dayCount,
    { peopleCount, meals, includeSnacks },
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/history");
  revalidatePath("/plan/menu");
  redirect(`/plan/menu?menuId=${result.menuId}`);
}
