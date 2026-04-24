# CODEX Execution Plan: OpenAI Foundation Asset (Detailed Build Blueprint)

## Objective
Turn current OpenAI touchpoints into a governed enrichment platform that is measurable, repeatable, and monetizable across direct users, resellers, and white-label owners.

## What "Done" Looks Like
- Every AI interaction is registered, typed, logged, and quality-scored.
- Every high-value output has evidence, confidence framing, and next actions.
- Retention loops are intentional, measurable, and improving week over week.
- Reseller and white-label features are configurable without code forks.

## Prioritization Framework
- User outcome lift (interview readiness, application quality, action completion)
- Retention lift (WAU return rate, session depth, feature re-use)
- Revenue/margin leverage (higher ARPU, lower cost per successful outcome)
- Implementation risk (complexity, compliance, model uncertainty)

## NOW (0-2 weeks): Foundation and Control

### 1) Canonical AI Interaction Inventory
- [ ] What to build exactly:
  - Create `docs/ai-interaction-registry.md` with one row per AI endpoint/function.
  - Include these existing areas: `app/api/agent/respond`, `app/api/analyze-profile-ai`, `career/* generation routes`, `teamsync/*`, `lib/career-background-jobs`, `lib/career-live-jobs`.
  - Add fields: owner, purpose, input sources, output artifact, model, fallback behavior, telemetry event names.
- [ ] Additional functionality ideas:
  - Add a "criticality" tag (`critical`, `high`, `medium`) for incident response priority.
  - Add "revenue tie" tag to identify monetization-critical interactions.
- [ ] Acceptance criteria:
  - 100% known OpenAI calls are listed.
  - Each call has named owner and SLA expectations.

### 2) Standard Interaction Contract (Input/Output/Fallback)
- [ ] What to build exactly:
  - Add `lib/ai/contracts.ts` with shared TypeScript interfaces:
    - `AIInteractionInputEnvelope`
    - `AIInteractionOutputEnvelope`
    - `AIInteractionErrorEnvelope`
  - Add shared parser/validator helpers in `lib/ai/parse.ts`.
  - Refactor routes to emit a normalized envelope instead of ad hoc payloads.
- [ ] Additional functionality ideas:
  - Add "degraded mode" outputs (short deterministic templates) when OpenAI fails.
  - Add output versioning (`schema_version`) for backward compatibility.
- [ ] Acceptance criteria:
  - All AI routes compile against common contract.
  - Client-side consumers can rely on one stable shape.

### 3) Quality Rubric and Post-Generation Checks
- [ ] What to build exactly:
  - Add `lib/ai/quality-rubric.ts` with scored dimensions:
    - relevance (0-5)
    - actionability (0-5)
    - clarity (0-5)
    - trust/evidence (0-5)
  - Add route-level post-processing to reject or revise outputs below threshold.
  - Add optional auto-rewrite pass for low-scoring outputs.
- [ ] Additional functionality ideas:
  - "Explain your reasoning in one sentence" footer for trust.
  - "What to do next in 24 hours" block for actionability.
- [ ] Acceptance criteria:
  - Every saved generated artifact has rubric metadata.
  - Low-quality outputs are either revised or blocked from save.

### 4) Baseline Telemetry for Every OpenAI Interaction
- [ ] What to build exactly:
  - Extend `lib/telemetry.ts` and `api_usage_logs` insert payload with:
    - `interaction_key`
    - `user_action_after_output` (`saved`, `copied`, `dismissed`, `regenerated`)
    - `time_to_first_action_ms`
    - `quality_score_total`
    - `schema_version`
  - Add UI event hooks in relevant components for save/copy/regenerate actions.
- [ ] Additional functionality ideas:
  - Build "dissatisfaction detector" = regenerate within 90 seconds + no save.
  - Build "power user pattern" = repeated use of same interaction category.
- [ ] Acceptance criteria:
  - 100% of AI interactions emit start/end usage logs.
  - Dashboard shows quality/usage/cost trend by interaction key.

