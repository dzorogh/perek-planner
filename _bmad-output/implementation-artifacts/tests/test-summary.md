# E2E test summary — 2026-07-20

## Framework

Playwright (`@playwright/test`), Chromium. Config: `playwright.config.ts`. Run: `npm run test:e2e`.

## Suites

| Spec | Coverage |
|------|----------|
| `e2e/shell-bypass.spec.ts` | Shell under `KEPLO_DEV_BYPASS_AUTH`: Create Menu, Menu empty, Portions, Shopping list, History, Settings, Login |
| `e2e/planning-flow.spec.ts` | Authenticated UJ-1 path: login → generate 1 day → recipe dialog → snack → portions → shopping list copy → history → settings |

## Browser manual pass (same day)

Verified live at `http://localhost:3000` with bypass + operator session: generate, slot edit, recipe text Esc, snacks, portions, shopping list (prices/pantry/snacks/store link/copy), history ratings, settings store radio.

## Fixes from manual pass

- Removed bypass page stubs that blocked real UI.
- Expanded mock catalog for seed recipes; re-sync for freshness.
- Matching prefix 4→5 chars (blocks «курица»→«яйца куриные»).
- Middleware bypass still refreshes session cookies / redirects signed-in users off `/auth/login`.
