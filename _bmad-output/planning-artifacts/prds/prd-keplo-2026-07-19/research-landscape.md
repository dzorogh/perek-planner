# Landscape digest — AI meal-prep + live grocery catalog

(Facts only; research 2026-07-19)

## 1. Comparable products / categories

**Meal kits / ready rations (closed supply):** HelloFresh-style kits and RU players (Шефмаркет / Chefmarket, Elementaree = ready-to-cook kits; Grow Food / Performance Group = mostly ready-to-eat subscriptions). Position on time-saving, curated menus, portioned ingredients, door delivery — not on shopping a supermarket catalog. Market context: ~₽17B RU meal-kit/rations market 2024 ([ECOMHUB](https://ecomhub.ru/russia-meal-kits-ready-meals-market-2024-performance-group-grow-food-shefmarket/), [Chefmarket](https://chefmarket.ru/)).

**Meal planners + grocery lists (generic ingredients):** Paprika, Mealime, AnyList — recipes → aisle-sorted lists, merge quantities, share lists. Typically **do not** bind to a live local SKU catalog or guarantee cookability against store stock ([Paprika](https://www.paprikaapp.com/), [Mealime](https://www.mealime.com/), [AnyList](https://play.google.com/store/apps/details?id=com.purplecover.anylist)).

**AI meal planners:** Nouri, MealVibe, MealAI, Cora, Swoodie — personalized plans, macros, aisle lists; some add Instacart/Walmart handoff or **estimated** store prices. Catalog linkage is usually partner-marketplace or price estimate, not “this exact nearby store, verified before suggest” ([Nouri](https://getnouri.today/), [MealVibe](https://mealvibe.ai/), [MealAI](https://usemealai.com/), [Cora](https://apps.apple.com/us/app/cora-ai-meal-planner/id6756597503)).

**Retailer-owned planning (Russia):** retailer tool «ПП-Консьерж» — questionnaire → day-by-day ration + КБЖУ → add ingredients to the store cart for pickup/delivery ([foodretail.ru](https://foodretail.ru/), [food-helper.x5.ru](https://food-helper.x5.ru)). Store app also exposes availability checks and picker replacements ([Play Store listing](https://play.google.com/store/apps/details?id=ru.x5.retail)).

**Gap commonly left open:** planners produce *ingredient intent* and copyable lists; kits own the supply chain; retailer tools plan *inside* their commerce. Few independent products treat **batch cook plan (2–3 days) as executable only when ingredients match a live local catalog**, with explicit gating + fallbacks when match/stock fails.

## 2. Common failure modes (AI recipe + shopping list)

- **Ingredient → product matching:** free-form lines (“2 cups diced Roma tomatoes”) vs SKUs; modifiers, forms, pack sizes. Pure string match ~20% in one reported pipeline; production needed hybrid rules + embeddings ([Allspice/Pinecone case](https://theapplied.co/use-cases/how-allspice-improved-ingredient-matching-from-20-to-97-percent-with-pinecone), [SimDin/Devpost](https://devpost.com/software/simdin)).
- **Units & consolidation:** unsupported units break quantity mapping; aisle apps merge poorly without a canonical ingredient layer ([Instacart shopping-list API notes](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page); [Recipy pantry guide](https://recipyapp.com/guides/receipt-scanning-pantry)).
- **LLM hallucinations / unstructured output:** invented recipes, bad JSON; teams add validation or fall back to curated DBs ([SimDin](https://devpost.com/software/simdin); MealAI markets curated recipes vs free-gen).
- **Reasoning vs real-world state:** model plans ignore local stock; Instacart notes double-digit % of items unavailable locally; substitutions are core, not edge ([Tei.se / Instacart](https://tei.se/the-brownie-recipe-problem-why-llms-must-have-fine-grained-context-to-deliver-real-time-results/)).
- **Stale availability & brand ambiguity:** multiple SKUs for one ingredient; cart APIs that can add but not fully manage ([groceries-agent / Kroger](https://github.com/caseyWebb/groceries)).

## 3. Availability uncertainty / substitute / fallback UX patterns

Documented grocery patterns (Instacart docs/help):
- Per-item policy: **best match** / **specific replacement** / **refund (skip)**; saved for next orders.
- Suggestions from ML/catalog; shopper proposes → user **approve/reject** while shopping.
- Cart may **auto-remove** unavailable items; surface alternatives or continue with remainder.
- Multi-store / re-check for refunded OOS (delivery constraints).
- Partner shopping-list pages: name- or UPC-based match; if UPC missing/unavailable, user searches alternatives on the retailer surface ([Instacart replacements](https://docs.instacart.com/storefront/learn_about_your_storefront/cart_and_checkout/replacements), [help](https://www.instacart.com/help/section/360007902831/360039162252), [shopping list page](https://docs.instacart.com/developer_platform_api/guide/concepts/shopping_list/)).

Retailer fulfillment (e.g. the store app copy): picker offers a replacement when something runs out during assembly.

## 4. Flaky store API / checkout intentionally out-of-app

- **Handoff, not fulfillment:** generate shareable list/cart deep links; user picks store, reviews availability, checks out on retailer ([Instacart shopping list flow](https://docs.instacart.com/developer_platform_api/guide/concepts/shopping_list/)).
- **Name-based matching as soft contract:** without stable IDs, retailer re-resolves products; mismatches deferred to user review.
- **Cache list URLs; regenerate on content change** (API guidance).
- **Copyable aisle list** remains the reliable offline path when APIs fail (classic Mealime/Paprika/AnyList behavior).
- **Trust boundary:** planners that fill carts warn users to verify in the store app before pay (e.g. Kroger agent pattern).
- Latency/error handling dominates integration effort when chaining LLM + catalog services ([Instacart/Tei.se](https://tei.se/the-brownie-recipe-problem-why-llms-must-have-fine-grained-context-to-deliver-real-time-results/)).
