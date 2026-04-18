# Personara Experience Agent Plan

## Goal
Add a cross-app in-product agent that makes workflows easier, faster, and more supportive across:
- Career Intelligence
- Persona Foundry
- TeamSync
- Control Center/Admin

The agent should reduce drop-off, improve completion rates, and guide users to the next best action in plain language.

## Phase 1 (Now) - Foundation Endpoints

Implemented endpoints:
- `POST /api/agent/session`  
  Creates a user-scoped agent session for current module/route.
- `GET /api/agent/session`  
  Returns active session for a module/route.
- `POST /api/agent/respond`  
  Returns contextual agent reply for a session and stores message history.

Data model:
- `experience_agent_sessions`
- `experience_agent_messages`

SQL:
- `supabase/experience_agent.sql`

## Phase 2 - UI Integration

1. Add floating "Ask Agent" entry point in all modules.
2. Auto-pass context:
- module
- route
- current step key
- readiness status
- blockers
3. Show concise responses with:
- "Next best action"
- "Why this action"
- "Do this now" button link.

## Phase 3 - Workflow Intelligence

1. Connect module-specific context providers:
- Career candidate progress
- TeamSync readiness and member intake state
- Persona Foundry baseline/test/export state
2. Add "stuck detection" (inactivity + repeated errors) and proactive prompts.
3. Add handoff cards:
- "Continue where you left off"
- "Finish this in 2 minutes"

## Phase 4 - Operator Control + Safety

1. Admin controls:
- enable/disable agent by module
- response tone preset
- max token budget per user/day
2. Guardrails:
- no hidden actions
- no irreversible changes without explicit confirmation
- clear uncertainty disclosure
3. Observability:
- completion impact metrics
- agent-helped conversion rate
- common stuck points.

## Commercial Outcomes

Primary KPI targets:
- lower onboarding friction
- faster first value
- lower support burden
- higher weekly active completion
- better premium conversion from guided workflows.

