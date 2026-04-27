"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

type AudienceCard = {
  id: string
  investorTarget: string
  coreAppeal: string
  primaryOutcome: string
  commercialMotion: string
  firstConversation: string
}

type AudienceSection = {
  id: string
  title: string
  whatIsInItForYou: string
  whyNow: string
  whyEngage: string
}

const audienceArchitecture: AudienceCard[] = [
  {
    id: "recruitment-firms",
    investorTarget: "Recruitment firms and reseller partners",
    coreAppeal: "Margin expansion and premium services",
    primaryOutcome: "Turn placement workflows into talent intelligence products",
    commercialMotion: "Reseller, white-label, and premium candidate-readiness packages",
    firstConversation: "Identify a candidate segment where stronger positioning improves fee quality or placement velocity.",
  },
  {
    id: "job-boards",
    investorTarget: "Job boards and hiring marketplaces",
    coreAppeal: "Higher user value and recurring engagement",
    primaryOutcome: "Shift from listings to career intelligence",
    commercialMotion: "Embedded premium workflow, conversion uplift, and marketplace differentiation",
    firstConversation: "Map the moments where candidates need guidance after search but before application.",
  },
  {
    id: "strategic-platforms",
    investorTarget: "LinkedIn and strategic platforms",
    coreAppeal: "Deeper identity interpretation for AI and career workflows",
    primaryOutcome: "Extend the professional graph into practical intelligence",
    commercialMotion: "Strategic integration, data enrichment, and AI personalization layer",
    firstConversation: "Explore where identity interpretation improves profile, coaching, hiring, or AI assistant products.",
  },
  {
    id: "venture-capital",
    investorTarget: "Venture capital firms",
    coreAppeal: "Large category thesis with platform expansion",
    primaryOutcome: "Back the identity layer for applied AI",
    commercialMotion: "Seed or strategic capital with disciplined customer-funded validation",
    firstConversation: "Review the wedge, product surfaces, channel routes, and evidence needed for the next funding milestone.",
  },
]

const platformThesis = [
  {
    label: "Core insight",
    title: "Identity is the durable data layer",
    detail:
      "Profiles, strengths, work history, and live context become more valuable when they are interpreted into practical decisions, not stored as static data.",
  },
  {
    label: "Product wedge",
    title: "Career execution creates immediate utility",
    detail:
      "Career Intelligence gives users a high-frequency reason to return: prepare, tailor, track, interview, follow up, and improve the next attempt.",
  },
  {
    label: "Expansion path",
    title: "The same engine supports teams",
    detail:
      "Persona Foundry and TeamSync turn the identity layer into AI personality design, collaboration intelligence, and executive decision support.",
  },
]

const investorSignals = [
  { label: "Category", value: "Applied AI identity layer", detail: "Context across career, AI voice, and team decisions." },
  { label: "Business motion", value: "B2C + B2B2C", detail: "Direct users first, then reseller, marketplace, and enterprise routes." },
  { label: "Near-term wedge", value: "Career Intelligence", detail: "Immediate pain, clear workflow, and visible generated outcomes." },
  { label: "Strategic upside", value: "Platform expansion", detail: "Multiple product surfaces built from one user-owned intelligence model." },
]

const engagementPath = [
  {
    step: "1",
    title: "Strategic fit call",
    detail: "Validate audience, channel fit, commercial pressure, and the buyer problem worth solving first.",
  },
  {
    step: "2",
    title: "Pilot design",
    detail: "Choose one use case, one success metric, and one workflow where Personara can prove value quickly.",
  },
  {
    step: "3",
    title: "Commercial model",
    detail: "Agree referral, white-label, reseller, marketplace, or investment path once pilot evidence is clear.",
  },
]

const diligenceRows = [
  {
    question: "Why does this need to exist?",
    answer: "Generic AI is abundant, but trusted personal context is still fragmented across CVs, strengths reports, profiles, notes, and team history.",
  },
  {
    question: "Where does adoption start?",
    answer: "Career users need immediate help turning identity and experience into better applications, interviews, and follow-up workflows.",
  },
  {
    question: "How does it expand?",
    answer: "The same intelligence layer becomes useful for AI persona design, recruiter channels, team dynamics, coaching, and workplace decisions.",
  },
]

