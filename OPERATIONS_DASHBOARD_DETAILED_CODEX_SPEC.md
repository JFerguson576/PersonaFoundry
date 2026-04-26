# Personara.ai Operations Dashboard - Detailed Codex Build Spec

Date: 2026-04-24
Goal: Turn each operations stream into executable, trackable, Codex-actionable work items.

## 1) Status Model (To-Do Style)

Use exactly these workflow states:
- `prioritise` (needs triage)
- `actioned` (in progress)
- `complete` (done and verified)

Use priority:
- `P0` (critical now)
- `P1` (important next)
- `P2` (can wait)

## 2) Platform Placement

Assumed admin structure:
- `Admin > Operations` as new top-level nav item
- Route: `/admin/operations`
- Child routes:
  - `/admin/operations/north-star-kpis`
  - `/admin/operations/funnel-control`
  - `/admin/operations/ai-quality-control`
  - `/admin/operations/retention-engine`
  - `/admin/operations/pricing-packaging`
  - `/admin/operations/gtm-pipeline`
  - `/admin/operations/reliability-cost`
  - `/admin/operations/compliance-trust`
  - `/admin/operations/experiment-lab`
  - `/admin/operations/weekly-rhythm`

## 3) Core Data Requirements (Must Build First)

### 3.1 Tables / Collections

1. `operations_items`
- `id` (uuid)
- `code` (string, unique; example `FC-1`)
- `title` (string)
- `menu_section` (enum)
- `description` (text)
- `priority` (enum: P0/P1/P2)
- `status` (enum: prioritise/actioned/complete)
- `owner_user_id` (uuid nullable)
- `due_date` (date nullable)
- `definition_of_done` (text)
- `metric_target` (text nullable)
- `current_value` (text nullable)
- `codex_prompt` (text)
- `created_at`, `updated_at`

2. `operations_item_notes`
- `id` (uuid)
- `item_id` (fk)
- `note_body` (text)
- `author_user_id` (uuid)
- `created_at`

3. `operations_item_links`
- `id` (uuid)
- `item_id` (fk)
- `label` (string)
- `url` (text)
- `link_type` (enum: doc/dashboard/pr/prd/other)
- `created_at`

4. `operations_item_content_blocks`
- `id` (uuid)
- `item_id` (fk)
- `block_type` (enum: checklist/text/table/json)
- `content` (json/text)
- `sort_order` (int)
- `created_at`, `updated_at`

### 3.2 API Endpoints

- `GET /api/admin/operations/items`
- `POST /api/admin/operations/items`
- `PATCH /api/admin/operations/items/:id`
- `POST /api/admin/operations/items/:id/notes`
- `GET /api/admin/operations/items/:id/notes`
- `POST /api/admin/operations/items/:id/links`
- `DELETE /api/admin/operations/links/:id`
- `POST /api/admin/operations/items/:id/content-blocks`
- `PATCH /api/admin/operations/content-blocks/:id`

## 4) UI Requirements (How It Looks)

## 4.1 Operations Home (`/admin/operations`)

Components:
1. KPI strip: counts by `prioritise`, `actioned`, `complete`, and overdue.
2. Kanban lanes: three lanes (`prioritise`, `actioned`, `complete`).
3. Filter bar: menu section, priority, owner, due date.
4. Quick action: `Start with Codex` button per card.

Card design:
- Title + code + section
- Priority badge (`P0/P1/P2`)
- Status dropdown (`prioritise/actioned/complete`)
- Owner + due date
- Inline actions: `Open`, `Add Note`, `Add Link`, `Start with Codex`

## 4.2 Item Detail Drawer/Page

Sections:
1. `Overview` (description, DoD, metric)
2. `Notes` (append-only timeline)
3. `Links` (URL list with labels)
4. `Content` (rich blocks/checklists/tables)
5. `Codex Action` (prompt editor + run workflow)

## 5) Codex Click-to-Action Behavior

Native one-click execution depends on platform wiring. Implement this practical flow now:

1. `Start with Codex` button on each task card.
2. Button opens a modal with prefilled `codex_prompt`.
3. Modal actions:
- `Copy Prompt` (always available)
- `Open in Codex` (if your platform has internal Codex launcher; otherwise disabled)
4. When clicked, status auto-updates:
- `prioritise -> actioned`
5. On merge/verification completion, user marks `complete`.

## 6) Detailed Build Breakdown By Operations Menu

Each section below includes: required code, UI look, placement, and task starter prompt.

## 6.1 North Star & KPIs

Required code:
- KPI query layer and aggregation service.
- Daily snapshot job for trend history.

UI look:
- Top trend chart + 12 KPI tiles.

Placement:
- `/admin/operations/north-star-kpis`

Codex starter:
`Implement KPI aggregation endpoints and render North Star dashboard with daily snapshots and trend lines.`

