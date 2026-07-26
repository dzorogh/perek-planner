"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ShoppingActionResult =
  | { ok: true; productKeys: string[] }
  | { ok: false; error: string };

function normalizeKeys(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

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

async function assertMenuOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  menuId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("menus")
    .select("id")
    .eq("id", menuId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function ensureShoppingListRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  menuId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: existing, error: selectError } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("menu_id", menuId)
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: "Не удалось сохранить список покупок." };
  }
  if (existing?.id) {
    return { ok: true, id: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("shopping_lists")
    .insert({
      menu_id: menuId,
      curated_product_keys: [],
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    // Race: another tab may have inserted first.
    const { data: raced } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("menu_id", menuId)
      .maybeSingle();
    if (raced?.id) return { ok: true, id: raced.id };
    return { ok: false, error: "Не удалось сохранить список покупок." };
  }

  return { ok: true, id: inserted.id };
}

/** Replace curated selection keys for a menu (pruned list from the client). */
export async function setShoppingSelectionAction(
  menuId: string,
  productKeys: readonly string[],
): Promise<ShoppingActionResult> {
  const id = menuId.trim();
  if (!id) return { ok: false, error: "Не указано меню." };

  const keys = normalizeKeys(productKeys);
  const { supabase, user, error } = await requireUser();
  if (!user) return { ok: false, error: error! };

  const owned = await assertMenuOwned(supabase, user.id, id);
  if (!owned) return { ok: false, error: "Меню не найдено." };

  const ensured = await ensureShoppingListRow(supabase, id);
  if (!ensured.ok) return ensured;

  const { data: updated, error: updateError } = await supabase
    .from("shopping_lists")
    .update({
      curated_product_keys: keys,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ensured.id)
    .eq("menu_id", id)
    .select("id")
    .maybeSingle();

  if (updateError || !updated?.id) {
    return { ok: false, error: "Не удалось сохранить список покупок." };
  }

  revalidatePath("/plan/shopping-list");
  return { ok: true, productKeys: keys };
}