const audienceSections: AudienceSection[] = [
  {
    id: "recruitment-firms",
    title: "Recruitment firms and reseller partners",
    whatIsInItForYou:
      "Personara.ai gives recruitment firms a higher-margin intelligence layer on top of existing candidate and client workflows. It helps transform standard recruiting activity into stronger candidate positioning, sharper interview preparation, better-fit narratives, and premium advisory services.",
    whyNow:
      "Recruitment firms are under pressure from AI-enabled automation, fee compression, and client demand for better prepared and better differentiated candidates. Generic matching is becoming easier. Higher-value interpretation is becoming more important.",
    whyEngage:
      "Firms can monetize before placement, during placement, and after placement. Personara.ai opens up premium services in executive repositioning, candidate readiness, outplacement, talent advisory, leadership-fit guidance, and white-labeled career intelligence products.",
  },
  {
    id: "job-boards",
    title: "Job boards and hiring marketplaces",
    whatIsInItForYou:
      "Personara.ai helps job boards increase the value of every user session. It adds identity-aware job guidance, stronger profile onboarding, better application quality, and richer premium experiences on top of existing marketplace traffic.",
    whyNow:
      "Job boards are being pressured by changing discovery behavior, AI-driven job search, and the growing importance of integrated workflow ecosystems. Owning listings alone is less defensible than owning guidance, fit, and repeated user engagement.",
    whyEngage:
      "Personara.ai helps job boards evolve from inventory-led marketplaces into career intelligence platforms. That creates more recurring sessions, stronger premium subscription pathways, better-quality applications, and a deeper relationship with both candidates and employers.",
  },
  {
    id: "strategic-platforms",
    title: "LinkedIn and strategic platforms",
    whatIsInItForYou:
      "Personara.ai adds an identity interpretation layer that goes beyond raw profile data. It translates how a person naturally thinks, communicates, and works into practical intelligence that can improve AI personalization, career support, hiring insight, and team-related workflows.",
    whyNow:
      "As major platforms move deeper into AI, the differentiator is shifting from generic summarization to deeper human understanding. The next wave of value will come from systems that understand not only what a person has done, but how they work best and how they should be guided.",
    whyEngage:
      "Personara.ai can extend professional identity into richer career, coaching, hiring, learning, and AI-productivity use cases. It increases the usefulness and trustworthiness of AI by grounding it in the person behind the profile.",
  },
  {
    id: "venture-capital",
    title: "Venture capital firms",
    whatIsInItForYou:
      "Personara.ai is building an identity-driven intelligence platform at the intersection of AI personalization, career infrastructure, and human coordination. The same core engine powers multiple product surfaces, creating a credible platform expansion story from day one.",
    whyNow:
      "AI is abundant, but useful context is still scarce. Generic assistants are easy to access and difficult to retain. Products that embed trusted human context into valuable workflows can create better engagement, stronger retention, and more defensible expansion paths.",
    whyEngage:
      "The company offers a platform thesis rather than a single feature thesis. One Gallup-based core powers AI personality design, career positioning, and group coordination. That creates multiple monetization paths, multiple strategic exit paths, and a customer-funded growth model with disciplined capital use.",
  },
]

