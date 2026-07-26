"use server";

import { revalidatePath } from "next/cache";

import { withMenuMutationLock } from "@/domain/menu/menu-mutation-lock";
import { isPlateRole } from "@/domain/menu/meal-templates";
import {
  clearCompanionForSlot,
  modifyRecipeAcrossMenu,
  refuseAndReplaceRecipeAcrossMenu,
  resuggestRecipeAcrossMenu,
  resuggestSlotForUser,
  type SlotDishTarget,
} from "@/domain/suggestions/resuggest-slot";
import { createClient } from "@/lib/supabase/server";

export type SlotActionState =
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

function parseTarget(raw: FormDataEntryValue | null): SlotDishTarget {
  if (typeof raw === "string" && isPlateRole(raw)) return raw;
  if (raw === "companion") return "carb";
  if (raw === "main") return "main";
  return "main";
}

/**
 * Fill an empty cookable slot (day-pair invent). Not used when a dish already
 * exists — use {@link resuggestRecipeAcrossMenuAction} instead.
 */
export async function resuggestSlotAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const target = parseTarget(formData.get("target"));
  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  let result: SlotActionState;
  try {
    result = await withMenuMutationLock(supabase, menuId, () =>
      resuggestSlotForUser(supabase, user.id, menuId, slotId, { target }),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось обновить слот.",
    };
  }
  if (!result?.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}

/** @deprecated Prefer empty-role «Предложить» with target=carb. Kept for legacy forms. */
export async function suggestCompanionAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  let result: SlotActionState;
  try {
    result = await withMenuMutationLock(supabase, menuId, () =>
      resuggestSlotForUser(supabase, user.id, menuId, slotId, {
        target: "carb",
      }),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось обновить слот.",
    };
  }
  if (!result?.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}

/** Soft-replace this dish in every slot of the menu where it appears. */
export async function resuggestRecipeAcrossMenuAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const target = parseTarget(formData.get("target"));
  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  let result: SlotActionState;
  try {
    result = await withMenuMutationLock(supabase, menuId, () =>
      resuggestRecipeAcrossMenu(supabase, user.id, menuId, slotId, { target }),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось обновить слот.",
    };
  }
  if (!result?.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}

/** Variant of this dish from a user wish; applied to every matching slot. */
export async function modifyRecipeAcrossMenuAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const target = parseTarget(formData.get("target"));
  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  let result: SlotActionState;
  try {
    result = await withMenuMutationLock(supabase, menuId, () =>
      modifyRecipeAcrossMenu(supabase, user.id, menuId, slotId, {
        comment,
        target,
      }),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось обновить слот.",
    };
  }
  if (!result?.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}

/** Refuse forever + replace this dish in every slot of the menu. */
export async function refuseSlotAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const target = parseTarget(formData.get("target"));
  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  let result: SlotActionState;
  try {
    result = await withMenuMutationLock(supabase, menuId, () =>
      refuseAndReplaceRecipeAcrossMenu(supabase, user.id, menuId, slotId, {
        comment,
        target,
      }),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось обновить слот.",
    };
  }
  if (!result?.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  revalidatePath("/settings");
  return { ok: true };
}

/** Remove companion dish from a slot (main stays). */
export async function clearCompanionAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }

  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const result = await clearCompanionForSlot(supabase, menuId, slotId);
  if (!result.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}
