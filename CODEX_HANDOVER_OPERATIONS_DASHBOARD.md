# Codex Handover - Operations Dashboard Build

Date: 2026-04-24
Project: Personara.ai
Scope: Build the Operations dashboard system with strategy context, task workflow, and Codex action triggers.

## Handover Goal

Implement an `Admin > Operations` area that converts SaaS strategy into visible execution using:
- task states (`prioritise`, `actioned`, `complete`)
- section-based operations modules
- editable notes/links/content blocks
- per-task `Start with Codex` prompt workflow
- strategic context panel on every module

## Source Documents

1. [SAAS_SUCCESS_REPORT_PERSONARA_2026-04-24.md](C:/Users/johnf/OneDrive/Desktop/personafoundry/PersonaFoundry/SAAS_SUCCESS_REPORT_PERSONARA_2026-04-24.md)
2. [OPERATIONAL_MENU_CODEX_PLAYBOOK.md](C:/Users/johnf/OneDrive/Desktop/personafoundry/PersonaFoundry/OPERATIONAL_MENU_CODEX_PLAYBOOK.md)
3. [OPERATIONS_DASHBOARD_DETAILED_CODEX_SPEC.md](C:/Users/johnf/OneDrive/Desktop/personafoundry/PersonaFoundry/OPERATIONS_DASHBOARD_DETAILED_CODEX_SPEC.md)
4. [OPERATIONS_TASKS_SEED.json](C:/Users/johnf/OneDrive/Desktop/personafoundry/PersonaFoundry/OPERATIONS_TASKS_SEED.json)

## Implementation Order (Do Not Skip)

1. Create core models and APIs:
- `operations_items`
- `operations_item_notes`
- `operations_item_links`
- `operations_item_content_blocks`

2. Create `/admin/operations` home board:
- KPI strip
- Kanban lanes (`prioritise`, `actioned`, `complete`)
- filter/search
- task card actions

3. Add task detail view:
- `Context`, `Execution`, `Evidence` tabs
- notes, links, content blocks CRUD

4. Add `Start with Codex` flow:
- modal with prefilled prompt
- copy/open action
- status transition `prioritise -> actioned`

5. Build submenu pages:
- north-star-kpis
- funnel-control
- ai-quality-control
- retention-engine
- pricing-packaging
- gtm-pipeline
- reliability-cost
- compliance-trust
- experiment-lab
- weekly-rhythm

6. Add strategy context panels from spec section 10 to each submenu page.

7. Import `OPERATIONS_TASKS_SEED.json` and render as initial backlog.

## Non-Negotiable Acceptance Criteria

1. Every task supports:
- status change
- priority change
- notes
- links
- content blocks
- codex prompt action

2. Every submenu shows:
- strategic objective
- risk addressed
- primary KPI
- target threshold
- failure signal
- owner expectation

3. Validation rules enforced:
- `complete` blocked if DoD empty
- `P0` requires due date

4. Dashboard can answer in <5 minutes:
- top 3 blockers
- top KPI regressions
- owner and due date for each P0 item

## Suggested First Commit Plan

1. `feat(operations): add data models and CRUD APIs`
2. `feat(operations): add board UI with statuses and filters`
3. `feat(operations): add detail tabs context execution evidence`
4. `feat(operations): add codex action modal and state transition`
5. `feat(operations): add module pages with strategy context`
6. `feat(operations): add seed import for initial backlog`

## Codex Execution Prompt (Master)

`Implement the Operations dashboard system per OPERATIONS_DASHBOARD_DETAILED_CODEX_SPEC.md and OPERATIONS_TASKS_SEED.json. Build models, APIs, board UI, detail tabs (Context/Execution/Evidence), Codex action modal, module routes, and strategy context panels. Enforce status workflow and validations.`