## 6.2 Funnel Control

Required code:
- Event schema validator.
- Funnel conversion query service.
- Drop-off diagnostics endpoint.

UI look:
- Horizontal funnel with stage-to-stage conversion and drop-off heat.

Placement:
- `/admin/operations/funnel-control`

Codex starter:
`Build funnel-control module for visit->paid flow with event validation, conversion metrics, and drop-off views.`

## 6.3 AI Quality Control

Required code:
- AI flow registry CRUD.
- Prompt version storage and rollback.
- Regression score logging.

UI look:
- Registry table + prompt version timeline + weekly QA scorecards.

Placement:
- `/admin/operations/ai-quality-control`

Codex starter:
`Create AI Quality Control module with flow registry, prompt versions, rollback, and regression score capture.`

## 6.4 Retention Engine

Required code:
- Next-best-action generator hook.
- Reminder scheduling pipeline.
- Progress completion event handlers.

UI look:
- Cohort retention chart + user action plan feed + reminder health panel.

Placement:
- `/admin/operations/retention-engine`

Codex starter:
`Implement retention engine dashboards and hooks for weekly action plans, reminders, and progress-loop tracking.`

## 6.5 Pricing & Packaging

Required code:
- Plan/feature matrix storage.
- Entitlement mapping to plans.
- Paywall experiment flags.

UI look:
- Matrix editor + plan comparison + experiment controls.

Placement:
- `/admin/operations/pricing-packaging`

Codex starter:
`Build pricing and packaging admin with plan matrix CRUD, entitlement mapping, and paywall experiment toggles.`

## 6.6 GTM Pipeline

Required code:
- Lead/opportunity model.
- Stage movement logging.
- Win/loss reason taxonomy.

UI look:
- CRM-style board with stages and conversion summary.

Placement:
- `/admin/operations/gtm-pipeline`

Codex starter:
`Implement GTM pipeline board with lead stages, conversion reporting, and win/loss capture.`

## 6.7 Reliability & Cost

Required code:
- Cost telemetry per model/flow/tenant.
- Alert rules for threshold breaches.
- Incident registry + postmortem links.

UI look:
- Cost trend chart + alert panel + incident timeline.

Placement:
- `/admin/operations/reliability-cost`

Codex starter:
`Create reliability and cost module with AI cost telemetry, alerting thresholds, and incident tracking.`

## 6.8 Compliance & Trust

Required code:
- Data retention/deletion policy records.
- Audit logs query APIs.
- Trust checklist tracker.

UI look:
- Compliance status board + audit log browser + trust checklist progress.

Placement:
- `/admin/operations/compliance-trust`

Codex starter:
`Build compliance and trust dashboard with policy controls, audit log views, and trust checklist tracking.`

## 6.9 Experiment Lab

Required code:
- Experiment entity (hypothesis, metric, baseline, duration).
- Decision logging and outcome tagging.

UI look:
- Experiment kanban + result table + win-rate panel.

Placement:
- `/admin/operations/experiment-lab`

Codex starter:
`Implement experiment lab with templates, lifecycle states, decision logs, and rolling win-rate analytics.`

## 6.10 Weekly Operating Rhythm

Required code:
- Meeting agenda templates.
- Completion tracking with overdue alerts.
- Weekly decision register.

UI look:
- Week calendar + completion checklist + decisions feed.

Placement:
- `/admin/operations/weekly-rhythm`

Codex starter:
`Create weekly operating rhythm module with Monday/Wednesday/Friday templates, completion tracking, and decision logs.`

## 7) Task Card UX (Actioned/Complete/Prioritise + Notes + Links + Content)

Card actions required:
1. Change status (`prioritise/actioned/complete`)
2. Change priority (`P0/P1/P2`)
3. `Start with Codex`
4. Add/edit note
5. Add/remove link
6. Add/edit content block

Validation rules:
- Cannot set `complete` without `definition_of_done` filled.
- If `priority = P0`, due date is required.
- `Start with Codex` sets `last_actioned_at`.

## 8) Seed Initial Task Backlog

Use the companion file:
- [OPERATIONS_TASKS_SEED.json](C:/Users/johnf/OneDrive/Desktop/personafoundry/PersonaFoundry/OPERATIONS_TASKS_SEED.json)

Load it as initial tasks for the Operations dashboard.

## 9) First Sprint (Recommended)

Build in this order:
1. Core data model + APIs + generic task board UI.
2. `North Star & KPIs` and `Funnel Control`.
3. Add `Start with Codex` modal.
4. Add notes/links/content blocks.
5. Roll out remaining modules.

## 10) Strategy Context Layer (Add To Each Dashboard Component)

Add a collapsible panel at the top of every Operations submenu:
- Panel title: `Why This Matters`
- Default state: expanded for first-time viewers, collapsed after first visit.
- Content fields:
  - `Strategic objective`
  - `Weakness/risk addressed`
  - `Primary KPI`
  - `Target threshold`
  - `Failure signal`
  - `Owner expectation`

