---
name: perek-planner
status: final
sources:
  - {planning_artifacts}/prds/prd-perek-planner-2026-07-19/prd.md
  - {planning_artifacts}/prds/prd-perek-planner-2026-07-19/addendum.md
  - {planning_artifacts}/briefs/brief-perek-planner-2026-07-19/brief.md
  - {planning_artifacts}/briefs/brief-perek-planner-2026-07-19/addendum.md
updated: 2026-07-19
---

# perek-planner — Experience Spine

> Desktop web planner for one operator (Sergey). shadcn/ui on Next.js + Tailwind; `DESIGN.md` is the brand-layer delta (Soft Workshop + Lavender Workshop palette). UI copy in **Russian**. Light mode only in v1. **Spine wins on conflict** with `mockups/` and `wireframes/`.

→ Primary journey wireframe: [`wireframes/flow-uj1-2026-07-19.excalidraw`](wireframes/flow-uj1-2026-07-19.excalidraw)

## Foundation

Desktop web first. Single operator (Sergey); default plan feeds **two people**, three meals per day (breakfast, lunch, dinner). One **Menu** (1–4 days) maps to one **Cook session** and one **Order** via a always-**copyable Shopping list**; purchase completes outside the app on Perekrestok (no in-app checkout).

**Stack posture:** shadcn/ui defaults for structure and interaction; brand discipline is Soft Workshop — soft card columns, rounded surfaces, medium density, friendly workshop register. Visual tokens live in `DESIGN.md`; reference as `{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`.

**Scope boundaries (v1 UX):**
- Post sign-in landing: Create **Menu** / current planning — not an empty dashboard.
- Slot edit after AI suggestions, before **Portion plan** and **Shopping list** — not a jump straight to the list.
- Slot replace: AI resuggest only — no separate Recipe library browse and no manual History pick in v1.
- AI generation reintroduces **Recipes** not cooked for ~2+ weeks, weighted by **Rating** (high more often, medium less); **Refusal**/dislike stay hard-suppressed.
- **History** of past **Menus** / **Recipes** is for review and **Rating** (not a forced post-cook interrupt); **Rating** editable after submit in v1.
- No Pantry management screen — **Pantry item**s / staples included on **Shopping list** by default; Sergey filters at Perekrestok order time (no in-app opt-in prompt).
- **`store-picker`**: once in Settings; default д. Алабино, 92 — not required before every new **Menu**.
- **UJ-2** (reuse previous **Menu** as draft): out of v1 surfaces.
- No match-review UI, no fallback-after-planning flow, no ready packs, no in-app **Shopping list** edit as primary path, no stock-badge UI, no cook-along mode, no hover-only critical actions without keyboard path.
- **Model C:** day × meal slot grid (eat view). AI repeats simple home dishes/sides across days (~20% variety enough); no cook-once batch-component surface. Unique fancy dish per day is an anti-pattern.
- **Cook ~2h heuristic:** guides AI suggestion quality and voice only. No cook timer UI, no hard duration filter control, no required cook-time field in v1 UI.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Sign-in | App open (unauthenticated) | Login + password; unauthenticated users cannot access **Menus** or personal history |
| Create **Menu** | Post sign-in landing / primary nav | `day-length-picker`: choose 1, 2, 3, or 4 days; trigger AI **Recipe** suggestions for that length |
| **Menu** + slot edit | After generation | Model C: day × meal slot grid (eat view). Edit breakfast / lunch / dinner per day; AI may repeat simple home dishes/sides across days — no batch-component layer. Empty slots OK; **Refusal**; add **Snack**s; slot replace via AI resuggest |
| **Portion plan** | Continue from slot edit | `portion-plan-grid`: servings by day and meal; adjustable before copying **Shopping list** |
| **Shopping list** handoff | Continue from **Portion plan** | One combined list (includes staples by default); `shopping-list-cta` copy; optional Perekrestok store link; price/nutrition only when catalog provides |
| Settings | Primary nav | `store-picker`: concrete Perekrestok store; v1 default д. Алабино, 92 — set once, not before each **Menu** |
| History | Primary nav | Past **Menus** / **Recipes**; hosts `history-rating-row` (like/dislike + reason, editable after submit); feeds AI recency/Rating weights — not a manual slot-pick UI |
| **Recipe text** | Any **Recipe** name (Menu, History, **Shopping list**) | `recipe-text-panel`: read **Recipe** while shopping or cooking — not cook-along |

