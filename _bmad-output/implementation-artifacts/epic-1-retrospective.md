# Epic 1 Retrospective — Foundation & catalog

Status: done  
Date: 2026-07-20

## What went well

- Soft Workshop shell + auth gate landed early; planning surfaces share one composition.
- Catalog freshness fail-closed (AD-8) via `catalog_sync_runs`, not product timestamps.
- Python sync worker kept out of Next; secret key never `NEXT_PUBLIC_*`.

## What to improve

- Anon-only RLS smoke is weak; dual-operator isolation harness still deferred.
- Placeholder `stores.external_id` needs a real shop id for store-link quality.

## Action items

- [done] Keep append-only migrations and verify scripts per story.
- [open] Dual authenticated RLS harness when smoke credentials are standard.

## Next epic prep

Epic 2 needed Menu skeleton + matching before AI; store snapshot (AD-9) already available from Settings.