### 5) Budget Guardrails and Burn Alerts
- [ ] What to build exactly:
  - Use existing admin openai budget route and add three thresholds:
    - warning at 60%
    - risk at 80%
    - critical at 100%
  - Add projected month-end burn estimate in admin and recommended actions.
  - Add route-level optional throttle behavior when `critical`.
- [ ] Additional functionality ideas:
  - "Cost per successful artifact" metric by workflow.
  - Automatic model downgrade (e.g., to cheaper model) under emergency mode.
- [ ] Acceptance criteria:
  - Admin dashboard visibly flags state (safe/warning/risk/critical).
  - Alerts are persisted and auditable.

### 6) Source-Evidence Requirements for Research Outputs
- [ ] What to build exactly:
  - Standardize source extraction via shared helper used in dossier/live-jobs paths.
  - Require minimum source count for research outputs before save.
  - Add source quality checks (valid URL, non-duplicate, relevant domain).
- [ ] Additional functionality ideas:
  - Add "freshness date" per source.
  - Add source confidence labels (`strong`, `moderate`, `weak`).
- [ ] Acceptance criteria:
  - Research outputs always include source list section.
  - Outputs without minimum evidence fail validation.

### Success Criteria (NOW)
- 100% interactions inventoried and contract-compliant.
- 100% interactions telemetry-enabled.
- Quality and budget controls visible in admin.

## NEXT (2-6 weeks): Retention and Personalization Engine

### 1) Behavior Loops (Return Usage Engine)
- [ ] What to build exactly:
  - Progress ladder UI in candidate workflows (e.g., profile -> assets -> outreach -> interview prep).
  - Micro-commitment capture (`I will apply to 3 roles by Friday`) with follow-up reminders.
  - "Open loop" module: unfinished next step automatically surfaced on next login.
- [ ] Additional functionality ideas:
  - Momentum score (streak + completion trend).
  - Celebrate meaningful milestones (not vanity milestones).
- [ ] Acceptance criteria:
  - Loop features available in at least one complete workflow.
  - Weekly return rate improves for exposed cohort.

### 2) Adaptive Personalization
- [ ] What to build exactly:
  - Add `user_growth_memory` table:
    - goals, blockers, wins, preferred style, recent outcomes.
  - Inject memory snippets into prompt construction.
  - Adjust suggestions based on outcomes (callbacks, replies, interviews, offers).
- [ ] Additional functionality ideas:
  - Preferred coaching mode toggle (`direct`, `supportive`, `structured`).
  - Personal "avoid patterns" coaching based on repeated mistakes.
- [ ] Acceptance criteria:
  - Prompts include memory context when available.
  - Users see explicit continuity across sessions.

### 3) Reseller Tenant Configuration Packs
- [ ] What to build exactly:
  - Add tenant settings for:
    - industry profile
    - tone profile
    - policy constraints
    - default output templates
  - Add admin UI for tenant-level prompt pack selection.
- [ ] Additional functionality ideas:
  - "Template marketplace" for reseller-ready deliverables.
  - Tenant benchmark report against anonymized peer average.
- [ ] Acceptance criteria:
  - At least one reseller tenant can run fully branded and segmented outputs.

### 4) Experimentation Framework (A/B)
- [ ] What to build exactly:
  - Create experiment assignment utility (`lib/experiments/assign.ts`).
  - Add experiment flags for:
    - short brief vs checklist output
    - reminder timing windows
    - confidence/explanation style
  - Store experiment exposure + outcomes in telemetry.
- [ ] Additional functionality ideas:
  - Multi-armed bandit for format optimization in later phase.
  - Auto-stop losing variants with guardrail thresholds.
- [ ] Acceptance criteria:
  - At least 2 live experiments with statistically interpretable data.

### Success Criteria (NEXT)
- +15% repeat weekly active usage (target segment).
- +10% action completion on AI-generated plans.
- Reduced regenerate-without-save behavior.

## LATER (6-12+ weeks): Productization and Scale

