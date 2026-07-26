import "server-only";

import { recordAiDebugEntry } from "@/lib/openrouter/debug-log";
import { slog, slogError } from "@/lib/server-log";

/**
 * OpenRouter Chat Completions client (server-only).
 * Never import from Client Components. Never use NEXT_PUBLIC_* keys.
 */

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/**
 * Default for menu invent/snacks — DeepSeek V4 Flash via OpenRouter.
 * Override with OPENROUTER_MODEL.
 */
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

/**
 * Hard cap per OpenRouter request. Below the old 90s so a stuck provider
 * releases the expand pool; above observed healthy p95 (~40s on slow routes).
 */
export const OPENROUTER_TIMEOUT_MS = 60_000;

/**
 * Default completion budget. Models often pretty-print JSON and truncate
 * mid-object when the provider default max_tokens is too low.
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
    // DeepSeek V4 Flash (and similar) can burn the whole max_tokens budget on
    // reasoning and return empty content. We only need the JSON answer.
    reasoning: { enabled: false },
    // Wall clock for ~1k completion tokens is dominated by tokens/sec, not TTFT.
    // Price-default routing landed on ~20 tps hosts (45s/chunk); throughput/nitro
    // prefers ~60–74 tps providers.
    provider: { sort: "throughput" },
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
  const maxTokens = request.maxTokens ?? DEFAULT_OPENROUTER_MAX_TOKENS;
  const systemLen =
    request.messages.find((m) => m.role === "system")?.content.length ?? 0;
  const userLen = request.messages
    .filter((m) => m.role === "user")
    .reduce((n, m) => n + m.content.length, 0);
  slog("openrouter", "request:start", {
    model,
    maxTokens,
    temperature: request.temperature ?? 0.4,
    responseFormatJson: Boolean(request.responseFormatJson),
    messageCount: request.messages.length,
    systemChars: systemLen,
    userChars: userLen,
    timeoutMs: OPENROUTER_TIMEOUT_MS,
    providerSort: "throughput",
  });

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
    const durationMs = Date.now() - started;
    slogError("openrouter", "request:fail", {
      model,
      durationMs,
      error: message,
      errName: err instanceof Error ? err.name : undefined,
    });
    // Fire-and-forget: never block OpenRouter error path on DB latency.
    void recordAiDebugEntry({
      model,
      durationMs,
      ok: false,
      error: message,
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError(message);
  }

  if (!response.ok) {
    const message = `OpenRouter HTTP ${response.status}`;
    const durationMs = Date.now() - started;
    slogError("openrouter", "request:fail", {
      model,
      durationMs,
      status: response.status,
      error: message,
    });
    void recordAiDebugEntry({
      model,
      durationMs,
      ok: false,
      error: message,
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError(message, response.status);
  }

  const routedProvider =
    response.headers.get("x-openrouter-provider") ??
    response.headers.get("x-provider") ??
    undefined;

  let json: {
    id?: string;
    provider?: string;
    model?: string;
    choices?: Array<{
      finish_reason?: string | null;
      native_finish_reason?: string | null;
      message?: {
        content?: string | null | Array<{ type?: string; text?: string }>;
        reasoning?: string | null;
      };
    }>;
    usage?: {
      completion_tokens?: number;
      prompt_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  try {
    json = (await response.json()) as typeof json;
  } catch (err) {
    // Abort during body read surfaces here, not on fetch().
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError");
    const message = aborted
      ? "OpenRouter request timed out"
      : "OpenRouter returned invalid JSON";
    const durationMs = Date.now() - started;
    slogError("openrouter", "request:fail", {
      model,
      durationMs,
      error: message,
      errName: err instanceof Error ? err.name : undefined,
    });
    void recordAiDebugEntry({
      model,
      durationMs,
      ok: false,
      error: message,
      requestMessages: debugMessages,
      response: null,
    });
    throw new OpenRouterError(message);
  }

  const choice = json.choices?.[0];
  const content = extractAssistantText(choice?.message?.content);
  const finishReason = choice?.finish_reason ?? choice?.native_finish_reason;
  const completionTokens = json.usage?.completion_tokens;
  const promptTokens = json.usage?.prompt_tokens;
  const reasoningTokens =
    json.usage?.completion_tokens_details?.reasoning_tokens;
  const provider = json.provider ?? routedProvider;
  const tokensPerSec =
    completionTokens && Date.now() - started > 0
      ? Math.round((completionTokens * 1000) / (Date.now() - started))
      : undefined;
  if (!content) {
    const message =
      finishReason === "length" || finishReason === "MAX_TOKENS"
        ? `OpenRouter returned empty content (truncated; reasoning_tokens=${reasoningTokens ?? "?"})`
        : "OpenRouter returned empty content";
    const durationMs = Date.now() - started;
    slogError("openrouter", "request:fail", {
      model,
      provider,
      durationMs,
      error: message,
      finishReason,
      completionTokens,
      reasoningTokens,
    });
    void recordAiDebugEntry({
      model,
      durationMs,
      ok: false,
      error: message,
      requestMessages: debugMessages,
      response: choice?.message?.reasoning?.slice(0, 2000) ?? null,
    });
    throw new OpenRouterError(message);
  }

  const truncated =
    finishReason === "length" || finishReason === "MAX_TOKENS";
  if (truncated) {
    // Hard fail: never return partial content for callers to parse/retry.
    const durationMs = Date.now() - started;
    slogError("openrouter", "request:fail", {
      model,
      durationMs,
      error: `Output truncated (finish_reason=${finishReason})`,
      finishReason,
      contentChars: content.length,
      completionTokens,
      reasoningTokens,
    });
    void recordAiDebugEntry({
      model,
      durationMs,
      ok: false,
      error: `Output truncated (finish_reason=${finishReason})`,
      requestMessages: debugMessages,
      response: content.slice(0, 4000),
    });
    throw new OpenRouterError(
      `OpenRouter output truncated (finish_reason=${finishReason})`,
    );
  }

  const durationMs = Date.now() - started;
  slog("openrouter", "request:ok", {
    model,
    provider,
    durationMs,
    finishReason,
    contentChars: content.length,
    promptTokens,
    completionTokens,
    reasoningTokens,
    tokensPerSec,
  });
  void recordAiDebugEntry({
    model,
    durationMs,
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
