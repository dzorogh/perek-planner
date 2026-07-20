# Project Documentation Index — keplo

**Type:** monolith · **Primary language:** TypeScript · **Architecture:** BaaS-backed modular Next  
**Generated:** 2026-07-20 · **Scan:** exhaustive · **Part:** app (web)

## Quick Reference

| Item | Value |
|------|--------|
| Tech stack | Next 16.2.10 · React 19.2.7 · Tailwind 4.3.3 · Supabase SSR · OpenRouter |
| Entry UI | `app/(authenticated)/` → `/history` |
| Session | `proxy.ts` → `@/lib/supabase/middleware` |
| Domain root | `src/domain/` |
| Schema SoT | `supabase/migrations/` |
| Dev URL | http://localhost:3100 |
| Agent rules | `_bmad-output/project-context.md` |

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [API Contracts](./api-contracts.md) (Server Actions + RSC)
- [Data Models](./data-models.md)
- [Scan state](./project-scan-report.json)

## Existing Documentation (planning / product)

- [README](../README.md)
- [Project Context (AI rules)](../_bmad-output/project-context.md)
- [PRD](../_bmad-output/planning-artifacts/prds/prd-keplo-2026-07-19/prd.md)
- [Architecture Spine](../_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md)
- [UX DESIGN](../_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md)
- [UX EXPERIENCE](../_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md)
- [Epics](../_bmad-output/planning-artifacts/epics.md)
- [SPEC](../_bmad-output/specs/spec-keplo/SPEC.md)
- [Glossary](../_bmad-output/specs/spec-keplo/glossary.md)
- [Sprint status](../_bmad-output/implementation-artifacts/sprint-status.yaml)
- [Implementation readiness](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-20.md)

## Getting Started

1. Read [development-guide.md](./development-guide.md) and [project-context.md](../_bmad-output/project-context.md)
2. Apply migrations; set `.env.local`; `npm run dev` on port **3100**
3. For feature work, start from [architecture.md](./architecture.md) + the relevant domain folder
4. For brownfield PRD / party analysis, use this `index.md` as the retrieval root

## Notable Gaps / Legacy

- `/plan/portions` redirects; `PortionPlanGrid` unused
- `verify-snack-pool-logic.mjs` not in `verify:logic` aggregate
- Playwright default baseURL 3000 vs app port 3100
- Architecture spine ER may still show dropped catalog entities — trust migrations + `src/`
