# Supabase Auth Rules

## Core Rule
Use the current Supabase pattern already installed in the repo.

Do not introduce deprecated helpers or a second auth architecture unless required.

## Required Behaviour
- Check `/lib/supabase.ts` before creating any new Supabase client.
- Keep authentication consistent across the app.
- Keep user-owned database access scoped by `auth.uid()`.
- Never allow public write access to private user data.
- Never expose service role keys to the browser.
- Never place secret keys in client components.

## Common Error

### `createRouteHandlerClient` does not exist
Likely cause:
An incompatible or deprecated Supabase helper is being imported.

Fix:
Use the Supabase SSR/client pattern already installed in this repo.

## Preferred Auth Safety Checklist
Before completing auth-related work:

- [ ] Does this route know the current user?
- [ ] Are queries filtered by user_id?
- [ ] Is RLS enabled?
- [ ] Are secrets server-side only?
- [ ] Does the client handle unauthenticated state safely?