### 1) Modular Enrichment Marketplace
- [ ] What to build exactly:
  - Create plugin-style enrichment registry (`enrichment_modules`) with config-driven execution.
  - Define module contract: inputs, outputs, quality checks, pricing tier availability.
- [ ] Additional functionality ideas:
  - Domain packs: recruiting, coaching, education, founder GTM.
  - Partner-authored modules with approval workflow.
- [ ] Acceptance criteria:
  - New enrichment module can be added without core route rewrites.

### 2) White-Label Cost/Quality Admin Controls
- [ ] What to build exactly:
  - Add per-tenant control panel:
    - model tier
    - reasoning effort
    - max tokens
    - quality threshold
    - source strictness
  - Add policy enforcement middleware so route calls obey tenant controls.
- [ ] Additional functionality ideas:
  - SLA mode (`economy`, `balanced`, `premium`) presets.
  - Tenant-level protected prompts for proprietary IP.
- [ ] Acceptance criteria:
  - Tenant config changes reflect in real generation behavior and telemetry.

### 3) Partner Benchmark Intelligence
- [ ] What to build exactly:
  - Build anonymized cohort metrics by industry/segment/plan.
  - Show benchmark deltas in partner dashboard.
- [ ] Additional functionality ideas:
  - "Next best improvement" recommendations based on benchmark gaps.
  - Quarterly benchmark report export for reseller sales enablement.
- [ ] Acceptance criteria:
  - Benchmarks cannot expose identifiable customer data.
  - Partners can compare themselves against normalized peers.

### 4) Predictive Guidance Layer
- [ ] What to build exactly:
  - Add `next_best_action` scoring service with weighted inputs:
    - recency of action
    - completion history
    - output quality trend
    - stage bottlenecks
  - Add churn/stall risk flags and proactive interventions.
- [ ] Additional functionality ideas:
  - "Autopilot when stuck" mode that proposes a full recovery plan.
  - Proactive nudges selected by best personal response window.
- [ ] Acceptance criteria:
  - Prediction-driven suggestions outperform static suggestions in A/B test.

### Success Criteria (LATER)
- Higher ARPU from reseller and white-label tiers.
- Lower churn in users with predictive + personalization features.
- Stable/improving margin per successful user outcome.

## Cross-Cutting Additional Functionality Ideas
- Trust layer:
  - "Why this recommendation" explainers for every key output.
  - Confidence bands and ambiguity warnings.
- Collaboration:
  - Shareable draft links for coaches/managers/recruiters to comment.
  - Human-in-the-loop review queue for premium tiers.
- Safety/compliance:
  - Prompt/response redaction for sensitive fields.
  - Policy violation scanner for generated content.
- Commercialization:
  - Tiered AI credits and usage packs.
  - Premium "done-with-you" autopilot bundles.

## Data Model Additions (Suggested)
- `ai_interaction_registry`
- `ai_output_quality_scores`
- `user_growth_memory`
- `engagement_commitments`
- `experiment_exposures`
- `next_best_actions`
- `tenant_ai_policies`

## API and UI Deliverables
- API:
  - Standardized AI envelope across all generation endpoints.
  - Shared quality + source validation middleware.
  - Experiment assignment and logging middleware.
- UI:
  - Admin: budget risk panel, interaction health panel, experiment panel.
  - User: progress ladder, open loops, commitment prompts, next-best-action card.
  - Partner: benchmark and tenant configuration screens.

## Operating Cadence
- Weekly:
  - Review quality, cost, and retention scorecard.
  - Decide one experiment to start and one to stop.
- Monthly:
  - Audit interaction inventory completeness.
  - Re-balance quality/cost controls.
- Quarterly:
  - Refresh reseller/white-label packs and benchmark narrative.

