# Epic 2 Retrospective — Buyable Menu & AI

Status: done  
Date: 2026-07-20

## What went well

- Matching eligibility + CheckedMatch menu-scoped (AD-7) unblocked AI assign.
- OpenRouter server-only; hard-suppress Refusal/dislike in one suggestions module (AD-4).
- UJ-1 gate (`slot_edit_passed_at`) cleanly sequences Menu → Portions → List.

## What to improve

- Full-library candidate rebuild on every resuggest is fine for seed size; cache later.
- OpenRouter key must be present in `.env.local` for live generate smoke.

## Action items

- [done] Wire FR12 shortest fridge-keep in assign path.
- [done] Recipe/snack rating tables ready for Epic 4 write UI.
- [open] Paginate recipe/history queries when library grows.

## Next epic prep

Epic 3 consumes CheckedMatch + snacks; Portion plan servings column prepared at Menu create defaults.
