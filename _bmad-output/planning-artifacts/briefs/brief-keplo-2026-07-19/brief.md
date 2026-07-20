---
title: "Product Brief: keplo"
status: ready
created: 2026-07-19
updated: 2026-07-19
---

# Product Brief: keplo

## Executive Summary

keplo is a personal web app for preparing food in batches, not for cooking every day. About every two or three days you place one grocery order, cook once, put the food in the fridge, and eat from that batch so it is nearly finished by the end of the window — without a plan that collapses when the store is missing a key ingredient.

The account holder and cook is Sergey. Default planning covers **two people**, three meals a day (breakfast, lunch, dinner), over two or three days. He wants fewer shopping trips and cooking sessions, variety across weeks, and a record of recipes he rejected. For now the app supports only one store: **the store**, for the address д. Алабино, 92.

Recipes only count when their critical ingredients can be matched to products you can actually buy there. Spices and sauces are always checked (if the store does not carry them, the recipe is unsuitable), but they are added to the order only if you choose to include them. Artificial intelligence may propose recipes from the library or new ones, using cook history and refusals; a recipe may enter an order only after ingredient-to-product matches are checked.

You finish the purchase outside this app. A copyable shopping list is always available; a store link is added when a working link is available — never the only way to complete shopping. Availability is a useful but imperfect signal with a “last checked” time, not a guarantee. If a product for a critical ingredient disappears after a catalog refresh, the app must offer a fallback (another recipe and/or a substitute product) so the plan stays usable. “Finished evenly” means portions laid out by day and meal up front; the first version does not track leftovers.

## Success Criteria

- One order and one cook session cover a chosen two- or three-day window without daily cooking, with a clear portion plan by day and meal for two people by default.
- Plans stay executable against the store: unsuitable recipes are blocked; missing products trigger a fallback that still fits one cook and the same window; pantry items do not bloat the cart; a copyable list is always enough to buy outside the app.
- Early validation: after two real cycles of “order → cook once → eat from the fridge for several days,” shopping is not fully manual “by eye” in the store app again.

## The Problem

Deciding what to eat for the next few days costs a lot of attention. Recipes live in one place and the store assortment for your address lives in another, so plans break on “out of stock,” or the cart fills with pantry staples you already have. The real rhythm is not cooking every day — it is one shop, one cook, and a fridge that lasts about three days. Nothing today reliably closes that loop against a live local grocery catalog. The difference worth building is not an “AI chef” fantasy or a fake in-stock promise — it is plans that stay executable when the catalog is wrong or stale.

## The Solution

A web planner (Next.js, modern UI components, Supabase for data, auth, and cloud functions) for a meal-prep window — usually two or three days:

1. Choose the days on a calendar or timeline — the window when you will eat the batch.
2. Pick dishes for breakfast, lunch, and dinner as portions from food cooked once (servings configurable; default three meals for two people), plus diverse snacks that need no cooking but join the same order. Artificial intelligence suggests options using history and refusals; new recipes wait for checked product matches.
3. Keep only recipes whose critical ingredients map to the store products, that can stay in the fridge at least as long as the window, and that look available enough on the last check. Prefer cheaper analogs over ultra-expensive items without dropping below basic quality. Show price and nutrition only when the catalog provides those fields.
4. Build one combined shopping list (pantry optional), always copyable, with a store link when possible; show the portion plan by day and meal. If a key product is gone after a refresh, propose a workable alternative that preserves one cook for the same window.

Cooking help in the first version is recipe text plus the shopping list — not a step-by-step cook-along mode.

## Scope

**In the first version:** meal-prep window; configurable servings (default three meals per day for two people); artificial-intelligence recipe suggestions (library or new) guided by history and refusals, gated on checked ingredient-to-product matches; diverse no-cook snacks; local recipe and product databases; catalog sync; imperfect availability with timestamp plus fallback that preserves one cook; one combined cart; smarter price substitutes without ultra-cheap quality collapse; copyable list and link when possible; cost and nutrition when data exists; recipe plus list only; the store for Alabino, 92; thin “store catalog” boundary so another store can be added later; graceful work on a last-saved catalog if store access breaks; fast path to repeat a previous window or use a ready pack of checked recipes.

**Out of the first version:** checkout inside this app; guaranteed stock until delivery; multi-store marketplace in the interface; unchecked artificial-intelligence product matches driving the cart; cook-along timers; daily separate cooking; multiple households; leftover / eaten tracking; hard monthly budget caps; hard food exclusions as a required setup step (optional preference data later).

**Beyond the first version:** after the batch loop is proven for one store, the same store boundary can support another shop or richer recipe preferences.

## Risks and protections

The main way this product fails is not a missing feature — it is adding friction and failing once on a real cook, after which it stops getting used.

- Keep unchecked product matches out of the cart; prefer a small set of proven matches while new recipes wait in a review queue.
- Fallbacks must preserve one cook and the same day window.
- Offer repeat-last-window and ready packs so planning stays faster than opening the store app alone.
- Never depend only on a store link; the copyable list is the minimum success path.
- Cap the window by how many days dishes keep in the fridge; show portioning by day.
- If the store access breaks, use the last saved catalog with a clear stale warning and allow manual list edits.
- Judge the first version by real fridge cycles, not by clever matching or a second store.
