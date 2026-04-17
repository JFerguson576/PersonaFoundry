# Personara Go-Live Hosting Plan

This plan is designed for your current preference:
- avoid Azure complexity for now
- keep costs controlled
- launch quickly
- stay ready to scale when traffic grows

## Recommended Stack

- Frontend/App Hosting: **Vercel**
- Database/Auth/Storage: **Supabase**
- Domain + DNS + edge security: **Cloudflare**
- Email sending: **Resend**

---

## Phase 1: Launch-Ready (Now)

Goal: ship safely with low operational overhead.

1. Hosting and domain
- Deploy app to Vercel.
- Connect `personara.ai` in Vercel.
- Keep Cloudflare as registrar/DNS.

2. Core environment setup
- Set production env vars in Vercel:
  - `NEXT_PUBLIC_SITE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `RESEND_API_KEY`
  - `PREMIUM_AUTOPILOT_CRON_SECRET`
- Mirror any required auth provider credentials.

3. Security baseline
- Keep secrets server-only (never in client bundle).
- Enable Cloudflare registrar lock + auto renew.
- Configure Supabase redirect allow-list for production domain.

4. Reliability baseline
- Keep long jobs in background (already implemented).
- Add rate limiting to heavy AI endpoints.
- Keep clear user-facing retry messages.

5. Monitoring baseline
- Enable Vercel logs.
- Enable Supabase logs.
- Add one error tracking tool (Sentry recommended) when ready.

---

## Phase 2: Growth-Ready (When usage starts increasing)

Goal: improve cost control and performance under rising traffic.

1. Cost controls
- Enforce monthly OpenAI budget alerts in admin.
- Add per-user/per-feature usage guardrails.
- Cap expensive operations by tier (free vs premium).

2. Performance
- Cache safe read-heavy endpoints.
- Optimize largest candidate pages/modules for hydration and payload size.
- Add DB indexes for most-used filters and admin queries.

3. Job orchestration
- Move cron/scheduler jobs to production cadence.
- Add retry + dead-letter style handling for failed autopilot runs.
- Add autopilot run observability panel in admin.

4. Ops workflows
- Add incident runbook (what to check first on failures).
- Add daily backup verification and restore drill.

---

## Phase 3: Scale-Ready (High traffic / enterprise demand)

Goal: support larger traffic and premium reliability requirements.

1. Architecture hardening
- Split critical heavy routes into dedicated worker processes if needed.
- Add queue-based job processing for all long-running pipelines.
- Introduce regional strategy (if user base spreads globally).

2. Enterprise controls
- SSO and role governance hardening.
- Audit logs for sensitive admin actions.
- Enhanced data retention and privacy controls.

3. Commercial expansion
- Tiered plans with hard limits and premium automations.
- SLA-backed operations policy.

---

## Traffic Strategy: Build for growth, not overbuild today

Recommendation:
- Do **not** over-engineer for very high traffic immediately.
- Implement strong launch guardrails now.
- Scale in steps based on real usage signals.

This keeps burn low while preserving a clear path to enterprise-grade scale.

---

## Immediate Next 5 Actions

1. Buy domain and keep Cloudflare DNS as control plane.
2. Deploy current app to Vercel production.
3. Set production env vars + Supabase redirect URLs.
4. Add basic rate limits to AI-heavy endpoints.
5. Add autopilot cron in production using `PREMIUM_AUTOPILOT_CRON_SECRET`.
