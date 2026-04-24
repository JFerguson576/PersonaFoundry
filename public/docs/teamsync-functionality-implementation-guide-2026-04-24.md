# TeamSync Functionality Implementation Guide
## Detailed Build Instructions for Resilience Intelligence, Scenario Testing, and Digital Twin

Date: April 24, 2026
Path: C:\Users\johnf\Desktop\personafoundry\TEAMSYNC_FUNCTIONALITY_IMPLEMENTATION_GUIDE_2026-04-24.md

## 0) How to Use This Guide

This is a build-level implementation document. It expands each TeamSync capability into:
- Product intent
- Functional requirements
- Data requirements
- Backend implementation instructions
- Frontend implementation instructions
- AI orchestration instructions
- Security/compliance instructions
- QA/acceptance criteria

Use this in sequence:
1. Build platform foundation (sections 1-4)
2. Build Digital Twin (section 5)
3. Build remaining feature modules (sections 6-12)
4. Add practitioner workflows and packaging (section 13)
5. Operationalize with metrics and rollout controls (sections 14-16)

---

## 1) Platform Foundation (Required Before Advanced Features)

## 1.1 Product Objective

Create a board-ready resilience intelligence layer that unifies:
- Leadership/strengths data
- Engagement and manager-system indicators
- Operational risk and execution signals
- Scenario simulation and action tracking

## 1.2 Core Technical Stack (Recommended)

Given your existing Next.js/Supabase project layout, implement:
- App: Next.js App Router + TypeScript
- Data: Supabase Postgres
- Auth: existing auth stack with RBAC extension
- AI: OpenAI-based orchestration (structured outputs)
- Jobs: background orchestration for simulations and report generation
- Observability: telemetry tables + structured event logging

## 1.3 Core Services

Create these service boundaries in `lib/teamsync/`:
- `ingestion-service.ts` (source intake and normalization)
- `twin-service.ts` (digital twin state and behavior model)
- `scenario-service.ts` (simulation orchestration)
- `risk-service.ts` (risk scoring and tolerance checks)
- `action-service.ts` (intervention and accountability workflows)
- `boardpack-service.ts` (board report generation)
- `explainability-service.ts` (assumption trace and confidence)

## 1.4 Non-Negotiable Product Constraints

1. Probabilistic outputs only
- Never present deterministic "will happen" claims.
- Force confidence bands and assumptions in all executive views.

2. Explainability by default
- Every score and recommendation must show inputs + rationale.

3. Governance-grade traceability
- Persist scenario version, inputs, assumptions, model version, and outputs.

4. Human decision ownership
- TeamSync recommends; executives approve and assign actions.

---

## 2) Canonical Domain Model

Implement these primary entities in Supabase.

## 2.1 Core Tables

1. `orgs`
- `id`, `name`, `industry`, `size_band`, `region`, `created_at`

2. `org_units`
- `id`, `org_id`, `name`, `type` (executive/team/function), `parent_unit_id`

3. `people`
- `id`, `org_id`, `name`, `role_title`, `role_level`, `status`, `manager_id`

4. `capability_profiles`
- `id`, `person_id`, `source_type` (gallup_strengths, manager_assessment, custom)
- `profile_json` (normalized capability vector)
- `confidence`, `effective_date`

5. `engagement_metrics`
- `id`, `org_unit_id`, `period_start`, `period_end`
- `engagement_score`, `manager_engagement_score`, `wellbeing_score`
- `source`, `confidence`

6. `operational_metrics`
- `id`, `org_unit_id`, `metric_name`, `metric_value`, `unit`, `period`, `source`, `confidence`

7. `risk_register`
- `id`, `org_id`, `risk_domain`, `risk_statement`, `owner_person_id`
- `inherent_risk`, `residual_risk`, `status`

8. `risk_tolerances`
- `id`, `org_id`, `risk_domain`, `metric_name`
- `lower_bound`, `upper_bound`, `breach_logic`, `board_approved_at`

9. `scenarios`
- `id`, `org_id`, `name`, `horizon` (immediate, medium, long)
- `scenario_type`, `severity`, `status`, `created_by`

10. `scenario_assumptions`
- `id`, `scenario_id`, `assumption_key`, `assumption_value`, `source`, `confidence`

