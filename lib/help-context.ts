export type HelpModuleKey = "platform" | "career" | "persona" | "teamsync" | "community" | "admin" | "marketing"

export type HelpModuleContext = {
  key: HelpModuleKey
  title: string
  purpose: string
  workflowSteps: string[]
  prepChecklist: string[]
}

const moduleContexts: Record<HelpModuleKey, HelpModuleContext> = {
  platform: {
    key: "platform",
    title: "Platform Hub",
    purpose: "Choose the right module and keep one login across Career Intelligence, Persona Foundry, and TeamSync.",
    workflowSteps: [
      "Choose your module based on immediate priority.",
      "Sign in once and continue in the same session.",
      "Open the module workspace and complete the current step shown in the workflow.",
    ],
    prepChecklist: ["Your email login", "A clear goal for this session"],
  },
  career: {
    key: "career",
    title: "Career Intelligence",
    purpose: "Turn your profile into practical outcomes: role targeting, documents, interviews, and live opportunities.",
    workflowSteps: [
      "Load key source material (CV, Gallup strengths, LinkedIn, proof stories).",
      "Generate your career profile and select target roles.",
      "Create assets, run company research, and execute job search.",
      "Track applications and follow-ups in one place.",
    ],
    prepChecklist: ["CV or executive bio", "Gallup strengths report", "Target roles and locations"],
  },
  persona: {
    key: "persona",
    title: "Persona Foundry",
    purpose: "Build and tune a personal AI voice that matches how you think, lead, and communicate.",
    workflowSteps: [
      "Set baseline personality traits.",
      "Analyze writing and compare presets or versions.",
      "Tune the output style and test in sandbox mode.",
      "Export for ChatGPT/API/Claude/JSON deployment.",
    ],
    prepChecklist: ["Sample writing", "Gallup strengths (optional but recommended)", "Primary use cases"],
  },
  teamsync: {
    key: "teamsync",
    title: "TeamSync",
    purpose: "Use strengths-based intelligence to improve communication, clarity, and decision flow in teams or families.",
    workflowSteps: [
      "Create a group and load member strengths.",
      "Run scenario analysis and relationship insight tools.",
      "Use expert mode outputs to guide conversations and support plans.",
    ],
    prepChecklist: ["Group name", "Member strengths inputs", "Current scenario or challenge"],
  },
  community: {
    key: "community",
    title: "Community",
    purpose: "Share product ideas and success stories, and learn from real outcomes across the user base.",
    workflowSteps: [
      "Post an idea or success story.",
      "Vote and discuss practical improvements.",
      "Use featured insights to refine your workflow.",
    ],
    prepChecklist: ["Your idea or story summary", "What changed and why it mattered"],
  },
  admin: {
    key: "admin",
    title: "Admin / Operations",
    purpose: "Monitor usage, manage users, oversee candidate health, and control operational quality.",
    workflowSteps: [
      "Review dashboard signals and usage trends.",
      "Inspect candidate health and intervene where needed.",
      "Manage roles, settings, and operational backlog.",
    ],
    prepChecklist: ["Admin access", "Operational priorities for this week"],
  },
  marketing: {
    key: "marketing",
    title: "Marketing Engine",
    purpose: "Manage campaign performance, budget safety, and growth recommendations from one control center.",
    workflowSteps: [
      "Review budget guardrails and campaign health.",
      "Approve/reject recommendation actions.",
      "Track alerts, audit events, and outcomes.",
    ],
    prepChecklist: ["Campaign goals", "Budget limits", "Decision owner for approvals"],
  },
}

export function resolveHelpModule(pathname: string): HelpModuleContext {
  const normalized = pathname.toLowerCase()

  if (normalized.startsWith("/career")) return moduleContexts.career
  if (normalized.startsWith("/persona-foundry")) return moduleContexts.persona
  if (normalized.startsWith("/teamsync")) return moduleContexts.teamsync
  if (normalized.startsWith("/community")) return moduleContexts.community
  if (normalized.startsWith("/admin") || normalized.startsWith("/operations")) return moduleContexts.admin
  if (normalized.includes("marketing")) return moduleContexts.marketing
  return moduleContexts.platform
}

