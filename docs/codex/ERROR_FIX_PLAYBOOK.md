# Error Fix Playbook

## Error: `createRouteHandlerClient` does not exist
Likely cause:
Deprecated or incompatible Supabase helper.

Fix:
Use the current Supabase SSR/client pattern already installed in the repo.

## Error: API route returns non-JSON
Likely cause:
Route crashed, returned HTML, or returned raw text.

Fix:
Wrap all route logic in try/catch and return `NextResponse.json`.

## Error: `Module not found`
Likely cause:
Missing package or wrong import path.

Fix:
1. Check `package.json`.
2. Check existing imports.
3. Install package only if truly required.
4. Prefer existing utilities.

## Error: `Server action not found`
Likely cause:
Wrong route path or client calling old endpoint.

Fix:
Confirm route exists under:

```txt
/app/api/.../route.ts
```

Then update the client fetch path.

## Error: User data visible across users
Likely cause:
Missing RLS or missing `user_id` filter.

Fix:
Add RLS policy using:

```sql
auth.uid() = user_id
```

## Error: Build fails after editing a large page
Likely cause:
Missing brace, broken JSX, or accidental partial replacement.

Fix:
1. Inspect exact build line.
2. Fix only the syntax area.
3. Do not rewrite the full page unless requested.

## Error: Environment variable undefined
Likely cause:
Missing `.env.local` value or wrong variable name.

Fix:
Check the expected variable name. Do not invent a new one if the project already uses a different name.
