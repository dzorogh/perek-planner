"use server";

import { revalidatePath } from "next/cache";

import {
  isValidFeedbackComment,
  normalizeFeedbackComment,
  type HistoryRatingValue,
} from "@/domain/history/constants";
import { recordTasteBanFromFeedback } from "@/domain/settings/taste-preferences";
import { createClient } from "@/lib/supabase/server";

export type RatingActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

function parseHistoryRating(
  raw: FormDataEntryValue | null,
): HistoryRatingValue | null {
  const v = String(raw ?? "");
  if (v === "like" || v === "dislike") return v;
  return null;
}

export async function upsertRecipeRatingAction(
  _prev: RatingActionState,
  formData: FormData,
): Promise<RatingActionState> {
  const recipeId = String(formData.get("recipeId") ?? "");
  const rating = parseHistoryRating(formData.get("rating"));
  const commentRaw = String(formData.get("comment") ?? "");

  if (!recipeId || !rating) {
    return { ok: false, error: "Укажите оценку." };
  }

  let reason: string | null = null;
  if (rating === "dislike") {
    const comment = normalizeFeedbackComment(commentRaw);
    if (!isValidFeedbackComment(comment)) {
      return {
        ok: false,
        error: "Для «Не нравится» нужна причина — без неё оценку не сохраняем.",
      };
    }
    reason = comment;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { error } = await supabase.from("recipe_ratings").upsert(
    {
      user_id: user.id,
      recipe_id: recipeId,
      rating,
      reason,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,recipe_id" },
  );

  if (error) {
    return { ok: false, error: "Не удалось сохранить оценку." };
  }

  if (reason) {
    const { data: recipeRow } = await supabase
      .from("recipes")
      .select("name")
      .eq("id", recipeId)
      .maybeSingle();
    await recordTasteBanFromFeedback(supabase, user.id, {
      subject: recipeRow?.name ?? null,
      comment: reason,
    });
  }

  revalidatePath("/history");
  revalidatePath("/settings");
  return { ok: true };
}

export async function upsertSnackRatingAction(
  _prev: RatingActionState,
  formData: FormData,
): Promise<RatingActionState> {
  const label = String(formData.get("label") ?? "").trim();
  const rating = parseHistoryRating(formData.get("rating"));
  const commentRaw = String(formData.get("comment") ?? "");

  if (!label || !rating) {
    return { ok: false, error: "Укажите оценку." };
  }

  let reason: string | null = null;
  if (rating === "dislike") {
    const comment = normalizeFeedbackComment(commentRaw);
    if (!isValidFeedbackComment(comment)) {
      return {
        ok: false,
        error: "Для «Не нравится» нужна причина — без неё оценку не сохраняем.",
      };
    }
    reason = comment;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { error } = await supabase.from("snack_ratings").upsert(
    {
      user_id: user.id,
      label,
      rating,
      reason,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,label" },
  );

  if (error) {
    return { ok: false, error: "Не удалось сохранить оценку." };
  }

  if (reason) {
    await recordTasteBanFromFeedback(supabase, user.id, {
      subject: label,
      comment: reason,
    });
  }

  revalidatePath("/history");
  revalidatePath("/settings");
  return { ok: true };
}
