# Routing Map

Last refreshed: 2026-04-27.

## Important Rule

Before editing any route, inspect the existing route group and confirm there is not already a matching route. This app already has many domain-specific routes.

## App Pages

| Area | Routes |
|---|---|
| Home/product | `/`, `/about`, `/platform`, `/pricing`, `/plans`, `/contact`, `/help`, `/investors-partners` |
| Persona Foundry | `/persona-foundry` |
| Career Intelligence | `/career-intelligence`, `/career`, `/career/[id]`, `/career-test` |
| TeamSync | `/teamsync` |
| Community/resources | `/community`, `/community/success-wall`, `/resources`, `/resources/library/[id]` |
| Control/admin | `/admin`, `/operations`, `/control-center`, `/control-center/admin`, `/control-center/marketing-engine`, `/admin/codex-diagnostics` |

## API Route Groups

| Group | Purpose |
|---|---|
| `/app/api/admin/*` | Admin overview, jobs, users, security, tester notes, marketing engine, candidates, economics, and telemetry views |
| `/app/api/agent/*` | Experience agent sessions, messages, and feedback |
| `/app/api/analyze-profile` | File/profile extraction without OpenAI enrichment |
| `/app/api/analyze-profile-ai` | AI profile analysis |
| `/app/api/auth/*` | Role and provider status helpers |
| `/app/api/career/*` | Candidates, source documents, generated assets, applications, live jobs, autopilot, uploads, parsing, and generation routes |
| `/app/api/chat-sandbox` | Persona sandbox OpenAI comparison route |
| `/app/api/community/*` | Community posts, comments, votes, and moderation |
| `/app/api/contact` | Contact form endpoint |
| `/app/api/cron/*` | Scheduled/background career processing |
| `/app/api/persona/*` | Persona/Gallup source helpers |
| `/app/api/referrals` | Referral invite workflow |
| `/app/api/teamsync/*` | TeamSync workspace, simulation, conversation, resources, and sharing |
| `/app/api/tester-notes` | Tester feedback intake |
| `/app/api/user/*` | User progress state |

## Route Rules

- API routes must return `NextResponse.json`.
- Validate request bodies before calling Supabase or OpenAI.
- Keep OpenAI calls and service-role Supabase calls server-side.
- Scope user-owned Supabase queries by authenticated user unless an admin service-role route explicitly requires otherwise.
- For admin routes, reuse `getRequestAuth()` and `getAdminCapabilities()` patterns.
- For dynamic route params in Next 16, inspect the existing `context: { params: Promise<...> }` pattern before editing.

## Naming Preference

Use explicit domain route groups such as:

```txt
/app/api/career/generate-cover-letter/route.ts
/app/api/career/generate-interview-prep/route.ts
/app/api/teamsync/simulate/route.ts
/app/api/admin/jobs/overview/route.ts
```

Avoid new ambiguous routes like:

```txt
/app/api/analyze/route.ts
/app/api/generate/route.ts
/app/api/process/route.ts
```
