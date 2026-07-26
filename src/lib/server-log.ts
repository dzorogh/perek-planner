/**
 * Structured server logs for generate / OpenRouter (Next terminal).
 * Keep payloads JSON-serializable and free of secrets.
 */
export function slog(
  scope: string,
  event: string,
  fields?: Record<string, unknown>,
): void {
  if (fields && Object.keys(fields).length > 0) {
    console.info(`[${scope}] ${event}`, fields);
    return;
  }
  console.info(`[${scope}] ${event}`);
}

export function slogError(
  scope: string,
  event: string,
  fields?: Record<string, unknown>,
): void {
  if (fields && Object.keys(fields).length > 0) {
    console.error(`[${scope}] ${event}`, fields);
    return;
  }
  console.error(`[${scope}] ${event}`);
}
