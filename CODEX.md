# Codex Instructions for Personara.ai

## Mission
You are working on Personara.ai, a strengths-based intelligence platform that builds AI around who people naturally are, not just what they type.

Personara.ai includes three primary modules:

1. Persona Foundry
   - Creates an AI personality tailored to a user's Gallup strengths and natural working style.

2. Career Intelligence
   - Turns Gallup strengths, CVs, LinkedIn profiles, and career evidence into credible executive positioning, career assets, interview guidance, and targeted job-search support.

3. TeamSync
   - Maps the interacting strengths of teams, families, couples, boards, and groups to create shared language, reduce friction, and improve performance.

## Core Rule
Before changing code, read:

1. `/docs/codex/PROJECT_OVERVIEW.md`
2. `/docs/codex/ARCHITECTURE_MAP.md`
3. `/docs/codex/ROUTING_MAP.md`
4. `/docs/codex/CURRENT_STATE.md`
5. `/docs/codex/KNOWN_PATTERNS.md`

## Default Behaviour
- Inspect existing files before creating new ones.
- Prefer small, modular changes.
- Preserve existing functionality.
- Reuse existing project patterns.
- Do not create duplicate architecture.
- Do not rewrite working modules unless explicitly instructed.
- Keep API keys server-side.
- Return JSON from API routes.
- Keep user data protected by Supabase RLS.
- Report all changed files at the end.

## Protected Areas
Do not modify these unless the task explicitly requires it:

- Supabase auth flows
- `/lib/supabase.ts`
- Existing working API routes
- Existing working UI pages
- Existing database schema
- Authentication callback routes
- Environment variable names
- Production deployment configuration

If a protected area must be changed:
1. Explain why.
2. Apply the smallest possible change.
3. Preserve existing logic.
4. Document the change.

## Debug Mode
When fixing errors:

1. Identify the root cause first.
2. Do not rewrite large files.
3. Apply the minimal safe fix.
4. Preserve existing behaviour.
5. Run build checks.
6. Report the exact file and line area changed.

## Task Size Rule
If a task is large:

1. Break it into phases.
2. Complete one phase fully before starting the next.
3. Do not partially implement multiple systems at once.
4. Leave clear TODO notes only when unavoidable.
5. Prefer a working narrow feature over a broken broad feature.

## Acceptance Standards
A task is complete only when:

- App builds successfully.
- No TypeScript errors are introduced.
- No broken imports are introduced.
- API routes return valid JSON.
- User data remains scoped to the authenticated user.
- Existing pages continue working.
- Changed files are listed.
- Manual testing steps are documented.

## Completion Summary Format
At the end of every Codex task, report:

1. Summary of what changed.
2. Files changed.
3. Build/test result.
4. Any risks or follow-up tasks.
