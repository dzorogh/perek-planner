"use server";

import { revalidatePath } from "next/cache";

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

  const result = await resuggestSnackForMenu(
    supabase,
    user.id,
    menuId,
    snackId,
  );
  if (!result.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
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

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
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

  const { data: disliked } = await supabase
    .from("snack_ratings")
    .select("label")
    .eq("user_id", user.id)
    .eq("rating", "dislike")
    .ilike("label", label)
    .maybeSingle();

  if (disliked) {
    return { ok: false, error: "Этот Snack отмечен как dislike." };
  }

  const { data, error: updateError } = await supabase
    .from("menu_snacks")
    .update({
      label,
      // Manual rename invalidates AI estimates for this snack.
      price_cents_per_serving: null,
      calories_kcal_per_serving: null,
      protein_g_per_serving: null,
      fat_g_per_serving: null,
      carbs_g_per_serving: null,
    })
    .eq("id", snackId)
    .eq("menu_id", menuId)
    .select("id");

  if (updateError) {
    if (updateError.code === "23505") {
      return { ok: false, error: "Этот Snack уже есть в меню." };
    }
    return { ok: false, error: "Не удалось сохранить Snack." };
  }
  if (!data?.length) {
    return { ok: false, error: "Snack не найден." };
  }

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
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

  // Keep the day slot: blank via placeholder is worse — delete and allow regenerating
  // via resuggest by recreating. Simpler: set a soft empty? Schema requires nonempty.
  // Clear = remove row; day will show empty with "Предложить" recreate.
  const { data, error: deleteError } = await supabase
    .from("menu_snacks")
    .delete()
    .eq("id", snackId)
    .eq("menu_id", menuId)
    .select("id, day_index");

  if (deleteError || !data?.length) {
    return { ok: false, error: "Не удалось очистить Snack." };
  }

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
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
    .select("day_count")
    .eq("id", menuId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (menuError || !menu) {
    return { ok: false, error: "Меню не найдено." };
  }
  if (dayIndex > menu.day_count) {
    return { ok: false, error: "Некорректный день." };
  }

  const { data: existing } = await supabase
    .from("menu_snacks")
    .select("id")
    .eq("menu_id", menuId)
    .eq("day_index", dayIndex)
    .maybeSingle();

  if (existing) {
    const result = await resuggestSnackForMenu(
      supabase,
      user.id,
      menuId,
      existing.id,
    );
    if (!result.ok) return result;
  } else {
    // Insert a temporary row then resuggest, or generate one label and insert
    const { data: inserted, error: insertError } = await supabase
      .from("menu_snacks")
      .insert({ menu_id: menuId, day_index: dayIndex, label: "перекус" })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { ok: false, error: "Не удалось предложить Snack." };
    }

    const result = await resuggestSnackForMenu(
      supabase,
      user.id,
      menuId,
      inserted.id,
    );
    if (!result.ok) {
      await supabase.from("menu_snacks").delete().eq("id", inserted.id);
      return result;
    }
  }

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}