11. `scenario_runs`
- `id`, `scenario_id`, `run_version`, `model_version`, `started_at`, `completed_at`
- `output_json`, `confidence_overall`, `quality_flags`

12. `twin_snapshots`
- `id`, `org_id`, `snapshot_at`, `snapshot_type` (baseline, post-change, post-event)
- `state_json`, `stability_score`, `execution_risk_score`

13. `recommended_actions`
- `id`, `scenario_run_id`, `action_type`, `priority`, `owner_person_id`
- `due_date`, `expected_impact`, `status`

14. `action_updates`
- `id`, `action_id`, `update_text`, `progress_pct`, `updated_by`, `updated_at`

15. `board_packets`
- `id`, `org_id`, `period_label`, `packet_version`, `content_json`, `generated_at`

16. `evidence_log`
- `id`, `org_id`, `entity_type`, `entity_id`, `source_ref`, `event_type`, `payload_json`, `created_at`

## 2.2 Indexing and Performance

Add indexes:
- Time-series: `(org_id, period_start, period_end)`
- Scenario queries: `(scenario_id, run_version)`
- Twin lookup: `(org_id, snapshot_at desc)`
- Action tracking: `(owner_person_id, status, due_date)`
- Tolerance checks: `(org_id, risk_domain, metric_name)`

## 2.3 Row-Level Security (RLS)

Implement RLS policies by role:
- `org_admin`: full org scope
- `board_viewer`: read board packet + scenario summaries, no raw PII by default
- `exec_user`: scoped read/write for assigned units and actions
- `practitioner`: bounded multi-client tenant scope, explicit client consent flags

---

## 3) Data Ingestion and Normalization

## 3.1 Input Sources

Support these input channels:
- Structured upload: CSV/XLSX for metrics
- Document upload: PDF/DOCX reports
- API connector mode: Gallup exports / existing HRIS feeds
- Manual form mode: executive workshop findings, advisory notes

## 3.2 Ingestion Pipeline

Implement ETL pipeline stages:

1. `extract`
- Parse file/source into raw records
- Store immutable raw payload with checksum

2. `map`
- Map source fields to canonical schema via mapping templates

3. `normalize`
- Standardize units/scales (e.g., percentages, per-FTE metrics)
- Convert date ranges to canonical periods

4. `validate`
- Required fields
- Outlier detection
- Duplicate detection

5. `score_quality`
- Assign confidence by source recency, completeness, and consistency

6. `commit`
- Write normalized records
- Emit evidence log events

## 3.3 Mapping Templates

Create reusable mapping profiles:
- `gallup_engagement_template`
- `gallup_strengths_template`
- `manager_effectiveness_template`
- `ops_kpi_template`
- `incident_postmortem_template`

## 3.4 Engineering Instructions

- Add `app/api/teamsync/ingest/route.ts`
- Add `app/api/teamsync/ingest/validate/route.ts`
- Add `app/api/teamsync/ingest/mappings/route.ts`
- Build retryable background job `lib/teamsync/jobs/ingest-job.ts`
- Persist job status table `ingestion_jobs`

Acceptance criteria:
- 100k-row CSV ingest with resumable retries
- Parsing and normalization error report downloadable
- Evidence log entry for every committed batch

---

## 4) Scenario Engine (System-Wide)

## 4.1 Scenario Taxonomy

Define scenario classes:
- Workforce shock (attrition, manager burnout, succession event)
- Revenue shock (demand contraction, customer concentration failure)
- Operational shock (critical process disruption, dependency failure)
- Cyber/governance shock (incident + disclosure pressure)
- Transformation shock (simultaneous major initiatives overload)

## 4.2 Simulation Runtime Flow

1. Select org scope and time horizon
2. Load latest twin snapshot + metrics + tolerances
3. Apply scenario assumptions and shocks
4. Run behavior model inference (leadership/team response tendencies)
5. Run tolerance breach evaluation
6. Generate interventions (role, cadence, capability, controls)
7. Produce summary + board-ready output + action plan

## 4.3 API Endpoints