Modal depth: one level (e.g., `recipe-text-panel` as **Dialog**). No drawer-based Pantry layer.

**Out of v1 IA:** see Scope boundaries — UJ-2 reuse surface, Pantry screen, Recipe library browse, post-cook Rating interrupt, per-item staple opt-in, batch-component layer, cook timer / duration UI.

→ Visual references: [direction B shell](mockups/direction-b-soft-workshop.html), [UJ-1 wireframe](wireframes/flow-uj1-2026-07-19.excalidraw), key-screen mocks in `mockups/`.

## Voice and Tone

Microcopy in **Russian**. Practical, calm, workshop register — dense but friendly; no marketing hero, no streaks, no fake stock promises. Voice reflects **home food, not restaurant**: batch cooking simplicity, repeatable sides, one **Cook session** for the **Menu** — not chef's-table variety or daily novelty as the default success story.

| Do | Don't |
|---|---|
| «Меню на 3 дня» | «Давайте спланируем ваши идеальные приёмы пищи! 🍳» |
| «Список скопирован.» | «✓ Список успешно скопирован в буфер обмена» |
| «Каталог устарел — планирование недоступно, пока не обновится.» | «Ошибка синхронизации» (без контекста); «план строится по последнему сохранённому» |
| «Список включает специи и соусы — отфильтруйте на Perekrestok.» (staples on list by default) | «Добавить {Pantry item} в список?» per-item prompt; отдельный экран «Кладовая» |
| Treat repeating a side across days as normal batch planning | Celebrate per-day unique dishes, "новинка дня", or restaurant-style variety as the default win |
| Frame suggestions as simple home cooking for one batch session | Imply Sergey needs a unique restaurant-quality dish every day |
| Name **Product**s on the **Shopping list**, not match jargon | «Checked match», «Critical ingredient» in shopper-facing list rows |

