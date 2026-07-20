# Project Overview — keplo

**Generated:** 2026-07-20  
**Scan level:** exhaustive  
**Repository type:** monolith (single Next.js app)

## Purpose

**keplo** is a personal batch-cooking meal planner (Soft Workshop / Lavender Workshop UX). Operators plan multi-day menus, invent/assign cookable recipes via OpenRouter, add free-text snacks, rate/refuse dishes, and copy an ingredient shopping-list snapshot. There is **no live grocery-store catalog**.

## Executive Summary

| Item | Value |
|------|--------|
| Product name | keplo |
| Primary language | TypeScript |
| UI language | Russian |
| Architecture | BaaS-backed modular Next (App Router + domain modules + Supabase + OpenRouter) |
| Auth | Supabase email/password (single-operator v1; no public sign-up UI) |
| Deploy | Next on Dokploy → Supabase Cloud |

## Tech Stack Summary

| Category | Technology | Version |
|----------|------------|---------|
| Runtime | Node.js | ≥22 |
| Framework | Next.js (App Router) | 16.2.10 |
| UI | React + Tailwind + shadcn/ui | 19.2.7 / 4.3.3 / new-york |
| Backend data | Supabase Postgres + RLS | `@supabase/ssr` 0.12.3 |
| AI | OpenRouter (server-only) | configurable model |
| E2E | Playwright | ^1.57 |
| Logic/RLS checks | Node `.mjs` verify scripts | — |

## Repository Structure

Single cohesive app — not a monorepo of deployables:

- `app/` — routes & layouts
- `src/domain/` — menu, suggestions, shopping, history, recipes, settings, matching
- `src/components/` — Soft Workshop UI
- `src/lib/` — Supabase + OpenRouter clients
- `supabase/migrations/` — schema SoT
- `scripts/` + `e2e/` — verification

## Related Planning Artifacts

- `_bmad-output/project-context.md` — AI implementation rules
- `_bmad-output/planning-artifacts/` — PRD, UX, architecture spine, epics
- `_bmad-output/specs/spec-keplo/` — SPEC + glossary
- `_bmad-output/implementation-artifacts/` — stories & sprint status

## Documentation Index

See [index.md](./index.md) for the full navigation map.
