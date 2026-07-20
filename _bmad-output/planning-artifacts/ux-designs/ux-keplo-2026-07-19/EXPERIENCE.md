---
name: keplo
status: final
sources:
  - {planning_artifacts}/prds/prd-keplo-2026-07-19/prd.md
  - {planning_artifacts}/prds/prd-keplo-2026-07-19/addendum.md
  - {planning_artifacts}/briefs/brief-keplo-2026-07-19/brief.md
  - {planning_artifacts}/briefs/brief-keplo-2026-07-19/addendum.md
updated: 2026-07-20
---

# keplo — Experience Spine

> Desktop web planner for one operator (Sergey). shadcn/ui on Next.js + Tailwind; `DESIGN.md` is the brand-layer delta (Soft Workshop + Lavender Workshop palette). UI copy in **Russian**. Light mode only in v1. **Spine wins on conflict** with `mockups/` and `wireframes/`.

→ Primary journey wireframe: [`wireframes/flow-uj1-2026-07-19.excalidraw`](wireframes/flow-uj1-2026-07-19.excalidraw)  
→ App chrome (header + wizard): [`mockups/mock-header-nav-w1-2026-07-20.html`](mockups/mock-header-nav-w1-2026-07-20.html)

## Foundation

Desktop web first. Single operator (Sergey); default plan feeds **two people**, three meals per day (breakfast, lunch, dinner). One **Menu** (1–4 days) maps to one **Cook session** and one **Order** via a always-**copyable Shopping list**; purchase completes outside the app at the store (no in-app checkout).

**Stack posture:** shadcn/ui defaults for structure and interaction; brand discipline is Soft Workshop — calm rounded surfaces, friendly workshop register, **meal-lane** Menu composition (meal rows × day columns). Visual tokens live in `DESIGN.md`; reference as `{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`.

**Scope boundaries (v1 UX):**
- Post sign-in landing: Create **Menu** / current planning — not an empty dashboard.
- **Chrome split (W1):** global header (brand **Keplo** + «Создать меню» + History + Settings + Logout) is separate from wizard stepper (`Новое меню · Меню · Список`). Stepper hidden outside plan surfaces.
- Slot edit after AI suggestions, before **Shopping list** — not a jump straight to the list. **Portion plan** is not a wizard step; people count is set on Create **Menu**.
- Slot replace: AI resuggest only — no separate Recipe library browse and no manual History pick in v1.
- AI generation reintroduces **Recipes** not cooked for ~2+ weeks, weighted by **Rating** (high more often, medium less); **Refusal**/dislike stay hard-suppressed.
- **History** of past **Menus** / **Recipes** is for review and **Rating** (not a forced post-cook interrupt); **Rating** editable after submit in v1.
- No Pantry management screen — **Pantry item**s / staples included on **Shopping list** by default; Sergey filters at store order time (no in-app opt-in prompt).
- **`store-picker`**: once in Settings; default д. Алабино, 92 — not required before every new **Menu**.
- **UJ-2** (reuse previous **Menu** as draft): out of v1 surfaces.
- No match-review UI, no fallback-after-planning flow, no ready packs, no in-app **Shopping list** edit as primary path, no stock-badge UI, no cook-along mode, no hover-only critical actions without keyboard path (⋯ overflow must be focusable).
- **Model C:** day × meal slot grid (eat view), presented as **meal lanes** (rows = meal type, columns = days). AI repeats simple home dishes/sides across days (~20% variety enough); no cook-once batch-component surface; no special “same as day N” grouping chrome. Unique fancy dish per day is an anti-pattern.
- **Cook ~2h heuristic:** guides AI suggestion quality and voice only. No cook timer UI, no hard duration filter control, no required cook-time field in v1 UI.

## Information Architecture

### Global vs plan chrome

| Layer | Where | Contents | Active-state rules |
|---|---|---|---|
| Global header | All authenticated surfaces | L3 mark + **Keplo** · CTA «Создать меню» · «История» · «Настройки» · «Выйти» | Highlight History / Settings when on those routes. Never highlight a plan step here. |
| Wizard bar (`pill-nav`) | Plan surfaces only | `Новое меню` → `Меню` → `Список` | Shown on Create **Menu**, slot edit, **Shopping list**. **Hidden** on History and Settings. **Shopping list** gated until slot-edit pass (UJ-1). |

→ [header + wizard chrome W1](mockups/mock-header-nav-w1-2026-07-20.html)

### Surfaces

