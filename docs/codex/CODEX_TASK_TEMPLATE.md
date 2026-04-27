# Codex Task Template

Use this template for every major task.

## Task Name
[Short feature or fix name]

## Goal
[What this task must achieve]

## Product Area
[Persona Foundry / Career Intelligence / TeamSync / Admin / Shared]

## Files Codex Should Inspect First
- `/CODEX.md`
- `/docs/codex/PROJECT_OVERVIEW.md`
- `/docs/codex/ARCHITECTURE_MAP.md`
- `/docs/codex/ROUTING_MAP.md`
- `/docs/codex/CURRENT_STATE.md`
- Relevant existing files

## Files Codex May Edit
[List exact files]

## Files Codex Must Not Edit
[List protected files]

## Required Behaviour
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## Acceptance Criteria
- [ ] App builds successfully
- [ ] No TypeScript errors
- [ ] No broken imports
- [ ] No duplicate routes
- [ ] No exposed API keys
- [ ] API routes return valid JSON
- [ ] Supabase access remains user-scoped
- [ ] UI works on mobile
- [ ] Changed files are listed
- [ ] Manual test steps are documented

## Testing Steps
1. Run `npm install`
2. Run `npm run build`
3. Run `npm run dev`
4. Test affected route/page manually

## Completion Report Required
Codex must report:
- Summary
- Files changed
- Tests run
- Risks
- Follow-up tasks
