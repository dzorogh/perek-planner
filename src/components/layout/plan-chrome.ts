/** Plan surfaces that show the W1 wizard bar under the global header. */
export function isPlanRoute(pathname: string): boolean {
  if (pathname === "/plan/menu" || pathname === "/plan/shopping-list") {
    return true;
  }
  if (pathname.startsWith("/plan/portions")) return true;
  return /^\/plan\/[^/]+\/(?:menu|shopping-list)\/?$/.test(pathname);
}

export type WizardStepHref = "/plan/menu" | "/plan/shopping-list";

export function resolveWizardActiveHref(pathname: string): WizardStepHref {
  if (
    pathname === "/plan/shopping-list" ||
    pathname.endsWith("/shopping-list") ||
    pathname.startsWith("/plan/portions")
  ) {
    return "/plan/shopping-list";
  }
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