| Surface | Reached from | Purpose |
|---|---|---|
| Sign-in | App open (unauthenticated) | Login + password; unauthenticated users cannot access **Menus** or personal history |
| Create **Menu** («Новое меню») | Post sign-in landing / «Создать меню» CTA / wizard step 0 | Setup form: days (1–4) + people count + meal types (incl. snacks) → «Сгенерировать». First wizard step — label is **«Новое меню»**, not «Дни». |
| **Menu** + slot edit | After generation / wizard step | Model C eat view as **meal lanes** (meal type × day). Edit slots; AI may repeat simple home dishes/sides across days — no batch-component layer, no always-visible per-slot CTA row. Empty slots OK; **Refusal** / replace / replace-all via `slot-overflow`; **Snack**s as a **Перекус** lane when planned; slot replace via AI resuggest → [mock](mockups/mock-menu-edit.html) |
| **Shopping list** handoff | Continue from slot edit (UJ-1 gate) / wizard step | One combined list (includes staples by default); `shopping-list-cta` copy; optional store link; price/nutrition only when catalog provides. Servings driven by people count from Create **Menu**. |
| Settings | Global header | `store-picker`: concrete store; v1 default д. Алабино, 92 — set once, not before each **Menu** |
| History | Global header | Past **Menus** / **Recipes**; hosts `history-rating-row` (like/dislike + reason, editable after submit); feeds AI recency/Rating weights — not a manual slot-pick UI. **No wizard bar.** |
| **Recipe text** | Any **Recipe** name (Menu, History, **Shopping list**) | `recipe-text-panel`: read **Recipe** while shopping or cooking — not cook-along |

Modal depth: one level (e.g., `recipe-text-panel` as **Dialog**). No drawer-based Pantry layer.

**Out of v1 IA / chrome:** UJ-2 reuse surface, Pantry screen, Recipe library browse, post-cook Rating interrupt, per-item staple opt-in, batch-component layer, cook timer / duration UI, **Portion plan as a wizard step** (people count lives on Create **Menu**; no «Порции» pill).

→ Visual references: [header W1](mockups/mock-header-nav-w1-2026-07-20.html), [direction B shell](mockups/direction-b-soft-workshop.html) *(shell chrome superseded by W1)*, [UJ-1 wireframe](wireframes/flow-uj1-2026-07-19.excalidraw), key-screen mocks in `mockups/`.

## Voice and Tone

Microcopy in **Russian**. Practical, calm, workshop register — dense but friendly; no marketing hero, no streaks, no fake stock promises. Voice reflects **home food, not restaurant**: batch cooking simplicity, repeatable sides, one **Cook session** for the **Menu** — not chef's-table variety or daily novelty as the default success story.

| Do | Don't |
|---|---|
| «Меню на 3 дня» | «Давайте спланируем ваши идеальные приёмы пищи! 🍳» |
| «Список скопирован.» | «✓ Список успешно скопирован в буфер обмена» |
| «Каталог устарел — планирование недоступно, пока не обновится.» | «Ошибка синхронизации» (без контекста); «план строится по последнему сохранённому» |
| «Список включает специи и соусы — отфильтруйте в магазине.» (staples on list by default) | «Добавить {Pantry item} в список?» per-item prompt; отдельный экран «Кладовая» |
| Treat repeating a side across days as normal batch planning | Celebrate per-day unique dishes, "новинка дня", or restaurant-style variety as the default win |
| Frame suggestions as simple home cooking for one batch session | Imply Sergey needs a unique restaurant-quality dish every day |
| Name **Product**s on the **Shopping list**, not match jargon | «Checked match», «Critical ingredient» in shopper-facing list rows |

