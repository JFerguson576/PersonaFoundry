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
  workspaceHref: string
  tourHref?: string
  resources: ResourceItem[]
}

const sections: ResourceSection[] = [
  {
    key: "career",
    label: "Career Intelligence",
    summary: "Positioning, profile building, document strategy, and role-ready execution.",
    workspaceHref: "/career-intelligence",
    tourHref: "/career?tour=1",
    resources: [
      {
        title: "Candidate Journey Explainer (v2)",
        description: "End-to-end onboarding and execution guide.",
        href: "/docs/personara-candidate-explainer-v2.docx",
        type: "doc",
      },
      {
        title: "Career Intelligence Explainer",
        description: "Core operating model for candidate outcomes.",
        href: "/docs/personara-ai-career-intelligence-explainer.docx",
        type: "doc",
      },
      {
        title: "Gallup Strengths Explainer",
        description: "How strengths data improves quality and positioning.",
        href: "/docs/personara-ai-gallup-strengths-explainer.docx",
        type: "doc",
      },
    ],
  },
  {
    key: "persona",
    label: "Persona Foundry",
    summary: "Build a custom AI operating identity aligned with strengths and intent.",
    workspaceHref: "/persona-foundry",
    tourHref: "/persona-foundry?tour=1",
    resources: [
      {
        title: "User Experience Explainer (v2)",
        description: "Why custom AI personalities improve consistency and speed.",
        href: "/docs/personara-user-explainer-v2.docx",
        type: "doc",
      },
      {
        title: "Platform Proposition",
        description: "Strategic framing for identity-driven AI operations.",
        href: "/docs/personara-ai-platform-proposition.docx",
        type: "doc",
      },
    ],
  },
  {
    key: "teamsync",
    label: "TeamSync",
    summary: "Team and executive simulation for role-fit, pressure, and governance.",
    workspaceHref: "/teamsync",
    tourHref: "/teamsync?tour=1",
    resources: [
      {
        title: "Analyst Intelligence Explainer (v2)",
        description: "Interpret simulation signals and actions.",
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
        description: "Board-ready premium simulation deck.",
        href: "/docs/teamsync-executive-intelligence-deck.pdf",
        type: "pdf",
      },
      {
        title: "Executive Intelligence Brief",
        description: "Leadership use-case and rollout brief.",
        href: "/docs/teamsync-executive-intelligence.pdf",
        type: "pdf",
      },
    ],
  },
]

const visualResources: ResourceItem[] = [
  {
    title: "Personara Platform Anatomy",
    description: "Architecture linking strengths, career, and team outcomes.",
    href: "/images/personara-platform-anatomy.png",
    type: "image",
  },
  {
    title: "Strengths-Based Intelligence Ecosystem",
    description: "Integrated map of Persona Foundry, TeamSync, and Career Intelligence.",
    href: "/images/personara-strengths-ecosystem.png",
    type: "image",
  },
  {
    title: "TeamSync Executive Intelligence Engine",
    description: "Premium executive intelligence architecture.",
    href: "/images/teamsync-executive-intelligence-engine.png",
    type: "image",
  },
]

function formatType(type: ResourceItem["type"]) {
  if (type === "doc") return "DOCX"
  if (type === "pdf") return "PDF"
  return "IMAGE"
}

function safeSitePath(href: string) {
  return href.startsWith("/") ? href : "/resources"
}

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-5 py-7">
        <PlatformModuleNav />

        <section className="rounded-3xl border border-[#bfd2ed] bg-[linear-gradient(130deg,#ffffff_0%,#edf4ff_64%,#f0f6ff_100%)] px-5 py-5 shadow-[0_14px_30px_-26px_rgba(26,54,93,0.5)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Resources Hub</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#142c4f]">Guides, explainers, and strategy assets</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#475569]">
            Everything here opens from Personara website paths only. No local desktop links.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sections.map((section) => (
              <a key={section.key} href={`#${section.key}`} className="personara-explainer-chip">
                {section.label}
              </a>
            ))}
            <a href="#visual-library" className="personara-explainer-chip">Visual library</a>
          </div>
        </section>

        <section className="mt-4 space-y-3">
          {sections.map((section) => (
            <article key={section.key} id={section.key} className="rounded-2xl border border-[#c9d8ef] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{section.label}</p>
                  <p className="mt-1 text-sm text-[#475569]">{section.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={section.workspaceHref} className="personara-explainer-chip">Open workspace</Link>
                  {section.tourHref ? <Link href={section.tourHref} className="personara-explainer-chip">Start tour</Link> : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {section.resources.map((resource) => (
                  <div key={`${section.key}-${resource.href}`} className="rounded-xl border border-[#d9e4f3] bg-[#f8fbff] px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#142c4f]">{resource.title}</div>
                        <div className="mt-0.5 text-xs text-[#52627b]">{resource.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-[#d4e1f1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                          {formatType(resource.type)}
                        </span>
                        <a
                          href={safeSitePath(resource.href)}
                          target="_blank"
                          rel="noreferrer"
                          className="personara-explainer-chip"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section id="visual-library" className="mt-4 rounded-2xl border border-[#c9d8ef] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Visual library</p>
          <h2 className="mt-1 text-xl font-semibold text-[#142c4f]">Architecture and ecosystem visuals</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visualResources.map((visual, index) => (
              <article key={visual.href} className="rounded-xl border border-[#d9e4f3] bg-[#f8fbff] p-3">
                <div className="overflow-hidden rounded-lg border border-[#bfd2ed] bg-[#f3f8ff]">
                  <Image
                    src={safeSitePath(visual.href)}
                    alt={visual.title}
                    width={1400}
                    height={800}
                    className="h-auto w-full"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#142c4f]">{visual.title}</p>
                    <p className="text-xs text-[#52627b]">{visual.description}</p>
                  </div>
                  <a href={safeSitePath(visual.href)} target="_blank" rel="noreferrer" className="personara-explainer-chip">
                    Open
                  </a>
                </div>
                {index === 2 ? <div className="mt-1 text-[11px] text-[#6b7c95]">TeamSync premium visual asset</div> : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
