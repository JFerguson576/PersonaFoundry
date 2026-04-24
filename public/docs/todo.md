# To Do

- [ ] Review and execute prioritized roadmap in CODEX_EXECUTION_PLAN.md and CODEX_EXECUTION_PLAN.docx.

## Foundational Asset: OpenAI Logic and Enrichment Map

- [ ] Build a single "AI interaction map" of every OpenAI call path and keep it versioned as a core platform asset.
- [ ] Treat each interaction like a value conveyor belt: raw input in, signal extraction in the middle, decision-ready output out.
- [ ] For each interaction below, document: input sources, transformation logic, output format, trust checks, and where value is realized.

## Current OpenAI Interactions (Plain-English)

- [ ] `app/api/analyze-profile-ai/route.ts` and `app/api/chat-sandbox/route.ts` and `app/api/agent/respond/route.ts`:
  - What it does: turns user-entered profile/context and prompts into structured insight and response text.
  - Metaphor: "translator + strategist" that converts messy story data into useful next moves.
  - Core transformation: free-form text to normalized, actionable guidance.

- [ ] `app/api/career/generate-profile/route.ts`:
  - What it does: compiles source documents into a coherent candidate profile.
  - Metaphor: "ore to steel" refinement from scattered resume artifacts into a strong professional narrative.
  - Core transformation: fragmented evidence to profile synthesis.

- [ ] `app/api/career/generate-assets/route.ts`:
  - What it does: generates career assets (for example CV/LinkedIn style outputs) from profile + docs.
  - Metaphor: "content factory line" that turns one profile core into multiple fit-for-purpose assets.
  - Core transformation: one profile context to multi-channel deliverables.

- [ ] `app/api/career/generate-cover-letter/route.ts`:
  - What it does: creates role-targeted cover letters using profile and role context.
  - Metaphor: "tailor" that cuts a custom suit for each application.
  - Core transformation: generic career history to role-specific persuasion.

- [ ] `app/api/career/generate-interview-prep/route.ts`:
  - What it does: builds interview prep material from profile + role signals.
  - Metaphor: "sparring coach" turning background into rehearsable talking points.
  - Core transformation: background evidence to interview-ready narratives.

- [ ] `app/api/career/generate-strategy-document/route.ts`:
  - What it does: composes strategy docs from latest generated assets and goals.
  - Metaphor: "game planner" combining player stats and match conditions.
  - Core transformation: multiple assets to cohesive tactical plan.

- [ ] `app/api/career/generate-company-dossier/route.ts` and `app/api/career/generate-target-company-workflow/route.ts` and `lib/career-live-jobs.ts`:
  - What it does: uses OpenAI web search tooling plus reasoning to gather and synthesize company/job intelligence with sources.
  - Metaphor: "research analyst" that scouts the field and returns a structured brief.
  - Core transformation: web signals to vetted, source-aware dossier/opportunity outputs.

- [ ] `app/api/career/generate-target-company-workflow/route.ts`:
  - What it does: chains multiple model calls (dossier -> cover letter -> interview prep) in one workflow.
  - Metaphor: "assembly line" where each station upgrades the artifact before passing it on.
  - Core transformation: multi-step pipeline that compounds value.

- [ ] `app/api/teamsync/conversation/route.ts` and `app/api/teamsync/simulate/route.ts` and `app/api/teamsync/resources/route.ts`:
  - What it does: powers team communication simulation, scenario response generation, and support resources.
  - Metaphor: "flight simulator" for difficult workplace conversations.
  - Core transformation: interpersonal context to practical response playbooks.

- [ ] `lib/career-background-jobs.ts`:
  - What it does: orchestrates background AI jobs across profile generation, assets, dossier research, fit analysis, salary and outreach strategy, course recommendations, and premium autopilot runs.
  - Metaphor: "back-office AI operations center" running high-value tasks while the user is offline.
  - Core transformation: asynchronous workflow automation from queued intent to saved assets and recommendations.

- [ ] `lib/openai-organization-usage.ts` and admin overview routes:
  - What it does: calls OpenAI organization usage/cost endpoints for budget visibility and governance.
  - Metaphor: "fuel gauge + dashboard" showing burn rate before the engine overheats.
  - Core transformation: raw usage telemetry to budget guardrails and executive signals.

- [ ] `lib/telemetry.ts`:
  - What it does: estimates cost and logs API usage for product analytics and margin monitoring.
  - Metaphor: "black box recorder" for model economics and reliability learning.
  - Core transformation: token-level events to unit-economics intelligence.

## Future Enrichment Opportunities (Higher Value for User, Reseller, White Label, New Owner)

- [ ] User enrichment:
  - Persistent memory of goals, blockers, and wins with "continue where you left off" flows.
  - Outcome-linked personalization: adjust prompts based on interview callbacks, replies, and placement outcomes.
  - Confidence calibration: show why guidance is suggested and how certain the system is.

- [ ] Reseller enrichment:
  - Segment-specific prompt packs and rubric templates per industry.
  - Tenant-level benchmarking so partners can show comparative performance lift.
  - Packaged reporting exports that translate AI output into client-ready ROI narratives.

- [ ] White-label/new owner enrichment:
  - Brand voice overlays, compliance packs, and policy constraints per deployment.
  - Swappable workflow modules (career, coaching, education, recruiting) using shared orchestration.
  - Admin knobs for quality/cost tradeoffs by product tier.

