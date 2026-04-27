# Codex Prompt Pack for Personara.ai

## Install Prompt
Install and adopt the Codex Efficiency Layer.

Follow CODEX.md as operating instructions.
Read /docs/codex before making changes.
Preserve existing functionality.
Do not rewrite unrelated files.
Run build checks and report all changed files.

## Repo Inspection Prompt
Inspect the repo and update the Codex documentation files with real project information.

Update:
- /docs/codex/ROUTING_MAP.md
- /docs/codex/CURRENT_STATE.md
- /docs/codex/KNOWN_PATTERNS.md
- /docs/codex/DATABASE_SCHEMA.md

Do not change app functionality.

## Debug Prompt
Fix the current error using Debug Mode in CODEX.md.

Rules:
- Identify root cause first.
- Apply minimal fix.
- Do not rewrite large files.
- Preserve existing logic.
- Run build.
- Report changed files and risk.

## Feature Build Prompt
Use /docs/codex/CODEX_TASK_TEMPLATE.md to implement this feature.

Product area:
[Persona Foundry / Career Intelligence / TeamSync / Admin / Shared]

Goal:
[Paste goal]

Files to inspect first:
[Paste files]

Files allowed to edit:
[Paste files]

Files not to edit:
[Paste files]

Acceptance criteria:
[Paste acceptance criteria]

## Route Creation Prompt
Create a new API route using /docs/codex/API_ROUTE_PATTERNS.md.

Rules:
- Return NextResponse.json.
- Use try/catch.
- Validate input.
- Keep OpenAI calls server-side.
- Do not expose API keys.
- Match existing route style.
