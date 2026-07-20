/**
 * Pure-logic smoke for plan-chrome helpers (keep in sync with plan-chrome.ts).
 * Usage: node scripts/verify-plan-chrome-logic.mjs
 */

function isPlanRoute(pathname) {
  return (
    pathname.startsWith("/plan/menu") ||
    pathname.startsWith("/plan/shopping-list") ||
    pathname.startsWith("/plan/portions")
  );
}

function resolveWizardActiveHref(pathname) {
  if (pathname.startsWith("/plan/shopping-list")) return "/plan/shopping-list";
  if (pathname.startsWith("/plan/portions")) return "/plan/shopping-list";
  return "/plan/menu";
}

function resolvePrimaryActiveHref(pathname) {
  if (pathname.startsWith("/history")) return "/history";
  if (pathname.startsWith("/settings")) return "/settings";
  return undefined;
}

let failed = 0;
function check(name, cond) {
  if (cond) console.log(`PASS: ${name}`);
  else {
    console.log(`FAIL: ${name}`);
    failed += 1;
  }
}

check("off-plan: /", !isPlanRoute("/"));
check("plan: menu", isPlanRoute("/plan/menu"));
check("plan: list", isPlanRoute("/plan/shopping-list"));
check("plan: portions legacy", isPlanRoute("/plan/portions"));
check("off-plan: history", !isPlanRoute("/history"));
check("off-plan: settings", !isPlanRoute("/settings"));
check("off-plan: login", !isPlanRoute("/auth/login"));

check(
  "wizard active home defaults to menu",
  resolveWizardActiveHref("/") === "/plan/menu",
);
check("wizard active menu", resolveWizardActiveHref("/plan/menu") === "/plan/menu");
check(
  "wizard active list",
  resolveWizardActiveHref("/plan/shopping-list") === "/plan/shopping-list",
);
check(
  "wizard active portions → list",
  resolveWizardActiveHref("/plan/portions") === "/plan/shopping-list",
);

check("primary history", resolvePrimaryActiveHref("/history") === "/history");
check("primary settings", resolvePrimaryActiveHref("/settings") === "/settings");
check("primary none on /", resolvePrimaryActiveHref("/") === undefined);
check(
  "primary none on menu",
  resolvePrimaryActiveHref("/plan/menu") === undefined,
);

if (failed > 0) {
  console.log(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All plan-chrome logic cases passed");
