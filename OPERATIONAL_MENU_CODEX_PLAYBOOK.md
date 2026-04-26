# Personara.ai Operations Dashboard - Codex Ready Playbook

Date: 2026-04-24
Purpose: Convert strategy into executable operations inside a new dashboard menu.
How to use: Build these menu sections in order. Run each action as a tracked task with clear owner, due date, and done criteria.

## 1) New Menu Structure (Build This First)

Create a top-level menu item: `Operations`

Add these submenus:
1. `North Star & KPIs`
2. `Funnel Control`
3. `AI Quality Control`
4. `Retention Engine`
5. `Pricing & Packaging`
6. `GTM Pipeline`
7. `Reliability & Cost`
8. `Compliance & Trust`
9. `Experiment Lab`
10. `Weekly Operating Rhythm`

## 2) Shared Data Model (Use Across All Submenus)

Every action/task record should include:
- `id`
- `title`
- `menu_section`
- `priority` (`P0`, `P1`, `P2`)
- `owner`
- `status` (`not_started`, `in_progress`, `blocked`, `done`)
- `start_date`
- `due_date`
- `metric_target`
- `current_value`
- `definition_of_done`
- `evidence_link`
- `risks`
- `next_step`

## 3) Build Order (Execution Sequence)

1. `North Star & KPIs` (mandatory first)
2. `Funnel Control`
3. `AI Quality Control`
4. `Retention Engine`
5. `Pricing & Packaging`
6. `GTM Pipeline`
7. `Reliability & Cost`
8. `Compliance & Trust`
9. `Experiment Lab`
10. `Weekly Operating Rhythm` (locks accountability)

## 4) Detailed Actions By Menu

## 4.1 North Star & KPIs

### Action NS-1: Set wedge ICP
- Build: Single ICP selector card (only one active ICP at a time).
- Done when: One ICP selected and approved; all reports filtered by this ICP.
- Metric target: `100% dashboards default to selected ICP`.

### Action NS-2: Define north-star metric
- Build: North-star metric widget with trend (weekly).
- Done when: Metric formula documented and auto-calculated.
- Metric target: `Metric updates daily without manual entry`.

### Action NS-3: KPI scorecard
- Build: 12 KPI tiles (activation, retention, conversion, cost, quality).
- Done when: All KPI tiles pull live event data.
- Metric target: `0 broken KPI queries in 7 days`.

## 4.2 Funnel Control

### Action FC-1: Event taxonomy rollout
- Build: Event map + tracking checklist.
- Required events: `visit`, `signup`, `onboarding_started`, `onboarding_completed`, `first_insight_generated`, `first_action_completed`, `week2_returned`, `trial_started`, `converted_paid`.
- Done when: Each event has schema + validation.

### Action FC-2: Funnel drop-off board
- Build: Stage conversion table with drop-off % and confidence interval.
- Done when: Daily refresh and weekly comparison view exists.

### Action FC-3: Time-to-value tracker
- Build: Median `signup -> first_insight_generated` timer.
- Done when: Segmented by device/source/ICP.
- Target: `< 5 minutes`.

## 4.3 AI Quality Control

### Action AQ-1: AI flow registry
- Build: Registry table for every OpenAI interaction.
- Fields: `flow_name`, `input_type`, `output_contract`, `latency_sla`, `fallback_behavior`, `owner`.
- Done when: 100% production AI flows listed.

### Action AQ-2: Prompt/version control
- Build: Prompt version history with release date and rollback action.
- Done when: Every flow points to active prompt version.

### Action AQ-3: Weekly regression pack
- Build: Test set (golden inputs) + score sheet.
- Scoring: `accuracy`, `relevance`, `actionability`, `format compliance`.
- Done when: Weekly run completed and tracked in dashboard.

## 4.4 Retention Engine

### Action RE-1: Weekly next-best-action planner
- Build: Auto-generated weekly action plan card per user.
- Done when: Plan visible to 100% active users.

### Action RE-2: Progress loop
- Build: Progress bar + one-step-left nudges.
- Done when: Trigger rules active after incomplete workflows.

### Action RE-3: Reminder orchestration
- Build: Reminder scheduler by user success window.
- Done when: Reminders deployed with opt-out controls and tracking.

## 4.5 Pricing & Packaging

### Action PP-1: Plan matrix
- Build: Side-by-side feature matrix for `Starter`, `Pro`, `Reseller`, `White-label`.
- Done when: Each plan has limits, target persona, and upgrade trigger.

### Action PP-2: Outcome scorecards
- Build: Exportable ROI summary by customer type.
- Done when: At least one auto-generated scorecard per active account/month.

### Action PP-3: Paywall test framework
- Build: A/B framework for trial length, gating, and upgrade copy.
- Done when: At least one paywall experiment launched.

## 4.6 GTM Pipeline

### Action GTM-1: Founder sales pipeline
- Build: Lead board (`new`, `qualified`, `demo`, `pilot`, `won`, `lost`).
- Done when: 100% conversations logged.

