# TeamSync Simulation Demo Framework

This folder is a drop-in, config-driven framework for running TeamSync simulations in Codex.

## Goal
Run a realistic corporate simulation that uses Clifton/Gallup strengths reports as participant context and stays adaptable when your workflow changes.

## Structure
- `config/workflow.schema.json` - Workflow phases, decisions, and change points.
- `config/participants.json` - Team members + linked PDF sources.
- `config/scenario.json` - Corporate scenario settings and success criteria.
- `prompts/system.simulation.md` - Stable simulation system prompt.
- `prompts/scenario.corporate-change.md` - Common/relatable scenario module.
- `scripts/build-simulation-prompt.ps1` - Compiles config + prompts into one runnable prompt.
- `runs/` - Output folder for generated prompt packets.
- `docs/OPERATING-GUIDE.md` - How to run and adapt the demo.

## Quick start
1. Update participant strengths in `config/participants.json` as needed.
2. Tune workflow phases in `config/workflow.schema.json` when process changes.
3. Run:
   `powershell -ExecutionPolicy Bypass -File .\\teamsync-demo\\scripts\\build-simulation-prompt.ps1`
4. Paste the generated file from `teamsync-demo/runs/` into Codex and run your demo.

## Why this is future-proof
- Workflow logic is separated from prompt language.
- Scenario content is modular and replaceable.
- Participant inputs are source-linked and can be swapped without rewriting the system prompt.
