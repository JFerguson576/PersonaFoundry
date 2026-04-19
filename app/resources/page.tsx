import Image from "next/image"
import Link from "next/link"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"

type ResourceItem = {
  title: string
  description: string
  href: string
  type: "doc" | "pdf" | "image"
}

type ResourceSection = {
  key: string
  label: string
  summary: string
  tourHref?: string
  resources: ResourceItem[]
}

const sections: ResourceSection[] = [
  {
    key: "career",
    label: "Career Intelligence",
    summary: "Positioning, profile building, document strategy, and role-ready workflow design.",
    tourHref: "/career?tour=1",
    resources: [
      {
        title: "Candidate Journey Explainer (v2)",
        description: "End-to-end candidate flow guidance for onboarding, setup, and execution outcomes.",
        href: "/docs/personara-candidate-explainer-v2.docx",
        type: "doc",
      },
      {
        title: "Career Intelligence Explainer",
        description: "Core operating model for candidate workflow and outcomes.",
        href: "/docs/personara-ai-career-intelligence-explainer.docx",
        type: "doc",
      },
      {
        title: "Gallup Strengths Explainer",
        description: "How strengths data lifts profile quality, messaging, and positioning.",
        href: "/docs/personara-ai-gallup-strengths-explainer.docx",
        type: "doc",
      },
      {
        title: "Personara Platform Anatomy",
        description: "Visual architecture linking strengths, career, and team outputs.",
        href: "/images/personara-platform-anatomy.png",
        type: "image",
      },
    ],
  },
  {
    key: "persona-foundry",
    label: "Persona Foundry",
    summary: "Build a custom AI operating identity aligned with human strengths and intent.",
    tourHref: "/persona-foundry?tour=1",
    resources: [
      {
        title: "User Experience Explainer (v2)",
        description: "User-facing narrative that clarifies why custom AI personalities improve decision quality and speed.",
        href: "/docs/personara-user-explainer-v2.docx",
        type: "doc",
      },
      {
        title: "Gallup Strengths Explainer",
        description: "Use strengths as the baseline for AI personality design.",
        href: "/docs/personara-ai-gallup-strengths-explainer.docx",
        type: "doc",
      },
      {
        title: "Platform Proposition",
        description: "Strategic framing for identity-driven AI operations.",
        href: "/docs/personara-ai-platform-proposition.docx",
        type: "doc",
      },
      {
        title: "Personara Platform Anatomy",
        description: "Reference visual for how Persona Foundry fits the full stack.",
        href: "/images/personara-platform-anatomy.png",
        type: "image",
      },
    ],
  },
  {
    key: "teamsync",
    label: "TeamSync",
    summary: "Strengths-based team and executive simulation for role-fit, pressure, and governance.",
    tourHref: "/teamsync?tour=1",
    resources: [
      {
        title: "Analyst Intelligence Explainer (v2)",
        description: "Analyst-grade framing for simulation interpretation, leadership diagnostics, and executive signal reading.",
        href: "/docs/personara-analyst-explainer-v2.docx",
        type: "doc",
      },
      {
        title: "TeamSync Explainer",
        description: "How TeamSync models communication and decision dynamics.",
        href: "/docs/personara-ai-teamsync-explainer.docx",
        type: "doc",
      },
      {
        title: "Executive Intelligence Deck",
        description: "Board-ready deck version for premium executive simulations.",
        href: "/docs/teamsync-executive-intelligence-deck.pdf",
        type: "pdf",
      },
      {
        title: "Executive Intelligence Brief",
        description: "Detailed PDF briefing for leadership use cases and rollout.",
        href: "/docs/teamsync-executive-intelligence.pdf",
        type: "pdf",
      },
      {
        title: "Executive Intelligence Engine Visual",
        description: "Architecture map of the TeamSync premium intelligence layer.",
        href: "/images/teamsync-executive-intelligence-engine.png",
        type: "image",
      },
      {
        title: "TeamSync Executive Illustration",
        description: "Premium narrative visual for executive outcomes and use cases.",
        href: "/images/teamsync-executive-intelligence-visual.png",
        type: "image",
      },
    ],
  },
]

function formatType(type: ResourceItem["type"]) {
  if (type === "doc") return "DOCX"
  if (type === "pdf") return "PDF"
  return "IMAGE"
}

