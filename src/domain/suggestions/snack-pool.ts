/** Normalize snack labels for dedupe / avoid sets (Russian locale). */
export function normalizeSnackLabel(label: string): string {
  return label.trim().toLocaleLowerCase("ru");
}

/** Display / persist: trim and capitalize the first letter (Russian locale). */
export function formatSnackLabel(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("ru") + trimmed.slice(1);
}