Use this exact content:

### 10.1 North Star & KPIs
- Strategic objective: create execution discipline around one measurable value outcome.
- Weakness/risk addressed: no visible operating system; team drifts without clear targets.
- Primary KPI: weekly users completing core high-value action.
- Target threshold: positive week-over-week trend for 4 consecutive weeks.
- Failure signal: KPI flat/down while activity appears high.
- Owner expectation: adjust roadmap by KPI movement, not intuition.

### 10.2 Funnel Control
- Strategic objective: improve activation and conversion through clear stage visibility.
- Weakness/risk addressed: under-specified funnel and unclear drop-off causes.
- Primary KPI: signup->activation and activation->paid conversion.
- Target threshold: measurable drop-off reduction at biggest funnel leak each sprint.
- Failure signal: high top-of-funnel traffic but weak paid conversion.
- Owner expectation: each weekly review must identify one funnel blocker and one action.

### 10.3 AI Quality Control
- Strategic objective: keep AI output reliable, trusted, and action-ready.
- Weakness/risk addressed: inconsistent outputs reduce trust and retention.
- Primary KPI: output acceptance rate and format compliance pass rate.
- Target threshold: sustained quality pass rate with no severe regressions.
- Failure signal: frequent manual correction or user distrust feedback.
- Owner expectation: all production prompts/version changes are traceable and reversible.

### 10.4 Retention Engine
- Strategic objective: increase repeat usage through behavior-based loops.
- Weakness/risk addressed: users churn if no momentum path is visible.
- Primary KPI: Week-1/Week-4 retention and action completion rate.
- Target threshold: consistent retention lift from active experiments.
- Failure signal: acquisition grows while return behavior stagnates.
- Owner expectation: run retention experiments continuously with explicit decision rules.

### 10.5 Pricing & Packaging
- Strategic objective: align value delivery to monetization tiers.
- Weakness/risk addressed: unclear packaging weakens conversion and upsell.
- Primary KPI: trial->paid conversion and ARPA by segment.
- Target threshold: conversion gains after pricing/packaging iterations.
- Failure signal: high product engagement but low willingness to pay.
- Owner expectation: each plan must map to distinct outcome and buyer.

### 10.6 GTM Pipeline
- Strategic objective: convert product capability into repeatable revenue.
- Weakness/risk addressed: weak pipeline hygiene and ad hoc sales motion.
- Primary KPI: stage conversion rates and win rate.
- Target threshold: predictable deal flow with documented win/loss reasons.
- Failure signal: long cycles with poor stage movement visibility.
- Owner expectation: every customer conversation is logged and learnings are codified.

### 10.7 Reliability & Cost
- Strategic objective: preserve margin and service confidence while scaling.
- Weakness/risk addressed: rising AI costs and instability can kill SaaS economics.
- Primary KPI: AI cost per active user/outcome and incident frequency.
- Target threshold: stable unit economics with controlled alert volume.
- Failure signal: usage growth paired with margin decline or frequent incidents.
- Owner expectation: enforce cost guardrails and maintain incident/postmortem discipline.

### 10.8 Compliance & Trust
- Strategic objective: reduce enterprise friction and improve buyer confidence.
- Weakness/risk addressed: unclear data governance blocks larger contracts.
- Primary KPI: audit coverage and policy compliance completion.
- Target threshold: critical controls implemented and reviewed monthly.
- Failure signal: unresolved compliance gaps or incomplete audit trails.
- Owner expectation: trust artifacts stay current and operational, not static docs.

### 10.9 Experiment Lab
- Strategic objective: institutionalize learning velocity and evidence-based decisions.
- Weakness/risk addressed: random changes without measurable outcomes.
- Primary KPI: experiment throughput and win rate.
- Target threshold: steady experiment cadence with clear adoption/kill decisions.
- Failure signal: many experiments launched but few concluded decisively.
- Owner expectation: no major product change ships without hypothesis + metric.

### 10.10 Weekly Operating Rhythm
- Strategic objective: maintain execution cadence and prevent founder/operator overload.
- Weakness/risk addressed: priorities drift without recurring decision forums.
- Primary KPI: weekly meeting completion and action closure rate.
- Target threshold: all weekly sessions run with logged decisions and owners.
- Failure signal: repeated blockers and unclear accountability.
- Owner expectation: monday/wednesday/friday rhythm is non-negotiable.

## 11) UX Addition: Embedded Playbook Content

Each operations item detail page should include three editable tabs:
1. `Context` (preloaded strategic rationale from section 10)
2. `Execution` (task checklist + Codex prompt)
3. `Evidence` (links, notes, uploads, outcomes)

This gives every component both clarity (`why`) and actionability (`what/how`).
