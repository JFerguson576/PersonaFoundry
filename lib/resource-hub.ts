export type ResourceAssetType = "doc" | "pdf" | "image" | "md" | "xlsx"

export type ResourceItem = {
  id: string
  title: string
  description: string
  href: string
  thumbnailHref?: string
  type: ResourceAssetType
  sectionKey: "career" | "persona" | "teamsync" | "visual"
}

export type ResourceSection = {
  key: "career" | "persona" | "teamsync"
  label: string
  summary: string
  workspaceHref: string
  tourHref?: string
}

export const resourceSections: ResourceSection[] = [
  {
    key: "career",
    label: "Career Intelligence",
    summary: "Positioning, profile building, document strategy, and role-ready execution.",
    workspaceHref: "/career-intelligence",
    tourHref: "/career?tour=1",
  },
  {
    key: "persona",
    label: "Persona Foundry",
    summary: "Build a custom AI operating identity aligned with strengths and intent.",
    workspaceHref: "/persona-foundry",
    tourHref: "/persona-foundry?tour=1",
  },
  {
    key: "teamsync",
    label: "TeamSync",
    summary: "Team and executive simulation for role-fit, pressure, and governance.",
    workspaceHref: "/teamsync",
    tourHref: "/teamsync?tour=1",
  },
]

