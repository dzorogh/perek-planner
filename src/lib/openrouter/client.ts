import "server-only";

import { recordAiDebugEntry } from "@/lib/openrouter/debug-log";

/**
 * OpenRouter Chat Completions client (server-only).
 * Never import from Client Components. Never use NEXT_PUBLIC_* keys.
 */

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/**
 * Default for menu invent/snacks — Gemini 2.5 Flash Lite via OpenRouter.
 * Override with OPENROUTER_MODEL.
 */
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Hard cap so generate action cannot hang indefinitely.
 * Keep as safety net for multi-step invent/expand.
 */
export const OPENROUTER_TIMEOUT_MS = 90_000;

/**
 * Default completion budget. Gemini Flash Lite often pretty-prints JSON and
 * truncates mid-object when the provider default max_tokens is too low.
 */
export const DEFAULT_OPENROUTER_MAX_TOKENS = 8192;

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterChatRequest = {
  model?: string;
  messages: OpenRouterChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
  /** Completion token budget (OpenRouter `max_tokens`). */
  maxTokens?: number;
};

export class OpenRouterError extends Error {
  readonly code = "OPENROUTER_ERROR" as const;

  constructor(
    message: string,
    public readonly causeStatus?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function getOpenRouterModel(): string {
  const model = process.env.OPENROUTER_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_OPENROUTER_MODEL;
}

export type ChatCompletionsFn = (
  request: OpenRouterChatRequest,
) => Promise<string>;

/**
 * Call OpenRouter chat completions; returns assistant message content.
 */
export async function openRouterChatCompletions(
  request: OpenRouterChatRequest,
): Promise<string> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not configured");
  }

  const model = request.model ?? getOpenRouterModel();
  const body: Record<string, unknown> = {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    max_tokens: request.maxTokens ?? DEFAULT_OPENROUTER_MAX_TOKENS,
  };
  if (request.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-OpenRouter-Title"] = title;

  const started = Date.now();
  const debugMessages = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
  } catch (err) {
    let message = "Failed to reach OpenRouter";
    if (err instanceof Error && err.name === "TimeoutError") {
      message = "OpenRouter request timed out";
    } else if (err instanceof Error && err.name === "AbortError") {
      message = "OpenRouter request aborted";
    }
    // Fire-and-forget: never block OpenRouter error path on DB latency.
    void recordAiDebugEntry({
      model,
      durationMs: Date.now() - started,
      ok: false,
      error: message,
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError(message);
  }

  if (!response.ok) {
    const message = `OpenRouter HTTP ${response.status}`;
    void recordAiDebugEntry({
      model,
      durationMs: Date.now() - started,
      ok: false,
      error: message,
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError(message, response.status);
  }

  let json: {
    choices?: Array<{
      finish_reason?: string | null;
      native_finish_reason?: string | null;
      message?: {
        content?: string | null | Array<{ type?: string; text?: string }>;
      };
    }>;
  };
  try {
    json = (await response.json()) as typeof json;
  } catch {
    void recordAiDebugEntry({
      model,
      durationMs: Date.now() - started,
      ok: false,
      error: "OpenRouter returned invalid JSON",
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError("OpenRouter returned invalid JSON");
  }

  const choice = json.choices?.[0];
  const content = extractAssistantText(choice?.message?.content);
  if (!content) {
    void recordAiDebugEntry({
      model,
      durationMs: Date.now() - started,
      ok: false,
      error: "OpenRouter returned empty content",
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError("OpenRouter returned empty content");
  }

  const finishReason = choice?.finish_reason ?? choice?.native_finish_reason;
  const truncated =
    finishReason === "length" || finishReason === "MAX_TOKENS";
  void recordAiDebugEntry({
    model,
    durationMs: Date.now() - started,
    ok: !truncated,
    error: truncated
      ? `Output truncated (finish_reason=${finishReason})`
      : undefined,
    requestMessages: debugMessages,
    response: content,
  });
  return content;
}

function extractAssistantText(
  content:
    | string
    | null
    | undefined
    | Array<{ type?: string; text?: string }>,
): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text!)
    .join("");
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}
