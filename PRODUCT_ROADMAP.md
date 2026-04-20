# Persona Foundry Product Roadmap

This roadmap captures the next major product directions for Persona Foundry and the Career Copilot module.

## Product Direction

Persona Foundry has two connected but separate modules:

1. The custom GPT personality builder.
2. Career Copilot, which helps users turn their career material into stronger positioning, better application assets, smarter target selection, and better interview execution.

The long-term direction is to make Career Copilot feel premium, strategic, and valuable enough to sit naturally inside a larger professional platform.

## Near-Term Priorities

### Immediate Next Todo

1. TeamSync Step 2 member loading clarity:
- make loaded members unmistakably visible
- make the upload action obvious
- make the "what to click next" path explicit after upload

2. Tester feedback loop (email + floating notes):
- allow superuser to send tester outreach emails from the control center
- add a floating notes widget for testers to log improvement ideas and bug notes in context
- capture and store location context for every note (module, route URL, section anchor, and timestamp)
- add an admin triage view to review, filter, and resolve tester notes by module/severity/status

3. Monthly API cost guardrail by user (dashboard + control center):
- show total monthly API usage and estimated cost per user
- compare each user monthly API cost against their subscription revenue
- add margin indicator per user (`revenue - API cost`) and portfolio-level operating margin
- add alerting for unprofitable users/workspaces (cost exceeds subscription threshold)
- add policy controls to throttle premium automations when user-level cost exceeds plan limits
- add finance view summary: total monthly subscription revenue vs total monthly API cost vs net operating margin

4. Cross-app Experience Agent:
- deploy shared in-product guidance agent across Career Intelligence, Persona Foundry, TeamSync, and Control Center
- provide contextual next-step recommendations tied to current module, route, and workflow stage
- detect stuck patterns and offer proactive unblock guidance
- track impact on completion rate, support load, and premium conversion

5. Post-success referral prompt + tracked attribution:
- when a candidate completes setup and runs a live job search, trigger a lightweight "Share with a friend" prompt
- if accepted, share the public site link with a hidden referral code tied to the current user
- store referral sends and successful referred signups/conversions
- surface referral performance in dashboard: invites sent, accepted, and converted

6. Gallup coach growth engine (outreach + console tooling):
- build a dedicated marketing plan to sell Personara to Gallup strengths provider coaches
- add a coach outreach pipeline inside Marketing Admin Console (lead list, stage tracking, next action, owner)
- support campaign templates by coach segment (independent coach, enterprise coach, franchise/partner)
- add conversion tracking from first contact through booked demo and paid subscription
- add performance dashboard for coach channel: outreach volume, reply rate, demos booked, conversions, CAC proxy

### 1. Application Sprint Automation

Create a one-click sprint for a selected role that can start the missing workflow pieces in sequence:

- company dossier
- tailored cover letter
- fit analysis
- salary analysis
- interview prep

Goal:
Reduce friction between role discovery and action.

### 2. Recruiter Match Search

Add a recruiter-focused search function later so users can identify relevant recruiters or talent contacts for target markets and target roles.

Goal:
Move the platform beyond passive applying and into smarter market access.

### 3. Deep Prospect Research

Add a deep research function that scans companies in a specific location and identifies organisations that:

- appear to be performing strongly
- may not currently have an advertised role
- show signals that they are likely to need a candidate like the user

This feature should not be treated as a basic job search. It should behave more like an opportunity intelligence engine.

Core outputs:

- shortlist of high-potential companies in the chosen location
- why each company looks promising
- likely role demand signals
- suggested angle of approach
- suggested warm-application strategy
- suggested dossier-generation targets

Possible market signals to use:

- recent growth
- hiring momentum in adjacent teams
- expansion announcements
- leadership hires
- funding or strong financial performance
- new product launches
- restructuring or transformation activity
- local market movement

Why this matters:

Many strong career moves happen before a formal role is posted. This feature would help users spot likely demand earlier and approach the market more strategically.

Suggested implementation phases:

1. Deep research brief:
User chooses location, industry, role family, and seniority target.

