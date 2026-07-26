/** Canonical plan URLs: `/plan/{menuId}/{step}`. */

export function planMenuPath(menuId: string): string {
  return `/plan/${encodeURIComponent(menuId)}/menu`;
}

export function planShoppingListPath(menuId: string): string {
  return `/plan/${encodeURIComponent(menuId)}/shopping-list`;
}

/** Menu id from `/plan/{menuId}/menu|shopping-list`, else null. */
export function parsePlanMenuId(pathname: string): string | null {
  const match = pathname.match(
    /^\/plan\/([^/]+)\/(?:menu|shopping-list)\/?$/,
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1] ?? "");
  } catch {
    return match[1] ?? null;
  }
}
