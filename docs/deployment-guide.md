# Deployment Guide — keplo

## Target Topology

| Piece | Host |
|-------|------|
| Next.js app | Dokploy (Node ≥22) |
| Auth + Postgres + RLS | Supabase Cloud |
| AI | OpenRouter (outbound from Next server) |

No catalog sync worker. No Supabase Edge Functions required for v1.

## Environment Variables

Documented in `.env.example`:

| Variable | Where | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Anon/publishable key |
| `OPENROUTER_API_KEY` | Server only | Never `NEXT_PUBLIC_*` |
| `OPENROUTER_MODEL` | Server optional | Default `openai/gpt-4o-mini:nitro` |
| `OPENROUTER_HTTP_REFERER` / `OPENROUTER_APP_TITLE` | Optional headers | Ranking |
| `KEPLO_DEV_BYPASS_AUTH` | **Never production** | Local shell inspection only |

Operator smoke credentials (`SMOKE_OPERATOR_*` / `E2E_OPERATOR_*`) are for local verify/e2e, not required at runtime for the app itself.

## Database

1. Apply all files in `supabase/migrations/` in timestamp order to the Supabase project  
2. Create the operator Auth user in the dashboard  
3. Confirm RLS via `npm run verify:rls` against that project when changing policies  

## App Deploy Checklist

1. Set env vars on Dokploy (no auth bypass)  
2. `npm run build` succeeds  
3. Confirm login → create menu (needs OpenRouter) → UJ-1 → shopping list copy  
4. Confirm OpenRouter key is server-scoped  

## CI / CD

No committed GitHub Actions pipeline observed in-repo. Verification is script-driven (`npm run verify`). Add CI by wrapping those scripts if desired.

## Security Notes

- Session cookies via `@supabase/ssr`; protect planning routes with `getUser()`  
- Shared recipe library is authenticated invent/write — do not expose service role to the browser  
- Bypass auth must remain production-inert (already coded)  