2. Market scan:
Search live web sources for strong companies and growth signals.

3. Opportunity scoring:
Rank companies by probability that they will need someone like the candidate.

4. Action layer:
Generate outreach ideas, dossier targets, and tailored application strategy.

5. Conversion workflow:
Let the user move a prospect company directly into dossier generation, role targeting, and application planning.

### 4. Executive Outreach Strategy

For selected target companies, generate a practical outreach plan including:

- message angle
- positioning hook
- likely stakeholder targets
- follow-up sequence

Goal:
Help the user create warm approaches even when no public role exists.

### 5. LinkedIn Login Enablement (Deferred)

Status:
Deferred until LinkedIn app brand assets (logo/company profile requirements) are ready.

Operational note:
Facebook provider rollout is temporarily on hold while Meta app-domain configuration is resolved. Keep Google as the primary active social login path.

Implementation checklist:

1. Create/complete LinkedIn developer app:
- Add required logo + company details.
- Enable the product: `Sign In with LinkedIn using OpenID Connect`.

2. LinkedIn auth configuration:
- Copy `Client ID` and `Client Secret`.
- Set redirect URL in LinkedIn app:
`https://usqafbuamrfslltsfdsi.supabase.co/auth/v1/callback`

3. Supabase provider setup:
- Go to `Authentication -> Providers -> LinkedIn (OIDC)`.
- Enable provider.
- Paste LinkedIn `Client ID` and `Client Secret`.

4. Supabase redirect allow-list:
- In `Authentication -> URL Configuration`, add:
`http://localhost:3000/career-intelligence`
`http://localhost:3000/platform`

5. Test flow:
- Use `Switch account` in app.
- Test login from `/career-intelligence`.
- Confirm provider badge shows `LinkedIn login`.
- Confirm LinkedIn profile prefill/import appears in candidate onboarding.

### 6. New User Safety Net (Support Contact Capture)

Add a structured onboarding capture for all new users so support can proactively help if they stall:

- full name (required)
- email (required)
- optional support preferences (timezone, preferred contact window)
- workflow stall signal (for example: no meaningful progress for 7+ days)

Goal:
Allow support to intervene early and increase successful workflow completion.

Implementation notes:

1. Capture + consent:
- Add onboarding fields with explicit consent language for support follow-up.

2. Stall detection:
- Detect inactivity windows per module and flag risk in admin/support views.

3. Support queue:
- Add a `Needs follow-up` queue in Admin with user name, email, module, and last active timestamp.

4. Contact actions:
- Add one-click `Send support email` and `Mark resolved`.

### 7. Premium: Weekly Autopilot Job Pipeline

Add a premium workflow in Candidate session that runs weekly automation after the user profile is complete.

Proposed weekly pipeline:

1. Auto-search:
- Run live job search using saved role profile and location filters.

2. Auto-research:
- Generate/update company dossier for shortlisted roles.

3. Auto-document prep:
- Generate tailored cover letter drafts using:
  - candidate profile
  - Gallup strengths signals
  - company dossier tone and messaging fit

4. Human review gate:
- Present a weekly review queue (`Approve / Edit / Skip`) before applying.

5. Apply-ready output:
- Export final application pack for each selected role.

Premium positioning:

- This is a paid feature tier focused on speed and leverage.
- User remains in control via review/approval before submission.

Rollout phases:

1. Premium entitlement + billing gate.
2. Weekly scheduler setup UI.
3. Background job orchestration for search -> dossier -> cover letter.
4. Review queue UX and notifications.
5. Admin observability (run success/failure, time saved, conversion metrics).

### 8. Superuser Bootstrap + Granular Rights Matrix

Add a hardened access-control layer so platform operations can safely scale support and moderation.

Immediate todo captured:

1. Auto-superuser bootstrap:
- Ensure `bourgogne.matt@gmail.com` and `nicolemanderson79@gmail.com` are always treated as superusers at login.

