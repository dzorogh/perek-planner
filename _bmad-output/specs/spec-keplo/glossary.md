# Glossary — keplo

Domain vocabulary. English ids in code and product vocabulary; Russian UI labels where natural («меню» for Menu). Shopper-facing list rows name Products, not match jargon.

| Term | Definition |
| --- | --- |
| **Menu** | Eating plan («меню») for 1–4 days: chosen length, Portion plan, one Cook session, one Order. Length capped by fridge-keep among selected Recipes. |
| **Recipe** | Dish with ingredients and a required fridge-keep duration. |
| **Critical ingredient** | Ingredient without which the Recipe cannot be cooked; must have a Checked match to a Product. |
| **Product** | the store catalog item for the selected store. |
| **Checked match** | System-selected Critical ingredient → Product link (one ingredient may have several Product variants). Sergey reviews resulting Products on the Shopping list, not by confirming each match. |
| **In stock today** | Product (or suitable analog) available at the selected store at planning time. |
| **Shopping list** | One combined list for the Menu; always copyable; store link optional. |
| **Pantry item** | Spices, sauces, or staples that gate Recipe eligibility. In v1 they appear on the Shopping list by default; Sergey filters at store order time. |
| **Portion plan** | Servings laid out by day and meal (breakfast / lunch / dinner). |
| **Refusal** | Recipe rejected before cooking; hard-suppresses future suggestions in v1. |
| **Rating** | After trying a Recipe or Snack: like/dislike plus reason (v1: too hard, not tasty, too long, other). Dislike hard-suppresses re-suggestion in v1. Editable after submit in v1. |
| **Snack** | No-cook item on the Menu that joins the same Order; can receive a Rating. |
| **Order** | Store purchase completed outside the app using the Menu’s Shopping list (and optional store link). |
| **Cook session** | One batch cook covering the Menu days (not a separate cook per day). ~2h total is a suggestion-quality heuristic only — no timer or duration UI in v1. |
| **History** | Past Menus / Recipes surface; hosts Rating and slot-replace picks. Replaces a separate Recipe library browse in v1. |
| **Model C** | Day × meal slot grid (eat view). AI may repeat simple home dishes/sides across days; no cook-once batch-component surface. |
