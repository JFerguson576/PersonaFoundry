const fs = require("fs")
const path = require("path")
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require("docx")

function h(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } })
}

function p(text) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } })
}

function b(text) {
  return new Paragraph({ children: [new TextRun({ text: `• ${text}` })], spacing: { after: 80 } })
}

async function run() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Personara.ai Enterprise SaaS Delivery Review", bold: true, size: 34 })],
            spacing: { after: 180 },
          }),
          p("Date: 21 April 2026"),
          p("Prepared for: Personara leadership"),
          p("Purpose: Assess the current product against enterprise SaaS best practices, identify scale-critical gaps, and define the fastest practical path to efficient growth."),

          h("1. Executive Summary"),
          p("Personara has progressed beyond MVP and now operates as a real multi-module SaaS platform with core product depth, strong workflow coverage, and meaningful admin/operations controls. The architecture already includes key scaling assets (modular routes, role-aware APIs, telemetry foundations, outreach tooling, and premium feature paths)."),
          p("The immediate opportunity is not to add random features. The fastest growth path is to harden five areas in sequence: acquisition infrastructure, activation depth, monetization controls, enterprise trust controls, and operational automation."),
          p("Current position: strong product innovation and breadth. Required next move: SaaS operating discipline so growth compounds without support and cost chaos."),

          h("2. Current System Architecture"),
          h("2.1 Frontend and Experience Layer", HeadingLevel.HEADING_2),
          b("Next.js App Router application with dedicated module routes: Platform, Career Intelligence, Persona Foundry, TeamSync, Resources, Community, Operations, Admin."),
          b("Shared navigation and in-product guidance components (module nav, tours, contextual helper/agent, tester feedback)."),
          b("Role-aware UX behavior for superuser/operator paths vs standard user experience."),
          b("Deployed on Vercel with production domain and preview workflow."),

          h("2.2 Backend and API Layer", HeadingLevel.HEADING_2),
          b("Route-based API architecture under app/api with clear domain segmentation (career, teamsync, persona, admin, marketing, community, referrals, auth, agent)."),
          b("OpenAI integration for generation, simulation, analysis, and workflow automation endpoints."),
          b("Background processing model exists (career_background_jobs, live search runs, recovery sweeps, cron path for autopilot)."),
          b("Admin APIs already support operations signals, outreach actions, notebooking, role/access, and financial snapshots."),

          h("2.3 Data and Persistence Layer", HeadingLevel.HEADING_2),
          b("Supabase Postgres as system-of-record with broad schema coverage across product, operations, growth, and governance."),
          b("Strong schema foundation: career assets/jobs/applications, TeamSync core + outreach, marketing engine datasets, referrals, user roles/access, tour progress, tester feedback, experience agent feedback."),
          b("Soft-delete, inbox state, and policy/alert tables indicate good operational maturity direction."),

          h("2.4 Identity and Access Layer", HeadingLevel.HEADING_2),
          b("Google auth active; Facebook/LinkedIn staged with rollout constraints tracked."),
          b("Role and access models already present (user_roles, user_access_levels) with superuser/admin/support patterns emerging."),
          b("Cross-module single account context is in place, but enterprise-grade permission matrix enforcement is still partial."),

          h("3. Module-by-Module Capability Snapshot"),
          h("3.1 Career Intelligence", HeadingLevel.HEADING_2),
          b("Candidate onboarding, profile generation, documents, company dossiers, interview prep, job search, saved outputs, and premium autopilot foundation."),
          b("Strength: rich workflow depth and practical candidate outputs."),
          b("Gap: simplify first-time activation and enforce strongest path-to-value with less UI complexity."),

          h("3.2 Persona Foundry", HeadingLevel.HEADING_2),
          b("Custom AI personality setup, tuning, and export, with Gallup baseline integration linkage."),
          b("Strength: clear differentiation through identity-based AI behavior control."),
          b("Gap: improve enterprise packaging (governance, audit/version controls, and team-level rollout patterns)."),

          h("3.3 TeamSync", HeadingLevel.HEADING_2),
          b("Member loading, scenario simulation, insights, premium executive prompt layers, and outreach adjacency."),
          b("Strength: high strategic value for leadership and coach markets."),
          b("Gap: member intake clarity, simulation output variation quality, and stronger executive reporting standards."),

          h("3.4 Operations and Admin", HeadingLevel.HEADING_2),
          b("Unified operations workspace with left-nav control patterns, risk inbox, run health, outreach queues, and financial summary signals."),
          b("Strength: uncommon maturity for this stage—real control tooling already exists."),
          b("Gap: information architecture consistency, no duplicate pathways, and explicit operator runbooks embedded in-product."),

          h("3.5 Marketing Engine", HeadingLevel.HEADING_2),
          b("Campaign controls, policy/recommendation structures, outreach queues, and spend/revenue context beginnings."),
          b("Strength: clear move toward customer-funded growth operating model."),
          b("Gap: full closed-loop attribution (lead -> outreach -> booking -> paid -> retained) needs completion."),

          h("4. What Is Already Strong (Do Not Lose)"),
          b("Multi-module architecture with domain-level APIs and dedicated data schemas."),
          b("Clear product vision anchored on identity intelligence and Gallup-based differentiation."),
          b("Early operations tooling (rare and valuable at this stage)."),
          b("Admin-side financial thinking already present (API spend vs revenue intent)."),
          b("Premium lane concept defined (autopilot, executive simulation layers, outreach engines)."),

          h("5. Critical Gaps Blocking Fast, Efficient SaaS Scale"),
          h("5.1 Product and Activation", HeadingLevel.HEADING_2),
          b("First-session activation still too complex in places; user can see too many options before experiencing value."),
          b("Cross-module progression logic exists conceptually but needs stronger orchestration and completion tracking."),
          b("Guidance surfaces (tour/agent/help) need tighter non-overlapping behavior and standardized action semantics."),

          h("5.2 Revenue and Pricing Operations", HeadingLevel.HEADING_2),
          b("Subscription-to-cost guardrails are not yet fully enforced at user level."),
          b("Premium entitlement and usage throttling need explicit hard controls for margin protection."),
          b("Referral and discount economics logic is not yet complete for scalable growth loops."),

          h("5.3 Sales and Go-to-Market Infrastructure", HeadingLevel.HEADING_2),
          b("Outreach engines are promising, but CRM-grade lifecycle tracking is incomplete."),
          b("Coach channel GTM is partially scaffolded but needs campaign standards, pipeline stages, and reporting rigor."),
          b("No full enterprise sales path yet (teams, procurement readiness, security pack, account-level controls)."),

          h("5.4 Security, Compliance, and Enterprise Trust", HeadingLevel.HEADING_2),
          b("Need formal hardening plan: threat model, logging standards, incident runbooks, key rotation process, and access review cadence."),
          b("Need compliance-prep artifacts (privacy policy maturity, DPA templates, security FAQ, data handling matrix)."),
          b("Need stricter authorization audit across all APIs for least-privilege guarantees."),

          h("5.5 Platform Reliability and Engineering Discipline", HeadingLevel.HEADING_2),
          b("OneDrive file lock build failures indicate environment risk during release cycles."),
          b("Need CI gate profile: lint/build/typecheck/test + migration validation before production deploy."),
          b("Need release safety model: staged rollout, rollback SOP, and smoke-test checklist automation."),

          h("6. High-Impact Additions Recommended"),
          h("6.1 Growth and Revenue Engine", HeadingLevel.HEADING_2),
          b("Complete referral system v2: unique code issuance, redemption tracking, conversion attribution, and reward economics."),
          b("Complete Teamsync coach outreach engine with campaign templates, queue automation, and booked-call conversion reporting."),
          b("Add customer health scoring (activation depth, weekly use, output generation, support risk) to operations dashboard."),

          h("6.2 Enterprise-Ready Product Layers", HeadingLevel.HEADING_2),
          b("Account workspaces for teams/organizations (owner/admin/member), not only individual users."),
          b("Audit timeline per workspace for critical actions and generated outputs."),
          b("Version governance for generated artifacts (draft/approved/published states)."),

          h("6.3 AI Cost and Quality Governance", HeadingLevel.HEADING_2),
          b("Per-feature cost budget envelopes with auto-throttle and fallback model strategy."),
          b("Quality telemetry by generation type (retry rates, user edits, acceptance rates)."),
          b("Model routing policy layer based on task sensitivity and ROI."),

          h("6.4 UX Standardization", HeadingLevel.HEADING_2),
          b("Single interaction contract for all modules: left navigation + right content panel + unified sticky action row."),
          b("Uniform state labels and action labels across modules (reduce cognitive switching costs)."),
          b("Context-preserving scroll/anchor behavior platform-wide to avoid hidden content on action jump."),

          h("7. Proposed Implementation Order (Fastest Path to Scale)"),
          h("Phase 1: 0-30 Days (Stabilize and Monetize)", HeadingLevel.HEADING_2),
          b("Finish operations IA cleanup and remove duplicate navigation paths."),
          b("Enforce per-user margin guardrails in production dashboards and policies."),
          b("Complete referral/discount tracking schema + admin reporting shell."),
          b("Finalize tester outreach loop and issue triage workflow with email delivery."),
          b("Establish production release checklist and CI gate requirements."),

          h("Phase 2: 31-60 Days (Activation and Conversion)", HeadingLevel.HEADING_2),
          b("Launch robust first-time guided onboarding for each module."),
          b("Add lifecycle messaging automation (Teamsync and premium candidate workflows)."),
          b("Ship ad campaign manager integration panel under Marketing tools."),
          b("Standardize resource hub as rendered + downloadable asset library with metadata."),

          h("Phase 3: 61-120 Days (Enterprise Readiness)", HeadingLevel.HEADING_2),
          b("Add organization-level accounts and role matrix enforcement end-to-end."),
          b("Implement audit/event timeline and exportable governance artifacts."),
          b("Formalize security hardening pack and trust center baseline."),
          b("Build board-ready KPI cockpit: ARR proxy, CAC proxy, LTV proxy, gross margin trend, retention signals."),

          h("8. KPI Framework to Run the Business"),
          b("Activation: Time-to-first-value, module completion rates, week-1 return rate."),
          b("Engagement: Outputs per active user, scenario runs per team, saved artifact reuse rate."),
          b("Monetization: Paid conversion rate, premium attach rate, ARPU, gross margin per user."),
          b("Reliability: Job success rate, stalled run rate, median recovery time."),
          b("Support: Open issue aging, feedback closure cycle time, support-assisted conversion rate."),
          b("Growth: Referral sends, referral conversions, outreach response/booked-call rates."),

          h("9. System Architecture Target State (Recommended)"),
          b("Experience Layer: Unified module shell, guided workflows, resource intelligence, adaptive in-product agent."),
          b("Workflow Services Layer: Career engine, Persona engine, TeamSync engine, Outreach engine, Referral engine."),
          b("Governance Layer: Role/access control, policy/rules, audit logs, billing and margin guardrails."),
          b("Intelligence Layer: Model routing, prompt packs, scenario simulation, confidence scoring, insight rendering."),
          b("Data Layer: Supabase core + analytics marts + event telemetry views for operations and growth."),

          h("10. Immediate Action Checklist"),
          b("Consolidate Operations into one non-jarring left-nav flow (no context-breaking jumps)."),
          b("Finish top-nav consistency and signed-in state clarity across all pages."),
          b("Complete TeamSync and Candidate onboarding simplification to improve activation."),
          b("Deploy margin-protection controls before scaling paid acquisition."),
          b("Publish enterprise trust artifacts before larger B2B outreach."),

          h("11. Closing Assessment"),
          p("Personara has unusually strong product ambition and cross-module depth for this stage. The fastest route to becoming a category-defining SaaS business is now operational excellence: clearer onboarding, strict margin controls, reliable release discipline, and conversion-grade growth loops. If these next layers are executed in order, Personara can scale quickly without losing quality or financial control."),
        ],
      },
    ],
  })

  const outDir = path.join(process.cwd(), "public", "docs")
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const outPath = path.join(outDir, "Personara_Enterprise_SaaS_Delivery_Review.docx")
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outPath, buffer)
  process.stdout.write(outPath)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})