- `POST /api/teamsync/scenarios` create scenario
- `POST /api/teamsync/scenarios/{id}/run` execute run
- `GET /api/teamsync/scenarios/{id}/runs/{runId}` retrieve results
- `POST /api/teamsync/scenarios/{id}/actions` approve actions

## 4.4 Output Contract (Strict)

Every scenario run must return:
- `situation_read`
- `predicted_behavior_patterns`
- `strengths_advantages`
- `blind_spots`
- `tolerance_breaches`
- `recommended_actions`
- `30_60_90_plan`
- `confidence_and_assumptions`

Use JSON schema validation before persistence.

---

## 5) Digital Twin (Priority Feature)

## 5.1 Product Definition

The TeamSync Digital Twin is a living computational model of leadership system behavior and execution resilience under changing constraints.

It is not a static org chart and not only a psychometric profile. It combines:
- Who is in which role
- How decisions are currently made
- Strengths/capability distribution
- Engagement and manager-system health
- Operational load and risk context

## 5.2 Twin Layers

Implement four layers:

1. `Structure layer`
- Roles, reporting lines, decision rights, escalation paths

2. `Capability layer`
- Strengths distribution, manager capability, bench depth, substitution capacity

3. `Behavior layer`
- Predicted team response tendencies under stress (speed, caution, conflict, alignment)

4. `Resilience layer`
- Tolerance proximity, fragility points, likely failure chains

## 5.3 Twin State Object

In `twin_snapshots.state_json`, include:
- `org_structure_graph`
- `capability_matrix`
- `decision_mode_profile`
- `manager_health_index`
- `execution_load_index`
- `risk_link_map`
- `known_constraints`
- `assumption_registry`

## 5.4 Twin Update Triggers

Recompute twin snapshot on:
- Executive role changes
- New engagement or manager metrics
- Incident and postmortem imports
- Major strategy change markers
- Approved action completion
- Scheduled weekly refresh

## 5.5 Twin Scoring System

Implement initial score family (0-100):
- `stability_score`
- `decision_quality_score`
- `execution_resilience_score`
- `succession_readiness_score`
- `manager_system_health_score`

Include confidence interval per score.

## 5.6 Digital Twin UX Instructions

Create a dedicated UI area: `app/teamsync/twin/page.tsx`

Views:
1. Twin Overview
- Current scores, confidence bands, top fragilities

2. Structure View
- Interactive graph: roles, dependencies, decision bottlenecks

3. Capability Heatmap
- Strengths/capability concentration and gap areas

4. Stress Response View
- Simulated behavior shifts at low/medium/high pressure

5. Interventions View
- Prioritized actions with expected score impact

## 5.7 Twin What-If Simulation

Support editable parameters:
- Remove/replace executive
- Change reporting lines
- Add manager enablement investment
- Change operating cadence
- Pause/resequence transformation work

For each what-if, produce delta view:
- score shifts
- risk shifts
- tolerance breach probability changes
- recommended mitigations

## 5.8 AI Instructions for Twin Narratives

System prompt requirements:
- Use only provided state and assumptions
- Explicitly label inference uncertainty
- Avoid personality-generalized claims
- Tie every recommendation to specific twin signals

Required narrative sections:
- "What changed"
- "Why this matters"
- "What to do now"
- "What to monitor next"

## 5.9 Digital Twin Acceptance Criteria

- Baseline twin generated in under 90 seconds for mid-size org data
- What-if simulation result in under 30 seconds for common changes
- All scores show confidence and assumptions
- Board summary export available from twin state

---

## 6) Board Resilience Cockpit

## 6.1 Functional Requirements

Dashboard panels:
- Strategic execution health
- Top enterprise risk domains
- Tolerance breach watchlist
- Manager-system risk
- Succession and capability risk
- Open critical actions and overdue items

## 6.2 Backend Instructions

- Build query aggregator `lib/teamsync/queries/board-cockpit.ts`
- Create materialized views for performance
- Cache key by `org_id + reporting_period`

## 6.3 Frontend Instructions

Route: `app/teamsync/board/page.tsx`

Widgets:
- Traffic-light indicators with drill-down
- Trend lines with 3 horizons
- Assumption toggles for quick stress view

## 6.4 Board Pack Export

Add `POST /api/teamsync/board/packet/generate`
Output formats:
- JSON (machine)
- Markdown (internal)
- DOCX/PDF-ready payload (executive distribution)

