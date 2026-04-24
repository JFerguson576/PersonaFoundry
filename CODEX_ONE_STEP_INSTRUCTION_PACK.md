# CODEX One-Step Instruction Pack (Enhancements 1-4)

## Purpose
Implement Enhancements 1-4 with minimal drift and minimal token overhead:
1. AI Interaction Inventory
2. Standard AI Contract (input/output/fallback)
3. Quality Rubric + post-generation checks
4. End-to-end telemetry upgrades
## Mandatory Pre-Implementation Refresh (Run First)
Before making any code changes, CODEX must rescan the current repo and regenerate both instruction files from latest code state.

Required actions:
1. Rescan current OpenAI touchpoints, telemetry files, admin reporting files, and user action hook files.
2. Update `CODEX_ONE_STEP_INSTRUCTION_PACK.md` if file map or steps changed.
3. Regenerate `CODEX_ONE_STEP_INSTRUCTION_PACK.docx` from the refreshed `.md`.
4. Output a short "Refresh Summary" listing what changed in the pack.
5. Only then start implementation steps.

Hard rule:
- If refresh detects drift (new/changed routes, schema, or components), CODEX must implement against refreshed instructions, not stale instructions.

## Area Map (Current Code)

### A) OpenAI invocation points (must be covered)
- `C:\Users\johnf\Desktop\personafoundry\app\api\agent\respond\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\analyze-profile-ai\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-assets\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-company-dossier\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-cover-letter\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-interview-prep\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-profile\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-strategy-document\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\generate-target-company-workflow\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\chat-sandbox\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\teamsync\conversation\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\teamsync\resources\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\teamsync\simulate\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\career-background-jobs.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\career-live-jobs.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\openai-organization-usage.ts`

### B) Telemetry + admin reporting points
- `C:\Users\johnf\Desktop\personafoundry\lib\telemetry.ts`
- `C:\Users\johnf\Desktop\personafoundry\supabase\admin_telemetry.sql`
- `C:\Users\johnf\Desktop\personafoundry\app\api\admin\overview\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\components\admin\AdminDashboardClient.tsx`

### C) User action hook points (save/copy/regenerate/use)
- `C:\Users\johnf\Desktop\personafoundry\components\career\CareerAssetEditor.tsx`
- `C:\Users\johnf\Desktop\personafoundry\components\PersonaChatSandbox.tsx`
- `C:\Users\johnf\Desktop\personafoundry\components\navigation\ExperienceAgentWidget.tsx`
- `C:\Users\johnf\Desktop\personafoundry\components\teamsync\TeamSyncWorkspaceClient.tsx`
- `C:\Users\johnf\Desktop\personafoundry\lib\career-client.ts`

## Implementation Order (strict)

