# Persona Foundry Agent Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16.2.2 with Turbopack. APIs, conventions, and generated types may differ from older Next.js knowledge. Before touching framework-sensitive code, check the local guides in `node_modules/next/dist/docs/` and pay attention to deprecation notices.
<!-- END:nextjs-agent-rules -->

## Canonical Workspace

- Active repo: `C:\Users\johnf\Desktop\personafoundry`
- If another doc mentions a stale or nested `PersonaFoundry` path, verify the real working directory with `Get-Location` before acting.
- Do not edit generated build output or local scratch folders: `.next-build/`, `.next-local/`, `tmp_*/`, `node_modules/`, `*.tsbuildinfo`, or generated `.docx` files unless the user explicitly asks.

## Stack And Commands

- App framework: Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS 4.
- Data/backend: Supabase SQL migrations and route helpers under `lib/supabase/`.
- AI integrations: OpenAI calls live in API routes under `app/api/` plus selected helpers in `lib/`.
- On Windows PowerShell, prefer `npm.cmd` because `npm.ps1` may be blocked by execution policy.

Common checks:

```powershell
npm.cmd run build
npm.cmd run lint
git status --short --branch
```

Local builds use `next.config.ts` to write to `.next-build/` outside Vercel. If a Codex sandbox build fails with `spawn EPERM`, rerun the same command with approval rather than changing code to work around the sandbox.

## Repo Map

- `CODEX.md`: Codex operating rules for this repo; read it before implementation work.
- `docs/codex/`: Codex project memory, route maps, patterns, release checks, and task templates.
- `app/`: App Router pages, layouts, route handlers, and middleware-facing surfaces.
- `components/`: Client and shared UI components grouped by product area.
- `lib/`: Shared domain logic, Supabase clients, telemetry, AI/job helpers, and data utilities.
- `supabase/`: SQL schema and migration-style setup files.
- `public/docs/`: User-facing markdown resources served by the app.
- `teamsync-demo/`: Demo prompt framework and TeamSync operating docs.
- `CODEX_ONE_STEP_INSTRUCTION_PACK.md`: Current broad AI/telemetry implementation plan.
- `PRODUCT_ROADMAP.md`, `TODO.md`, and `WORKSPACE_NOTE.md`: Planning context; read only the relevant sections.

## Editing Guidance For Codex

- Keep changes scoped to the user request and preserve existing product behavior unless the request says otherwise.
- Read nearby code first and follow local patterns for route handlers, Supabase access, telemetry logging, and component styling.
- Avoid broad refactors, dependency changes, file deletion, or git history operations without explicit user approval.
- Treat `.env*` files as sensitive. Do not print secrets or add them to docs.
- If the working tree is dirty, assume existing edits belong to the user or a prior agent. Work around them; do not revert them unless asked.
- When changing SQL and TypeScript together, keep nullable/backward-compatible fields unless the migration plan explicitly allows a breaking change.

## Verification Norms

- For runtime TypeScript or Next.js changes, run `npm.cmd run build`.
- For lint-sensitive edits, run `npm.cmd run lint` when practical and fix only issues in touched files.
- For documentation-only edits, a build is optional unless the user requested it.
- Report changed files, verification result, and any residual risk at the end.
