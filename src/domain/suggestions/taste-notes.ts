import type { SupabaseClient } from "@supabase/supabase-js";

import { loadTastePreferences } from "@/domain/settings/taste-preferences";

export type TasteNote = {
  /** Recipe or snack display name when known. */
  subject: string | null;
  comment: string;
  source: "ban" | "wish";
};

const MAX_NOTES = 40;

/**
 * Load operator constraints for AI prompts from Settings taste_preferences.
 * Fail-closed: null on query error (callers must abort invent/assign/snacks).
 */
export async function loadTasteNotes(
  supabase: SupabaseClient,
  userId: string,
): Promise<TasteNote[] | null> {
  const prefs = await loadTastePreferences(supabase, userId);
  if (!prefs) {
    return null;
  }

  return prefs.slice(0, MAX_NOTES).map((pref) => ({
    subject: null,
    comment: pref.body,
    source: pref.kind,
  }));
}

/** Compact payload for OpenRouter user messages. */
export function tasteNotesForPrompt(notes: TasteNote[]): {
  subject: string | null;
  comment: string;
  kind: TasteNote["source"];
}[] {
  return notes.map((n) => ({
    subject: n.subject,
    comment: n.comment,
    kind: n.source,
  }));
}
