# TeamSync Jira Backlog (Token-Optimized)
Date: 2026-04-24

## 1) Global Rules (Reference Once)
- Project key: TS
- Shared Definition of Done (DoD): `TS-DOD-001`
- Shared Non-Functional Requirements (NFR): `TS-NFR-001`
- Shared Prompt/AI Guardrails: `TS-AI-001`
- Shared Security/RLS Policy: `TS-SEC-001`

Use ticket references instead of repeating requirements.

## 2) Reusable Ticket Template (Use for all stories)
- Summary: `<module> <capability> <outcome>`
- Description: 2-4 lines max
- In Scope: 3-6 bullets
- Out of Scope: 1-3 bullets
- Acceptance Criteria: max 5 bullets
- Dependencies: ticket IDs only
- Notes: links only

## 3) Shared Tickets

### TS-DOD-001 (Task)
Definition of Done baseline for all TS tickets.
Acceptance Criteria:
1. Feature works end-to-end in target environment.
2. Explainability included (assumptions + confidence).
3. Evidence log event written.
4. RBAC/RLS checks pass.
5. Monitoring and error handling present.

### TS-NFR-001 (Task)
Performance/security/observability baseline.
Acceptance Criteria:
1. API p95 < agreed threshold.
2. Retry and timeout policy implemented.
3. Structured logs and trace IDs emitted.
4. Input validation and schema checks enforced.

### TS-AI-001 (Task)
AI output safety and schema guardrails.
Acceptance Criteria:
1. Strict JSON schema validation for all AI outputs.
2. No deterministic claims without confidence bands.
3. Prompt contracts stored in versioned files.
4. Failed schema outputs are rejected and retried.

### TS-SEC-001 (Task)
Security and tenancy baseline.
Acceptance Criteria:
1. Role matrix implemented (`org_admin`, `board_viewer`, `exec_user`, `practitioner`).
2. RLS policy tests pass for all core tables.
3. Export actions auditable.
4. Sensitive fields masked per role.

## 4) Epics and Stories

## EPIC TS-100: Foundation Schema + Ingestion
Goal: Canonical data model and reliable ingestion pipeline.

### TS-101 (Story)
Create canonical TeamSync tables and indexes.
Dependencies: TS-SEC-001
Acceptance Criteria:
1. Core tables created (`orgs`, `people`, `engagement_metrics`, `scenarios`, `scenario_runs`, `twin_snapshots`, `recommended_actions`, `evidence_log`).
2. Required indexes and FK constraints in place.
3. Migration scripts idempotent.

### TS-102 (Story)
Build ingestion API (`/api/teamsync/ingest`) with validation stage.
Dependencies: TS-101, TS-NFR-001
Acceptance Criteria:
1. Accept CSV and JSON payloads.
2. Validation errors returned with row references.
3. Valid rows committed and invalid rows quarantined.

### TS-103 (Story)
Implement normalization + confidence scoring.
Dependencies: TS-102
Acceptance Criteria:
1. Source fields mapped to canonical schema.
2. Confidence score persisted per batch/record.
3. Evidence log written for each ingest batch.

### TS-104 (Story)
Add ingestion job runner with retry/resume.
Dependencies: TS-102, TS-NFR-001
Acceptance Criteria:
1. Background job handles large payloads.
2. Failed jobs retry with backoff.
3. Resume from last committed cursor.

## EPIC TS-200: Scenario Engine
Goal: Create simulation runtime and strict output contract.

### TS-201 (Story)
Create scenario CRUD APIs.
Dependencies: TS-101
Acceptance Criteria:
1. Create/list/get/update scenario endpoints.
2. Horizon and scenario type enums enforced.
3. Permission checks per role.

### TS-202 (Story)
Implement scenario run endpoint (`/run`) with versioning.
Dependencies: TS-201, TS-AI-001
Acceptance Criteria:
1. Scenario run persists `run_version` and input snapshot.
2. Output conforms to schema.
3. Confidence and assumptions stored.

### TS-203 (Story)
Tolerance breach evaluator in simulation flow.
Dependencies: TS-202
Acceptance Criteria:
1. Evaluates risk against `risk_tolerances`.
2. Flags `normal/watch/imminent/breached`.
3. Returns breach reasoning.

### TS-204 (Story)
Generate 30/60/90 action plans from scenario output.
Dependencies: TS-202
Acceptance Criteria:
1. Action objects created with owner/priority/due date.
2. Each action linked to scenario run.
3. Expected impact field populated.

## EPIC TS-300: Digital Twin MVP (Priority)
Goal: Living twin with what-if simulation and score deltas.

### TS-301 (Story)
Build twin snapshot service.
Dependencies: TS-101, TS-103
Acceptance Criteria:
1. Generates baseline twin state JSON.
2. Stores score set and confidence bands.
3. Snapshot versioned by timestamp.

