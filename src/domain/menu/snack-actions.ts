"use server";

import { revalidatePath } from "next/cache";

import {
  ensureSnackSlots,
  upsertSnackDish,
} from "@/domain/menu/menu-dishes";
import { assertDishPlanningUnlockedById } from "@/domain/menu/planning-lock";
import { revalidatePlanForMenu } from "@/domain/menu/revalidate-plan";
import {
  refuseAndReplaceSnackAcrossMenu,
  resuggestSnackForMenu,
} from "@/domain/suggestions/generate-snacks";
import { formatSnackLabel } from "@/domain/suggestions/snack-pool";
import { createClient } from "@/lib/supabase/server";

export type SnackActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

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

async function snackDishOnMenu(
  supabase: Awaited<ReturnType<typeof createClient>>,
  menuId: string,
  dishId: string,
): Promise<{ id: string; dayIndex: number } | null> {
  const { data, error } = await supabase
    .from("menu_dishes")
    .select("id, menu_slots!inner(id, menu_id, day_index, meal)")
    .eq("id", dishId)
    .eq("plate_role", "snack")
    .eq("menu_slots.menu_id", menuId)
    .eq("menu_slots.meal", "snack")
    .maybeSingle();
  if (error || !data) return null;
  const slot = Array.isArray(data.menu_slots)
    ? data.menu_slots[0]
    : data.menu_slots;
  if (!slot || typeof slot.day_index !== "number") return null;
  return { id: data.id, dayIndex: slot.day_index };
}

/** Replace snack with another suggestion (primary edit path). */
export async function resuggestSnackAction(
  _prev: SnackActionState,
  formData: FormData,
): Promise<SnackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const snackId = String(formData.get("snackId") ?? "");
  if (!menuId || !snackId) {
    return { ok: false, error: "Некорректный Snack." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const unlocked = await assertDishPlanningUnlockedById(supabase, snackId);
  if (!unlocked.ok) return unlocked;

  const result = await resuggestSnackForMenu(
    supabase,
    user.id,
    menuId,
    snackId,
  );
  if (!result.ok) return result;

  revalidatePlanForMenu(menuId);
  return { ok: true };
}

/** Refuse forever + replace this snack everywhere on the menu. */
export async function refuseSnackAction(
  _prev: SnackActionState,
  formData: FormData,
): Promise<SnackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const snackId = String(formData.get("snackId") ?? "");
  const comment = String(formData.get("comment") ?? "");
  if (!menuId || !snackId) {
    return { ok: false, error: "Некорректный Snack." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const result = await refuseAndReplaceSnackAcrossMenu(
    supabase,
    user.id,
    menuId,
    snackId,
    { comment },
  );
  if (!result.ok) return result;

  revalidatePlanForMenu(menuId);
  revalidatePath("/settings");
  return { ok: true };
}

/** Manual override: set free-text label for an existing day snack. */
export async function updateSnackLabelAction(
  _prev: SnackActionState,
  formData: FormData,
): Promise<SnackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const snackId = String(formData.get("snackId") ?? "");
  const label = formatSnackLabel(String(formData.get("label") ?? ""));
  if (!menuId || !snackId) {
    return { ok: false, error: "Некорректный Snack." };
  }
  if (!label) {
    return { ok: false, error: "Введите название Snack." };
  }
  if (label.length > 80) {
    return { ok: false, error: "Название Snack слишком длинное." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const dish = await snackDishOnMenu(supabase, menuId, snackId);
  if (!dish) {
    return { ok: false, error: "Snack не найден." };
  }

  const unlocked = await assertDishPlanningUnlockedById(supabase, snackId);
  if (!unlocked.ok) return unlocked;

  const { data, error: updateError } = await supabase
    .from("menu_dishes")
    .update({
      snack_label: label,
      // Manual rename invalidates AI estimates for this snack.
      price_cents_per_serving: null,
      calories_kcal_per_serving: null,
      protein_g_per_serving: null,
      fat_g_per_serving: null,
      carbs_g_per_serving: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", snackId)
    .select("id");

  if (updateError) {
    return { ok: false, error: "Не удалось сохранить Snack." };
  }
  if (!data?.length) {
    return { ok: false, error: "Snack не найден." };
  }

  revalidatePlanForMenu(menuId);
  return { ok: true };
}

export async function clearSnackAction(
  _prev: SnackActionState,
  formData: FormData,
): Promise<SnackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const snackId = String(formData.get("snackId") ?? "");
  if (!menuId || !snackId) {
    return { ok: false, error: "Некорректный Snack." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const dish = await snackDishOnMenu(supabase, menuId, snackId);
  if (!dish) {
    return { ok: false, error: "Не удалось очистить Snack." };
  }

  const unlocked = await assertDishPlanningUnlockedById(supabase, snackId);
  if (!unlocked.ok) return unlocked;

  const { data, error: deleteError } = await supabase
    .from("menu_dishes")
    .delete()
    .eq("id", snackId)
    .select("id");

  if (deleteError || !data?.length) {
    return { ok: false, error: "Не удалось очистить Snack." };
  }

  revalidatePlanForMenu(menuId);
  return { ok: true };
}

/** Recreate a missing day snack after clear. */
export async function suggestSnackForDayAction(
  _prev: SnackActionState,
  formData: FormData,
): Promise<SnackActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const dayIndex = Number(formData.get("dayIndex"));
  if (!menuId || !Number.isInteger(dayIndex) || dayIndex < 1) {
    return { ok: false, error: "Некорректный день." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("day_count, default_servings_per_meal")
    .eq("id", menuId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (menuError || !menu) {
    return { ok: false, error: "Меню не найдено." };
  }
  if (dayIndex > menu.day_count) {
    return { ok: false, error: "Некорректный день." };
  }

  const servings =
    typeof menu.default_servings_per_meal === "number"
      ? menu.default_servings_per_meal
      : 2;
  const slots = await ensureSnackSlots(
    supabase,
    menuId,
    menu.day_count,
    servings,
  );
  const slotId = slots.get(dayIndex);
  if (!slotId) {
    return { ok: false, error: "Не удалось предложить Snack." };
  }

  const { data: existing } = await supabase
    .from("menu_dishes")
    .select("id")
    .eq("menu_slot_id", slotId)
    .eq("plate_role", "snack")
    .maybeSingle();

  let dishId = existing?.id ?? null;
  if (!dishId) {
    const inserted = await upsertSnackDish(supabase, slotId, "перекус");
    if (!inserted) {
      return { ok: false, error: "Не удалось предложить Snack." };
    }
    const { data: row } = await supabase
      .from("menu_dishes")
      .select("id")
      .eq("menu_slot_id", slotId)
      .eq("plate_role", "snack")
      .maybeSingle();
    dishId = row?.id ?? null;
    if (!dishId) {
      return { ok: false, error: "Не удалось предложить Snack." };
    }
  }

  const result = await resuggestSnackForMenu(
    supabase,
    user.id,
    menuId,
    dishId,
  );
  if (!result.ok) {
    if (!existing?.id) {
      await supabase.from("menu_dishes").delete().eq("id", dishId);
    }
    return result;
  }

  revalidatePlanForMenu(menuId);
  return { ok: true };
}
