"use server";

import {
  clearAiDebugEntries,
  listAiDebugEntries,
} from "@/lib/openrouter/debug-log";
import type { AiDebugEntry } from "@/lib/openrouter/debug-types";
import { createClient } from "@/lib/supabase/server";

export type AiDebugLogState =
  | { ok: true; entries: AiDebugEntry[] }
  | { ok: false; error: string };

async function requireUser(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Нужна авторизация." };
  }
  return { ok: true };
}

/** Latest OpenRouter request/response pairs for the current user (DB). */
export async function loadAiDebugLogAction(): Promise<AiDebugLogState> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const listed = await listAiDebugEntries();
  if (!listed.ok) return listed;
  return { ok: true, entries: listed.entries };
}

export async function clearAiDebugLogAction(): Promise<AiDebugLogState> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const cleared = await clearAiDebugEntries();
  if (!cleared.ok) return cleared;
  return { ok: true, entries: [] };
}