### TS-302 (Story)
Implement twin scoring model v1.
Dependencies: TS-301
Acceptance Criteria:
1. Scores: `stability`, `decision_quality`, `execution_resilience`, `succession_readiness`, `manager_health`.
2. Each score has explainability payload.
3. Unit tests for score boundaries.

### TS-303 (Story)
Twin overview UI page.
Dependencies: TS-301, TS-302
Acceptance Criteria:
1. Displays current twin scores and top fragilities.
2. Shows confidence bands and assumptions.
3. Drill-down to risk drivers.

### TS-304 (Story)
What-if simulation API for twin deltas.
Dependencies: TS-302, TS-202
Acceptance Criteria:
1. Supports changes: role removal, reporting-line shift, cadence change.
2. Returns score deltas and breach probability changes.
3. Persists what-if run history.

### TS-305 (Story)
Twin narrative generation with strict schema.
Dependencies: TS-304, TS-AI-001
Acceptance Criteria:
1. Narrative sections: `what_changed`, `why_it_matters`, `what_to_do_now`, `what_to_monitor`.
2. No output saved if schema invalid.
3. Output links to assumptions.

## EPIC TS-400: Board Cockpit + Evidence
Goal: Board-ready visibility and defensible traceability.

### TS-401 (Story)
Board cockpit API aggregator.
Dependencies: TS-202, TS-203, TS-302
Acceptance Criteria:
1. Aggregates key risk/execution/twin metrics.
2. Returns period-based trend payload.
3. Supports role-scoped response.

### TS-402 (Story)
Board cockpit UI.
Dependencies: TS-401
Acceptance Criteria:
1. Traffic-light risk panels.
2. Trend views by horizon.
3. Top overdue critical actions panel.

### TS-403 (Story)
Board packet export service.
Dependencies: TS-401, TS-AI-001
Acceptance Criteria:
1. Exports JSON + Markdown payload.
2. Includes assumptions and confidence sections.
3. Export action logged in audit trail.

### TS-404 (Story)
Evidence workspace and lineage view.
Dependencies: TS-103, TS-202
Acceptance Criteria:
1. Source-to-output lineage visible per scenario run.
2. Version history queryable.
3. Evidence bundle downloadable.

## EPIC TS-500: Action + Assurance Workflow
Goal: Convert recommendations to tracked execution.

### TS-501 (Story)
Action CRUD + status transitions.
Dependencies: TS-204
Acceptance Criteria:
1. Valid statuses enforced (`open/in_progress/blocked/done/canceled`).
2. Owner required for `open` actions.
3. Status audit trail persisted.

### TS-502 (Story)
Action update feed and progress tracking.
Dependencies: TS-501
Acceptance Criteria:
1. Update posts support progress % and blockers.
2. Timeline view renders latest updates.
3. Overdue flag computed daily.

### TS-503 (Story)
Action impact recalculation.
Dependencies: TS-502, TS-302
Acceptance Criteria:
1. Recomputes predicted risk delta as updates arrive.
2. Delta visible in cockpit and action detail.
3. Recalc failures retried and logged.

## EPIC TS-600: Practitioner Workspace
Goal: Multi-client advisory execution and growth packaging.

### TS-601 (Story)
Practitioner portfolio dashboard.
Dependencies: TS-401, TS-SEC-001
Acceptance Criteria:
1. Lists assigned clients and status snapshots.
2. Shows upcoming simulation sessions.
3. Enforces tenant isolation.

### TS-602 (Story)
Playbook runner (Alignment Sprint, Quarterly Simulation, Board Review).
Dependencies: TS-601, TS-202
Acceptance Criteria:
1. Select playbook and generate required steps.
2. Attach scenario runs and outputs.
3. Track completion by stage.

### TS-603 (Story)
Commercial output templates.
Dependencies: TS-602
Acceptance Criteria:
1. Generates concise client summary output.
2. Includes KPI trend + recommended next package.
3. Export logged for audit.

## 5) Sprint Sequence (Fast Path)
- Sprint 1: TS-101, TS-102, TS-201, TS-202, TS-DOD-001, TS-AI-001
- Sprint 2: TS-103, TS-203, TS-301, TS-302, TS-303
- Sprint 3: TS-304, TS-305, TS-401, TS-402, TS-501
- Sprint 4: TS-403, TS-404, TS-502, TS-503, TS-601
- Sprint 5: TS-602, TS-603, hardening + NFR pass

## 6) Token-Minimizing Working Agreement
- In planning chats, reference ticket ID + status only.
- Do not restate full requirements; link to ticket.
- Use fixed response format for updates:
  - `Done:` IDs
  - `In progress:` IDs
  - `Blocked:` IDs + blocker
  - `Next:` IDs
