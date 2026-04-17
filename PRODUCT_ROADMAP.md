# Persona Foundry Product Roadmap

This roadmap captures the next major product directions for Persona Foundry and the Career Copilot module.

## Product Direction

Persona Foundry has two connected but separate modules:

1. The custom GPT personality builder.
2. Career Copilot, which helps users turn their career material into stronger positioning, better application assets, smarter target selection, and better interview execution.

The long-term direction is to make Career Copilot feel premium, strategic, and valuable enough to sit naturally inside a larger professional platform.

## Near-Term Priorities

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
