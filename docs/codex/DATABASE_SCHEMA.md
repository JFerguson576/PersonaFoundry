# Database Schema Notes

Last refreshed: 2026-04-27.

## Principle

All user-owned data must include user ownership and be protected by Row Level Security. Admin/service-role routes may aggregate across users only when the route enforces admin capability checks.

## Schema Files

The repo keeps SQL setup files in `supabase/`. Key groups:

| Area | Files / Tables |
|---|---|
| Admin settings/roles | `admin_settings`, `user_roles`, `user_access_levels`, `admin_notebook_entries` |
| Telemetry | `usage_events`, `api_usage_logs` |
| Career core | `career_candidates`, `career_source_documents`, `career_candidate_profiles`, `career_generated_assets`, `career_applications` |
| Career automation | `career_background_jobs`, `career_live_job_runs`, `career_premium_autopilot_settings`, `career_premium_autopilot_review_queue` |
| Community | `community_posts`, `community_comments`, `community_post_votes` |
| Experience agent | `experience_agent_sessions`, `experience_agent_messages`, `experience_agent_feedback` |
| Marketing engine | `mkt_policy_settings`, `mkt_cash_ledger`, `mkt_budget_snapshots`, `mkt_recommendations`, `mkt_approvals`, `mkt_audit_log`, `mkt_alerts`, `mkt_campaigns`, `mkt_coach_*` |
| TeamSync | `teamsync_workspaces`, `teamsync_members`, `teamsync_runs`, `teamsync_outreach_*` |
| Tester/referral/tour | `tester_feedback_*`, `referral_invites`, `user_tour_progress`, `user_subscriptions` |

## Current Telemetry Columns

`api_usage_logs` includes baseline usage/cost fields and Codex-planned AI quality fields:

- `interaction_key`
- `schema_version`
- `quality_score_total`
- `user_action_after_output`
- `time_to_first_action_ms`

Keep these nullable for backward compatibility with existing callers.

## RLS Pattern

Use policies shaped like:

```sql
alter table public.some_user_table enable row level security;

create policy "Users can read their own rows"
on public.some_user_table
for select
using (auth.uid() = user_id);
```

## Codex Rule

Do not create or modify database schema unless the task explicitly asks for it. When schema changes are required, update the matching TypeScript logger/route code in the same task and run `npm.cmd run build`.
