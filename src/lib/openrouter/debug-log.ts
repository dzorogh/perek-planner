import "server-only";

import type { AiDebugEntry, AiDebugMessage } from "@/lib/openrouter/debug-types";
import { createClient } from "@/lib/supabase/server";

export type { AiDebugEntry, AiDebugMessage };

export const AI_DEBUG_MAX_ENTRIES = 24;
const MAX_CONTENT_CHARS = 80_000;
/** Page size when deleting overflow rows (PostgREST default max is often 1000). */
const PRUNE_PAGE = 200;

type AiDebugLogRow = {
  id: string;
  created_at: string;
  model: string;
  duration_ms: number;
  ok: boolean;
  error: string | null;
  request_messages: unknown;
  response: string | null;
};

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return `${text.slice(0, MAX_CONTENT_CHARS)}\n…[truncated ${text.length - MAX_CONTENT_CHARS} chars]`;
}

function parseRequestMessages(raw: unknown): AiDebugMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: AiDebugMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const role = row.role;
    const content = row.content;
    if (
      (role === "system" || role === "user" || role === "assistant") &&
      typeof content === "string"
    ) {
      out.push({ role, content });
    }
  }
  return out;
}

function rowToEntry(row: AiDebugLogRow): AiDebugEntry {
  return {
    id: row.id,
    at: row.created_at,
    model: row.model,
    durationMs: row.duration_ms,
    ok: row.ok,
    error: row.error ?? undefined,
    requestMessages: parseRequestMessages(row.request_messages),
    response: row.response,
  };
}

/**
 * Persist one OpenRouter call (best-effort). Never throws.
 * Callers should not await this on the AI hot path — use void fire-and-forget.
 */
export async function recordAiDebugEntry(input: {
  model: string;
  durationMs: number;
  ok: boolean;
  error?: string;
  requestMessages: AiDebugMessage[];
  response: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const requestMessages = input.requestMessages.map((m) => ({
      role: m.role,
      content: truncate(m.content),
    }));
    const response =
      input.response != null ? truncate(input.response) : null;

    const { error: insertError } = await supabase.from("ai_debug_logs").insert({
      user_id: user.id,
      model: input.model.slice(0, 200),
      duration_ms: Math.max(0, Math.trunc(input.durationMs)),
      ok: input.ok,
      error: input.error?.slice(0, 2000) ?? null,
      request_messages: requestMessages,
      response,
    });
    if (insertError) {
      console.error("[ai-debug-log] insert failed:", insertError.message);
      return;
    }

    await pruneAiDebugLogs(supabase, user.id);
  } catch (err) {
    console.error(
      "[ai-debug-log] persist skipped:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Delete rows beyond the newest AI_DEBUG_MAX_ENTRIES (paged, not full-table read). */
async function pruneAiDebugLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  // Newest keep-window ends at index MAX-1; overflow starts at MAX.
  for (let page = 0; page < 20; page++) {
    const from = AI_DEBUG_MAX_ENTRIES + page * PRUNE_PAGE;
    const to = from + PRUNE_PAGE - 1;
    const { data, error } = await supabase
      .from("ai_debug_logs")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[ai-debug-log] prune list failed:", error.message);
      return;
    }
    if (!data || data.length === 0) return;

    const dropIds = data.map((r) => r.id as string);
    const { error: dropError } = await supabase
      .from("ai_debug_logs")
      .delete()
      .in("id", dropIds);
    if (dropError) {
      console.error("[ai-debug-log] prune delete failed:", dropError.message);
      return;
    }
    if (data.length < PRUNE_PAGE) return;
  }
}

export type ListAiDebugResult =
  | { ok: true; entries: AiDebugEntry[] }
  | { ok: false; error: string };

export async function listAiDebugEntries(): Promise<ListAiDebugResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Нужна авторизация." };

    const { data, error } = await supabase
      .from("ai_debug_logs")
      .select(
        "id, created_at, model, duration_ms, ok, error, request_messages, response",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(AI_DEBUG_MAX_ENTRIES);

    if (error) {
      console.error("[ai-debug-log] list failed:", error.message);
      return { ok: false, error: "Не удалось загрузить лог нейросети." };
    }

    return {
      ok: true,
      entries: (data as AiDebugLogRow[] | null)?.map(rowToEntry) ?? [],
    };
  } catch (err) {
    console.error(
      "[ai-debug-log] list skipped:",
      err instanceof Error ? err.message : err,
    );
    return { ok: false, error: "Не удалось загрузить лог нейросети." };
  }
}

export type ClearAiDebugResult = { ok: true } | { ok: false; error: string };

export async function clearAiDebugEntries(): Promise<ClearAiDebugResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Нужна авторизация." };

    const { error } = await supabase
      .from("ai_debug_logs")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("[ai-debug-log] clear failed:", error.message);
      return { ok: false, error: "Не удалось очистить лог нейросети." };
    }
    return { ok: true };
  } catch (err) {
    console.error(
      "[ai-debug-log] clear skipped:",
      err instanceof Error ? err.message : err,
    );
    return { ok: false, error: "Не удалось очистить лог нейросети." };
  }
}