---

## 7) Human Capital Risk Engine

## 7.1 Purpose

Continuously map people-system conditions to execution and resilience risk.

## 7.2 Risk Dimensions

- Engagement decay risk
- Manager overload risk
- Capability concentration risk
- Succession single-point-of-failure risk
- Coordination friction risk

## 7.3 Scoring Logic (v1)

Use weighted model:
- Engagement trend slope
- Manager engagement delta
- Critical role backup depth
- Action completion consistency
- Cross-functional dependency intensity

Persist each domain risk + confidence.

## 7.4 API and UI

- `GET /api/teamsync/risk/domains`
- `GET /api/teamsync/risk/domain/{id}`
- `app/teamsync/risk/page.tsx`

Include "top risk drivers" list for explainability.

---

## 8) Leadership Operating System Designer

## 8.1 Purpose

Turn diagnosis into operating design changes that improve execution quality.

## 8.2 Design Outputs

- Role clarity recommendations
- Decision rights matrix (RACI-like)
- Meeting cadence recommendations
- Escalation protocol recommendations
- Manager coaching rhythm requirements

## 8.3 Implementation

- Build rule-based recommender first (`lib/teamsync/recommend/os-rules.ts`)
- Layer AI narrative generation second (`os-narrative.ts`)

## 8.4 UI

`app/teamsync/design/page.tsx`

- Current vs recommended operating model comparison
- Effort/impact matrix
- One-click convert recommendation -> action item

---

## 9) Action and Assurance Tracker

## 9.1 Purpose

Ensure scenario outputs become accountable execution, not slideware.

## 9.2 Requirements

Each action must include:
- Clear owner
- Due date
- expected impact metric
- status and progress updates
- blockers and dependency flags

## 9.3 Workflow

1. Scenario recommends actions
2. Leadership approves and assigns
3. Owners update progress weekly
4. System recalculates predicted risk delta
5. Board cockpit reflects real progress

## 9.4 API

- `POST /api/teamsync/actions`
- `PATCH /api/teamsync/actions/{id}`
- `POST /api/teamsync/actions/{id}/update`

## 9.5 QA

- Overdue action alerts
- Owner-level workload balancing
- Required justification for canceled actions

---

## 10) Tolerance Breach Early Warning

## 10.1 Purpose

Move from reactive breach reporting to predictive warning.

## 10.2 Engine Logic

For each tolerance:
- compute current distance to boundary
- compute trend velocity
- compute projected breach window
- assign warning status (`normal`, `watch`, `imminent`, `breached`)

## 10.3 Alerts

- In-app alerts to owners
- weekly digest to executives
- board digest for `imminent` and `breached`

## 10.4 Implementation

- Scheduled job `lib/teamsync/jobs/tolerance-watch.ts`
- `tolerance_alerts` table with acknowledgment tracking

---

## 11) Succession Stress Test

## 11.1 Purpose

Test leadership continuity resilience under exits/absences.

## 11.2 Simulation Inputs

- Role removal event(s)
- Time-to-replacement assumption
- Interim coverage options
- Capability transfer readiness

## 11.3 Outputs

- Critical continuity risk
- time-to-stability estimate
- recommended interim structure
- bench development priorities

## 11.4 UI

`app/teamsync/succession/page.tsx`
- "Remove role" simulation controls
- replacement archetype recommendation
- readiness map by role cluster

---

## 12) Boardroom Scenario Pack and Evidence-to-Disclosure Workspace

## 12.1 Boardroom Scenario Pack

Provide prebuilt high-stakes templates:
- Capital allocation stress
- Activist/investor pressure
- Cyber incident + governance scrutiny
- Strategy reset under underperformance
- CEO succession event under time pressure

## 12.2 Evidence-to-Disclosure Workspace

Purpose: consolidate defensible evidence for board and committee workflows.

Features:
- Source trace for each claim
- assumptions ledger
- scenario version history
- action response timeline
- committee-ready summary views

Implementation:
- `app/teamsync/evidence/page.tsx`
- export endpoints for structured evidence bundles

---

## 13) Gallup Practitioner Workspace and Growth Flows

