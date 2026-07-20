import type { SupabaseClient } from "@supabase/supabase-js";

export const UJ1_GATE_RU =
  "Сначала проверьте меню и перейдите к списку покупок.";

/** Pure predicate shared with verify-uj1-gate-logic.mjs. */
export function shoppingListAllowed(
  slotEditPassedAt: string | null | undefined,
): boolean {
  return slotEditPassedAt != null;
}

export async function hasSlotEditPassed(
  supabase: SupabaseClient,
  menuId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("menus")
    .select("slot_edit_passed_at")
    .eq("id", menuId)
    .maybeSingle();

  if (error || !data) return false;
  return shoppingListAllowed(data.slot_edit_passed_at);
}

export async function markSlotEditPassed(
  supabase: SupabaseClient,
  menuId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("menus")
    .update({ slot_edit_passed_at: new Date().toISOString() })
    .eq("id", menuId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Не удалось продолжить. Попробуйте снова." };
  }
  return { ok: true };
}
