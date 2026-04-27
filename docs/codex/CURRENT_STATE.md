# Current State

Last refreshed: 2026-04-27.

## Active Workspace

- Repo path: `C:\Users\johnf\Desktop\personafoundry`
- Branch: `main`
- Package manager command on this machine: use `npm.cmd`, not bare `npm`, from PowerShell.
- Local Next build output is configured in `next.config.ts` as `.next-build/` unless running on Vercel.

## Current Build Focus

- Install and adopt the Codex Efficiency Layer from `personara_codex_efficiency_layer_full (1).zip`.
- Keep Codex project memory in `CODEX.md` and `docs/codex/`.
- Preserve current product behavior while improving agent reliability, route awareness, and build checks.

## Recent Local Changes In Progress

- Codex guide updates in `AGENTS.md`.
- Workspace path cleanup in `README.md` and `WORKSPACE_NOTE.md`.
- API usage telemetry fields in `lib/telemetry.ts` and `supabase/admin_telemetry.sql`.
- New Codex layer files under `docs/codex/`, `CODEX.md`, `lib/featureFlags.ts`, and `app/admin/codex-diagnostics/page.tsx`.

## Working Product Areas

- Persona Foundry: personality/studio page and chat sandbox.
- Career Intelligence: candidate profiles, uploads, generated assets, applications, live jobs, premium autopilot, and interview prep.
- TeamSync: workspace, simulation, resources, Slack share route, and demo packet in `teamsync-demo/`.
- Control Center/Admin: admin dashboard, operations jobs, marketing engine, security audit, user roles/access, tester notes, and telemetry surfaces.
- Community/resources/help/marketing pages: public product and content routes.

## Watch Areas

- Supabase auth helpers and admin capability checks are sensitive; use existing helpers.
- API routes should return `NextResponse.json` and keep OpenAI/service keys server-side.
- Generated folders (`.next-build/`, `.next-local/`, `tmp_*/`) must stay out of lint and source edits.
- Large client components exist in admin and career areas; make focused patches and avoid broad rewrites.
- `npm.cmd run lint` depends on generated folders being ignored by ESLint.

## Verification Baseline

- Required runtime check: `npm.cmd run build`.
- Codex health check after this layer: `npm.cmd run codex:health`.
- If build fails with `spawn EPERM` in the sandbox, rerun the same command with approval.

## Notes For Codex

- Read `CODEX.md` and the relevant files in `docs/codex/` before implementing.
- Inspect existing routes/components before adding new architecture.
- If unsure where to place shared behavior, prefer `lib/`; if UI is reusable, prefer `components/`; if server behavior is request/response, use `app/api/`.
