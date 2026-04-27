# Architecture Map

Last refreshed: 2026-04-27.

## Main Structure

| Area | Path | Purpose |
|---|---|---|
| App pages | `app/` | Next.js App Router pages and layouts |
| API routes | `app/api/` | Backend route handlers |
| Components | `components/` | Reusable UI grouped by product area |
| Shared logic | `lib/` | Supabase, admin, telemetry, AI/job helpers, feature flags, and utilities |
| SQL setup | `supabase/` | Migration-style SQL files and RLS policies |
| Codex docs | `docs/codex/` | Operating instructions and project memory |
| Public docs/assets | `public/` | Static assets and user-facing docs |
| TeamSync demo | `teamsync-demo/` | Demo configuration, prompts, script, and run packet |

## Product Modules

### Persona Foundry

Owns:
- Persona studio page under `app/persona-foundry`.
- Persona chat sandbox component and route.
- Persona/Gallup source helper route.

### Career Intelligence

Owns:
- Candidate and career pages under `app/career*`.
- Career components under `components/career/`.
- Career domain helpers under `lib/career*.ts`.
- Career generation, uploads, applications, live jobs, and premium autopilot routes under `app/api/career/`.

### TeamSync

Owns:
- TeamSync page and workspace client.
- TeamSync prompts and executive simulation helpers.
- TeamSync API routes under `app/api/teamsync/`.
- TeamSync demo framework under `teamsync-demo/`.

### Admin / Control Center

Owns:
- Admin/control pages under `app/admin`, `app/operations`, and `app/control-center`.
- Admin clients under `components/admin/`.
- Admin helpers in `lib/admin.ts`.
- Admin API routes under `app/api/admin/`.

## Shared Systems

- Supabase clients are split by runtime in `lib/supabase.ts` and `lib/supabase/*`.
- Auth checks use `lib/supabase/auth.ts`.
- Admin capability checks use `lib/admin.ts`.
- API/usage telemetry uses `lib/telemetry.ts`.
- Feature flags use `lib/featureFlags.ts`.

## Codex Rule

Prefer existing module boundaries over new abstractions. Add shared helpers only when more than one route/component needs the behavior or when the surrounding code already has a matching pattern.