2. Granular user rights assignment:
- Add assignable access levels for every user:
  - `viewer` (read-only)
  - `editor` (can update content/workflows)
  - `manager` (can coordinate and run management actions)

3. Enforcement rollout:
- Apply access levels across key modules so view/edit/management controls are consistently enforced in API routes and UI actions.

Goal:
Keep operator control simple while reducing accidental over-permissioning as team support expands.

### 9. TeamSync Member Loading Clarity (Next UX Pass)

Improve Step 2 (`Load Members`) so first-time users can instantly tell:

1. Who is already loaded in the current group.
2. Exactly where to click to upload Gallup files.
3. What action to take next after selecting a file.

Key UX fixes to implement:

- Add a clear "Loaded members" list/panel directly above the intake form.
- Add stronger upload affordance (single primary upload CTA with clearer label).
- Reduce ambiguity between "Paste text", "Upload file", and "Pick themes" with helper text and step state.
- Show immediate post-upload state confirmation (file parsed, member ready to add, and next action).
- Tighten intake layout so the active action path is visually obvious.

### 10. TeamSync Premium: Executive Leadership Optimization Suite

Add a premium TeamSync area designed for CEOs, executive teams, and senior HR leaders focused on high-stakes team performance.

Core concept:

- guide executive users through structured scenario planning and organizational stress-testing
- use Gallup strengths intelligence to identify team design risks and optimal role structure under pressure
- support mission-critical planning where clarity, speed, and resilience matter

Feature scope:

1. Executive Leadership mode:
- dedicated TeamSync premium workspace for executive/facilitator use
- clear onboarding path for CEO/HR operator with role-aware guidance
- premium access gate and entitlement checks

2. Prebuilt prompt library (business + defense testing):
- large set of ready-to-run prompts for:
  - crisis leadership response
  - succession and bench-strength planning
  - reorg and role redesign pressure tests
  - decision-latency and communication-breakdown scenarios
  - mission-critical continuity and conflict-recovery drills
- allow prompt packs by context (`corporate`, `scale-up`, `transformation`, `high-risk ops`)

3. Team structure optimizer outputs:
- identify likely role overlap, bottlenecks, and decision fragility
- suggest optimized team structure options for scenario conditions
- provide tradeoff notes (speed vs alignment, control vs adaptability)
- output "recommended structure" plus "fallback structure" plans

4. Executive-ready reporting:
- concise board-ready summary mode
- deeper diagnostic mode for HR/people leaders
- export options for leadership workshops and follow-up planning

5. Premium marketing content in TeamSync:
- add focused in-product premium explainer for executive audiences:
  - what this mode does
  - who it is for
  - why it matters for high-functioning teams
- add clear upgrade CTA language at the right moment in workflow
- include outcome-focused examples and trust signals

Rollout phases:

1. Premium IA + entitlement gate.
2. Executive mode UX shell + onboarding flow.
3. Prompt library v1 (curated packs + tags + filters).
4. Scenario output engine v1 (structure recommendations + risk flags).
5. Executive reporting + export + marketing surfaces.

### 11. TeamSync Executive Output Enrichment (Next)

Add richer executive storytelling layers to TeamSync outputs:

1. Run-to-run delta strip:
- show what improved, worsened, or stayed stable between latest and previous run
- include concise directional indicators in Insights and exports

2. Recommendation confidence badges:
- add `High / Medium / Low` confidence tags based on signal overlap and evidence quality
- show confidence inline with each key recommendation

3. One-page board brief cover:
- include top decisions, top 3 risks, top 3 actions, and owners
- make this the first page in Word/PDF exports for executive sharing

### 12. TeamSync Executive Simulator Company-Context Layer (Premium)

Add optional company/industry context to executive simulations using a company URL.

Scope:
- user enters company URL in executive mode
- system extracts public context (industry pressures, operating model cues, language/tone, governance posture)
- simulation blends Gallup strengths + company context with clear labeling of source influence

Controls:
- context influence slider (`Low`, `Medium`, `High`)
- include/exclude company context toggle
- refresh context snapshot action

