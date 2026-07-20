import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadTastePreferences,
  parseTastePreferenceBody,
} from "@/domain/settings/taste-preferences";

export type TasteNote = {
  /** Optional dish/snack that triggered the note — secondary context only. */
  subject: string | null;
  /** Operator rule — primary constraint for AI. */
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

  return prefs.slice(0, MAX_NOTES).map((pref) => {
    const parsed = parseTastePreferenceBody(pref.body);
    return {
      subject: parsed.subject,
      comment: parsed.comment,
      source: pref.kind,
    };
  });
}

/**
 * Compact payload for OpenRouter user messages.
 * `constraint` is the operator's rule (PRIMARY); `exampleDish` is optional context.
 */
export function tasteNotesForPrompt(notes: TasteNote[]): {
  constraint: string;
  exampleDish: string | null;
  kind: TasteNote["source"];
}[] {
  return notes.map((n) => ({
    constraint: n.comment,
    exampleDish: n.subject,
    kind: n.source,
  }));
}
