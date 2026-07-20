/**
 * Minimal name helpers. Variety / “near-duplicate” judgment is owned by the AI
 * (invent + assign prompts), not by stem/family tables in code.
 */

export function normalizeDishName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact normalized name equality (for dedupe of identical labels). */
export function namesEqual(a: string, b: string): boolean {
  const na = normalizeDishName(a);
  const nb = normalizeDishName(b);
  return !!na && !!nb && na === nb;
}

/** Dedupe a list by exact normalized name, keeping first occurrence. */
export function uniqueExactNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = normalizeDishName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return out;
}

export type NamedRecipe = { recipeId: string; name: string };

/** Pick first candidate whose id is not excluded (deterministic fallback). */
export function pickUnusedCandidate(
  candidates: NamedRecipe[],
  excludeIds: Set<string>,
): NamedRecipe | null {
  for (const c of candidates) {
    if (excludeIds.has(c.recipeId)) continue;
    return c;
  }
  return null;
}