export default function InvestorsPartnersPage() {
  const [activeAudienceId, setActiveAudienceId] = useState("recruitment-firms")
  const [growthImageSrc, setGrowthImageSrc] = useState("/images/customer-funded-growth-engine.png")

  const activeAudience = useMemo(
    () => audienceArchitecture.find((item) => item.id === activeAudienceId) ?? audienceArchitecture[0],
    [activeAudienceId]
  )
  const activeSection = useMemo(
    () => audienceSections.find((item) => item.id === activeAudienceId) ?? audienceSections[0],
    [activeAudienceId]
  )

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8 investor-brief-root">
        <PlatformModuleNav />

        <section className="rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#edf6ff_50%,#f5fbff_100%)] p-7 shadow-sm investor-brief-intro">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b6b7c]">Investors and partners</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a]">
            The identity layer for applied AI outcomes
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[#475569]">
            Personara.ai turns strengths-based human understanding into practical intelligence across career, AI personality design,
            and team coordination. This page outlines how that creates strategic and commercial value for investors, recruitment firms,
            job marketplaces, and major platforms.
          </p>
          <div className="mt-5 grid gap-2 md:grid-cols-4">
            {investorSignals.map((signal) => (
              <div key={signal.label} className="rounded-xl border border-[#d8e4f2] bg-white/85 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{signal.label}</p>
                <p className="mt-1 text-sm font-semibold text-[#0f172a]">{signal.value}</p>
                <p className="mt-1 text-[11px] leading-4 text-[#475569]">{signal.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 investor-brief-print-hide">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.print()
                }
              }}
              className="rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3.5 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
            >
              Download investor brief
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm investor-brief-menu">
          <div className="flex flex-wrap gap-2">
            {audienceArchitecture.map((audience) => {
              const isActive = audience.id === activeAudienceId
              return (
                <button
                  key={audience.id}
                  type="button"
                  onClick={() => setActiveAudienceId(audience.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {audience.investorTarget}
                </button>
              )
            })}
          </div>
          <article className="mt-4 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Selected audience</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#0f172a]">{activeSection.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#334155]">{activeAudience.firstConversation}</p>
              </div>
              <a
                href="/contact"
                className="rounded-xl border border-[#0a66c2] bg-[#0a66c2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0958a8]"
              >
                Start conversation
              </a>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-sky-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">Core appeal</p>
                <p className="mt-1 text-sm font-semibold text-[#0f172a]">{activeAudience.coreAppeal}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Primary outcome</p>
                <p className="mt-1 text-sm font-semibold text-[#0f172a]">{activeAudience.primaryOutcome}</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">Commercial motion</p>
                <p className="mt-1 text-sm font-semibold text-[#0f172a]">{activeAudience.commercialMotion}</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5 rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm investor-brief-thesis">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">Platform thesis</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">One intelligence layer, three commercial surfaces</h2>
            </div>
            <a
              href="/platform#modules"
              className="rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm font-semibold text-neutral-700 hover:bg-white"
            >
              View platform
            </a>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {platformThesis.map((item) => (
              <article key={item.label} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{item.label}</p>
                <h3 className="mt-2 text-base font-semibold text-[#0f172a]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 investor-brief-images">
          <article className="rounded-3xl border border-[#d8e4f2] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Platform overview</p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#d8e4f2] bg-[#f8fbff]">
              <Image
                src="/images/personara-platform-anatomy.png"
                alt="The Anatomy of Personara.ai platform"
                width={1366}
                height={768}
                className="h-auto w-full"
              />
            </div>
          </article>
          <article className="rounded-3xl border border-[#d8e4f2] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Growth engine</p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#d8e4f2] bg-[#f8fbff]">
              <Image
                src={growthImageSrc}
                alt="The Customer-Funded Growth Engine blueprint"
                width={1366}
                height={768}
                className="h-auto w-full"
                onError={() => {
                  if (growthImageSrc !== "/marketing/customer-funded-growth-engine.jpeg") {
                    setGrowthImageSrc("/marketing/customer-funded-growth-engine.jpeg")
                  }
                }}
              />
            </div>
          </article>
        </section>

        <section className="mt-5 investor-brief-content">
          <article id={activeSection.id} className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">What is in it for you</p>
                <p className="mt-2 text-sm leading-6 text-[#334155]">{activeSection.whatIsInItForYou}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Why now</p>
                <p className="mt-2 text-sm leading-6 text-[#334155]">{activeSection.whyNow}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Why engage</p>
                <p className="mt-2 text-sm leading-6 text-[#334155]">{activeSection.whyEngage}</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] investor-brief-engagement">
          <article className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">Engagement path</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">Move from interest to evidence</h2>
            <div className="mt-4 space-y-3">
              {engagementPath.map((item) => (
                <div key={item.step} className="flex gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0a66c2] text-xs font-semibold text-white">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">{item.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-[#475569]">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[#d8e4f2] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748b]">Diligence prompts</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">The questions this brief answers</h2>
            <div className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-neutral-50">
              {diligenceRows.map((row) => (
                <div key={row.question} className="p-4">
                  <h3 className="text-sm font-semibold text-[#0f172a]">{row.question}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#475569]">{row.answer}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
      <style jsx global>{`
        @media print {
          nav,
          .investor-brief-print-hide,
          .investor-brief-menu {
            display: none !important;
          }

          .investor-brief-root {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .investor-brief-intro,
          .investor-brief-images article,
          .investor-brief-content article {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            background: #ffffff !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .investor-brief-images {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .investor-brief-intro {
            margin: 0 0 12px 0 !important;
            border-radius: 10px !important;
          }

          .investor-brief-content {
            margin-top: 12px !important;
          }

          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </main>
  )
}