Safety and cost controls:
- public pages only (no credentials/private systems)
- cache context snapshots to reduce repeat token cost
- strict timeout/fallback when website context is unavailable

### 13. TeamSync Coach/User Outreach Automation (Operations)

Build an automated outreach pipeline for users who actively engage with TeamSync (not general candidate browsing), so support can offer short onboarding calls early.

Business goal:
- identify high-intent TeamSync users (especially Gallup coaches)
- trigger timely support outreach
- convert activation into paid usage

Required capability:
1. Audience capture (TeamSync-specific):
- create and persist TeamSync engagement events (`teamsync_workspace_opened`, `teamsync_member_added`, `teamsync_run_completed`)
- create segmentation views:
  - `teamsync_engaged_users`
  - `gallup_coach_segment`
  - `new_teamsync_users_7d`

2. Auto-email workflow:
- add Operations/Outreach rule:
  - when user enters TeamSync and meets engagement threshold, queue outreach email
- email template baseline:
  - “I noticed you logged into Personara.ai… typically we schedule a 15-minute call…”
- sender identity:
  - support mailbox/user profile (to be configured later)

3. Calendly integration:
- store global or per-support-user Calendly booking URL
- include booking link in outreach email CTA
- track outbound clicks and bookings where possible

4. Operations UI shell:
- add `TeamSync Outreach` panel in Operations/Admin:
  - queued
  - sent
  - opened
  - responded
  - booked
- allow manual resend / pause / mark-complete actions

5. Data + API checklist:
- database:
  - `teamsync_outreach_queue`
  - `teamsync_outreach_campaigns`
  - `teamsync_outreach_events`
- API:
  - queue ingestion endpoint
  - campaign send endpoint
  - status/update endpoint
- scheduler:
  - daily sweep job for newly-eligible users

Implementation order (suggested):
1. Event capture + segmentation queries
2. Outreach queue schema + APIs
3. Operations UI shell
4. Email sender wiring (Resend/provider)
5. Calendly link wiring + analytics
6. Rules refinement by conversion outcomes

### 14. Integration Expansion Backlog (Platform Utility)

Create a structured integration backlog to increase platform value without cluttering core workflows.

Priority candidates:
1. Calendly (support and onboarding calls)
2. Slack (team alerts and operations notifications)
3. HubSpot or CRM-lite connector (coach pipeline)
4. Gmail/Outlook mailbox sync for support operations
5. Optional webinar/demo tooling for coach enablement

Framework:
- classify each integration by:
  - user value
  - implementation complexity
  - recurring cost
  - data/privacy risk
  - premium upsell relevance
- only promote integrations that improve activation, retention, or margin

## Product Quality Themes

Across all roadmap items, keep pushing on:

- clearer workflow guidance
- stronger decision support
- premium visual clarity
- background processing for longer research tasks
- saved outputs that remain editable and reusable
- acquisition-grade product thinking

## Go-Live Domain Setup (Saved for Launch)

When `personara.ai` is purchased and we are ready to go live:

1. In Cloudflare DNS:
- Create `@` record pointing to hosting target (set by deployment platform).
- Create `www` CNAME pointing to `@`.

2. SSL and security:
- Set SSL mode to `Full (strict)` once origin certificate is active.
- Keep registrar lock and auto-renew enabled.

3. Platform environment:
- Update `NEXT_PUBLIC_SITE_URL` to production domain.
- Add production auth redirect URLs in Supabase.

4. Verification pass:
- Confirm homepage, module routes, login flow, contact form, and email links all resolve on production domain.

## New TODO Queue (2026-04-20)

1. Operations economics upgrade:
- add Codex API cost telemetry to Operations dashboard (daily + monthly)
- include Codex cost line item inside revenue/expense calculator
- show margin impact after OpenAI + Codex model spend

2. Share + referral growth engine:
- generate one-time discount/referral code when user clicks `Share`
- persist share records by user (`codes_created`, `codes_redeemed`, `signups_from_shares`)
- add attribution dashboard panel for high-volume sharers
- define optional rewards policy for top referral contributors
