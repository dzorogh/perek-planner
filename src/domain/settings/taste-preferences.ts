import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isValidFeedbackComment,
  normalizeFeedbackComment,
} from "@/domain/history/constants";

export type TastePreferenceKind = "ban" | "wish";

export type TastePreference = {
  id: string;
  kind: TastePreferenceKind;
  body: string;
  createdAt: string;
};

export const TASTE_PREFERENCE_KIND_LABELS_RU: Record<
  TastePreferenceKind,
  string
> = {
  ban: "Запрет",
  wish: "Пожелание",
};

export const MAX_TASTE_PREFERENCES = 60;

export function isTastePreferenceKind(
  value: string,
): value is TastePreferenceKind {
  return value === "ban" || value === "wish";
}

export function normalizeTastePreferenceBody(raw: string): string {
  return normalizeFeedbackComment(raw);
}

export function isValidTastePreferenceBody(raw: string): boolean {
  return isValidFeedbackComment(raw);
}

/** Build Settings/AI body from feedback comment, optionally with dish/snack name. */
export function formatTasteBanBody(
  subject: string | null | undefined,
  comment: string,
): string {
  const body = normalizeTastePreferenceBody(comment);
  const name = subject?.trim();
  if (!name) return body.slice(0, 500);
  const combined = `${name}: ${body}`;
  return combined.slice(0, 500);
}

/**
 * Persist a refusal/dislike comment into Settings bans (idempotent by body).
 * Best-effort: returns false on failure; caller should not fail the primary action.
 */
export async function recordTasteBanFromFeedback(
  supabase: SupabaseClient,
  userId: string,
  options: { subject?: string | null; comment: string },
): Promise<boolean> {
  const body = formatTasteBanBody(options.subject, options.comment);
  if (!isValidTastePreferenceBody(body)) {
    return false;
  }

  const { data: existing, error: existingError } = await supabase
    .from("taste_preferences")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "ban")
    .eq("body", body)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return false;
  }
  if (existing) {
    return true;
  }

  const { error } = await supabase.from("taste_preferences").insert({
    user_id: userId,
    kind: "ban",
    body,
  });

  return !error;
}

/**
 * Load operator taste preferences (Settings list + AI context).
 * Fail-closed: null on query error.
 */
export async function loadTastePreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<TastePreference[] | null> {
  const { data, error } = await supabase
    .from("taste_preferences")
    .select("id, kind, body, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_TASTE_PREFERENCES);

  if (error || !data) {
    return null;
  }

  const out: TastePreference[] = [];
  for (const row of data) {
    if (!isTastePreferenceKind(row.kind)) continue;
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!body) continue;
    out.push({
      id: row.id,
      kind: row.kind,
      body,
      createdAt: row.created_at,
    });
  }
  return out;
}
