import type { SupabaseClient } from "@supabase/supabase-js";

export type LoadShoppingSelectionResult =
  | { ok: true; productKeys: string[] }
  | { ok: false; error: string };

function normalizeProductKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
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

/** Load curated product keys for a menu (empty if no shopping_lists row). */
export async function loadShoppingSelection(
  supabase: SupabaseClient,
  menuId: string,
): Promise<LoadShoppingSelectionResult> {
  const id = menuId.trim();
  if (!id) {
    return { ok: false, error: "Не указано меню." };
  }

  const { data, error } = await supabase
    .from("shopping_lists")
    .select("curated_product_keys")
    .eq("menu_id", id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: "Не удалось загрузить список покупок.",
    };
  }

  if (!data) {
    return { ok: true, productKeys: [] };
  }

  return {
    ok: true,
    productKeys: normalizeProductKeys(data.curated_product_keys),
  };
}
