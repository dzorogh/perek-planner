/** Plan surfaces that show the W1 wizard bar under the global header. */
export function isPlanRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/plan/menu") ||
    pathname.startsWith("/plan/shopping-list") ||
    pathname.startsWith("/plan/portions")
  );
}

export function resolveWizardActiveHref(pathname: string): string {
  if (pathname.startsWith("/plan/shopping-list")) return "/plan/shopping-list";
  if (pathname.startsWith("/plan/portions")) return "/plan/shopping-list";
  return "/plan/menu";
}

/** Global text-nav current page — never a plan step. */
export function resolvePrimaryActiveHref(
  pathname: string,
): "/history" | "/settings" | undefined {
  if (pathname.startsWith("/history")) return "/history";
  if (pathname.startsWith("/settings")) return "/settings";
  return undefined;
}
