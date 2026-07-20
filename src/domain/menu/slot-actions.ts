"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { markSlotEditPassed } from "@/domain/menu/uj1-gate";
import {
  clearCompanionForSlot,
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
  return raw === "companion" ? "companion" : "main";
}

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

  const result = await resuggestSlotForUser(
    supabase,
    user.id,
    menuId,
    slotId,
    { target },
  );
  if (!result.ok) return result;

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}

/** Soft-replace this dish in every slot of the menu (shared replacement). */
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

  const result = await resuggestRecipeAcrossMenu(
    supabase,
    user.id,
    menuId,
    slotId,
    { target },
  );
  if (!result.ok) return result;

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

  const result = await refuseAndReplaceRecipeAcrossMenu(
    supabase,
    user.id,
    menuId,
    slotId,
    { comment, target },
  );
  if (!result.ok) return result;

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

export async function continueToPortionsAction(
  formData: FormData,
): Promise<void> {
  const menuId = String(formData.get("menuId") ?? "");
  if (!menuId) {
    redirect("/plan/menu");
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError || !menu) {
    redirect("/plan/menu");
  }

  const marked = await markSlotEditPassed(supabase, menuId);
  if (!marked.ok) {
    redirect(
      `/plan/menu?menuId=${encodeURIComponent(menuId)}&error=continue`,
    );
  }

  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  redirect(`/plan/shopping-list?menuId=${encodeURIComponent(menuId)}`);
}