Use glossary terms verbatim in product vocabulary (see Glossary). Chat-facing docs may stay English; UI labels Russian where natural («меню» for **Menu**).

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md` components map and shadcn defaults.

| Component | Use | Behavioral rules |
|---|---|---|
| `button-create` | Global header | «Создать меню» — navigates to Create **Menu** (wizard step 0). Not a plan-step pill. → [chrome](mockups/mock-header-nav-w1-2026-07-20.html) |
| `button-primary` | Primary actions (`Сгенерировать`, `К списку`, `Копировать список`) | One primary per screen region. Uses `{colors.primary}` / `{colors.primary-foreground}`. Disabled while generation or copy in flight. |
| `wizard-bar` / `pill-nav` | Plan surfaces | Steps `Новое меню · Меню · Список`. Hidden on History / Settings. List step blocked until slot-edit pass. → [chrome](mockups/mock-header-nav-w1-2026-07-20.html) |
| `day-length-picker` | Create **Menu** | Radio or segmented control: 1–4 days. Part of richer setup with people count + meal types — not the sole control on the step. Suggestion pass biased to simple home food and batch repetition (model C). → [mock](mockups/mock-create-menu.html) |
| `people-count-picker` | Create **Menu** | Servings-per-meal people count (drives **Shopping list** quantities). Set here — not via a separate Portion-plan wizard step. |
| `meal-types-picker` | Create **Menu** | Which meal slots (and snacks) to plan. Completes the «Новое меню» form alongside days and people. |
| `meal-lane` / `slot-cell` | **Menu** + slot edit | Meal-type row with one `slot-cell` per day (model C — eat view only; no parallel batch-component surface). Dish name is the visual hero; AI may assign the same simple home dish across days — repetition is success, not a UI warning or “same as” badge. → [mock](mockups/mock-menu-edit.html) |
| `slot-overflow` | **Menu** + slot edit | Equal-weight actions behind ⋯: «Заменить», «Заменить все», «Никогда не предлагать» (**Refusal**). No always-visible multi-button row on each cell. Trigger always keyboard-focusable (not hover-only). AI resuggest only — no manual History pick. **Recipe** name (not ⋯) opens `recipe-text-panel`. Empty slots allowed. |
| `warning-stale` | Planning surfaces (Create **Menu**, slot edit, **Shopping list**) | Inline banner when catalog sync failed or non-fresh; `{colors.warning-bg}`, `{colors.warning-fg}`, `{colors.warning-border}`. **Menu planning actions blocked** until fresh sync — explicit stale warning required. |
| `shopping-list-cta` | **Shopping list** handoff | Always-available copy action. List may include staples by default — no in-app opt-in. Optional secondary: open store link when available — must not be the only purchase path. → [mock](mockups/mock-shopping-list.html) |
| `store-picker` | Settings | Concrete store list / selector; default д. Алабино, 92. Set once in Settings — not shown before each new **Menu**. No free-text address. |
| `recipe-text-panel` | Global read aid | **Dialog** or side panel: full **Recipe** text. Opens from any **Recipe** name on **Menu**, **History**, or **Shopping list** — anytime, not cook-along. |
| `history-rating-row` | History | Each past **Recipe** / **Snack**: like/dislike + reason (too hard, not tasty, too long, other). Editable after submit in v1. Dislike hard-suppresses future suggestions in v1. No forced post-cook screen. → [mock](mockups/mock-history-rating.html) |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Unauthenticated | App | Sign-in only; no **Menu** or History preview. |
| Cold load | Any authenticated surface | shadcn `Skeleton` matching meal-lane grid (or surface layout); resolves on data. |
| Generating **Menu** | Create **Menu** → slot edit | `button-primary` loading; disable Create **Menu** pickers until suggestions arrive or error. |
| Empty slot | **Menu** + slot edit | `slot-cell` empty state on `{colors.empty-slot}`; still valid to proceed. |
| Slot menu open | **Menu** + slot edit | One `slot-overflow` menu open at a time; Esc closes menu without discarding **Menu**. |
| Stale catalog | Create **Menu**, slot edit, **Shopping list** | `warning-stale` persistent until fresh sync; generate/continue Menu actions blocked; Settings remain available. |
| Off-plan surface | History, Settings | Wizard bar hidden; global header only — no plan-step active state. |
| **Refusal** recorded | Slot edit | Remove or mark **Recipe**; hard-suppressed from future suggestions in v1. |
| Copy success | **Shopping list** | Brief confirmation («Список скопирован.»); list remains visible. |
| Store link unavailable | **Shopping list** | Copy path unchanged; link control hidden or disabled with plain explanation — not an error wall. |
| No History | History | Empty state routing to Create **Menu** — not a Recipe library browse. |
| Rating pending | History | Row shows rate affordance; no interrupt after cooking. |
| Rating submitted | History | `history-rating-row` remains editable — user can change like/dislike or reason after submit in v1. |

## Interaction Primitives

**Desktop-first.** Mouse primary; keyboard adequate for v1 (see Accessibility Floor). No mobile layout requirement in v1.

- **Linear UJ-1 spine:** Sign-in → Create **Menu** (`Новое меню`: days + people + meal types) → slot edit (`Меню`) → `shopping-list-cta` (`Список`) → external store (exit app).
- **Chrome:** Global header always; wizard bar only on the three plan steps above.
- **Slot edit gate:** User must pass through slot edit after AI suggestions; cannot skip directly to **Shopping list**.
- **Slot replace / refuse:** Via `slot-overflow` (⋯) only — AI resuggest, replace-all, **Refusal**; no Recipe library search, no manual History pick; no persistent CTA row on each cell.
- **Recipe text:** Any **Recipe** name on **Menu**, **History**, or **Shopping list** opens `recipe-text-panel`.
- **Esc:** Close `slot-overflow`, `recipe-text-panel`, and other modals; does not discard saved **Menu** state.
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

1. Opens keplo in the browser → Sign-in (login / password) → lands on Create **Menu** / planning. Global header shows **Keplo** + «Создать меню»; wizard bar shows step **«Новое меню»**.
2. Create **Menu**: sets days (1–4), people count, and meal types → `button-primary` «Сгенерировать». Store is already set in Settings (`store-picker`, default д. Алабино, 92) — not prompted again here.
3. If catalog sync failed or is stale, `warning-stale` appears («каталог устарел — планирование недоступно») — generate/continue Menu is blocked until fresh sync.
4. **Menu** + slot edit: wizard advances to **«Меню»**. Meal lanes show suggestions — intentionally repeating simple home dishes/sides across days is normal (model C); long-idle dishes (~2+ weeks) may return, weighted by **Rating**; empty slots OK; he opens ⋯ to replace / replace-all / **Refusal**, opens **Recipe** text from any name — edits slots before moving on.
5. **Shopping list** handoff: wizard step **«Список»** (after UJ-1 gate). Combined **Product** list including staples by default; quantities reflect people count from Create **Menu**; he copies via `shopping-list-cta` and filters at store order time.
6. Optionally opens store link → **exit app** to the store website — purchase without in-app checkout.

**Off-path:** From History he rates past **Recipes** — wizard bar is absent; returning via «Создать меню» starts a new plan without a false «Новое меню» active state left over from History.

**Climax:** He leaves with one trustworthy, copyable **Shopping list** he can paste or use — not a polished empty dashboard. (Wireframe: «★ Кульминация» / «Climax: уходит с надёжным копируемым Shopping list».)

**Failure / edge — stale catalog:** Sync failure or non-fresh catalog surfaces `warning-stale` on planning screens. **Menu planning is blocked** until a fresh sync succeeds; Settings remain available. No silent stale data. No fallback-after-planning flow — when planning is allowed, only **Recipes** with in-stock **Critical ingredient** **Product**s are suggested.

**Later (not UJ-1):** After cooking, Sergey **Rating**s past **Recipes** from History via `history-rating-row` — editable after submit; no forced post-cook screen.

### Out of v1 — UJ-2 reuse previous **Menu**

PRD mentions reopening a previous **Menu** as an optional draft (weeks later) → accept or edit slots → same **Shopping list** handoff. **Not in v1 UX surfaces.** Primary path remains new **Menu** with AI suggestions.

---

## Glossary

Terms verbatim from PRD (use in product vocabulary):

- **Menu** — eating plan («меню») for 1–4 days: chosen length, people count (at create), one **Cook session**, one **Order**; length capped by fridge-keep
- **Recipe** — dish with ingredients and required fridge-keep duration
- **Critical ingredient** — ingredient without which **Recipe** cannot be cooked; must have **Checked match** to **Product**
- **Product** — store catalog item for selected store
- **Checked match** — system-selected **Critical ingredient** → **Product** link (one ingredient may have several **Product** variants)
- **In stock today** — **Product** or suitable analog available at selected store at planning time
- **Shopping list** — one combined list for **Menu**; always copyable; store link optional
- **Pantry item** — spices, sauces, or staples that gate **Recipe** eligibility; included on **Shopping list** by default in v1 — Sergey filters at store order time
- **Portion plan** — (legacy term) per-meal servings; **not a v1 wizard step** — people count on Create **Menu** drives list quantities
- **Refusal** — **Recipe** rejected before cooking; shapes future suggestions
- **Rating** — after trying **Recipe** or **Snack**: like/dislike + reason (v1: too hard, not tasty, too long, other)
- **Snack** — no-cook item on **Menu**; same **Order**; can receive **Rating**
- **Order** — store purchase completed outside app using **Menu**'s **Shopping list** (and optional store link)
- **Cook session** — one batch cook covering **Menu** days (not separate cook per day); target ~2h total is a suggestion-quality heuristic only — no timer or duration UI in v1
