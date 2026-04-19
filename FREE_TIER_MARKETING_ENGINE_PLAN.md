# Personara Marketing Engine: Free-Tier MVP Plan

Date: 2026-04-17  
Scope: Build the Marketing Management Engine inside Control Center using free tiers first and low-risk operating patterns.

## 1) Goal

Ship a working Marketing Engine that helps you:
- see cash-in and safe-to-spend in one place,
- manage campaigns/offers/experiments with governance,
- run recommendations in a human-approved workflow,
- avoid monthly platform costs while traction grows.

## 2) Free-Tier-First Stack

- Supabase Free: auth, Postgres, RLS, admin tables
- PostHog Free: product + acquisition events
- Resend Free: low-volume alerts and approval emails
- Stripe standard account: payment events (no monthly setup fee)
- CSV/manual import adapters first, direct ad APIs later

## 3) MVP Boundaries (What we build now)

Build now:
- Executive command card set (cash collected, safe budget, reserve status, active campaigns, pipeline health)
- Budget policy engine (rules-first)
- Campaign workspace
- Offer + landing link manager
- Experiment registry (required fields enforced)
- Approval queue
- Audit log
- Alerts center (in-app + email)

Defer:
- Full autonomous budget changes
- LinkedIn advanced ad automation
- High-frequency AI auto-analysis
- Heavy warehouse/BI stack

## 4) Control Center Information Architecture

Add top-level nav item:
- `Control Center > Marketing Engine`

Marketing Engine sub-tabs:
1. Overview
2. Budget Cockpit
3. Campaigns
4. Offers & Landing Pages
5. Experiments
6. Approvals
7. Alerts
8. Audit Log
9. Integrations

## 5) Data Model (MVP tables)

Use compact operational schema first:

- `mkt_policy_settings`
  - reserve_floor_amount
  - reinvestment_rate_pct
  - max_weekly_spend
  - payback_target_days
  - automation_mode (`manual` | `approval_gated`)

- `mkt_cash_ledger`
  - source (`stripe`, `manual`)
  - event_type (`invoice_paid`, `refund`, `adjustment`)
  - amount
  - occurred_at
  - reference_id

- `mkt_budget_snapshots`
  - week_start
  - collected_cash_7d
  - safe_budget_weekly
  - safe_budget_daily
  - reserve_status (`healthy`, `watch`, `critical`)
  - computed_by

- `mkt_campaigns`
  - name
  - channel
  - status
  - offer_id
  - landing_url
  - daily_budget
  - owner_user_id

- `mkt_offers`
  - offer_name
  - offer_type
  - setup_fee
  - monthly_price
  - annual_price
  - notes

- `mkt_experiments`
  - title
  - hypothesis
  - primary_metric
  - guardrail_metric
  - owner_user_id
  - decision_date
  - status

- `mkt_recommendations`
  - entity_type (`campaign`, `budget`, `creative`)
  - entity_id
  - recommendation_type (`increase`, `decrease`, `hold`, `pause`, `refresh`)
  - reason_codes_json
  - metric_snapshot_json
  - status (`proposed`, `approved`, `rejected`, `applied`)

- `mkt_approvals`
  - recommendation_id
  - requested_by
  - assigned_to
  - decision
  - decided_at
  - notes

- `mkt_alerts`
  - alert_type
  - severity
  - message
  - related_entity_type
  - related_entity_id
  - status (`open`, `acknowledged`, `resolved`)

- `mkt_audit_log`
  - actor_user_id
  - actor_role
  - action_type
  - entity_type
  - entity_id
  - before_json
  - after_json
  - created_at

## 6) Rules Engine (MVP logic)

Weekly safe budget:
- `safe_budget_weekly = min(reinvestment_rate * collected_cash_7d, max_weekly_spend, cash_on_hand - reserve_floor_amount)`
- If result < 0, force 0 and raise `reserve risk` alert.

Hard rules:
- Never auto-increase spend if reserve would be breached.
- Any change above policy band goes to approvals.
- Every apply action writes audit log.
- Every applied action must be reversible.

## 7) Free-Tier Delivery Plan

## Sprint 1 (Critical, 1 week)
- Schema + RLS + role checks
- Marketing Engine shell and tabs
- Policy settings screen
- Manual cash ledger input
- Budget snapshot calculator job
- Overview dashboard v1

Exit criteria:
- Admin can set policy and see safe budget computed from real ledger entries.

## Sprint 2 (Critical, 1 week)
- Campaign workspace + offers manager
- Recommendations table (rules-first, no ML)
- Approval queue
- Audit logging
- Alerts center + Resend notifications

Exit criteria:
- Recommendation can be created, approved/rejected, applied, and fully audited.

## Sprint 3 (High, 1 week)
- Experiment registry
- PostHog event import summary cards
- Stripe event sync job (invoices/refunds)
- Integrations health view

Exit criteria:
- Experiments and integration health are visible and governed.

## 8) API Routes (MVP)

