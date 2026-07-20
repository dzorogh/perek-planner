import "server-only";

import type { AiDebugEntry, AiDebugMessage } from "@/lib/openrouter/debug-types";

export type { AiDebugEntry, AiDebugMessage };

const MAX_ENTRIES = 24;
const MAX_CONTENT_CHARS = 80_000;

const entries: AiDebugEntry[] = [];
let seq = 0;

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return `${text.slice(0, MAX_CONTENT_CHARS)}\n…[truncated ${text.length - MAX_CONTENT_CHARS} chars]`;
}

/** Record one OpenRouter call for the Settings debug panel (process memory). */
export function recordAiDebugEntry(input: {
  model: string;
  durationMs: number;
  ok: boolean;
  error?: string;
  requestMessages: AiDebugMessage[];
  response: string | null;
}): void {
  seq += 1;
  const entry: AiDebugEntry = {
    id: `ai-${Date.now()}-${seq}`,
    at: new Date().toISOString(),
    model: input.model,
    durationMs: input.durationMs,
    ok: input.ok,
    error: input.error,
    requestMessages: input.requestMessages.map((m) => ({
      role: m.role,
      content: truncate(m.content),
    })),
    response: input.response != null ? truncate(input.response) : null,
  };

  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }
}

export function listAiDebugEntries(): AiDebugEntry[] {
  return entries.map((e) => ({
    ...e,
    requestMessages: e.requestMessages.map((m) => ({ ...m })),
  }));
}

export function clearAiDebugEntries(): void {
  entries.length = 0;
}
