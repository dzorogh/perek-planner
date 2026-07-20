import "server-only";

import { recordAiDebugEntry } from "@/lib/openrouter/debug-log";

/**
 * OpenRouter Chat Completions client (server-only).
 * Never import from Client Components. Never use NEXT_PUBLIC_* keys.
 */

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/**
 * Default for menu invent/snacks — fast JSON + Nitro throughput routing.
 * Override with OPENROUTER_MODEL.
 */
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini:nitro";

/**
 * Hard cap so generate action cannot hang indefinitely.
 * Chunked invent on gpt-4o-mini:nitro is usually well under this; keep as safety net.
 */
export const OPENROUTER_TIMEOUT_MS = 90_000;

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterChatRequest = {
  model?: string;
  messages: OpenRouterChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
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
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "OpenRouter request timed out"
        : err instanceof Error && err.name === "AbortError"
          ? "OpenRouter request aborted"
          : "Failed to reach OpenRouter";
    recordAiDebugEntry({
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
    recordAiDebugEntry({
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
      message?: {
        content?: string | null | Array<{ type?: string; text?: string }>;
      };
    }>;
  };
  try {
    json = (await response.json()) as typeof json;
  } catch {
    recordAiDebugEntry({
      model,
      durationMs: Date.now() - started,
      ok: false,
      error: "OpenRouter returned invalid JSON",
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError("OpenRouter returned invalid JSON");
  }

  const content = extractAssistantText(json.choices?.[0]?.message?.content);
  if (!content) {
    recordAiDebugEntry({
      model,
      durationMs: Date.now() - started,
      ok: false,
      error: "OpenRouter returned empty content",
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError("OpenRouter returned empty content");
  }

  recordAiDebugEntry({
    model,
    durationMs: Date.now() - started,
    ok: true,
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