### Action GTM-2: Case study pipeline
- Build: Proof library with template (`problem`, `before`, `after`, `metrics`).
- Done when: First 3 case studies published.

### Action GTM-3: Partner channel tracker
- Build: Reseller/affiliate partner status board.
- Done when: First 5 partner conversations tracked.

## 4.7 Reliability & Cost

### Action RC-1: AI cost guardrails
- Build: Cost per active user + cost per completed outcome dashboards.
- Done when: Alerting triggers at budget thresholds.

### Action RC-2: Model routing policy
- Build: Route map (default model, fallback model, high-cost exception rules).
- Done when: Routing table documented and deployed.

### Action RC-3: Incident response panel
- Build: Incident timeline + severity + owner + postmortem link.
- Done when: First incident drill completed.

## 4.8 Compliance & Trust

### Action CT-1: Data lifecycle controls
- Build: Retention/deletion policy tracker by data type.
- Done when: Self-serve delete request flow documented and test-passed.

### Action CT-2: Audit logging
- Build: Admin action logs and export.
- Done when: Access, role, and data-change events logged.

### Action CT-3: Trust center checklist
- Build: Public trust page checklist (security, privacy, uptime, contacts).
- Done when: Checklist 100% complete and reviewed monthly.

## 4.9 Experiment Lab

### Action EL-1: Experiment template
- Build: Standard experiment form:
  - hypothesis
  - metric
  - baseline
  - expected uplift
  - segment
  - duration
  - decision rule
- Done when: All experiments use this template.

### Action EL-2: Active experiment board
- Build: Live board with `planned`, `running`, `analyzing`, `adopted`, `killed`.
- Done when: Weekly decision meeting uses this board only.

### Action EL-3: Win-rate dashboard
- Build: Experiment outcomes by category (onboarding, retention, pricing).
- Done when: Rolling 90-day win rate visible.

## 4.10 Weekly Operating Rhythm

### Action WR-1: Monday metrics review
- Build: 30-minute agenda block:
  1. North star trend
  2. Funnel blockers
  3. Cost anomalies
  4. Experiment decisions
- Done when: Calendarized and completed weekly.

### Action WR-2: Wednesday build checkpoint
- Build: Delivery tracker for all `in_progress` P0/P1 tasks.
- Done when: Blockers escalated same day.

### Action WR-3: Friday decision log
- Build: Weekly decision register with:
  - decision
  - rationale
  - expected metric impact
  - owner
- Done when: Published every Friday.

## 5) 30-60-90 Day Dashboard Tasks

## Day 0-30 (Foundation)
1. Complete `NS-1`, `NS-2`, `FC-1`, `AQ-1`, `WR-1`.
2. Launch first live KPI dashboard.
3. Activate weekly operating rhythm.

## Day 31-60 (Conversion + Retention)
1. Complete `FC-2`, `FC-3`, `RE-1`, `RE-2`, `PP-1`, `PP-2`.
2. Run first onboarding and paywall experiments.
3. Publish first customer outcome scorecards.

## Day 61-90 (Scale + Efficiency)
1. Complete `RC-1`, `RC-2`, `GTM-1`, `GTM-2`, `CT-1`, `EL-3`.
2. Launch partner channel tracking.
3. Hit stable cost and reliability reporting cadence.

## 6) Codex Task Blocks (Copy/Paste)

Use these as direct prompts to execute work in sequence.

### Block 1: Build Operations Menu Skeleton
`Create an Operations dashboard with the 10 submenu sections from OPERATIONAL_MENU_CODEX_PLAYBOOK.md. Add placeholder pages and shared task model fields.`

### Block 2: Implement KPI and Funnel Data Layer
`Implement event taxonomy and KPI queries for visit -> paid conversion funnel. Add validation for required event fields and create daily-refresh dashboard views.`

### Block 3: Implement AI Quality Registry
`Add AI Flow Registry CRUD and prompt version history. Include output contract, latency SLA, fallback behavior, and owner per flow.`

### Block 4: Implement Retention Engine Views
`Build weekly next-best-action planner, progress loop tracker, and reminder orchestration dashboard with measurable outcomes.`

### Block 5: Implement Pricing/GTM/Reliability Panels
`Create pricing matrix manager, sales pipeline board, case study tracker, cost guardrails dashboard, model routing policy panel, and incident response log.`

### Block 6: Implement Weekly Operating Rhythm
`Add weekly review workflow (Monday metrics, Wednesday checkpoint, Friday decisions) with completion tracking and overdue alerts.`

## 7) Definition of Success (Project-Level)

This operations menu is successful when:
1. Every strategic priority has a visible owner, target, and due date.
2. Weekly decisions are made from live dashboard data.
3. Activation, retention, and model cost trends are measurable and improving.
4. Team can identify top 3 blockers in under 5 minutes from the dashboard.