## 13.1 Practitioner Multi-Client Workspace

Add tenancy-aware practitioner console:
- client portfolio view
- engagement health and risk snapshots
- scenario session planner
- packaged output templates

Route: `app/teamsync/practitioner/page.tsx`

## 13.2 Practitioner Playbooks (Productized)

Implement guided workflows:
1. Executive Alignment Sprint
2. Quarterly Resilience Simulation
3. Board Confidence Review
4. Growth Operating Design

Each playbook should include:
- session agenda
- required inputs
- simulation scripts
- output template
- follow-up action cadence

## 13.3 Commercial Enablement Features

- Proposal generator with baseline findings
- ROI tracker per client program
- renewal risk signals
- attach recommendations for next offering

---

## 14) AI Orchestration Design

## 14.1 Model Usage Pattern

Split tasks:
- deterministic scoring/rules in code
- interpretive narrative in model calls

## 14.2 Structured Prompt Contracts

Use strict schemas for:
- scenario interpretation
- action recommendation
- board summary narrative
- twin change explanation

## 14.3 Hallucination Controls

- retrieval context only from approved internal state
- no free web lookup in live executive outputs unless explicitly enabled
- reject output if schema or citation fields missing

## 14.4 Prompt Library Organization

Create in `lib/teamsync/prompts/`:
- `twin-summary.ts`
- `scenario-analysis.ts`
- `action-plan.ts`
- `board-summary.ts`
- `practitioner-debrief.ts`

---

## 15) Security, Compliance, and Governance Controls

## 15.1 Data Classification

Tag fields by sensitivity:
- public/internal/confidential/restricted

## 15.2 Access Controls

- role-based visibility for board vs operational users
- masked views for sensitive people data where needed
- action audit logs immutable

## 15.3 Logging and Auditing

Track:
- who ran which scenario
- which assumptions were changed
- who approved actions
- which outputs were exported

## 15.4 Policy Guardrails

- non-deterministic language policy
- decision-rights disclaimer in all exports
- legal/compliance review mode toggle for regulated clients

---

## 16) Rollout Plan (Execution-Ready)

## Phase 1 (Weeks 1-4): Foundations
- Implement core schema and ingestion pipeline
- Build scenario runtime skeleton
- Build initial board cockpit view

Deliverables:
- working ingestion of sample Gallup + KPI data
- one baseline scenario run end-to-end

## Phase 2 (Weeks 5-8): Digital Twin MVP
- Implement twin snapshot generation
- Build twin overview and what-if controls
- Add first twin scores and confidence bands

Deliverables:
- Digital Twin MVP in production-like environment
- one-click board summary export from twin

## Phase 3 (Weeks 9-12): Resilience Modules
- Add tolerance warning engine
- Add succession stress test
- Add action and assurance tracker

Deliverables:
- tolerance alerts and action workflows live
- 30/60/90 planning from scenario output

## Phase 4 (Weeks 13-16): Practitioner and Packaging
- Build practitioner workspace
- Add playbook templates and commercial outputs
- finalize boardroom scenario pack

Deliverables:
- practitioner-ready offer flows
- repeatable quarterly simulation workflow

---

## 17) Definition of Done (DoD)

A feature is complete only if:
1. Functional output works end-to-end
2. Explainability is present (assumptions + confidence)
3. Evidence log is written
4. RBAC and RLS pass tests
5. UI and export views are available
6. Performance thresholds met
7. Acceptance tests documented

---

## 18) Suggested Next Build Ticket Breakdown

Create engineering epics:
- Epic A: Canonical schema and ingestion
- Epic B: Scenario engine runtime and APIs
- Epic C: Digital Twin MVP
- Epic D: Board cockpit and evidence exports
- Epic E: Action and assurance workflow
- Epic F: Practitioner workspace

Create first sprint stories under Epic C (Digital Twin):
1. Twin snapshot table + service
2. Twin baseline score calculator
3. Twin overview UI
4. Twin what-if API
5. Twin narrative generation schema
6. Twin export summary

---

## 19) Final Product Positioning

TeamSync is an executive and board decision intelligence system that uses strengths-informed and operating-context-aware digital twin simulation to improve resilience, governance confidence, and execution outcomes under uncertainty.