## Immediate Build Queue (Next 10 Tickets)
- [ ] Create `docs/ai-interaction-registry.md` and populate all current OpenAI interactions.
- [ ] Implement shared contracts in `lib/ai/contracts.ts` and adopt in 3 highest-traffic routes first.
- [ ] Add quality rubric module and attach scoring to saved artifacts.
- [ ] Extend telemetry schema and write path for action-after-output signals.
- [ ] Add budget threshold state machine to admin overview response.
- [ ] Standardize source extraction + minimum evidence checks for research outputs.
- [ ] Build progress ladder component in career flow.
- [ ] Add commitment capture + reminder scheduling API.
- [ ] Add experiment assignment utility and one live output-format experiment.
- [ ] Add `user_growth_memory` persistence and prompt-injection helper.

## Deep Dive: Items 1-4 (Concrete UX, Behavior Impact, and Delivery Complexity)

### Scope Note
This deep dive expands **NOW items 1-4**:
1. Canonical AI Interaction Inventory
2. Standard Interaction Contract
3. Quality Rubric and Post-Generation Checks
4. Baseline Telemetry for Every OpenAI Interaction

### 1) Canonical AI Interaction Inventory

#### What users/admins would actually see rendered
- Admin screen: `AI Interaction Registry`
  - Table columns shown:
    - `Interaction Name` (e.g., `career.generate_cover_letter`)
    - `Owner` (e.g., `Career Team`)
    - `Purpose` (e.g., `Role-specific application asset`)
    - `Model` (e.g., `gpt-5.4-mini`)
    - `Health` (`Healthy`, `Degraded`, `Failing`)
    - `Last 24h Success Rate` (e.g., `97.8%`)
    - `Avg Cost / Run` (e.g., `$0.028`)
    - `Top Failure Reason` (e.g., `schema_parse_failed`)
- Detail drawer per interaction:
  - Input sources shown (profile docs, candidate preferences, job context)
  - Output artifact(s) shown (cover letter, interview prep, dossier)
  - Fallback behavior shown (template fallback, retry, manual review)

#### Specific example
- Example row:
  - Interaction Name: `career.generate_company_dossier`
  - Health: `Degraded`
  - Last 24h Success: `84.3%`
  - Top Failure Reason: `insufficient_sources`
- Admin action available:
  - `View failed samples`
  - `Adjust source minimum`
  - `Enable stricter source domains`

#### What it does to user behavior
- Indirect but high-impact behavior effect:
  - Fewer silent failures means users trust outputs faster.
  - Faster issue resolution leads to fewer retries and rage-click behavior.
  - Consistent experience increases return usage because reliability feels predictable.

#### Build complexity and duration
- Delivery rank: **Easy-Medium**
- Estimated duration: **2-4 days** for first version
- Why: mostly metadata, admin table UI, and mapping existing routes

### 2) Standard Interaction Contract (Input/Output/Fallback)

#### What users would see rendered
- User-facing consistency upgrades:
  - All AI result cards share the same visual blocks:
    - `Summary`
    - `Recommended Actions`
    - `Why this was suggested`
    - `Confidence`
    - `Sources` (when relevant)
  - Error/fallback display is consistent:
    - `We hit a generation issue. Here is a rapid fallback draft you can still use now.`

#### Specific example
- In `Generate Cover Letter` result panel:
  - Header: `Cover Letter Draft`
  - Badge: `AI Draft v2 | Confidence: Medium`
  - Sections:
    - `Summary`: one-line strategic framing
    - `Draft`: main body text
    - `Recommended Actions`: `Tailor intro to hiring manager`, `Add one quantified achievement`
    - `Why`: `Matched role emphasis to your strongest documented experiences`

#### What it does to user behavior
- Reduces cognitive friction:
  - Users learn one structure and can process outputs faster.
- Increases completion behavior:
  - Clear `Recommended Actions` convert passive reading into next-step action.
- Reduces abandonment during failures:
  - Fallback draft keeps momentum so users continue instead of leaving.

#### Build complexity and duration
- Delivery rank: **Medium**
- Estimated duration: **5-8 days**
- Why: cross-route refactor, typed contracts, parser normalization, fallback unification

### 3) Quality Rubric and Post-Generation Checks

#### What users/admins would see rendered
- User result panel quality indicators:
  - `Quality Score: 18/20`
  - `Relevance: 5/5 | Actionability: 4/5 | Clarity: 5/5 | Trust Signals: 4/5`
