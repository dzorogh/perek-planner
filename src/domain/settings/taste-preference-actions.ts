"use server";

import { revalidatePath } from "next/cache";

import {
  isTastePreferenceKind,
  isValidTastePreferenceBody,
  MAX_TASTE_PREFERENCES,
  normalizeTastePreferenceBody,
} from "@/domain/settings/taste-preferences";
import { createClient } from "@/lib/supabase/server";

export type TastePreferenceActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function addTastePreferenceAction(
  _prev: TastePreferenceActionState,
  formData: FormData,
): Promise<TastePreferenceActionState> {
  const kindRaw = String(formData.get("kind") ?? "");
  const bodyRaw = String(formData.get("body") ?? "");

  if (!isTastePreferenceKind(kindRaw)) {
    return { ok: false, error: "Укажите тип: запрет или пожелание." };
  }

  const body = normalizeTastePreferenceBody(bodyRaw);
  if (!isValidTastePreferenceBody(body)) {
    return {
      ok: false,
      error: "Напишите пожелание от 3 до 500 символов.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { count, error: countError } = await supabase
    .from("taste_preferences")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return { ok: false, error: "Не удалось сохранить." };
  }
  if ((count ?? 0) >= MAX_TASTE_PREFERENCES) {
    return {
      ok: false,
      error: `Достигнут лимит (${MAX_TASTE_PREFERENCES}). Удалите старые записи.`,
    };
  }

  const { error } = await supabase.from("taste_preferences").insert({
    user_id: user.id,
    kind: kindRaw,
    body,
  });

  if (error) {
    return { ok: false, error: "Не удалось сохранить." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteTastePreferenceAction(
  _prev: TastePreferenceActionState,
  formData: FormData,
): Promise<TastePreferenceActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { ok: false, error: "Не найдено." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { error } = await supabase
    .from("taste_preferences")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: "Не удалось удалить." };
  }

  revalidatePath("/settings");
  return { ok: true };
}
