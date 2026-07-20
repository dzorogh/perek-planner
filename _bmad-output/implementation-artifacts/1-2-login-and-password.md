---
baseline_commit: e20cd4b
---

# Story 1.2: Login and password

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want to sign in with login and password,
So that my Menus and personal history are available only to me.

## Acceptance Criteria

1. **Given** an unauthenticated user  
   **When** they open any planning, History, or Settings route  
   **Then** they cannot access Menus or personal history and are shown the sign-in surface (FR21)

2. **Given** valid login and password for the operator account  
   **When** they sign in via Supabase Auth email/password with `@supabase/ssr` cookie session  
   **Then** they land on Create Menu / planning (FR25)  
   **And** subsequent requests use `getUser()`-protected server access (AD-5)

3. **Given** authenticated user-owned tables  
   **When** RLS policies are applied  
   **Then** user-owned rows require `auth.uid()`; unauthenticated clients cannot read Menus/history (NFR5)

## Tasks / Subtasks

- [x] Harden route protection with `getUser()` (AC: #1, #2)
  - [x] Keep Next 16 entry at `proxy.ts` → `src/lib/supabase/middleware.ts` `updateSession()` — do **not** add a competing root `middleware.ts`
  - [x] Confirm unauthenticated hits on `/`, `/history`, `/settings`, `/plan/*` redirect to `/auth/login` when `KEPLO_DEV_BYPASS_AUTH` is unset/false
  - [x] Confirm authenticated user on `/auth/login` redirects to `/` (Create Menu)
  - [x] Fix redirect cookie handoff: when returning `NextResponse.redirect`, copy session cookies from the `supabaseResponse` object (do not drop refreshed cookies on redirect)
  - [x] Add defense-in-depth in `app/(authenticated)/layout.tsx`: server `createClient()` + `getUser()`; if no user → `redirect("/auth/login")`
  - [x] Guard `KEPLO_DEV_BYPASS_AUTH`: local-only; must never be enabled in Dokploy prod (document in README / `.env.example`)

- [x] Complete email/password sign-in UX (AC: #2)
  - [x] Extend existing `LoginForm` + `app/auth/login/page.tsx` — do **not** rebuild a parallel auth UI
  - [x] Keep Soft Workshop: background `#EEF2FF`, card surface + border, wordmark `Keplo` accent, CTA «Войти», no AppShell/pill-nav on login
  - [x] Supabase field = email (PRD “login”); label may stay «Эл. почта» or «Логин» — English username system is forbidden
  - [x] Map common Supabase Auth errors to Russian workshop copy (never leak raw EN SDK strings as the only message)
  - [x] Loading + disabled submit; `role="alert"` on errors; keyboard + visible focus rings (NFR4)
  - [x] Success path: `signInWithPassword` → `router.push("/")` + `router.refresh()` (FR25)
  - [x] No OAuth, magic link, anonymous auth, public sign-up, or forgot-password product surface (not designed; single operator)

- [x] Operator account + session lifecycle (AC: #2)
  - [x] Document creating the single operator user in Supabase Dashboard (Auth → Users) — not an in-app multi-tenant signup flow
  - [x] Add minimal sign-out control in authenticated shell (header or menu) via `supabase.auth.signOut()` then navigate to `/auth/login` — needed to verify AC and expected by Story 1.5
  - [x] After sign-out, planning/History/Settings again redirect to sign-in

- [x] RLS for user-owned data (AC: #3)
  - [x] Add first migration under `supabase/migrations/` (schema SoT per AD-6) — replace empty `supabase/.gitkeep`-only state
  - [x] Seed minimal `user_settings` table: `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, timestamps; **defer** `selected_store_id` + `stores` FK to Story 1.3
  - [x] Enable RLS; policies: SELECT/INSERT/UPDATE/DELETE only when `auth.uid() = user_id`
  - [x] Prove: anon/unauthenticated client cannot read `user_settings`; authenticated operator can read/write own row only
  - [x] Do **not** invent Menu/Rating/History tables here — Epic 2/4 own those; RLS pattern on `user_settings` satisfies NFR5 seed for “user-owned rows”

- [x] Smoke verification (AC: #1–#3)
  - [x] Manual/curl: unauthenticated `/`, `/history`, `/settings` → redirect `/auth/login`
  - [x] Happy path: valid email/password → lands Create Menu `/` with session cookies
  - [x] Invalid password → Russian error; no shell access
  - [x] RLS proof via SQL editor or scripted client (anon key, no JWT → deny; user JWT → own row only)
  - [x] `npm run lint` / `npm run build` pass
  - [x] Soft Workshop login + authenticated shell brand unchanged (no purple SaaS / dark mode drift)

### Review Findings

- [x] [Review][Patch] Redirect cookie handoff must copy cookie options (httpOnly/secure/sameSite/path/maxAge), not only name/value [src/lib/supabase/middleware.ts:26]
- [x] [Review][Patch] Check `signOut` error before navigating to login (failed logout currently loops via middleware) [src/components/logout-button.tsx:17]
- [x] [Review][Patch] Harden RLS smoke script: empty `[]` without error must not PASS; distinguish real deny from network/empty-table [scripts/verify-rls-user-settings.mjs:19]
- [x] [Review][Patch] Handle `getUser` throw/error separately from unauthenticated (avoid 500 on login and false login redirects) [src/lib/supabase/middleware.ts:78]

## Dev Notes

### Epic context

Epic 1 — Sign in, workspace & store catalog: operator signs in, lands on Soft Workshop shell, picks store in Settings, plans against fresh catalog.

**This story is harden + RLS, not greenfield auth.** Story 1.1 already delivered Soft Workshop shell, `@supabase/ssr` clients, `proxy.ts` session gate with `getUser()`, and a Russian login stub. Story 1.2 owns full email/password UX polish, defense-in-depth, RLS seed, and verified session lifecycle.

Sibling stories (do not implement here):
- **1.3** — Store picker + `stores` / `selected_store_id` migrations
- **1.4** — Python `sync/` catalog worker (service role)
- **1.5** — `warning-stale` blocks planning (Settings + sign-out must remain available)

Traceability: PRD **FR-23** = Epics **FR21** = SPEC **CAP-20** = Architecture **AD-5**. Post-login landing = Epics **FR25**.

### Current code state (READ before editing)

| File | Today | This story changes | Must preserve |
| --- | --- | --- | --- |
| `proxy.ts` | Calls `updateSession` | Matcher only if needed | Next 16 proxy entry (not classic `middleware.ts`) |
| `src/lib/supabase/middleware.ts` | `getUser()` + redirect unauth → `/auth/login`; auth on login → `/`; bypass flag | Cookie-safe redirects; harden public-path rules | Cookie `getAll`/`setAll`; `getUser()` not `getSession()` |
| `src/lib/supabase/client.ts` / `server.ts` | Browser + server SSR clients | Only if env/key naming | Publishable/anon key only in browser |
| `app/auth/login/page.tsx` | Soft Workshop centered login + wordmark | Minor polish if needed | No AppShell; brand wordmark |
| `src/components/login-form.tsx` | `signInWithPassword` → `/` | RU errors, a11y, loading | Existing form structure + shadcn Card |
| `app/(authenticated)/layout.tsx` | AppShell only — **no** `getUser()` | Add server session assert | Soft Workshop AppShell wrapper |
| `supabase/` | `.gitkeep` only | First migration + RLS | Migrations as SoT; no hand-owned parallel schema |
| Soft Workshop shell (`globals.css`, layout/*, Create Menu) | Done in 1.1 | Touch only for sign-out affordance | Tokens, pill-nav, primary nav, light-only, RU copy |

### Technical requirements (MUST follow)

| Item | Requirement |
| --- | --- |
| Auth provider | Supabase Auth **email/password** only (AD-5, NFR5) |
| Session | `@supabase/ssr` **0.12.3** cookie sessions |
| Route protection | `auth.getUser()` in proxy/middleware **and** authenticated layout (AD-5) |
| Forbidden auth stacks | NextAuth, Clerk, Auth.js, Lucia, anonymous-only, OAuth/social |
| Packages | Keep pinned `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.7` — do not bump to `"latest"` |
| Node | ≥22.0.0 |
| Next / React | 16.2.10 / 19.2.7 |
| Post-login IA | Create Menu `/` — not History, Settings, or empty dashboard (FR25) |
| Secrets | Service role / OpenRouter / store creds **never** in browser (NFR6) |
| Operator model | Single operator (NFR7); provision user in Dashboard; no multi-household signup |
| Schema SoT | `supabase/migrations` only (AD-6) |
| Dependency direction | `UI → domain → supabase clients`; auth stays in `src/lib/supabase/` + `app/auth/` — **not** in `src/domain/` or `sync/` |

### Architecture compliance

- **AD-5:** email/password; cookie sessions; protect with `getUser()`; RLS `auth.uid()` on user-owned rows; catalog read = authenticated / write = sync service role (catalog write is later stories).
- **AD-1:** Auth/DB on Supabase Cloud; Next on Dokploy later — local `npm run dev` against cloud project is enough for this story.
- **AD-6:** No UI↔sync imports; migrations are schema SoT.
- **AD-9 (boundary):** Do not implement store picker or `selected_store_id` UX — only leave `user_settings` ready for 1.3 to extend.
- **Consistency — Auth row:** `@supabase/ssr` cookies; middleware `getUser()`.
- **Capability map:** Account (FR-23) lives in Supabase Auth + Next middleware/proxy.

[Source: `ARCHITECTURE-SPINE.md` — AD-5, AD-1, AD-6, AD-9, Consistency Conventions, Structural Seed, ER seed]

### UX / brand compliance

Sign-in is **spine-only** (no dedicated HTML mockup). Wireframe: title «Вход», login + password fields, CTA «Войти». EXPERIENCE: unauthenticated users see **only** the sign-in surface — no Menu/History preview.

| Element | Rule |
| --- | --- |
| Background | `#EEF2FF` |
| Card | surface `#FFFFFF`, border `#E0E7FF`, `rounded-lg` |
| Wordmark | `keplo`, accent `#312E81`, section-title |
| Title | «Вход», page-title 24/700 |
| CTA | «Войти», primary `#4338CA`, white text, `rounded-sm` |
| Voice | Practical Russian workshop; no marketing hero, streaks, emoji |
| Mode | Light only; no dark theme; no second CTA chroma |

Optional subtitle already in stub is acceptable: «Войдите, чтобы открыть рабочее пространство планирования меню.»

[Source: `EXPERIENCE.md` IA/State Patterns; `DESIGN.md` Soft Workshop tokens; wireframe flow UJ-1]

### File structure requirements

**UPDATE (primary):**

```text
proxy.ts
src/lib/supabase/middleware.ts
src/lib/supabase/client.ts          # only if needed
src/lib/supabase/server.ts          # only if needed
app/auth/login/page.tsx
src/components/login-form.tsx
app/(authenticated)/layout.tsx       # getUser() defense-in-depth
src/components/layout/app-header.tsx # or primary-nav — sign-out control
.env.example
README.md                            # operator account + RLS apply steps
```

**NEW:**

```text
supabase/migrations/<timestamp>_user_settings_rls.sql
src/components/logout-button.tsx     # or inline in header — keep thin
```

**Do NOT create:**

- NextAuth/Clerk config; OAuth callbacks; public sign-up / forgot-password product pages
- Auth logic under `src/domain/` or `sync/`
- Competing `middleware.ts` that fights `proxy.ts`
- Full Menu/Rating schema (later epics)
- Store picker UI (Story 1.3)

### Library / framework requirements

- **Use:** existing `@supabase/ssr` + `@supabase/supabase-js` clients; shadcn `Button`/`Input`/`Label`/`Card`; Next App Router redirects/`cookies()`.
- **Do not use:** `getSession()` alone for auth decisions; auth-helpers packages (replaced by `@supabase/ssr`); service role in client components.
- **Docs note (2026):** Supabase SSR guides increasingly mention `getClaims()` for JWT validation. **This project follows AD-5: use `getUser()`.** Do not switch to `getClaims()` unless Architecture is updated.
- Cookie API: always `getAll` / `setAll` (never legacy get/set/remove).

### Testing requirements

No Vitest/Playwright mandated by Architecture. Minimum for 1.2:

1. Unauthenticated planning/History/Settings → `/auth/login`
2. Valid credentials → Create Menu `/` + cookies persist across navigation
3. Invalid credentials → RU error, no access
4. Sign-out → gate restores
5. RLS: unauthenticated cannot SELECT `user_settings`; owner can
6. A11y floor: keyboard + focus rings on login controls
7. Build/lint green

Do not block on a full e2e harness unless you intentionally add a thin smoke script.

### Previous story intelligence (1.1)

Status: **done** (code review patches applied).

Actionable learnings:
- Starter Next 16 uses **`proxy.ts`**, not `middleware.ts` — keep it.
- Auth redirect already verified via curl 307 → `/auth/login` with bypass off.
- `KEPLO_DEV_BYPASS_AUTH=true` exists for shell inspection — never use as “auth works” proof; never enable in prod.
- 1.1 explicitly deferred to 1.2: full email/password UX hardening, RLS policies, hardened session tests.
- Soft Workshop tokens + AppShell + Create Menu landing must remain intact.
- Post-login target `/` already wired in login form — preserve FR25.
- Pinned deps already correct — do not re-scaffold or re-pin casually.

[Source: `_bmad-output/implementation-artifacts/1-1-app-shell-with-soft-workshop-brand.md`]

### Git intelligence summary

Only commit on branch: `e20cd4b Init` — includes Story 1.1 app shell + planning artifacts. No separate auth commits yet. Follow patterns already in tree (`src/lib/supabase/*`, Soft Workshop login card, Russian copy).

### Latest tech information

- `@supabase/ssr@0.12.3` (Jun–Jul 2026): use official SSR client pattern; middleware/proxy must refresh cookies before page render.
- Always prefer `getUser()` over `getSession()` for server auth decisions (session from cookie is not revalidated alone).
- When middleware redirects, **preserve** Set-Cookie from the Supabase response object or session refresh is lost.
- Concurrent tab refresh can race single-use refresh tokens — proxy-per-navigation pattern mitigates the common case.
- Env: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy anon JWT still acceptable as value during key migration).

### Project context reference

No `project-context.md` in repo. Follow Architecture Spine + DESIGN.md + EXPERIENCE.md. Domain glossary: `_bmad-output/specs/spec-keplo/glossary.md`.

### Anti-patterns (prevent disasters)

- Reinventing login / new auth kit instead of extending `login-form.tsx`
- NextAuth, Clerk, OAuth, anonymous auth, public multi-user signup
- Trusting `getSession()` alone; skipping authenticated-layout `getUser()`
- Adding root `middleware.ts` that conflicts with `proxy.ts`
- Claiming AC #3 without any RLS migration (empty `supabase/.gitkeep` is not enough)
- Implementing store picker / sync / stale-block “while here” (1.3–1.5)
- Empty dashboard post-login; putting pill-nav on the login page
- Service role or secrets in `NEXT_PUBLIC_*`
- Shipping mock browser chrome; dark mode; purple SaaS drift
- Building password-reset product UX without UX design
- Putting auth code in `src/domain/` or `sync/`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2, FR21, FR25, NFR5, NFR7, AD-5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md` — AD-5, Structural Seed, ER UserSettings]
- [Source: `_bmad-output/planning-artifacts/prds/prd-keplo-2026-07-19/prd.md` — FR-23]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md` — sign-in-only unauth state]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md` — Soft Workshop tokens]
- [Source: `_bmad-output/implementation-artifacts/1-1-app-shell-with-soft-workshop-brand.md`]
- [Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Unauth curl: `/`, `/history`, `/settings`, `/plan/menu` → 307 `Location: /auth/login`; `/auth/login` → 200.
- Browser: existing session on `/`; **Выйти** → `/auth/login`; invalid credentials → alert «Неверный логин или пароль.»
- Supabase MCP `apply_migration` `user_settings_rls` → success; `list_tables` shows `public.user_settings` with `rls_enabled: true`.
- Anon client: `42501 permission denied for table user_settings` (PASS).
- Authenticated JWT claim sim: own row insert/select OK; insert other `user_id` → RLS `42501` (PASS).
- Privileges: `anon_can_select=false`, `auth_can_select=true`.
- `npm run lint` / `npm run build` green.

### Completion Notes List

- Hardened `updateSession` cookie-safe redirects; production ignores `KEPLO_DEV_BYPASS_AUTH`.
- Authenticated layout defense-in-depth via `getUser()`.
- Login RU error mapping; header **Выйти**; README operator + migration docs.
- Applied `user_settings` + RLS via Supabase MCP; local file SoT: `supabase/migrations/20260720010000_user_settings_rls.sql`.
- All ACs satisfied; story ready for code-review.

### File List

- `proxy.ts` (unchanged entry; still used)
- `src/lib/supabase/middleware.ts`
- `app/(authenticated)/layout.tsx`
- `src/components/login-form.tsx`
- `src/components/logout-button.tsx`
- `src/components/layout/app-header.tsx`
- `supabase/migrations/20260720010000_user_settings_rls.sql`
- `scripts/verify-rls-user-settings.mjs`
- `.env.example`
- `README.md`
- `_bmad-output/implementation-artifacts/1-2-login-and-password.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-20: Story context created (ready-for-dev) — harden login, RLS seed, session protection.
- 2026-07-20: Implemented route hardening, login UX, logout, migration SQL; awaiting cloud apply for RLS prove.
- 2026-07-20: Applied `user_settings_rls` via Supabase MCP; RLS proved; status → review.
- 2026-07-20: Code review patches — cookie options on redirect, logout error handling, getUser failure path, RLS smoke hardening. Status: done.

