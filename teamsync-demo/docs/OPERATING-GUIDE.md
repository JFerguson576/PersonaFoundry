# Operating Guide

## What this gives you
A reusable TeamSync demo framework that can be dropped into Codex and adjusted without rewriting everything.

## Demo flow (recommended)
1. Add strengths summaries from each PDF into `config/participants.json`.
2. Confirm or edit `config/workflow.json` for your current process.
3. Confirm scenario context in `config/scenario.json`.
4. Build the final prompt packet:
   `powershell -ExecutionPolicy Bypass -File .\\teamsync-demo\\scripts\\build-simulation-prompt.ps1`
5. Open the generated file in `teamsync-demo/runs/` and paste into Codex.

## How to adapt when workflow changes
- Add, remove, or reorder phases in `config/workflow.json`.
- Update decision gate conditions and branch actions.
- Keep prompt files stable unless your simulation style changes.

## How to adapt industries
- Duplicate `prompts/scenario.corporate-change.md` into a new scenario file.
- Swap `industry`, `constraints`, and `successCriteria` in `config/scenario.json`.

## Suggested governance
- Version your workflow using `workflowVersion`.
- Maintain a changelog entry whenever phase logic changes.
- Keep participant summaries concise and behavior-focused.

## Optional enhancement
If you want full automation, add a PDF parsing script later to prefill top strengths into `participants.json`.