### Step 1: Add shared AI primitives
Create:
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\contracts.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\parse.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\quality-rubric.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\sources.ts`

Define:
- `AIInteractionKey` union (one key per interaction)
- `AIInputEnvelope`, `AIOutputEnvelope`, `AIErrorEnvelope`
- `parseJsonOutput<T>()`, `safeTextOutput()`
- `scoreOutput({text,sources,actions}) -> {relevance,actionability,clarity,trust,total}`
- `validateSourceList()` with min-count + valid URL checks

### Step 2: Add inventory doc
Create:
- `C:\Users\johnf\Desktop\personafoundry\docs\ai-interaction-registry.md`

Include one row per interaction with:
- interaction_key
- owner
- input sources
- output artifact
- model
- fallback strategy
- telemetry events

### Step 3: Upgrade telemetry schema + logger
Update SQL:
- `C:\Users\johnf\Desktop\personafoundry\supabase\admin_telemetry.sql`

Add columns:
- `api_usage_logs.interaction_key text`
- `api_usage_logs.schema_version text`
- `api_usage_logs.quality_score_total integer`
- `api_usage_logs.user_action_after_output text`
- `api_usage_logs.time_to_first_action_ms integer`

Update logger:
- `C:\Users\johnf\Desktop\personafoundry\lib\telemetry.ts`

Extend `logApiUsage` input and insert payload with new fields.
Keep backward compatibility by defaulting new fields to null.

### Step 4: Standardize OpenAI routes/jobs
Patch all files in section A:
- assign `interaction_key`
- normalize outputs via `AIOutputEnvelope`
- normalize error/fallback via `AIErrorEnvelope`
- parse content via shared parsers
- apply quality scoring before save/return
- for research outputs: enforce `validateSourceList` before save
- write `logApiUsage` with `interaction_key`, `schema_version`, `quality_score_total`

Rule:
- Do not change business intent; only normalize structure + instrumentation + guards.

### Step 5: User action telemetry hooks
Patch files in section C:
- emit follow-up telemetry events when user:
  - saves
  - copies
  - regenerates/retries
  - uses next action CTA

Use existing API layer where possible; do not duplicate business APIs.
Store signals in `usage_events` metadata and/or `api_usage_logs.user_action_after_output` flow.

### Step 6: Admin reporting update
Patch:
- `C:\Users\johnf\Desktop\personafoundry\app\api\admin\overview\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\components\admin\AdminDashboardClient.tsx`

Add panels:
- output quality by interaction_key
- regenerate-without-save signal
- time-to-first-action trend
- cost-per-useful-output approximation

TeamSync-specific dashboard requirements (required):
- include interaction keys:
  - `teamsync.simulate`
  - `teamsync.conversation`
  - `teamsync.resources`
- add `teamsync_funnel`:
  - run_started -> run_completed -> run_saved -> share_or_export_used
- add `teamsync_kpis`:
  - saved_run_conversion_rate
  - export_share_activation_rate (Slack/Teams/email/docx/csv)
  - repeat_simulation_rate
  - high_intent_workspace_rate
- add `teamsync_quality_by_scenario[]`:
  - scenario_mode (`custom|library|executive`)
  - quality_score_avg
  - sample_count
- add `teamsync_friction_hotspots[]`:
  - member_load_step
  - simulate_step
  - save_share_step
- add concise “What this means” text under each TeamSync chart/card.
- add “Explain this metric” action wired to Experience Agent context prompts.

### Step 7: Validate and lint
Run:
- `npm run lint`

If lint fails, fix only touched files.

### Step 8: Deliverables
Return:
- changed files list
- migration SQL summary
- interaction keys added
- telemetry fields populated
- any residual TODOs

## Copy/Paste Prompt For Codex (Low-Token)
Use exactly this with Codex:

```text
First run the Mandatory Pre-Implementation Refresh section in C:\\Users\\johnf\\Desktop\\personafoundry\\CODEX_ONE_STEP_INSTRUCTION_PACK.md (rescan + regenerate .md and .docx), then apply implementation exactly as written.
Constraints:
- Keep changes scoped to listed files plus new files specified.
- Preserve current business behavior.
- Add shared AI contracts/parsers/rubric/sources helpers.
- Add telemetry schema + logger fields.
- Normalize all OpenAI interaction routes/jobs to common output/error envelopes.
- Add user action telemetry hooks for save/copy/regenerate/use.
- Update admin overview + dashboard to expose new metrics.
- Ensure TeamSync metrics and charts are first-class in dashboard payload + UI.
- Run npm run lint and fix issues in touched files.
Output only: (1) changed files, (2) key implementation notes, (3) lint result.
```

## Phase 2: 6-12 Weeks (LATER) Ideas and Build Instructions

### Goal
Productize and scale: modular enrichment, white-label controls, partner benchmarks, and predictive guidance.

### L1) Modular Enrichment Marketplace

Build:
- New registry + runtime selection for enrichment modules (config-driven, no route rewrites).

Create files:
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\enrichments\registry.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\enrichments\types.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\enrichments\runner.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\admin\ai-enrichments\route.ts`

Data model (new SQL file):
- `C:\Users\johnf\Desktop\personafoundry\supabase\ai_enrichments.sql`
- Tables:
  - `ai_enrichment_modules` (key, name, domain, status, default_config_json, min_plan)
  - `tenant_enrichment_modules` (tenant/user scope, module_key, enabled, config_json)

UI/Admin:
- Extend `AdminDashboardClient.tsx` with "AI Enrichments" panel:
  - enable/disable modules
  - set defaults per tenant/scope

