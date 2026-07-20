# Distill — EXPERIENCE.md gaps

Generated: 2026-07-19. Items below are **not** resolved in memlog + extracts; need user or downstream DESIGN pass.

## Needs user decision

1. **History navigation placement** — History hosts Rating and replaces Recipe library, but primary nav order/label and default landing after sign-in are unspecified (Create Menu vs History).
2. **`store-picker` timing** — Confirm whether store is chosen once in settings, shown before each new Menu, or both; default д. Алабино, 92 is documented but entry point is not.
3. **`staple-add-prompt` batching** — Per-item modal is mandated; unclear whether multiple Pantry items prompt sequentially, in one summary step, or inline on Shopping list preview.
4. **Slot edit affordances** — Swap vs browse-in-history vs inline search for replacing a slot: wireframe shows AI suggestions + Refusal + Snacks but not the exact replace interaction.
5. **`recipe-text-panel` entry points** — “Anytime” is decided; which surfaces expose the control (icon on slot-card only vs global) is not specified.
6. **`history-rating-row` edit window** — Can Sergey change a Rating after submission, or is dislike permanent for v1 hard-suppress?

## Blocked on DESIGN.md (not user UX, but spine references)

7. **`DESIGN.md` tokens empty** — EXPERIENCE references `{colors.*}`, `{rounded.card}`, etc.; Lavender Workshop values live in memlog / `.working/color-themes-soft-workshop.html` but not yet written into DESIGN.md frontmatter.
8. **Typography / spacing tokens** — Soft Workshop direction chosen; concrete `{typography.*}` and `{spacing.*}` paths not populated.

## Engineering-owned (noted, not blocking UX spine)

9. Store-link transport format (deep link vs share URL) — addendum open question.
10. Cheaper **Product** variant preference aggressiveness — implementation, no v1 UI.

## Explicitly deferred / out of v1 (no gap — documented in spine)

- UJ-2 reuse previous Menu surface
- Pantry management screen
- Separate Recipe library
- Post-cook Rating interrupt
- Match-review UI, fallback-after-planning, ready packs, in-app list edit, stock badges, cook-along, dark mode
