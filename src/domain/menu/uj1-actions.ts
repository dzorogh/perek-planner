"use server";

import { hasSlotEditPassed } from "@/domain/menu/uj1-gate";
import { createClient } from "@/lib/supabase/server";

/** Client PillNav: whether UJ-1 continue has been marked for this menu. */
export async function getSlotEditPassedAction(
  menuId: string,
): Promise<boolean> {
  if (!menuId) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return hasSlotEditPassed(supabase, menuId);
}