Ideas to include:
- Domain packs: recruiting, coaching, education, GTM.
- Partner-contributed modules with approval status.

### L2) White-Label Cost/Quality Control Center

Build:
- Tenant policy controls that govern model tier, token caps, quality threshold, source strictness.

Create files:
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\tenant-policy.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\admin\ai-policies\route.ts`

Patch files:
- `C:\Users\johnf\Desktop\personafoundry\lib\career-background-jobs.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\career-live-jobs.ts`
- all direct route-level OpenAI calls in section A

Data model (new SQL file):
- `C:\Users\johnf\Desktop\personafoundry\supabase\tenant_ai_policies.sql`
- Table `tenant_ai_policies`:
  - scope key (tenant/user)
  - model_tier (`economy|balanced|premium`)
  - max_tokens
  - quality_min_total
  - source_min_count
  - source_domain_mode (`open|allowlist`)

UI/Admin:
- Add "AI Policy" card in `AdminDashboardClient.tsx`:
  - preset selector
  - live estimated cost impact
  - quality-risk badge

Ideas to include:
- Emergency mode auto-downgrade when budget risk = critical.
- Per-tier behavior presets exposed as product plans.

### L3) Partner Benchmark Intelligence

Build:
- Anonymous cohort metrics and deltas for resellers/partners.

Create files:
- `C:\Users\johnf\Desktop\personafoundry\app\api\admin\benchmarks\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\lib\analytics\benchmarks.ts`

Data model (new SQL file):
- `C:\Users\johnf\Desktop\personafoundry\supabase\partner_benchmarks.sql`
- Materialized view/table for aggregated metrics by segment/domain/plan.

UI/Admin:
- Add "Benchmark" panel in `AdminDashboardClient.tsx`:
  - your metric vs cohort median
  - percentile badge
  - top gap + recommended action

Ideas to include:
- Quarterly export narrative for reseller decks.
- "Next best improvement" suggestions generated from benchmark gaps.

### L4) Predictive Guidance Layer (Next Best Action + Stall Risk)

Build:
- Scoring engine for next action and stall/churn risk flags.

Create files:
- `C:\Users\johnf\Desktop\personafoundry\lib\ai\next-best-action.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\career\next-actions\route.ts`
- `C:\Users\johnf\Desktop\personafoundry\app\api\admin\retention-risk\route.ts`

Patch UI:
- `C:\Users\johnf\Desktop\personafoundry\components\career\CareerCandidateClient.tsx`
- Add "Next best action" card + estimated effort/time.

Data model (new SQL file):
- `C:\Users\johnf\Desktop\personafoundry\supabase\next_best_actions.sql`
- Tables:
  - `next_best_actions`
  - `retention_risk_events`

Ideas to include:
- Proactive autopilot nudges at user-specific best response time.
- "Recovery plan" mode when risk crosses threshold.

## 6-12 Week Delivery Order

1. L2 White-label controls (highest monetization and margin control)
2. L1 Modular enrichment marketplace (expansion surface)
3. L4 Predictive guidance (retention and behavior lift)
4. L3 Partner benchmarks (sales and partner enablement)

## 6-12 Week Success Metrics
- ARPU increase in reseller/white-label segments.
- Lower cost per useful output under policy control.
- Higher repeat usage in cohorts with next-best-action.
- Partner dashboard adoption and benchmark-driven actions.

## Optional Copy/Paste Prompt For Codex (Phase 2)
Use this after Phase 1 is done:

```text
First run the Mandatory Pre-Implementation Refresh section in C:\\Users\\johnf\\Desktop\\personafoundry\\CODEX_ONE_STEP_INSTRUCTION_PACK.md (rescan + regenerate .md and .docx), then apply Phase 2 (6-12 weeks).
Implement L1-L4 in listed order with new SQL migrations and admin panels.
Constraints:
- Reuse Phase 1 contracts/telemetry primitives.
- Keep existing behavior stable unless policy controls explicitly change it.
- Add feature flags for all new panels and scoring engines.
- Run npm run lint and return changed files + migration summary + flag list.
```