## Human Behavior Research: Keep Users Coming Back

- [ ] Goal-gradient effect: show visible progress ladders so users accelerate near completion.
- [ ] Endowed progress: pre-seed early wins to reduce start friction and boost continuation.
- [ ] Variable reward scheduling: alternate high-utility insights and surprise-value insights to sustain curiosity.
- [ ] Zeigarnik effect: preserve meaningful unfinished next steps so users return to close loops.
- [ ] Commitment and consistency: capture micro-commitments and remind users of prior stated goals.
- [ ] Identity reinforcement: reflect growth narrative ("you are becoming interview-ready") to build intrinsic motivation.
- [ ] Habit timing: schedule nudges around each user's proven active windows rather than generic reminders.
- [ ] Social proof where appropriate: anonymized benchmarks to normalize effort and reduce dropout.

## Measurement and Experimentation

- [ ] Define a scorecard for every OpenAI interaction: usefulness, action completion rate, repeat usage, and downstream outcomes.
- [ ] Add A/B testing for prompt strategies, output formats, and follow-up timing.
- [ ] Track retention by feature cluster (generation, simulation, live job intelligence, autopilot).
- [ ] Tie model spend to revenue impact by segment (direct user, reseller tenant, white-label deployment).
- [ ] Set quality guardrails: hallucination rate, source coverage rate, and edit-before-use rate.


## TeamSync Workstream: Resilience, Scenario Testing, and Digital Twin

Primary references:
- [ ] Read and use `TEAMSYNC_DEEP_RESEARCH_BRIEF_2026-04-24.md` for strategy context.
- [ ] Read and use `TEAMSYNC_FUNCTIONALITY_IMPLEMENTATION_GUIDE_2026-04-24.md` for build instructions.
- [ ] Execute tickets from `CODEX_JIRA_BACKLOG_TOKEN_OPTIMIZED_2026-04-24.md`.

Execution mode (token-optimized):
- [ ] Use ticket ID references in updates (`Done / In progress / Blocked / Next`) instead of restating full scope.
- [ ] Treat `TS-DOD-001`, `TS-NFR-001`, `TS-AI-001`, and `TS-SEC-001` as global gates on all TeamSync tickets.

### Phase 1: Foundation (Schema + Ingestion + Scenario Runtime)
- [ ] Complete `TS-101` canonical TeamSync schema + indexes.
- [ ] Complete `TS-102` ingestion API + validation.
- [ ] Complete `TS-103` normalization + confidence scoring.
- [ ] Complete `TS-104` ingestion job runner (retry/resume).
- [ ] Complete `TS-201` scenario CRUD.
- [ ] Complete `TS-202` scenario run endpoint with strict output schema.
- [ ] Complete `TS-203` tolerance breach evaluator.
- [ ] Complete `TS-204` 30/60/90 action plan generation.

### Phase 2: Digital Twin MVP (Priority)
- [ ] Complete `TS-301` twin snapshot service.
- [ ] Complete `TS-302` twin scoring model v1.
- [ ] Complete `TS-303` twin overview UI.
- [ ] Complete `TS-304` what-if simulation API (role/reporting/cadence deltas).
- [ ] Complete `TS-305` twin narrative generation with strict schema.
- [ ] Validate MVP acceptance: twin snapshot speed, confidence bands, assumption trace, export-ready summary.

### Phase 3: Board + Evidence + Action Assurance
- [ ] Complete `TS-401` board cockpit API aggregator.
- [ ] Complete `TS-402` board cockpit UI.
- [ ] Complete `TS-403` board packet export service.
- [ ] Complete `TS-404` evidence workspace + lineage view.
- [ ] Complete `TS-501` action CRUD + transitions.
- [ ] Complete `TS-502` action update feed + progress tracking.
- [ ] Complete `TS-503` action impact recalculation.

### Phase 4: Practitioner Growth Workspace
- [ ] Complete `TS-601` practitioner portfolio dashboard.
- [ ] Complete `TS-602` playbook runner (Alignment Sprint / Quarterly Simulation / Board Review).
- [ ] Complete `TS-603` commercial output templates.

### Readiness and Launch Gates
- [ ] Run full DoD check against `TS-DOD-001` for all completed tickets.
- [ ] Run NFR hardening pass from `TS-NFR-001`.
- [ ] Run AI guardrail verification from `TS-AI-001`.
- [ ] Run security + RLS verification from `TS-SEC-001`.
- [ ] Confirm Board Resilience Cockpit + Digital Twin + Scenario Engine + Action Tracker work end-to-end.

### Weekly Operating Cadence (Execution Discipline)
- [ ] Monday: set `In progress` ticket IDs and sprint targets.
- [ ] Wednesday: review blockers and dependency tickets.
- [ ] Friday: publish `Done / In progress / Blocked / Next` ticket summary.

### Start Here This Week (Sprint 1)
- [ ] Open and review `CODEX_JIRA_BACKLOG_TOKEN_OPTIMIZED_2026-04-24.md`.
- [ ] Complete shared gates: `TS-DOD-001`, `TS-AI-001`.
- [ ] Build foundation: `TS-101`, `TS-102`.
- [ ] Build scenario runtime core: `TS-201`, `TS-202`.
- [ ] End-of-week checkpoint: publish `Done / In progress / Blocked / Next` by ticket ID.