Use glossary terms verbatim in product vocabulary (see Glossary). Chat-facing docs may stay English; UI labels Russian where natural («меню» for **Menu**).

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md` components map and shadcn defaults.

| Component | Use | Behavioral rules |
|---|---|---|
| `button-primary` | Primary actions (`Сгенерировать`, `К плану порций`, `Копировать список`) | One primary per screen region. Uses `{colors.primary}` / `{colors.primary-foreground}`. Disabled while generation or copy in flight. |
| `day-length-picker` | Create **Menu** | Radio or segmented control: 1–4 days. Selecting length does not build slots manually — triggers suggestion pass biased to simple home food and batch repetition (model C). → [mock](mockups/mock-create-menu.html) |
| `slot-card` | **Menu** + slot edit | One card per day × meal slot (model C — eat view only; no parallel batch-component surface). Shows assigned **Recipe** or empty state on `{colors.surface}` with `{rounded.lg}`. AI may assign the same simple home dish or side on multiple days — repetition is success, not a UI warning. Actions: AI resuggest, **Refusal**, clear slot (no manual History pick). **Recipe** name opens `recipe-text-panel`. Empty slots allowed. → [mock](mockups/mock-menu-edit.html) |
| `warning-stale` | Planning surfaces (Create **Menu**, slot edit, **Portion plan**) | Inline banner when catalog sync failed or non-fresh; `{colors.warning-bg}`, `{colors.warning-fg}`, `{colors.warning-border}`. **Menu planning actions blocked** until fresh sync — explicit stale warning required. |
| `portion-plan-grid` | **Portion plan** | Rows: day × breakfast / lunch / dinner; default 2 people × 3 meals. Editable before **Shopping list**; visible without checkout. → [mock](mockups/mock-portion-plan.html) |
| `shopping-list-cta` | **Shopping list** handoff | Always-available copy action. List may include staples by default — no in-app opt-in. Optional secondary: open Perekrestok store link when available — must not be the only purchase path. → [mock](mockups/mock-shopping-list.html) |
| `store-picker` | Settings | Concrete store list / selector; default д. Алабино, 92. Set once in Settings — not shown before each new **Menu**. No free-text address. |
| `recipe-text-panel` | Global read aid | **Dialog** or side panel: full **Recipe** text. Opens from any **Recipe** name on **Menu**, **History**, or **Shopping list** — anytime, not cook-along. |
| `history-rating-row` | History | Each past **Recipe** / **Snack**: like/dislike + reason (too hard, not tasty, too long, other). Editable after submit in v1. Dislike hard-suppresses future suggestions in v1. No forced post-cook screen. → [mock](mockups/mock-history-rating.html) |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Unauthenticated | App | Sign-in only; no **Menu** or History preview. |
| Cold load | Any authenticated surface | shadcn `Skeleton` matching card grid; resolves on data. |
| Generating **Menu** | Create **Menu** → slot edit | `button-primary` loading; disable `day-length-picker` until suggestions arrive or error. |
| Empty slot | **Menu** + slot edit | `slot-card` empty state on muted surface; still valid to proceed. |
| Stale catalog | Create **Menu**, slot edit, **Portion plan** | `warning-stale` persistent until fresh sync; generate/continue Menu actions blocked; Settings remain available. |
| **Refusal** recorded | Slot edit | Remove or mark **Recipe**; hard-suppressed from future suggestions in v1. |
| Copy success | **Shopping list** | Brief confirmation («Список скопирован.»); list remains visible. |
| Store link unavailable | **Shopping list** | Copy path unchanged; link control hidden or disabled with plain explanation — not an error wall. |
| No History | History | Empty state routing to Create **Menu** — not a Recipe library browse. |
| Rating pending | History | Row shows rate affordance; no interrupt after cooking. |
| Rating submitted | History | `history-rating-row` remains editable — user can change like/dislike or reason after submit in v1. |

## Interaction Primitives

**Desktop-first.** Mouse primary; keyboard adequate for v1 (see Accessibility Floor). No mobile layout requirement in v1.

- **Linear UJ-1 spine:** Sign-in → Create **Menu** landing → `day-length-picker` → slot edit → `portion-plan-grid` → `shopping-list-cta` → external Perekrestok (exit app).
- **Slot edit gate:** User must pass through slot edit after AI suggestions; cannot skip directly to **Shopping list**.
- **Slot replace:** AI resuggest only — no Recipe library search, no manual History pick.
- **Recipe text:** Any **Recipe** name on **Menu**, **History**, or **Shopping list** opens `recipe-text-panel`.
- **Esc:** Close `recipe-text-panel` and other modals; does not discard saved **Menu** state.
- **Tab order:** Matches visual reading order on each surface; focus visible via shadcn `ring` on `{colors.background}`.
- **External handoff:** Store link and purchase open new tab / window; labeled as outside app («ВНЕ ПРИЛОЖЕНИЯ»).

**Banned in v1:** see Scope boundaries.

## Accessibility Floor

v1 floor: standard keyboard use + adequate contrast — no elevated a11y program beyond that.

- All interactive controls reachable and operable via keyboard; `Tab` order matches layout.
- Focus rings visible (shadcn default `ring`; brand overrides must maintain contrast against `{colors.background}`).
- `warning-stale` text meets contrast on `{colors.warning-bg}`; do not rely on color alone — include explicit «устаревший каталог» wording.
- `button-primary`, `shopping-list-cta`, and `history-rating-row` controls have accessible names in Russian.
- No cook-along timers, cook-duration UI, or motion-dependent-only affordances.

## Key Flows

### UJ-1 — Weekday evening plan (Sergey, desktop web)

Sergey is the account holder and cook. Kids asleep; he needs one **Order** and one **Cook session** for the next few days.

1. Opens perek-planner in the browser → Sign-in (login / password) → lands on Create **Menu** / planning.
2. Create **Menu**: `day-length-picker` — selects 1–4 days (e.g., ○ 1 ○ 2 ● 3 ○ 4 дня) → `button-primary` «Сгенерировать». Store is already set in Settings (`store-picker`, default д. Алабино, 92) — not prompted again here.
3. If catalog sync failed or is stale, `warning-stale` appears («каталог устарел — планирование недоступно») — generate/continue Menu is blocked until fresh sync.
4. **Menu** + slot edit: AI suggestions fill breakfast / lunch / dinner per day — intentionally repeating simple home dishes/sides across days is normal (model C); long-idle dishes (~2+ weeks) may return, weighted by **Rating**; empty slots OK; he replaces slots via AI resuggest, records **Refusal**, adds **Snack**s, opens **Recipe** text from any name — edits slots before moving on.
5. **Portion plan**: `portion-plan-grid` — day × meal, 2 people × 3 meals; adjusts servings if needed.
6. **Shopping list** handoff: combined **Product** list including staples by default; he copies via `shopping-list-cta` and filters at Perekrestok order time.
7. Optionally opens Perekrestok store link → **exit app** to perekrestok.ru — purchase without in-app checkout.

**Climax:** He leaves with one trustworthy, copyable **Shopping list** he can paste or use — not a polished empty dashboard. (Wireframe: «★ Кульминация» / «Climax: уходит с надёжным копируемым Shopping list».)

**Failure / edge — stale catalog:** Sync failure or non-fresh catalog surfaces `warning-stale` on planning screens. **Menu planning is blocked** until a fresh sync succeeds; Settings remain available. No silent stale data. No fallback-after-planning flow — when planning is allowed, only **Recipes** with in-stock **Critical ingredient** **Product**s are suggested.

**Later (not UJ-1):** After cooking, Sergey **Rating**s past **Recipes** from History via `history-rating-row` — editable after submit; no forced post-cook screen.

### Out of v1 — UJ-2 reuse previous **Menu**

PRD mentions reopening a previous **Menu** as an optional draft (weeks later) → accept or edit slots → same **Shopping list** handoff. **Not in v1 UX surfaces.** Primary path remains new **Menu** with AI suggestions.

---

## Glossary

Terms verbatim from PRD (use in product vocabulary):

- **Menu** — eating plan («меню») for 1–4 days: chosen length, **Portion plan**, one **Cook session**, one **Order**; length capped by fridge-keep
- **Recipe** — dish with ingredients and required fridge-keep duration
- **Critical ingredient** — ingredient without which **Recipe** cannot be cooked; must have **Checked match** to **Product**
- **Product** — Perekrestok catalog item for selected store
- **Checked match** — system-selected **Critical ingredient** → **Product** link (one ingredient may have several **Product** variants)
- **In stock today** — **Product** or suitable analog available at selected store at planning time
- **Shopping list** — one combined list for **Menu**; always copyable; store link optional
- **Pantry item** — spices, sauces, or staples that gate **Recipe** eligibility; included on **Shopping list** by default in v1 — Sergey filters at Perekrestok order time
- **Portion plan** — servings by day and meal (breakfast / lunch / dinner)
- **Refusal** — **Recipe** rejected before cooking; shapes future suggestions
- **Rating** — after trying **Recipe** or **Snack**: like/dislike + reason (v1: too hard, not tasty, too long, other)
- **Snack** — no-cook item on **Menu**; same **Order**; can receive **Rating**
- **Order** — store purchase completed outside app using **Menu**'s **Shopping list** (and optional store link)
- **Cook session** — one batch cook covering **Menu** days (not separate cook per day); target ~2h total is a suggestion-quality heuristic only — no timer or duration UI in v1