export default function ResourcesPage() {
  const quickExplainers: ResourceItem[] = [
    {
      title: "Candidate Journey Explainer (v2)",
      description: "Clear onboarding and setup guidance for Career Intelligence users.",
      href: "/docs/personara-candidate-explainer-v2.docx",
      type: "doc",
    },
    {
      title: "Persona Foundry User Explainer (v2)",
      description: "Why to build a custom AI personality and how to use it effectively.",
      href: "/docs/personara-user-explainer-v2.docx",
      type: "doc",
    },
    {
      title: "TeamSync Analyst Explainer (v2)",
      description: "How to interpret simulation signals and move to practical actions.",
      href: "/docs/personara-analyst-explainer-v2.docx",
      type: "doc",
    },
    {
      title: "TeamSync Executive Intelligence Brief",
      description: "Leadership-grade architecture and strategic application brief.",
      href: "/docs/teamsync-executive-intelligence.pdf",
      type: "pdf",
    },
  ]

  return (
    <main className="min-h-screen bg-[#eef3fb] text-[#142c4f]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />

        <section className="rounded-[2rem] border border-[#bfd2ed] bg-[linear-gradient(140deg,#ffffff_0%,#edf4ff_55%,#f0f6ff_100%)] p-7 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b6b7c]">Resources</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#142c4f]">Deep dives, explainers, and strategic assets</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
            This library centralizes your core documentation for Career Intelligence, Persona Foundry, and TeamSync.
            It is structured for rapid onboarding now, with room for future case studies and expanded thought pieces.
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Newly added</p>
              <h2 className="mt-1 text-xl font-semibold text-[#142c4f]">Core explainer pack</h2>
              <p className="mt-1 text-sm text-[#475569]">Open the latest explainers directly from here.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {quickExplainers.map((resource) => (
              <article key={resource.href} className="rounded-2xl border border-[#c9d8ef] bg-[#f7faff] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[#142c4f]">{resource.title}</h3>
                  <span className="rounded-full border border-[#d4e1f1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                    {formatType(resource.type)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#475569]">{resource.description}</p>
                <Link
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip mt-3"
                >
                  Open explainer
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {sections.map((section, index) => (
            <details
              key={section.key}
              id={section.key}
              open={index === 0 || section.key === "teamsync"}
              className="group overflow-hidden rounded-3xl border border-[#c9d8ef] bg-white shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{section.label}</p>
                  <p className="mt-1 text-sm text-[#475569]">{section.summary}</p>
                  {section.tourHref ? (
                    <Link href={section.tourHref} className="mt-2 inline-flex text-xs font-semibold text-[#2a63e5] hover:underline">
                      Relaunch walkthrough
                    </Link>
                  ) : null}
                </div>
                <span className="rounded-full border border-[#bfd2ed] bg-[#edf4ff] px-3 py-1 text-xs font-semibold text-[#2a63e5]">
                  Expand
                </span>
              </summary>
              <div className="border-t border-[#e2ebf5] px-5 py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {section.resources.map((resource) => (
                    <article key={`${section.key}-${resource.href}`} className="rounded-2xl border border-[#c9d8ef] bg-[#f5f9ff] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-semibold text-[#142c4f]">{resource.title}</h2>
                        <span className="rounded-full border border-[#d4e1f1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                          {formatType(resource.type)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#475569]">{resource.description}</p>
                      <div className="mt-3">
                        <Link
                          href={resource.href}
                          target="_blank"
                          rel="noreferrer"
                          className="personara-explainer-chip"
                        >
                          Open resource
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </section>

        <section className="mt-5 rounded-3xl border border-[#c9d8ef] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Featured architecture visual</p>
          <h2 className="mt-2 text-xl font-semibold text-[#142c4f]">Personara system overview</h2>
          <p className="mt-2 text-sm text-[#475569]">
            A single view of how identity intelligence powers all three product modules.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#bfd2ed] bg-[#f3f8ff]">
            <Image
              src="/images/personara-platform-anatomy.png"
              alt="Personara platform architecture overview"
              width={1366}
              height={768}
              className="h-auto w-full"
            />
          </div>
        </section>
      </div>
    </main>
  )
}