- `GET/POST /api/admin/marketing/policy`
- `GET/POST /api/admin/marketing/cash-ledger`
- `POST /api/admin/marketing/budget/recompute`
- `GET/POST /api/admin/marketing/campaigns`
- `GET/POST /api/admin/marketing/offers`
- `GET/POST /api/admin/marketing/experiments`
- `GET/POST /api/admin/marketing/recommendations`
- `POST /api/admin/marketing/recommendations/:id/approve`
- `POST /api/admin/marketing/recommendations/:id/reject`
- `POST /api/admin/marketing/recommendations/:id/apply`
- `GET /api/admin/marketing/alerts`
- `GET /api/admin/marketing/audit`
- `GET /api/admin/marketing/integrations/health`

## 9) UX Simplicity Rules

- One primary action per screen.
- All “critical risk” states show a single recommended next action.
- Hide advanced settings behind expand/collapse.
- Keep status language plain: `Healthy`, `Watch`, `Critical`.
- Keep all writable actions behind clear confirm prompts.

## 10) Cost Control Policy (Operational)

- AI summaries only on-demand button click.
- Sync cadence every 6–12 hours unless critical.
- No always-on background inference loops.
- Email alerts grouped (digest mode) when possible.
- Log API usage daily in dashboard.

## 11) Next Build Command

Implementation should begin with:

## 12) New Channel: Gallup Coach Outreach Program (Todo)

Objective:
- create a dedicated acquisition motion for Gallup strengths provider coaches
- manage this channel directly inside the Marketing Engine admin console

MVP scope:
- add `Coach Outreach` as a first-class section in Marketing Engine
- support lead lifecycle stages:
  - identified
  - contacted
  - replied
  - discovery booked
  - trial started
  - converted
- include next-action date and owner for every coach lead
- include outreach templates for core segments:
  - independent coach
  - enterprise/internal coach
  - multi-coach practice/partner

Data model additions (MVP):
- `mkt_coach_leads`
  - full_name
  - business_name
  - email
  - country
  - segment
  - stage
  - source
  - owner_user_id
  - next_action_at
  - notes
- `mkt_coach_touchpoints`
  - coach_lead_id
  - channel (`email`, `linkedin`, `call`, `webinar`, `event`)
  - touch_type (`outreach`, `followup`, `demo`, `proposal`, `close`)
  - outcome
  - occurred_at
  - actor_user_id
- `mkt_coach_templates`
  - template_name
  - segment
  - channel
  - subject
  - body
  - active

Dashboard additions:
- coach outreach sent (7d/30d)
- reply rate
- demo-booked rate
- conversion count
- lightweight CAC proxy (manual spend / converted coaches)

Why this matters:
- Gallup coach channel is a high-fit, trust-based B2B2C path for Personara adoption
- gives you a repeatable partner-led growth lane without paid-ad dependence

## 13) Sprint Checklist: Gallup Coach Channel (Build Order)

Commercial decision to test first:
- offer each Gallup coach a free partner license
- pay 20% recurring rev share for 12 months per referred paid user
- increase to 30% for high-performing partners only after conversion thresholds are met

Sprint 1 (Schema + API foundation):
- DB tasks:
  - create `mkt_coach_leads`
  - create `mkt_coach_touchpoints`
  - create `mkt_coach_templates`
  - add indexes + updated_at triggers + RLS no-direct-access policies
- API tasks:
  - `GET /api/admin/marketing/coach-outreach`
  - `POST /api/admin/marketing/coach-outreach` (create lead)
  - `PATCH /api/admin/marketing/coach-outreach` (stage and follow-up updates)
- UI tasks:
  - add `Coach outreach` nav item in Marketing Engine
  - add lead intake form
  - add stage tracking table with inline stage updates
- Estimated effort: 1-2 days

Sprint 2 (Execution workflow):
- DB tasks:
  - add outreach sequence table for templated steps per segment
  - add touchpoint outcome enums + optional reply sentiment field
- API tasks:
  - add endpoint to log outbound touchpoint in one click
  - add endpoint to mark demo booked / trial started / converted
- UI tasks:
  - one-click "log outreach" actions
  - follow-up queue by `next_action_at`
  - "due today / overdue" board view
- Estimated effort: 2-3 days

Sprint 3 (Attribution + dashboard):
- DB tasks:
  - map partner coach to referral code and converted users
  - store monthly partner payout snapshots
- API tasks:
  - conversion attribution endpoint (referral -> paid)
  - payout summary endpoint
- UI tasks:
  - channel KPI cards: sent, replies, demos, trials, conversions
  - partner leaderboard
  - payout readiness report
- Estimated effort: 2-4 days

Sprint 4 (Scale + controls):
- DB/API tasks:
  - role-based assignment for outreach owners
  - audit log hooks for lead stage changes
- UI tasks:
  - admin bulk import/export
  - segment-level playbooks and A/B message variants
  - fail-safe controls for duplicate leads and contact suppression
- Estimated effort: 2-3 days
1. SQL migration for the tables above
2. `/control-center/marketing-engine` page scaffold
3. Policy + cash ledger + budget recompute path end-to-end
