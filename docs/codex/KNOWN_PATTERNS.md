# Known Working Patterns

Last refreshed: 2026-04-27.

## API Route Pattern

Use `NextResponse.json`, validate input early, and keep response shapes clear.

```ts
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    return NextResponse.json({
      success: true,
      data: body,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

## Auth And Admin Pattern

- Request auth helper: `getRequestAuth()` from `lib/supabase/auth.ts`.
- Admin capability helper: `getAdminCapabilities()` from `lib/admin.ts`.
- Server component Supabase helper: `createClient()` from `lib/supabase/server.ts`.
- Route/client Supabase helpers are split by runtime; do not duplicate clients.

## Feature Flag Pattern

```ts
import { isFeatureEnabled } from "@/lib/featureFlags"

if (!isFeatureEnabled("teamSync")) {
  return null
}
```

## AI Server Route Pattern

- Validate request body and authenticated user first.
- Fetch user-owned context through Supabase with `user_id` or candidate ownership checks.
- Build prompts server-side.
- Call OpenAI server-side only.
- Return structured JSON and log usage through `logApiUsage()` where the route already uses telemetry.

## UI Pattern

- Keep public product pages in `app/`.
- Keep reusable client UI in `components/`.
- Use Tailwind classes already present in nearby files.
- Internal diagnostic/admin surfaces should not display raw secrets or sensitive user data.

## SQL Pattern

- Keep migration-style SQL in `supabase/*.sql`.
- Prefer nullable/backward-compatible columns for telemetry and admin reporting expansions.
- User-owned tables should use RLS and `auth.uid() = user_id` policies unless the table is intentionally admin/service-role only.

## Codex Rule

When a working pattern exists, copy it instead of inventing a parallel system.
