# Epic 3 Retrospective — Portion plan & Shopping list

Status: done  
Date: 2026-07-20

## What went well

- AD-11 snapshot regenerate-on-view keeps list simple; no in-app cart editing.
- Copy always available; store link optional and never blocks handoff.
- Price shown only when `price_cents` present — no fabricated nutrition.

## What to improve

- Servings persist for cook plan; product-identity list does not yet scale line quantities from servings.
- Nutrition awaits catalog fields.

## Action items

- [done] Shopping list RLS + copy logic verify scripts.
- [open] Quantity scaling from servings if Critical ingredients gain amounts.

## Next epic prep

History/ratings/recipe text can hang off existing Menu + recipe_ratings tables.
