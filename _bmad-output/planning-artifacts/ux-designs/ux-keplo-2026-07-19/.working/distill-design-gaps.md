# Pass 1 — DESIGN.md token & component self-check

**Written:** 2026-07-19  
**Source spine:** `.memlog.md`, `extract-prd.md`, `extract-brief.md`, `direction-b-soft-workshop.html`, `color-themes-soft-workshop.html`

## Token coverage

| Token / area | Status | Notes |
|---|---|---|
| Lavender Workshop hexes (memlog) | ✅ | All 11 memlog colors in frontmatter `colors` |
| `empty-slot` #F8FAFC | ✅ | From direction B HTML comment |
| `slot-label` #94A3B8 | ✅ | From direction B HTML (meal-type labels) |
| `snacks-border` #C7D2FE | ✅ | From direction B HTML (dashed snacks bar) |
| `#F1F5F9` slot divider | ⚠️ inline only | Used in HTML; not promoted to named token — border-bottom on slot-card |
| Shadow rgba values | ✅ prose | Documented in Elevation; not YAML tokens (matches shadcn-delta pattern) |
| Dark mode | ✅ N/A | Explicitly out of scope; no dark tokens added |
| Typography fontFamily | ⚠️ gap | Mockups use system-ui; shadcn uses Geist Sans — **[NOTE FOR UX]** in DESIGN.md |
| Breakpoints / responsive | ⚠️ gap | Desktop-only decision in memlog; no mobile layout tokens |
| shadcn unlisted tokens | ✅ | Explicit inherit statement (card, destructive, input, ring, etc.) |

## Component coverage

| Component | Visual source | Gap |
|---|---|---|
| button-primary | direction B HTML | — |
| button-ghost | direction B HTML | — |
| pill-nav | direction B HTML | Undeclared destinations beyond UJ-1 steps |
| day-card | direction B HTML | — |
| slot-card / slot-card-empty | direction B HTML | — |
| slot-label | direction B HTML | — |
| warning-stale | direction B HTML + PRD | — |
| snacks-bar / snack-chip | direction B HTML | — |
| shopping-list-cta | color-themes HTML (Sage/Linen snippets) | **[NOTE FOR UX]** No direction B full-page mock; layout inferred from theme snippets only |
| history-rating-row | memlog decision (Option A) | **[NOTE FOR UX]** No visual mock — row anatomy, reason picker UI unspecified |
| sign-in surface | — | Not in visual artifacts |
| day-picker (1–4 days) | — | Not in visual artifacts |
| portion-plan view | — | Not in visual artifacts |
| store selection | memlog (yes, default Алабино 92) | **[NOTE FOR UX]** No visual treatment captured |
| pantry opt-in prompt | memlog (per-item prompt) | **[NOTE FOR UX]** No visual treatment captured |
| recipe-text view | memlog (available when cooking) | **[NOTE FOR UX]** No visual treatment captured |
| rating like/dislike controls | memlog | Icon vs text button not specified |

## Conflict / scope checks

| Rule | Applied |
|---|---|
| PRD wins on conflict | ✅ Stated once in Brand & Style |
| No invented product features | ✅ Components tied to memlog or HTML artifacts |
| Behavioral detail in EXPERIENCE.md | ✅ Cross-reference in Components section |
| Light only | ✅ |
| shadcn delta pattern | ✅ Follows design-example-shadcn.md structure |

## Open items for user / parent finalize

1. **Typography lock** — Geist Sans (shadcn default) vs system-ui stack from mockups?
2. **shopping-list-cta** — Confirm layout against Soft Workshop shell (only partial snippet exists).
3. **history-rating-row** — Row layout, reason selector pattern, history list vs detail.
4. **Missing screen mocks** — Sign-in, day picker, Portion plan, store selector, Pantry prompt, Recipe text view.
5. **Responsive** — Any tablet/narrow-desktop collapse rules needed before implementation?
6. **Logo / wordmark** — Text-only "keplo" in mockup; no logo asset decision.

## Pass 1 verdict

DESIGN.md is **draft-complete for captured visual decisions** (Soft Workshop + Lavender Workshop + Menu slot-edit shell). Gaps above are explicitly flagged; no invented fills for missing screens.