export const resourceItems: ResourceItem[] = [
  {
    id: "how-to-use-career-intelligence",
    title: "How to Use Career Intelligence",
    description: "Visual first-use guide from career inputs to profile, documents, interviews, and role execution.",
    href: "/images/module-guides/how-to-use-career-intelligence.png",
    type: "image",
    sectionKey: "career",
  },
  {
    id: "candidate-journey-explainer-v2",
    title: "Candidate Journey Explainer (v2)",
    description: "End-to-end onboarding and execution guide.",
    href: "/docs/personara-candidate-explainer-v2.docx",
    thumbnailHref: "/images/career-intelligence-blueprint-diagram.png",
    type: "doc",
    sectionKey: "career",
  },
  {
    id: "career-intelligence-explainer",
    title: "Career Intelligence Explainer",
    description: "Core operating model for candidate outcomes.",
    href: "/docs/personara-ai-career-intelligence-explainer.docx",
    thumbnailHref: "/images/career-intelligence-bullseye.png",
    type: "doc",
    sectionKey: "career",
  },
  {
    id: "career-intelligence-blueprint-pdf",
    title: "Career Intelligence Blueprint",
    description: "Full blueprint PDF for the Career Intelligence architecture and flow.",
    href: "/docs/career-intelligence-blueprint.pdf",
    thumbnailHref: "/images/career-intelligence-bullseye.png",
    type: "pdf",
    sectionKey: "career",
  },
  {
    id: "career-intelligence-blueprint-v2-pdf",
    title: "Career Intelligence Blueprint (v2)",
    description: "Updated architecture deck for Career Intelligence outcomes and workflow design.",
    href: "/docs/career-intelligence-blueprint-v2.pdf",
    thumbnailHref: "/images/career-intelligence-bullseye.png",
    type: "pdf",
    sectionKey: "career",
  },
  {
    id: "career-intelligence-blueprint-diagram",
    title: "Career Intelligence Blueprint Diagram",
    description: "High-level structural diagram for Career Intelligence from inputs to outputs.",
    href: "/images/career-intelligence-blueprint-diagram.png",
    type: "image",
    sectionKey: "career",
  },
  {
    id: "career-intelligence-bullseye-visual",
    title: "Career Intelligence Bullseye",
    description: "Core message visual for strengths-led career movement and positioning.",
    href: "/images/career-intelligence-bullseye.png",
    type: "image",
    sectionKey: "career",
  },
  {
    id: "gallup-strengths-explainer",
    title: "Gallup Strengths Explainer",
    description: "How strengths data improves quality and positioning.",
    href: "/docs/personara-ai-gallup-strengths-explainer.docx",
    thumbnailHref: "/images/personara-platform-anatomy.png",
    type: "doc",
    sectionKey: "career",
  },
  {
    id: "career-competitor-feature-table",
    title: "Career Competitor Feature Table",
    description: "Website-ready comparison table for Personara positioning vs adjacent categories.",
    href: "/docs/personara-competitor-feature-table.md",
    thumbnailHref: "/images/career-intelligence-bullseye.png",
    type: "md",
    sectionKey: "career",
  },
  {
    id: "career-competitor-source-matrix",
    title: "Competitor Source Matrix (XLSX)",
    description: "Working spreadsheet source for competitor benchmarking and feature tracking.",
    href: "/docs/personara-competitor-matrix.xlsx",
    thumbnailHref: "/images/career-intelligence-blueprint-diagram.png",
    type: "xlsx",
    sectionKey: "career",
  },
  {
    id: "personara-moat-plan-todo",
    title: "Personara Moat Plan (To-Do)",
    description: "Strategic moat planning worksheet and execution notes.",
    href: "/docs/personara-moat-plan-todo.docx",
    thumbnailHref: "/images/personara-strengths-ecosystem.png",
    type: "doc",
    sectionKey: "career",
  },
  {
    id: "how-to-use-persona-foundry",
    title: "How to Use Persona Foundry",
    description: "Visual first-use guide for turning strengths, goals, and context into a custom AI personality.",
    href: "/images/module-guides/how-to-use-persona-foundry.png",
    type: "image",
    sectionKey: "persona",
  },
  {
    id: "user-experience-explainer-v2",
    title: "User Experience Explainer (v2)",
    description: "Why custom AI personalities improve consistency and speed.",
    href: "/docs/personara-user-explainer-v2.docx",
    thumbnailHref: "/images/personara-platform-anatomy.png",
    type: "doc",
    sectionKey: "persona",
  },
  {
    id: "platform-proposition",
    title: "Platform Proposition",
    description: "Strategic framing for identity-driven AI operations.",
    href: "/docs/personara-ai-platform-proposition.docx",
    thumbnailHref: "/images/personara-platform-anatomy.png",
    type: "doc",
    sectionKey: "persona",
  },
  {
    id: "roxy-about-pack",
    title: "Personara About Pack (Roxy Ferguson)",
    description: "Long-form mission story, homepage version, and leadership bio copy.",
    href: "/docs/personara-codex-about-pack-roxy-ferguson.docx",
    thumbnailHref: "/images/roxy-ferguson-about.jpg",
    type: "doc",
    sectionKey: "persona",
  },
  {
    id: "how-to-use-teamsync",
    title: "How to Use TeamSync",
    description: "Visual first-use guide for loading group strengths, choosing scenarios, and using simulation outputs.",
    href: "/images/module-guides/how-to-use-teamsync.png",
    type: "image",
    sectionKey: "teamsync",
  },
  {
    id: "analyst-intelligence-explainer-v2",
    title: "Analyst Intelligence Explainer (v2)",
    description: "Interpret simulation signals and actions.",
    href: "/docs/personara-analyst-explainer-v2.docx",
    thumbnailHref: "/images/teamsync-executive-intelligence-engine.png",
    type: "doc",
    sectionKey: "teamsync",
  },
  {
    id: "teamsync-explainer",
    title: "TeamSync Explainer",
    description: "How TeamSync models communication and decision dynamics.",
    href: "/docs/personara-ai-teamsync-explainer.docx",
    thumbnailHref: "/images/teamsync-executive-intelligence-engine.png",
    type: "doc",
    sectionKey: "teamsync",
  },
  {
    id: "executive-intelligence-deck",
    title: "Executive Intelligence Deck",
    description: "Board-ready premium simulation deck.",
    href: "/docs/teamsync-executive-intelligence-deck.pdf",
    thumbnailHref: "/images/teamsync-executive-intelligence-visual.png",
    type: "pdf",
    sectionKey: "teamsync",
  },
  {
    id: "executive-intelligence-brief",
    title: "Executive Intelligence Brief",
    description: "Leadership use-case and rollout brief.",
    href: "/docs/teamsync-executive-intelligence.pdf",
    thumbnailHref: "/images/teamsync-executive-intelligence-engine.png",
    type: "pdf",
    sectionKey: "teamsync",
  },
  {
    id: "teamsync-future-pathway",
    title: "TeamSync Future Pathway",
    description: "Forward plan for TeamSync module growth, sequencing, and execution focus.",
    href: "/docs/future-pathway.md",
    thumbnailHref: "/images/teamsync-executive-intelligence-engine.png",
    type: "md",
    sectionKey: "teamsync",
  },
  {
    id: "platform-anatomy-visual",
    title: "Personara Platform Anatomy",
    description: "Architecture linking strengths, career, and team outcomes.",
    href: "/images/personara-platform-anatomy.png",
    type: "image",
    sectionKey: "visual",
  },
  {
    id: "strengths-ecosystem-visual",
    title: "Strengths-Based Intelligence Ecosystem",
    description: "Integrated map of Persona Foundry, TeamSync, and Career Intelligence.",
    href: "/images/personara-strengths-ecosystem.png",
    type: "image",
    sectionKey: "visual",
  },
  {
    id: "teamsync-executive-engine-visual",
    title: "TeamSync Executive Intelligence Engine",
    description: "Premium executive intelligence architecture.",
    href: "/images/teamsync-executive-intelligence-engine.png",
    type: "image",
    sectionKey: "visual",
  },
]

export function formatResourceType(type: ResourceAssetType) {
  if (type === "doc") return "DOCX"
  if (type === "pdf") return "PDF"
  if (type === "md") return "MD"
  if (type === "xlsx") return "XLSX"
  return "IMAGE"
}

export function findResourceById(id: string) {
  return resourceItems.find((item) => item.id === id) ?? null
}
