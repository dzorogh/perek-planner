# Addendum — perek-planner PRD

Technical and deferred detail that must not clutter the PRD spine. Companion to `prd.md` (status: final, 2026-07-19).

## Stack (from product brief; not PRD requirements)

- Next.js web app, modern UI components
- Supabase for data, auth, and cloud functions

## Store integration

- v1 chain: Perekrestok; Sergey selects a concrete store
- No public consumer checkout API expected; purchase completes on the retailer site
- Keep a thin **store adapter** boundary so another chain can be added later without rewriting Menu/Recipe logic
- Unofficial catalog access may be used for personal catalog/prices; not for guaranteed stock or in-app ordering
- Store link format (deep link / share URL / other) TBD at implementation; copyable list remains sufficient

## Matching

- System selects Product variants per Critical ingredient (multiple allowed)
- At planning time, at least one in-stock variant required or Recipe is not suggested
- No human match-review UI in v1; Sergey steers via Refusal, Rating, and store-cart edits
- Cheaper-analog preference: **medium** aggressiveness (clear price gap → prefer cheaper suitable Product; not always absolute cheapest)
- Pantry/staples appear on Shopping list by default in v1; Sergey filters at store
