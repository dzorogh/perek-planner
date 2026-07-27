"use server";

import { revalidatePlanForMenu } from "@/domain/menu/revalidate-plan";
import { createClient } from "@/lib/supabase/server";

export type CookFeedbackActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export type MenuDishRatingValue = "like" | "dislike";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      supabase,
      user: null as null,
      error: "Сессия истекла. Войдите снова." as const,
    };
  }
  return { supabase, user, error: null };
}

type OwnedFilledDish = {
  id: string;
  prepared: boolean;
  rating: string | null;
};

/** Filled Menu dish on this menu owned via RLS (recipe XOR snack_label). */
async function ownedFilledDish(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dishId: string,
  menuId: string,
): Promise<OwnedFilledDish | null> {
  const { data, error } = await supabase
    .from("menu_dishes")
    .select(
      `id, prepared, rating, recipe_id, snack_label,
       menu_slots!inner(id, menu_id)`,
    )
    .eq("id", dishId)
    .eq("menu_slots.menu_id", menuId)
    .maybeSingle();

  if (error || !data) return null;
  const filled =
    (typeof data.recipe_id === "string" && data.recipe_id.length > 0) ||
    (typeof data.snack_label === "string" && data.snack_label.trim().length > 0);
  if (!filled) return null;

  return {
    id: data.id,
    prepared: data.prepared === true,
    rating: typeof data.rating === "string" ? data.rating : null,
  };
}

/** Toggle prepared on a filled Menu dish. */
export async function togglePreparedAction(
  _prev: CookFeedbackActionState,
  formData: FormData,
): Promise<CookFeedbackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const dishId = String(formData.get("dishId") ?? "");
  if (!menuId || !dishId) {
    return { ok: false, error: "Некорректное блюдо." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const dish = await ownedFilledDish(supabase, dishId, menuId);
  if (!dish) {
    return { ok: false, error: "Блюдо не найдено." };
  }

  const { data, error: updateError } = await supabase
    .from("menu_dishes")
    .update({
      prepared: !dish.prepared,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dishId)
    .select("id");

  if (updateError) {
    return { ok: false, error: "Не удалось сохранить отметку." };
  }
  if (!data?.length) {
    return { ok: false, error: "Блюдо не найдено." };
  }

  revalidatePlanForMenu(menuId);
  return { ok: true };
}

/**
 * Set or clear like/dislike on a Menu dish.
 * Re-selecting the same rating clears it (null).
 */
export async function setDishRatingAction(
  _prev: CookFeedbackActionState,
  formData: FormData,
): Promise<CookFeedbackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const dishId = String(formData.get("dishId") ?? "");
  const raw = String(formData.get("rating") ?? "");
  if (!menuId || !dishId) {
    return { ok: false, error: "Некорректное блюдо." };
  }
  if (raw !== "like" && raw !== "dislike") {
    return { ok: false, error: "Некорректная оценка." };
  }
  const next: MenuDishRatingValue = raw;

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const dish = await ownedFilledDish(supabase, dishId, menuId);
  if (!dish) {
    return { ok: false, error: "Блюдо не найдено." };
  }

  const rating = dish.rating === next ? null : next;

  const { data, error: updateError } = await supabase
    .from("menu_dishes")
    .update({
      rating,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dishId)
    .select("id");

  if (updateError) {
    return { ok: false, error: "Не удалось сохранить оценку." };
  }
  if (!data?.length) {
    return { ok: false, error: "Блюдо не найдено." };
  }

  revalidatePlanForMenu(menuId);
  return { ok: true };
}
