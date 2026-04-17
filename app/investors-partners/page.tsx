"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

type AudienceCard = {
  id: string
  investorTarget: string
  coreAppeal: string
  primaryOutcome: string
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
  },
  {
    id: "job-boards",
    investorTarget: "Job boards and hiring marketplaces",
    coreAppeal: "Higher user value and recurring engagement",
    primaryOutcome: "Shift from listings to career intelligence",
  },
  {
    id: "strategic-platforms",
    investorTarget: "LinkedIn and strategic platforms",
    coreAppeal: "Deeper identity interpretation for AI and career workflows",
    primaryOutcome: "Extend the professional graph into practical intelligence",
  },
  {
    id: "venture-capital",
    investorTarget: "Venture capital firms",
    coreAppeal: "Large category thesis with platform expansion",
    primaryOutcome: "Back the identity layer for applied AI",
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
            <h2 className="text-xl font-semibold tracking-tight text-[#0f172a]">{activeSection.title}</h2>
            <p className="mt-3 text-sm text-[#334155]">
              <span className="font-semibold">Core appeal:</span> {activeAudience.coreAppeal}
            </p>
            <p className="mt-1 text-sm text-[#334155]">
              <span className="font-semibold">Primary outcome:</span> {activeAudience.primaryOutcome}
            </p>
          </article>
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