- If quality is low:
  - Inline message: `We improved this draft for clarity before showing it.`
  - Optional button: `Show first draft vs improved draft`
- Admin quality dashboard:
  - Trend chart by interaction (`7-day average quality`)
  - Low-score heatmap by workflow stage

#### Specific example
- Interview prep output initially scores:
  - Relevance 2/5, Actionability 2/5, Clarity 4/5, Trust 2/5
- System auto-runs revision prompt:
  - Adds concrete STAR examples, likely interviewer objections, and prep checklist
- Final shown output:
  - Score improves to 16/20

#### What it does to user behavior
- Raises perceived platform intelligence:
  - Users see more "ready-to-use" content and spend less effort fixing outputs.
- Increases downstream action rate:
  - Better actionability prompts more actual applications, prep sessions, outreach.
- Builds trust loop:
  - Consistent quality reduces skepticism and repeat regeneration behavior.

#### Build complexity and duration
- Delivery rank: **Medium-Complex**
- Estimated duration: **7-12 days**
- Why: scoring logic, threshold policy, auto-revision flow, storage of rubric metadata

### 4) Baseline Telemetry for Every OpenAI Interaction

#### What users/admins would see rendered
- Admin analytics panels:
  - `Output Utility Funnel`
    - Generated -> Viewed -> Saved -> Copied -> Action Completed
  - `Regenerate Without Save` trend
  - `Time to First Action` by interaction
  - `Cost per Useful Output`
- Product team drill-down:
  - Example: `career.generate_profile` has high generation volume but low action completion

#### Specific example
- New event sequence captured:
  - `ai_output_generated`
  - `ai_output_viewed`
  - `ai_output_saved`
  - `ai_next_action_clicked`
- Dashboard insight:
  - Cover letters: high save rate but low `next_action_clicked`
- Product change triggered:
  - Add `Apply this to Job Tracker` CTA directly under draft

#### What it does to user behavior
- Enables rapid UX iteration that materially changes behavior:
  - Better CTA placement increases task continuation.
- Improves habit formation:
  - Measurable funnels let team optimize for repeated completion loops.
- Reduces churn risk:
  - Detect disengagement patterns early and trigger targeted nudges.

#### Build complexity and duration
- Delivery rank: **Complex**
- Estimated duration: **8-14 days**
- Why: end-to-end event taxonomy, route logging, client events, dashboard queries, validation

## Ranked Delivery Order (Easy -> Complex)

1. Canonical AI Interaction Inventory
- Difficulty: Easy-Medium
- Duration: 2-4 days
- Fastest value: operational visibility and ownership

2. Standard Interaction Contract
- Difficulty: Medium
- Duration: 5-8 days
- Fastest value: user-facing consistency and reduced breakage

3. Quality Rubric and Post-Generation Checks
- Difficulty: Medium-Complex
- Duration: 7-12 days
- Fastest value: stronger output quality and trust

4. Baseline Telemetry for Every OpenAI Interaction
- Difficulty: Complex
- Duration: 8-14 days
- Fastest value: measurable behavior optimization and retention tuning

## Suggested Build Sequence (Practical)
- Week 1:
  - Ship Interaction Inventory
  - Start Contract layer in top 2 highest-volume routes
- Week 2:
  - Complete Contract rollout
  - Launch Quality Rubric v1 in career generation routes
- Week 3:
  - Launch full Telemetry event taxonomy and dashboards
  - Run first optimization cycle from telemetry findings

## Example User Journey After 1-4 Are Implemented
- User generates a cover letter.
- Output appears in consistent layout with confidence + clear next actions.
- Quality checks silently improve weak sections before display.
- User clicks `Save` and `Add to Job Tracker`.
- System logs interaction quality, action conversion, and timing.
- Next session starts with `You completed 1 of 3 application steps. Next: interview prep (4 min).`
- Behavioral result: higher continuity, lower drop-off, and stronger habit loop.
