"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import Image from "next/image"
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"
import { getAuthHeaders } from "@/lib/career-client"
import { supabase } from "@/lib/supabase"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { AdaptiveProductTour } from "@/components/navigation/AdaptiveProductTour"
import { ModuleExplainerPanel } from "@/components/navigation/ModuleExplainerPanel"
import { WelcomeBackNotice } from "@/components/navigation/WelcomeBackNotice"
import { teamsyncExecutivePromptLibrary } from "@/lib/teamsync-executive-prompts"
import { scrollToSelectorWithOffset } from "@/lib/scroll"

type TeamMember = {
  id: string
  name: string
  role: string
  strengths: string
}

type ScenarioTemplate = {
  id: string
  category: "Professional" | "Family" | "Learning" | "Executive" | "Boardroom"
  title: string
  focus: string
  promptText?: string
  visibility?: "private" | "shared"
  ownerUserId?: string
  updatedAt?: string | null
}

type ExecutivePromptTemplate = {
  id: string
  tier: "Premium" | "Boardroom"
  pack: string
  category: string
  title: string
  promptText: string
}

type RoleReaction = {
  audience: string
  likelyResponse: string
  supportAction: string
}

type ResourceLink = {
  id: string
  title: string
  href: string
  reason: string
}

type ScenarioExample = {
  id: string
  title: string
  href: string
  note: string
}

type ActionChecklistItem = {
  id: string
  label: string
  done: boolean
  owner: string
  dueDate: string
}

type PriorityItem = {
  title: string
  detail: string
  level: "high" | "medium" | "low"
}

type FacilitationScript = {
  opening: string[]
  prompts: string[]
  close: string[]
}

type MemberSupportPriority = {
  memberId: string
  memberName: string
  role: string
  score: number
  level: "high" | "medium" | "low"
  rationale: string
  supportMove: string
}

type RunResult = {
  runId: string
  timestamp: string
  isFavorite?: boolean
  notes?: string
  reviewed?: boolean
  scenarioTitle: string
  scenarioCategory: string
  pressureLevel: number
  groupSummary: string
  semanticLens: string
  likelyBehaviors: string[]
  roleReactions: RoleReaction[]
  risks: string[]
  adjustments: string[]
  actions: string[]
  actionChecklist: ActionChecklistItem[]
  memberSupportPriorities: MemberSupportPriority[]
  companyUrl?: string
  companyContextInfluence?: "low" | "medium" | "high"
  companyContextSummary?: string
}

type ConversationTurn = {
  id: string
  speakerName: string
  listenerName: string
  userMessage: string
  memberReply: string
  whatWorked: string[]
  whatToAdjust: string[]
  improvedRewrite: string
  safetyScore: number
}

type ConversationTone = "clear" | "warm" | "de-escalate"
type ConversationTemplate = {
  id: string
  label: string
  tone: ConversationTone
  message: string
}

type PairInsight = {
  id: string
  aName: string
  bName: string
  synergyScore: number
  frictionRisk: "high" | "medium" | "low"
  summary: string
  coachingMove: string
}

type RunComparison = {
  pressureDelta: number
  newlyAddedRisks: string[]
  resolvedRisks: string[]
  newActions: string[]
  droppedActions: string[]
}

type NextBestAction = {
  title: string
  detail: string
  tone: "high" | "medium" | "low"
  action: "open_support" | "open_checklist" | "schedule_pulse" | "none"
}

const LOCAL_MEMBERS_KEY = "teamsync-members-v1"
const LOCAL_RUNS_KEY = "teamsync-runs-v1"
const LOCAL_GROUP_NAME_KEY = "teamsync-group-name-v1"
const LOCAL_CUSTOM_SCENARIOS_KEY = "teamsync-custom-scenarios-v1"
const LOCAL_ACTIVE_GROUP_ID_KEY = "teamsync-active-group-id-v1"
const LOCAL_SIMPLE_VIEW_KEY = "teamsync-simple-view-v1"

type WorkspaceGroupSummary = {
  id: string
  group_name: string
  updated_at: string | null
}

const gallupThemes = [
  "Achiever",
  "Activator",
  "Adaptability",
  "Analytical",
  "Arranger",
  "Belief",
  "Command",
  "Communication",
  "Competition",
  "Connectedness",
  "Consistency",
  "Context",
  "Deliberative",
  "Developer",
  "Discipline",
  "Empathy",
  "Focus",
  "Futuristic",
  "Harmony",
  "Ideation",
  "Includer",
  "Input",
  "Intellection",
  "Learner",
  "Maximizer",
  "Positivity",
  "Relator",
  "Responsibility",
  "Restorative",
  "Self-Assurance",
  "Significance",
  "Strategic",
  "Woo",
]

const scenarioLibrary: ScenarioTemplate[] = [
  { id: "s1", category: "Professional", title: "New project kickoff", focus: "Role clarity and momentum setup" },
  { id: "s2", category: "Professional", title: "High-stakes deadline", focus: "Pressure response and execution handoffs" },
  { id: "s3", category: "Professional", title: "Feedback conversation", focus: "Trust, delivery tone, and absorption" },
  { id: "s4", category: "Professional", title: "Change readiness scan", focus: "Adaptability and ambiguity response" },
  { id: "s5", category: "Family", title: "Family conflict repair", focus: "De-escalation and repair sequence" },
  { id: "s6", category: "Family", title: "Holiday planning simulator", focus: "Decision style and friction points" },
  { id: "s7", category: "Family", title: "Big decision simulator", focus: "Consensus path under stress" },
  { id: "s8", category: "Learning", title: "Learning strategy builder", focus: "How the group learns best together" },
]

const executivePromptLibrary: ExecutivePromptTemplate[] = teamsyncExecutivePromptLibrary.map((item) => ({
  ...item,
  tier: item.tier,
}))

const TEAMSYNC_EXECUTIVE_ENGINE_IMAGE = "/images/teamsync-executive-intelligence-engine.png"
const TEAMSYNC_EXECUTIVE_VISUAL_IMAGE = "/images/teamsync-executive-intelligence-visual.png"
const TEAMSYNC_EXECUTIVE_BRIEF_PDF = "/docs/teamsync-executive-intelligence.pdf"
const TEAMSYNC_EXECUTIVE_DECK_PDF = "/docs/teamsync-executive-intelligence-deck.pdf"

const executorSet = new Set([
  "achiever",
  "discipline",
  "focus",
  "responsibility",
  "consistency",
  "arranger",
  "deliberative",
  "restorative",
  "belief",
])

const relationshipSet = new Set([
  "relator",
  "harmony",
  "empathy",
  "includer",
  "connectedness",
  "developer",
  "positivity",
  "adaptability",
])

const strategySet = new Set([
  "strategic",
  "analytical",
  "context",
  "ideation",
  "intellection",
  "learner",
  "futuristic",
  "input",
])

const influenceSet = new Set([
  "command",
  "communication",
  "maximizer",
  "self-assurance",
  "competition",
  "woo",
  "significance",
  "activator",
])

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function parseStrengthTokens(strengths: string) {
  return strengths
    .toLowerCase()
    .split(/[,/\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractOrderedGallupThemes(text: string) {
  const source = text || ""
  const lowered = source.toLowerCase()
  if (!lowered.trim()) return [] as string[]

  const rankedHits: Array<{ theme: string; rank: number; index: number }> = []

  gallupThemes.forEach((theme) => {
    const escapedTheme = escapeRegex(theme)
    const rankedRegex = new RegExp(`(?:^|\\n)\\s*(\\d{1,2})\\s*[\\)\\.:\\-]\\s*${escapedTheme}\\b`, "gim")
    let match = rankedRegex.exec(source)
    while (match) {
      const rank = Number(match[1])
      rankedHits.push({
        theme: theme.toLowerCase(),
        rank: Number.isFinite(rank) ? rank : 999,
        index: match.index,
      })
      match = rankedRegex.exec(source)
    }
  })

  if (rankedHits.length > 0) {
    const byRankThenPosition = rankedHits.sort((a, b) => a.rank - b.rank || a.index - b.index)
    const unique = Array.from(new Set(byRankThenPosition.map((item) => item.theme)))
    return unique
  }

  const positioned = gallupThemes
    .map((theme) => {
      const regex = new RegExp(`\\b${escapeRegex(theme.toLowerCase())}\\b`, "i")
      const index = lowered.search(regex)
      return { theme: theme.toLowerCase(), index }
    })
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)

  return positioned.map((item) => item.theme)
}

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ")
}

function summarizeMemberGallup(strengths: string) {
  const extractedThemes = extractOrderedGallupThemes(strengths)
  const tokens = extractedThemes.length > 0 ? extractedThemes : parseStrengthTokens(strengths)
  if (tokens.length === 0) {
    return "No strengths profile loaded yet."
  }

  const topThemes = tokens.slice(0, 3).map(titleCase)
  const laneScores = {
    executor: 0,
    relationship: 0,
    strategy: 0,
    influence: 0,
  }

  tokens.forEach((token) => {
    if (executorSet.has(token)) laneScores.executor += 1
    if (relationshipSet.has(token)) laneScores.relationship += 1
    if (strategySet.has(token)) laneScores.strategy += 1
    if (influenceSet.has(token)) laneScores.influence += 1
  })

  const dominant = Object.entries(laneScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "balanced"
  const dominantLabel =
    dominant === "executor"
      ? "execution"
      : dominant === "relationship"
        ? "relationship"
        : dominant === "strategy"
          ? "strategic thinking"
          : dominant === "influence"
            ? "influence"
            : "balanced"

  return `Top themes: ${topThemes.join(", ")}. Likely style leans ${dominantLabel}.`
}

function getDominantLane(tokens: string[]) {
  const laneScores = {
    executor: 0,
    relationship: 0,
    strategy: 0,
    influence: 0,
  }
  tokens.forEach((token) => {
    if (executorSet.has(token)) laneScores.executor += 1
    if (relationshipSet.has(token)) laneScores.relationship += 1
    if (strategySet.has(token)) laneScores.strategy += 1
    if (influenceSet.has(token)) laneScores.influence += 1
  })
  const dominant = Object.entries(laneScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "balanced"
  if (dominant === "executor") return "execution"
  if (dominant === "relationship") return "relationship"
  if (dominant === "strategy") return "strategy"
  if (dominant === "influence") return "influence"
  return "balanced"
}

function scoreTeam(members: TeamMember[]) {
  const totals = {
    executor: 0,
    relationship: 0,
    strategy: 0,
    influence: 0,
  }

  members.forEach((member) => {
    const tokens = parseStrengthTokens(member.strengths)
    tokens.forEach((token) => {
      if (executorSet.has(token)) totals.executor += 1
      if (relationshipSet.has(token)) totals.relationship += 1
      if (strategySet.has(token)) totals.strategy += 1
      if (influenceSet.has(token)) totals.influence += 1
    })
  })

  return totals
}

function summarizeTeamBias(scores: ReturnType<typeof scoreTeam>) {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const top = ranked[0]?.[0] || "balanced"
  const low = ranked[ranked.length - 1]?.[0] || "balanced"

  if (top === low) {
    return "This group reads balanced across execution, relationship, strategy, and influence."
  }

  return `This group leans ${top} and may under-index on ${low}.`
}

function buildActionChecklist(actions: string[], existingChecklist?: ActionChecklistItem[]) {
  const priorByLabel = new Map(
    (existingChecklist ?? []).map((item) => [
      item.label.toLowerCase(),
      { done: item.done, owner: item.owner || "", dueDate: item.dueDate || "" },
    ])
  )
  return actions.map((label, index) => ({
    id: `task-${index + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    label,
    done: priorByLabel.get(label.toLowerCase())?.done ?? false,
    owner: priorByLabel.get(label.toLowerCase())?.owner ?? "",
    dueDate: priorByLabel.get(label.toLowerCase())?.dueDate ?? "",
  }))
}

function containsAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token))
}

function hashText(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function truncateWords(text: string, maxWords = 8) {
  const parts = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length <= maxWords) return parts.join(" ")
  return `${parts.slice(0, maxWords).join(" ")}...`
}

function wrapTextForCard(text: string, maxChars = 26, maxLines = 2) {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return [""]

  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) {
      lines.push(current)
      current = word
    } else {
      lines.push(word.slice(0, maxChars))
      current = word.slice(maxChars)
    }
    if (lines.length >= maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length > maxLines) lines.length = maxLines

  if (lines.length === maxLines) {
    const sourceWordCount = words.length
    const renderedWordCount = lines.join(" ").trim().split(/\s+/).filter(Boolean).length
    if (sourceWordCount > renderedWordCount) {
      const lastIndex = lines.length - 1
      lines[lastIndex] = `${lines[lastIndex].replace(/[.]+$/, "").trimEnd()}...`
    }
  }
  return lines
}

function toneForLevel(level: "high" | "medium" | "low", score: number) {
  if (level === "high") {
    return {
      stroke: "#ef4444",
      fill: "#fff1f2",
      text: "#881337",
      edgeOpacity: 0.92,
      edgeWidth: Math.min(3.4, 2 + score / 100),
      edgeDash: "4 3",
    }
  }
  if (level === "medium") {
    return {
      stroke: "#f59e0b",
      fill: "#fffbeb",
      text: "#92400e",
      edgeOpacity: 0.85,
      edgeWidth: Math.min(2.8, 1.8 + score / 140),
      edgeDash: "3 2",
    }
  }
  return {
    stroke: "#10b981",
    fill: "#ecfdf5",
    text: "#065f46",
    edgeOpacity: 0.8,
    edgeWidth: Math.min(2.4, 1.6 + score / 170),
    edgeDash: "",
  }
}

function buildMemberSupportPriorities(
  members: TeamMember[],
  scenarioTitle: string,
  pressureLevel: number,
  risks: string[],
  roleReactions: RoleReaction[]
): MemberSupportPriority[] {
  const scenarioText = scenarioTitle.toLowerCase()
  const riskText = risks.join(" ").toLowerCase()
  const reactionRows = roleReactions.map((item) => `${item.audience} ${item.likelyResponse}`.toLowerCase())
  const isLossScenario = containsAny(scenarioText, ["grief", "loss", "died", "death", "bereav", "funeral"])
  const isConflictScenario = containsAny(scenarioText + " " + riskText, ["conflict", "tension", "repair", "misunderstanding"])

  const priorities = members.map((member) => {
    const roleText = member.role.toLowerCase()
    const strengths = parseStrengthTokens(member.strengths)
    const topThemes = strengths.slice(0, 2).map(titleCase).join(", ")
    const dominantLane = getDominantLane(strengths)
    let score = 35 + pressureLevel * 6
    const reasons: string[] = []

    if (isLossScenario && containsAny(roleText, ["parent", "caregiver", "guardian", "partner", "spouse"])) {
      score += 18
      reasons.push("Role indicates frontline family support responsibilities during grief.")
    }
    if (isLossScenario && containsAny(roleText, ["child", "grandchild", "teen"])) {
      score += 16
      reasons.push("Role may need extra emotional scaffolding in bereavement scenarios.")
    }
    const roleTokens = roleText
      .split(/[^a-z0-9]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4)
    const roleMentioned = roleTokens.some((token) => reactionRows.some((row) => row.includes(token)))
    const nameMentioned = reactionRows.some((row) => row.includes(member.name.toLowerCase()))
    const memberReactionText = reactionRows.filter((row) => row.includes(member.name.toLowerCase()) || roleTokens.some((token) => row.includes(token))).join(" ")
    const stressSignals = ["pressure", "strain", "overload", "burnout", "escalat", "conflict", "reactive", "friction", "tension", "blocked"]
    const memberShowsStressSignal = containsAny(memberReactionText, stressSignals)
    if (nameMentioned) {
      score += memberShowsStressSignal ? 10 : 4
      if (memberShowsStressSignal) {
        reasons.push("Current role reactions indicate this member may carry elevated response load.")
      }
    } else if (roleMentioned) {
      score += 6
      reasons.push("Role-level reaction patterns suggest this member may carry part of the response load.")
    }
    if (strengths.some((token) => ["empathy", "responsibility", "harmony", "relator"].includes(token)) && pressureLevel >= 4) {
      score += 10
      reasons.push("High-relational strengths can absorb emotional strain under pressure.")
    }
    if (strengths.some((token) => ["achiever", "focus", "discipline", "arranger"].includes(token)) && pressureLevel >= 4) {
      score += 8
      reasons.push("Execution strengths may over-function when urgency spikes.")
    }
    if (isConflictScenario && strengths.some((token) => ["command", "communication", "competition", "self-assurance"].includes(token))) {
      score += 6
      reasons.push("Influence-heavy profile may face additional friction in conflict-heavy context.")
    }

    const clampedScore = Math.max(10, Math.min(100, score))
    const level: "high" | "medium" | "low" = clampedScore >= 75 ? "high" : clampedScore >= 55 ? "medium" : "low"
    const memberSummary = summarizeMemberGallup(member.strengths)
    const memberSeed = hashText(`${member.id}|${scenarioTitle}|${member.strengths}`)
    const topStrength = strengths[0] ? titleCase(strengths[0]) : "Top strengths"

    const laneMovesByLevel = {
      high: {
        execution: [
          "Give this member one clear owner decision and remove non-critical tasks for 48 hours.",
          "Set a strict 48-hour priority cap and shield this member from low-value interruptions.",
        ],
        relationship: [
          "Schedule a direct emotional check-in and pair them with a trusted partner for near-term support.",
          "Use a short support huddle and assign one trusted ally to keep emotional load visible.",
        ],
        influence: [
          "Use a short alignment call so they can channel influence into calm direction-setting.",
          "Ask them to lead one clear message stream while another person owns delivery detail.",
        ],
        strategy: [
          "Give a concise planning sync and reduce ambiguity around immediate next steps.",
          "Use a 15-minute planning lane and lock one decision window to prevent re-looping.",
        ],
        balanced: [
          "Set one owner and one support partner so this member has both clarity and backup.",
          "Use short daily check-ins and keep priorities capped to one core deliverable.",
        ],
      },
      medium: {
        execution: [
          "Use a short daily pulse check and clarify one priority boundary.",
          `Anchor this member on one measurable output tied to ${topStrength} this week.`,
        ],
        relationship: [
          "Use a brief daily pulse and confirm where they need emotional backup.",
          "Keep trust visible with quick check-ins and explicit permission to ask for help.",
        ],
        influence: [
          "Use a quick alignment check so communication stays clear and non-reactive.",
          "Assign one communication owner path so influence energy stays constructive.",
        ],
        strategy: [
          "Confirm one planning checkpoint so analysis supports execution pace.",
          "Give context early and ask for one clear recommendation before broader debate.",
        ],
        balanced: [
          "Use a short daily pulse and keep role boundaries explicit for this scenario.",
          "Confirm one owner lane and one support lane to avoid hidden overload.",
        ],
      },
      low: {
        execution: [
          "Keep this member informed and include them in the weekly follow-up pulse.",
          "Use this member as a stabilizer for execution rhythm and quick task handoffs.",
        ],
        relationship: [
          "Invite this member into weekly follow-up pulse and peer-support moments.",
          "Keep this member connected to group check-ins so trust remains strong.",
        ],
        influence: [
          "Use this member to reinforce shared messaging in the weekly follow-up pulse.",
          "Invite this member to help close meetings with clear recap language.",
        ],
        strategy: [
          "Share context early and invite them into reflection in the weekly follow-up pulse.",
          "Use this member as a thought partner for next-step planning before major pivots.",
        ],
        balanced: [
          "Keep this member informed and include them in the weekly follow-up pulse.",
          "Use this member as a continuity anchor across weekly scenario follow-ups.",
        ],
      },
    } as const

    const laneMoves = laneMovesByLevel[level][dominantLane]
    const supportMove = laneMoves[memberSeed % laneMoves.length]

    const reasonsText = reasons.slice(0, 2).join(" ")
    const roleSummary = member.role ? `${member.role}: ` : ""
    const strengthsSummary = topThemes ? `Top strengths: ${topThemes}.` : ""
    const laneSummary = dominantLane !== "balanced" ? `Likely style leans ${dominantLane}.` : ""
    const openerByLevel = {
      high: [
        `${member.name} is likely to feel concentrated load early in this scenario.`,
        `${member.name} may become a pressure point without explicit support boundaries.`,
      ],
      medium: [
        `${member.name} should be monitored as a steady contributor with moderate load risk.`,
        `${member.name} is likely to stay effective if role boundaries remain clear.`,
      ],
      low: [
        `${member.name} looks positioned to remain stable in this scenario.`,
        `${member.name} can likely act as a support anchor for others right now.`,
      ],
    } as const
    const opener = openerByLevel[level][memberSeed % openerByLevel[level].length]
    const fallbackReason =
      dominantLane === "relationship"
        ? "Relational strengths may absorb extra emotional signals as pressure rises."
        : dominantLane === "execution"
          ? "Execution strengths may pull this member toward over-functioning under urgency."
          : dominantLane === "strategy"
            ? "Strategic strengths may increase cognitive load when ambiguity is high."
            : dominantLane === "influence"
              ? "Influence strengths may draw this member into high-friction decision moments."
              : "Balanced strengths suggest this member can remain stable with clear role boundaries."

    return {
      memberId: member.id,
      memberName: member.name,
      role: member.role,
      score: clampedScore,
      level,
      rationale: `${roleSummary}${opener} ${reasonsText || fallbackReason} ${strengthsSummary} ${laneSummary} ${memberSummary}`.replace(/\s+/g, " ").trim(),
      supportMove,
    }
  })

  return priorities.sort((a, b) => b.score - a.score).slice(0, 5)
}

function normalizeChecklist(value: unknown, fallbackActions: string[]) {
  if (!Array.isArray(value)) return buildActionChecklist(fallbackActions)
  const cleaned = value
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const label = typeof row.label === "string" ? row.label.trim() : ""
      if (!label) return null
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id : `task-${index + 1}`,
        label,
        done: Boolean(row.done),
        owner: typeof row.owner === "string" ? row.owner.trim() : "",
        dueDate: typeof row.dueDate === "string" ? row.dueDate.trim() : "",
      }
    })
    .filter(Boolean) as ActionChecklistItem[]
  return cleaned.length > 0 ? cleaned : buildActionChecklist(fallbackActions)
}

function normalizeRunResult(run: RunResult): RunResult {
  const actions = Array.isArray(run.actions) ? run.actions : []
  return {
    ...run,
    isFavorite: Boolean(run.isFavorite),
    notes: typeof run.notes === "string" ? run.notes : "",
    reviewed: Boolean(run.reviewed),
    actionChecklist: normalizeChecklist(run.actionChecklist, actions),
    memberSupportPriorities: Array.isArray(run.memberSupportPriorities) ? run.memberSupportPriorities : [],
  }
}

function levelToneClass(level: "high" | "medium" | "low") {
  if (level === "high") return "border-rose-200 bg-rose-50 text-rose-900"
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-emerald-200 bg-emerald-50 text-emerald-900"
}

function buildPriorityLane(run: RunResult | null): PriorityItem[] {
  if (!run) return []

  const items: PriorityItem[] = []
  const topRisk = run.risks[0]
  const topReaction = run.roleReactions[0]
  const unfinished = run.actionChecklist.filter((item) => !item.done)

  if (topReaction) {
    items.push({
      title: `Support ${topReaction.audience} first`,
      detail: topReaction.supportAction,
      level: "high",
    })
  }

  if (topRisk) {
    items.push({
      title: "Address the top risk hotspot",
      detail: topRisk,
      level: "medium",
    })
  }

  if (unfinished.length > 0) {
    items.push({
      title: "Complete the next action task",
      detail: unfinished[0].label,
      level: "medium",
    })
  }

  if (items.length === 0) {
    items.push({
      title: "Maintain momentum",
      detail: "All current actions are complete. Run a 7-day pulse follow-up.",
      level: "low",
    })
  }

  return items.slice(0, 3)
}

function buildFacilitationScript(run: RunResult | null): FacilitationScript {
  if (!run) {
    return {
      opening: [],
      prompts: [],
      close: [],
    }
  }

  return {
    opening: [
      `Today we are reviewing "${run.scenarioTitle}" with a focus on support, clarity, and shared accountability.`,
      `Our aim is practical: reduce friction and improve how we respond together under pressure.`,
    ],
    prompts: [
      "What response pattern helped us most in this scenario?",
      "Where did tension increase, and what support move would reduce it next time?",
      "Which one action should each person own in the next 7 days?",
    ],
    close: [
      "Confirm owners for the top 2 actions and write them down before ending.",
      "Book a 24-hour pulse check and a 7-day pulse review while everyone is present.",
    ],
  }
}

function applyConversationTone(message: string, tone: ConversationTone) {
  const text = message.trim()
  if (!text) return ""
  if (tone === "warm") {
    return `I care about our relationship and want to communicate this with empathy:\n\n${text}`
  }
  if (tone === "de-escalate") {
    return `I want to lower tension and find common ground. Here is what I am trying to say:\n\n${text}`
  }
  return text
}

function buildSlackUpdate(run: RunResult, groupName: string) {
  const topRisk = run.risks[0] || "No major risk flagged"
  const topAction = run.actions[0] || "No action listed"
  const topPriority = run.memberSupportPriorities[0]
  const supportLine = topPriority
    ? `${topPriority.memberName} (${topPriority.level}, score ${topPriority.score}) - ${topPriority.supportMove}`
    : "No member support priority generated yet"

  return [
    `*TeamSync Update* - ${groupName || "Group"}`,
    `Scenario: *${run.scenarioTitle}* (${run.scenarioCategory}, pressure ${run.pressureLevel}/5)`,
    `Summary: ${run.groupSummary}`,
    `Top risk: ${topRisk}`,
    `Top action: ${topAction}`,
    `Support first: ${supportLine}`,
  ].join("\n")
}

function buildEmailBrief(run: RunResult, groupName: string) {
  const actions = run.actions.slice(0, 3).map((action, index) => `${index + 1}. ${action}`).join("\n")
  const risks = run.risks.slice(0, 2).map((risk, index) => `${index + 1}. ${risk}`).join("\n")

  return [
    `Subject: TeamSync Brief - ${groupName || "Group"} - ${run.scenarioTitle}`,
    "",
    `Scenario: ${run.scenarioTitle}`,
    `Category: ${run.scenarioCategory}`,
    `Pressure: ${run.pressureLevel}/5`,
    "",
    `Summary:`,
    run.groupSummary || "No summary available.",
    "",
    `Top Risks:`,
    risks || "No risks listed.",
    "",
    `Top Actions:`,
    actions || "No actions listed.",
    "",
    `Semantic Lens:`,
    run.semanticLens || "No additional lens provided.",
  ].join("\n")
}

function buildMeetingAgenda(run: RunResult) {
  const firstAction = run.actions[0] || "Confirm immediate next step"
  const secondAction = run.actions[1] || "Assign ownership and due date"
  return [
    `Meeting Agenda - ${run.scenarioTitle}`,
    `1) 2-minute scenario recap`,
    `2) Confirm top risk: ${run.risks[0] || "No top risk identified"}`,
    `3) Decide action owner for: ${firstAction}`,
    `4) Confirm follow-up for: ${secondAction}`,
    `5) Support check for highest-priority member`,
    `6) Agree 24h pulse + 7-day review`,
  ].join("\n")
}

function formatIcsDate(date: Date) {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  const hh = String(date.getUTCHours()).padStart(2, "0")
  const min = String(date.getUTCMinutes()).padStart(2, "0")
  const sec = String(date.getUTCSeconds()).padStart(2, "0")
  return `${yyyy}${mm}${dd}T${hh}${min}${sec}Z`
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildRunComparison(currentRun: RunResult, previousRun: RunResult): RunComparison {
  const currentRisks = new Set(currentRun.risks.map((risk) => risk.trim().toLowerCase()).filter(Boolean))
  const previousRisks = new Set(previousRun.risks.map((risk) => risk.trim().toLowerCase()).filter(Boolean))
  const currentActions = new Set(currentRun.actions.map((action) => action.trim().toLowerCase()).filter(Boolean))
  const previousActions = new Set(previousRun.actions.map((action) => action.trim().toLowerCase()).filter(Boolean))

  const newlyAddedRisks = currentRun.risks.filter((risk) => !previousRisks.has(risk.trim().toLowerCase()))
  const resolvedRisks = previousRun.risks.filter((risk) => !currentRisks.has(risk.trim().toLowerCase()))
  const newActions = currentRun.actions.filter((action) => !previousActions.has(action.trim().toLowerCase()))
  const droppedActions = previousRun.actions.filter((action) => !currentActions.has(action.trim().toLowerCase()))

  return {
    pressureDelta: currentRun.pressureLevel - previousRun.pressureLevel,
    newlyAddedRisks,
    resolvedRisks,
    newActions,
    droppedActions,
  }
}

function buildRunHealth(run: RunResult) {
  const riskPenalty = Math.min(run.risks.length * 8, 32)
  const pressurePenalty = run.pressureLevel >= 4 ? 18 : run.pressureLevel >= 3 ? 10 : 4
  const checklist = run.actionChecklist.length
  const completed = run.actionChecklist.filter((item) => item.done).length
  const completionBoost = checklist > 0 ? Math.round((completed / checklist) * 24) : 0
  const supportPenalty = run.memberSupportPriorities.filter((item) => item.level === "high").length * 6
  const base = 78
  const score = Math.max(20, Math.min(96, base - riskPenalty - pressurePenalty - supportPenalty + completionBoost))
  const band: "strong" | "watch" | "at-risk" = score >= 72 ? "strong" : score >= 52 ? "watch" : "at-risk"
  const label = band === "strong" ? "Strong stability" : band === "watch" ? "Needs attention" : "At risk"
  const guidance =
    band === "strong"
      ? "Keep current rhythm and protect momentum with short pulse checks."
      : band === "watch"
        ? "Tighten ownership and run one support conversation this week."
        : "Run immediate support actions and reduce pressure before adding new work."

  return { score, band, label, guidance }
}

function buildNextBestActions(run: RunResult | null): NextBestAction[] {
  if (!run) return []

  const items: NextBestAction[] = []
  const topSupport = run.memberSupportPriorities[0]
  const topUnfinished = run.actionChecklist.find((item) => !item.done)
  const highRiskCount = run.memberSupportPriorities.filter((item) => item.level === "high").length
  const completed = run.actionChecklist.filter((item) => item.done).length
  const checklistTotal = run.actionChecklist.length
  const completionRate = checklistTotal > 0 ? completed / checklistTotal : 0

  if (topSupport) {
    items.push({
      title: `Support ${topSupport.memberName} first`,
      detail: topSupport.supportMove,
      tone: topSupport.level === "high" ? "high" : "medium",
      action: "open_support",
    })
  }

  if (topUnfinished) {
    items.push({
      title: `Complete next action: ${topUnfinished.label}`,
      detail: topUnfinished.owner
        ? `Owner set to ${topUnfinished.owner}. Confirm due date and close the loop.`
        : "Assign an owner and due date so this action does not stall.",
      tone: topUnfinished.owner ? "medium" : "high",
      action: "open_checklist",
    })
  }

  if (highRiskCount > 0 || run.pressureLevel >= 4) {
    items.push({
      title: "Run a 24-hour pulse check",
      detail: "Use the pulse to confirm emotional load, ownership clarity, and blockers.",
      tone: "high",
      action: "schedule_pulse",
    })
  } else if (completionRate < 0.6) {
    items.push({
      title: "Tighten follow-through",
      detail: "Close at least one open checklist item in the next 24 hours to build momentum.",
      tone: "medium",
      action: "open_checklist",
    })
  } else {
    items.push({
      title: "Protect current momentum",
      detail: "Keep weekly follow-up cadence and avoid adding new priorities until current items are closed.",
      tone: "low",
      action: "none",
    })
  }

  return items.slice(0, 3)
}

function buildTeamsUpdate(run: RunResult, groupName: string) {
  const topRisk = run.risks[0] || "No major risk flagged"
  const topAction = run.actions[0] || "No action listed"
  return [
    `TeamSync update - ${groupName || "Group"}`,
    `Scenario: ${run.scenarioTitle} (${run.scenarioCategory}, pressure ${run.pressureLevel}/5)`,
    `Summary: ${run.groupSummary || "No summary provided."}`,
    `Top risk: ${topRisk}`,
    `Top action: ${topAction}`,
  ].join("\n")
}

function buildSignalMapRows(run: RunResult) {
  return run.memberSupportPriorities.slice(0, 5).map((item, index) => ({
    rank: index + 1,
    member: item.memberName,
    role: item.role || "Role not set",
    level: item.level.toUpperCase(),
    score: item.score,
    signal: item.rationale,
    move: item.supportMove,
  }))
}

function deriveRiskStrip(run: RunResult) {
  const riskText = `${run.risks.join(" ")} ${run.groupSummary} ${run.semanticLens}`.toLowerCase()
  const doneCount = run.actionChecklist.filter((item) => item.done).length
  const totalChecklist = Math.max(run.actionChecklist.length, 1)
  const completionRate = doneCount / totalChecklist
  const frictionKeywords = ["conflict", "friction", "tension", "misunderstanding", "breakdown", "trust"]
  const pressureStatus = run.pressureLevel >= 4 ? "red" : run.pressureLevel === 3 ? "amber" : "green"
  const trustStatus = containsAny(riskText, frictionKeywords) ? "amber" : "green"
  const executionStatus = completionRate < 0.4 ? "red" : completionRate < 0.7 ? "amber" : "green"
  const alignmentStatus =
    run.roleReactions.length >= 3 && run.risks.length <= 2
      ? "green"
      : run.risks.length >= 4
        ? "red"
        : "amber"

  return [
    {
      key: "pressure",
      label: "Pressure",
      status: pressureStatus,
      detail: `Pressure ${run.pressureLevel}/5`,
    },
    {
      key: "alignment",
      label: "Alignment",
      status: alignmentStatus,
      detail: `${run.roleReactions.length} role reactions modeled`,
    },
    {
      key: "trust",
      label: "Trust climate",
      status: trustStatus,
      detail: run.risks[0] ? truncateWords(run.risks[0], 8) : "No immediate trust risk detected",
    },
    {
      key: "execution",
      label: "Execution rhythm",
      status: executionStatus,
      detail: `${Math.round(completionRate * 100)}% checklist progress`,
    },
  ] as const
}

function deriveActionTimeline(run: RunResult) {
  const buckets = {
    "Next 24 hours": [] as string[],
    "Next 7 days": [] as string[],
    "Next 30 days": [] as string[],
  }
  const pending = run.actionChecklist.filter((item) => !item.done)

  if (pending.length > 0) {
    pending.forEach((item, index) => {
      const label = `${item.label}${item.owner ? ` (Owner: ${item.owner})` : ""}`
      if (item.dueDate) {
        const parsed = new Date(item.dueDate)
        if (!Number.isNaN(parsed.getTime())) {
          const now = Date.now()
          const deltaDays = (parsed.getTime() - now) / (1000 * 60 * 60 * 24)
          if (deltaDays <= 1) {
            buckets["Next 24 hours"].push(label)
            return
          }
          if (deltaDays <= 7) {
            buckets["Next 7 days"].push(label)
            return
          }
        }
      }
      if (index < 2) buckets["Next 24 hours"].push(label)
      else if (index < 5) buckets["Next 7 days"].push(label)
      else buckets["Next 30 days"].push(label)
    })
  } else {
    const actions = run.actions.length > 0 ? run.actions : ["Maintain weekly pulse and monitor risk signals."]
    actions.slice(0, 6).forEach((item, index) => {
      if (index < 2) buckets["Next 24 hours"].push(item)
      else if (index < 4) buckets["Next 7 days"].push(item)
      else buckets["Next 30 days"].push(item)
    })
  }

  return [
    { horizon: "Next 24 hours", items: buckets["Next 24 hours"] },
    { horizon: "Next 7 days", items: buckets["Next 7 days"] },
    { horizon: "Next 30 days", items: buckets["Next 30 days"] },
  ]
}

function buildSignalMapSvgMarkup(run: RunResult) {
  const rows = buildSignalMapRows(run)
  const slots = [
    { x: 134, y: 66 },
    { x: 626, y: 66 },
    { x: 626, y: 258 },
    { x: 134, y: 258 },
    { x: 380, y: 294 },
  ]
  const esc = (value: string) => escapeHtml(value)
  const scenarioLines = wrapTextForCard(run.scenarioTitle, 24, 2)

  const nodes = rows
    .map((row, index) => {
      const slot = slots[index] ?? slots[0]
      const normalizedLevel = row.level === "HIGH" ? "high" : row.level === "MEDIUM" ? "medium" : "low"
      const tone = toneForLevel(normalizedLevel, row.score)
      const moveLines = wrapTextForCard(row.move, 28, 2)
      const moveTspans = moveLines
        .map((line, lineIndex) => `<tspan x="${slot.x - 100}" dy="${lineIndex === 0 ? "0" : "12"}">${esc(line)}</tspan>`)
        .join("")
      return `
      <g>
        <line x1="380" y1="176" x2="${slot.x}" y2="${slot.y - 2}" stroke="${tone.stroke}" stroke-opacity="${tone.edgeOpacity}" stroke-width="${tone.edgeWidth}" ${tone.edgeDash ? `stroke-dasharray="${tone.edgeDash}"` : ""}/>
        <rect x="${slot.x - 112}" y="${slot.y - 44}" width="224" height="88" rx="14" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="1.7" filter="url(#signalCardShadowReport)" />
        <text x="${slot.x - 100}" y="${slot.y - 20}" font-size="11" font-weight="700" fill="#0f172a">${esc(truncateWords(row.member, 3))}</text>
        <text x="${slot.x - 100}" y="${slot.y - 4}" font-size="10" fill="${tone.text}">${row.level} | ${row.score}/100</text>
        <text x="${slot.x - 100}" y="${slot.y + 14}" font-size="10" fill="#334155">${moveTspans}</text>
      </g>`
    })
    .join("")

  return `
  <svg viewBox="0 0 760 344" role="img" aria-label="Team signal map" style="width:100%;border:1px solid #dbe7f5;border-radius:12px;background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%);">
    <defs>
      <linearGradient id="signalCenterReport" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dbeafe" />
        <stop offset="100%" stop-color="#e0e7ff" />
      </linearGradient>
      <filter id="signalCardShadowReport" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#0f172a" flood-opacity="0.14" />
      </filter>
    </defs>
    <circle cx="380" cy="176" r="76" fill="url(#signalCenterReport)" stroke="#93c5fd" stroke-width="2.2" filter="url(#signalCardShadowReport)" />
    <text x="380" y="158" text-anchor="middle" font-size="11" font-weight="700" fill="#1e3a8a">SCENARIO</text>
    <text x="380" y="174" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">
      <tspan x="380" dy="0">${esc(scenarioLines[0] || "")}</tspan>
      ${scenarioLines[1] ? `<tspan x="380" dy="13">${esc(scenarioLines[1])}</tspan>` : ""}
    </text>
    <text x="380" y="203" text-anchor="middle" font-size="10" fill="#334155">Pressure ${run.pressureLevel}/5</text>
    ${nodes}
  </svg>`
}

function normalizeScenarioTemplate(raw: Partial<ScenarioTemplate> | null | undefined): ScenarioTemplate | null {
  if (!raw || typeof raw !== "object") return null
  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  if (!title) return null
  const category =
    raw.category === "Professional" ||
    raw.category === "Family" ||
    raw.category === "Learning" ||
    raw.category === "Executive" ||
    raw.category === "Boardroom"
      ? raw.category
      : "Professional"
  const focus = typeof raw.focus === "string" && raw.focus.trim() ? raw.focus.trim() : "Saved TeamSync scenario"
  const promptText = typeof raw.promptText === "string" ? raw.promptText.trim() : ""
  const visibility = raw.visibility === "shared" ? "shared" : "private"
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : uid("custom-scenario"),
    category,
    title,
    focus,
    promptText,
    visibility,
    ownerUserId: typeof raw.ownerUserId === "string" ? raw.ownerUserId : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  }
}

function buildTeamSyncReportMarkdown(
  run: RunResult,
  groupName: string,
  members: TeamMember[],
  resources: ResourceLink[],
  examples: ScenarioExample[]
) {
  const riskStrip = deriveRiskStrip(run)
  const actionTimeline = deriveActionTimeline(run)
  const signalMapRows = buildSignalMapRows(run)
  const supportRows = run.memberSupportPriorities
    .slice(0, 5)
    .map(
      (item, index) =>
        `${index + 1}. ${item.memberName} (${item.role || "Role not set"}) - ${item.level.toUpperCase()} ${item.score}/100\n   - Rationale: ${item.rationale}\n   - Support move: ${item.supportMove}`
    )
    .join("\n")
  const signalMapSummaryRows = signalMapRows
    .map(
      (item) =>
        `${item.rank}. ${item.member} (${item.role}) - ${item.level} ${item.score}/100\n   - Signal: ${item.signal}\n   - Priority move: ${item.move}`
    )
    .join("\n")
  const riskStripRows = riskStrip.map((item, index) => `${index + 1}. ${item.label}: ${item.status.toUpperCase()} - ${item.detail}`).join("\n")
  const actionTimelineRows = actionTimeline
    .map((bucket) => [`### ${bucket.horizon}`, ...(bucket.items.length > 0 ? bucket.items.map((item, index) => `${index + 1}. ${item}`) : ["No actions queued."]), ""].join("\n"))
    .join("\n")

  const checklistRows = run.actionChecklist
    .map((item, index) => `${index + 1}. [${item.done ? "x" : " "}] ${item.label}${item.owner ? ` (Owner: ${item.owner})` : ""}${item.dueDate ? ` (Due: ${item.dueDate})` : ""}`)
    .join("\n")
  const memberRows = members
    .map((member, index) => `${index + 1}. ${member.name} (${member.role || "Role not set"})\n   - Strengths: ${member.strengths}\n   - Summary: ${summarizeMemberGallup(member.strengths)}`)
    .join("\n")
  const roleReactionRows = run.roleReactions
    .map((item, index) => `${index + 1}. ${item.audience}\n   - Likely response: ${item.likelyResponse}\n   - Support action: ${item.supportAction}`)
    .join("\n")
  const resourceRows = resources
    .map((item, index) => `${index + 1}. ${item.title}\n   - URL: ${item.href}\n   - Why it helps: ${item.reason}`)
    .join("\n")
  const exampleRows = examples
    .map((item, index) => `${index + 1}. ${item.title}\n   - URL: ${item.href}\n   - Similar case note: ${item.note}`)
    .join("\n")

  return [
    `# TeamSync Run Report`,
    ``,
    `## Group`,
    `${groupName || "Group"}`,
    ``,
    `## Scenario`,
    `${run.scenarioTitle} (${run.scenarioCategory})`,
    `Pressure: ${run.pressureLevel}/5`,
    ...(run.companyUrl ? [`Company context URL: ${run.companyUrl}`] : []),
    ...(run.companyContextInfluence ? [`Company context influence: ${run.companyContextInfluence.toUpperCase()}`] : []),
    ``,
    `## Company Context`,
    `${run.companyContextSummary || "Not enabled for this run."}`,
    ``,
    `## Summary`,
    `${run.groupSummary || "No summary provided."}`,
    ``,
    `## Semantic Lens`,
    `${run.semanticLens || "No semantic lens provided."}`,
    ``,
    `## Group Members`,
    memberRows || "No members loaded.",
    ``,
    `## Role-by-role Reactions`,
    roleReactionRows || "No role reactions listed.",
    ``,
    `## Top Risks`,
    ...(run.risks.length > 0 ? run.risks.map((risk, index) => `${index + 1}. ${risk}`) : ["No major risks listed."]),
    ``,
    `## Recommended Actions`,
    ...(run.actions.length > 0 ? run.actions.map((action, index) => `${index + 1}. ${action}`) : ["No actions listed."]),
    ``,
    `## Support Priorities`,
    supportRows || "No member support priorities generated.",
    ``,
    `## Team Signal Map (Visual Summary)`,
    signalMapSummaryRows || "No team signal map available yet.",
    ``,
    `## Executive Signal Strip`,
    riskStripRows || "No signal strip available.",
    ``,
    `## Action Timeline`,
    actionTimelineRows || "No action timeline available.",
    ``,
    `## Action Checklist`,
    checklistRows || "No checklist generated.",
    ``,
    `## Useful Support Links`,
    resourceRows || "No links available.",
    ``,
    `## Comparable Scenario Examples`,
    exampleRows || "No examples available.",
  ].join("\n")
}

function buildFilteredRunsMarkdown(
  runs: RunResult[],
  groupName: string,
  members: TeamMember[],
  resources: ResourceLink[],
  examples: ScenarioExample[]
) {
  const memberRows = members
    .map((member, index) => `${index + 1}. ${member.name} (${member.role || "Role not set"}) - ${summarizeMemberGallup(member.strengths)}`)
    .join("\n")
  const resourceRows = resources.map((item, index) => `${index + 1}. ${item.title} - ${item.href}\n   - ${item.reason}`).join("\n")
  const exampleRows = examples.map((item, index) => `${index + 1}. ${item.title} - ${item.href}\n   - ${item.note}`).join("\n")
  const runRows = runs
    .map((run, index) => {
      const topPriority = run.memberSupportPriorities[0]
      return [
        `### ${index + 1}. ${run.scenarioTitle}`,
        `Category: ${run.scenarioCategory} | Pressure: ${run.pressureLevel}/5 | ${relativeTime(run.timestamp)}`,
        `Summary: ${run.groupSummary || "No summary provided."}`,
        `Top risk: ${run.risks[0] || "No major risk listed."}`,
        `Top action: ${run.actions[0] || "No action listed."}`,
        topPriority ? `Priority support: ${topPriority.memberName} - ${topPriority.supportMove}` : "Priority support: Not available",
        "",
      ].join("\n")
    })
    .join("\n")

  return [
    "# TeamSync Saved Runs Report",
    "",
    `Group: ${groupName || "Group"}`,
    `Exported runs: ${runs.length}`,
    "",
    "## Group Members",
    memberRows || "No members loaded.",
    "",
    "## Saved Runs",
    runRows || "No runs selected.",
    "",
    "## Useful Support Links",
    resourceRows || "No links available.",
    "",
    "## Comparable Scenario Examples",
    exampleRows || "No examples available.",
  ].join("\n")
}

function parseInlineBold(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  if (parts.length === 0) return [new TextRun(line)]
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return new TextRun({ text: part.slice(2, -2), bold: true })
    }
    return new TextRun(part)
  })
}

function buildDocxParagraphs(documentTitle: string, rawContent: string) {
  const lines = rawContent.replace(/\r\n/g, "\n").split("\n")
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 260 },
      children: [new TextRun({ text: documentTitle, bold: true })],
    }),
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }))
      continue
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = (trimmed.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3
      const headingText = trimmed.replace(/^#{1,3}\s+/, "")
      paragraphs.push(
        new Paragraph({
          heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: headingText, bold: true })],
        })
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 110 },
          children: parseInlineBold(trimmed),
        })
      )
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: parseInlineBold(trimmed.replace(/^[-*]\s+/, "")),
        })
      )
      continue
    }

    paragraphs.push(
      new Paragraph({
        spacing: { after: 110 },
        children: parseInlineBold(trimmed),
      })
    )
  }

  return paragraphs
}

function buildFileName(value: string, extension: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${safe || "teamsync-report"}.${extension}`
}

function downloadBlob(fileName: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string | number | boolean) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function mergeRunsById(runs: RunResult[]) {
  const byId = new Map<string, RunResult>()
  runs.map(normalizeRunResult).forEach((run) => {
    if (!run.runId) return
    byId.set(run.runId, run)
  })
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 200)
}

function frictionBand(score: number): "high" | "medium" | "low" {
  if (score <= 35) return "high"
  if (score <= 60) return "medium"
  return "low"
}

function buildRelationalHeatmap(members: TeamMember[]): PairInsight[] {
  const pairs: PairInsight[] = []
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i]
      const b = members[j]
      const aTokens = new Set(parseStrengthTokens(a.strengths))
      const bTokens = new Set(parseStrengthTokens(b.strengths))
      const overlap = Array.from(aTokens).filter((token) => bTokens.has(token))

      const aRel = Array.from(aTokens).filter((token) => relationshipSet.has(token)).length
      const bRel = Array.from(bTokens).filter((token) => relationshipSet.has(token)).length
      const aInf = Array.from(aTokens).filter((token) => influenceSet.has(token)).length
      const bInf = Array.from(bTokens).filter((token) => influenceSet.has(token)).length
      const aExec = Array.from(aTokens).filter((token) => executorSet.has(token)).length
      const bExec = Array.from(bTokens).filter((token) => executorSet.has(token)).length
      const aStrat = Array.from(aTokens).filter((token) => strategySet.has(token)).length
      const bStrat = Array.from(bTokens).filter((token) => strategySet.has(token)).length

      let synergy = 45
      synergy += Math.min(overlap.length * 8, 24)
      if (aExec > 0 && bStrat > 0) synergy += 8
      if (bExec > 0 && aStrat > 0) synergy += 8
      if (aRel > 0 || bRel > 0) synergy += 6
      if (Math.abs(aInf - bInf) >= 3 && aRel + bRel === 0) synergy -= 10
      if (overlap.length === 0 && (aExec + bExec > 3 || aInf + bInf > 3)) synergy -= 8
      synergy = Math.max(10, Math.min(95, synergy))

      const band = frictionBand(synergy)
      const overlapLabel = overlap.slice(0, 2).map(titleCase).join(", ")
      const summary =
        overlap.length > 0
          ? `${a.name} and ${b.name} share ${overlapLabel}, which can help them build trust quickly when pressure rises.`
          : `${a.name} and ${b.name} bring different strengths, so they work best with explicit check-ins before decisions.`
      const coachingMove =
        band === "high"
          ? "Run a simple turn-taking script: person A summarizes person B first, then gives their own view in one sentence."
          : band === "medium"
            ? "Use a short decision cadence: options, decision, owner, next check-in."
            : "Use this pair to co-lead key conversations, then let them align the rest of the group."

      pairs.push({
        id: `${a.id}-${b.id}`,
        aName: a.name,
        bName: b.name,
        synergyScore: synergy,
        frictionRisk: band,
        summary,
        coachingMove,
      })
    }
  }

  return pairs.sort((x, y) => y.synergyScore - x.synergyScore).slice(0, 8)
}

function ExpandableCard({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <details
      open={defaultOpen}
      onToggle={(event) => setIsOpen((event.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-neutral-200 bg-white p-3"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-[#64748b]">{subtitle}</div> : null}
          </div>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
            {isOpen ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

function buildScenarioResult(
  members: TeamMember[],
  scenario: ScenarioTemplate,
  customScenarioText: string,
  pressureLevel: number,
  desiredOutcome: string
): RunResult {
  const scores = scoreTeam(members)
  const summary = summarizeTeamBias(scores)
  const isHighPressure = pressureLevel >= 4
  const scenarioName = customScenarioText.trim() || scenario.title
  const totalSignals = scores.executor + scores.relationship + scores.strategy + scores.influence
  const hasEnoughData = totalSignals >= 8

  const likelyBehaviors: string[] = []
  const roleReactions: RoleReaction[] = []
  const risks: string[] = []
  const adjustments: string[] = []
  const actions: string[] = []
  let semanticLens = "Behavior likely follows each member's default strengths style under moderate pressure."

  if (scores.executor >= scores.relationship && scores.executor >= scores.strategy) {
    likelyBehaviors.push("Fast movement toward action and task ownership.")
  }
  if (scores.strategy >= scores.executor && scores.strategy >= scores.relationship) {
    likelyBehaviors.push("Strong pattern-recognition and options framing before decisions.")
  }
  if (scores.relationship >= scores.influence) {
    likelyBehaviors.push("High attention to trust, tone, and relationship continuity.")
  }
  if (scores.influence >= scores.relationship) {
    likelyBehaviors.push("Decisions may accelerate quickly through persuasive voices.")
  }

  if (isHighPressure && scores.relationship < scores.executor) {
    risks.push("Pressure may reduce listening quality and increase perceived bluntness.")
  }
  if (scores.strategy > scores.executor + 2) {
    risks.push("Over-analysis may delay commitment and handoff clarity.")
  }
  if (scores.influence > scores.relationship + 2) {
    risks.push("Dominant voices may overshadow quieter but critical contributors.")
  }
  if (!hasEnoughData) {
    risks.push("Limited strengths coverage: results are directional until more member data is loaded.")
  }

  adjustments.push("Set explicit role ownership: lead, coordinator, challenger, and finisher.")
  adjustments.push("Use a two-pass meeting rhythm: sense-making first, commitment second.")
  adjustments.push("Add a check-in rule under pressure: pause for one-minute alignment before major decisions.")

  if (scenario.category === "Family") {
    adjustments.push("Use strengths language during conflict to reduce personal attribution and blame.")
    semanticLens = "Family systems often amplify emotion first, then pattern-based coping behavior."
  }
  if (scenario.category === "Learning") {
    adjustments.push("Combine structure (study blocks) with autonomy (choice of method) to increase engagement.")
    semanticLens = "Learning scenarios usually surface differences in pace, reflection depth, and accountability style."
  }

  const lowercaseScenario = scenarioName.toLowerCase()
  const isLossScenario =
    lowercaseScenario.includes("died") ||
    lowercaseScenario.includes("death") ||
    lowercaseScenario.includes("bereav") ||
    lowercaseScenario.includes("funeral") ||
    lowercaseScenario.includes("grief") ||
    lowercaseScenario.includes("loss")

  if (isLossScenario) {
    semanticLens = "Grief tends to create different coping timelines across generations and roles."
    roleReactions.push(
      {
        audience: "Grandchildren",
        likelyResponse: "Can swing between visible sadness and normal play while processing loss in short bursts.",
        supportAction: "Use clear simple language, repeat key facts gently, and keep predictable routines.",
      },
      {
        audience: "Adult children",
        likelyResponse: "May over-function with logistics while suppressing emotion, especially with Responsibility or Achiever themes.",
        supportAction: "Split practical tasks explicitly and assign one trusted person to check emotional load daily.",
      },
      {
        audience: "Partner or primary caregiver",
        likelyResponse: "May experience exhaustion and decision fatigue after prolonged support periods.",
        supportAction: "Create a shared support rota and protect short recovery windows after major family events.",
      }
    )
  } else if (scenario.category === "Family") {
    roleReactions.push(
      {
        audience: "Parents or guardians",
        likelyResponse: "Often move quickly to fix the issue, which can unintentionally close space for emotions.",
        supportAction: "Hold a short feelings-first check-in before moving to solutions.",
      },
      {
        audience: "Children or teens",
        likelyResponse: "May react through behavior changes rather than direct language.",
        supportAction: "Offer two simple expression options (talk, write, or pause) and revisit later.",
      }
    )
  }

  actions.push(`Run a 20-minute scenario briefing for "${scenarioName}".`)
  actions.push("Assign one owner to capture decisions, risks, and next-step commitments.")
  actions.push(`Define the success signal for this run: ${desiredOutcome || "clear ownership, low-friction execution, and measurable progress"}.`)
  actions.push("Schedule a follow-up simulation in 7 days and compare deltas.")

  return {
    runId: uid("teamsync-run"),
    timestamp: new Date().toISOString(),
    reviewed: false,
    scenarioTitle: scenarioName,
    scenarioCategory: scenario.category,
    pressureLevel,
    groupSummary: summary,
    semanticLens,
    likelyBehaviors,
    roleReactions,
    risks,
    adjustments,
    actions,
    actionChecklist: buildActionChecklist(actions),
    memberSupportPriorities: buildMemberSupportPriorities(members, scenarioName, pressureLevel, risks, roleReactions),
  }
}

type AiSimulationResponse = {
  groupSummary: string
  semanticLens: string
  likelyBehaviors: string[]
  roleReactions: RoleReaction[]
  risks: string[]
  adjustments: string[]
  actions: string[]
  companyContextSummary?: string
}

function normalizeCompanyUrlInput(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    if (!/^https?:$/.test(parsed.protocol)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

function relativeTime(iso: string) {
  const ts = new Date(iso).getTime()
  const deltaMinutes = Math.floor((Date.now() - ts) / 60000)
  if (deltaMinutes < 1) return "just now"
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`
  const hours = Math.floor(deltaMinutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function extractGallupStrengths(text: string) {
  const ordered = extractOrderedGallupThemes(text)
  if (ordered.length > 0) {
    return ordered.map(titleCase)
  }
  const lowered = text.toLowerCase()
  const matches = gallupThemes.filter((theme) => lowered.includes(theme.toLowerCase()))
  return Array.from(new Set(matches)).slice(0, 10)
}

function guessMemberNameFromText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return ""
  const namedLine = trimmed.match(/(?:member\s*name|name)\s*[:\-]\s*([A-Za-z][A-Za-z\s'.-]{1,80})/i)
  if (namedLine?.[1]) return namedLine[1].trim()
  const reportFor = trimmed.match(/(?:report\s*for|cliftonstrengths\s*for)\s*[:\-]?\s*([A-Za-z][A-Za-z\s'.-]{1,80})/i)
  if (reportFor?.[1]) return reportFor[1].trim()
  return ""
}

function guessMemberNameFromFileName(fileName: string) {
  const base = fileName.replace(/\.[^/.]+$/, "")
  const cleaned = base
    .replace(/[_-]+/g, " ")
    .replace(/\b(clifton|strengths|gallup|report|profile|summary|top|themes|results|assessment|test)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return ""
  const parts = cleaned
    .split(" ")
    .filter(Boolean)
    .filter((part) => !/^\d+$/.test(part))
  if (parts.length === 0) return ""
  const picked = parts.slice(0, 3).join(" ")
  return picked.replace(/\b\w/g, (char) => char.toUpperCase())
}

function uniqueMemberName(base: string, existingMembers: TeamMember[]) {
  const trimmed = base.trim()
  if (!trimmed) return "New Member"
  const existing = new Set(existingMembers.map((member) => member.name.trim().toLowerCase()))
  if (!existing.has(trimmed.toLowerCase())) return trimmed
  let counter = 2
  while (existing.has(`${trimmed} (${counter})`.toLowerCase())) {
    counter += 1
  }
  return `${trimmed} (${counter})`
}

function buildResourceLinks(run: RunResult | null): ResourceLink[] {
  const baseResources: ResourceLink[] = [
    {
      id: "cdc-grief",
      title: "CDC: Grief and Loss",
      href: "https://www.cdc.gov/howrightnow/emotion/grief/index.html",
      reason: "Simple language support for families processing loss and major life events.",
    },
    {
      id: "apa-grief",
      title: "APA: Grief Resources",
      href: "https://www.apa.org/topics/grief",
      reason: "Evidence-based grief guidance that helps normalize different emotional responses.",
    },
    {
      id: "verywell-conflict",
      title: "Conflict Resolution Skills",
      href: "https://www.verywellmind.com/what-is-conflict-resolution-4177037",
      reason: "Practical conflict-resolution techniques for family and team conversations.",
    },
    {
      id: "mind-stress",
      title: "Mind: Stress Management",
      href: "https://www.mind.org.uk/information-support/types-of-mental-health-problems/stress/",
      reason: "Useful stress and pressure-management tactics for day-to-day coping.",
    },
    {
      id: "atlassian-retrospective",
      title: "Team Retrospective Guide",
      href: "https://www.atlassian.com/team-playbook/plays/retrospective",
      reason: "A lightweight structure to reflect, learn, and improve team behavior after scenarios.",
    },
    {
      id: "coursera-emotional-intelligence",
      title: "Emotional Intelligence Course Options",
      href: "https://www.coursera.org/courses?query=emotional%20intelligence",
      reason: "Learning options for communication, empathy, and leadership growth.",
    },
  ]

  if (!run) return baseResources.slice(0, 5)

  const text = `${run.scenarioTitle} ${run.scenarioCategory} ${run.semanticLens} ${run.risks.join(" ")}`.toLowerCase()
  const picks: ResourceLink[] = []

  const include = (id: string) => {
    const found = baseResources.find((item) => item.id === id)
    if (!found) return
    if (picks.some((item) => item.id === id)) return
    picks.push(found)
  }

  if (/(grief|loss|died|death|bereav|funeral)/.test(text)) {
    include("cdc-grief")
    include("apa-grief")
  }

  if (/(conflict|tension|repair|misunderstanding)/.test(text)) {
    include("verywell-conflict")
  }

  if (/(pressure|stress|high-stakes|burnout|fatigue)/.test(text)) {
    include("mind-stress")
  }

  if (/(team|project|execution|handoff|decision|group)/.test(text)) {
    include("atlassian-retrospective")
  }

  if (/(learning|skill|development|improve)/.test(text)) {
    include("coursera-emotional-intelligence")
  }

  if (picks.length < 5) {
    baseResources.forEach((item) => {
      if (picks.length >= 5) return
      if (!picks.some((existing) => existing.id === item.id)) {
        picks.push(item)
      }
    })
  }

  return picks.slice(0, 5)
}

function buildScenarioExamples(run: RunResult | null): ScenarioExample[] {
  const baseExamples: ScenarioExample[] = [
    {
      id: "google-project-aristotle",
      title: "Google Project Aristotle",
      href: "https://rework.withgoogle.com/print/guides/5721312655835136/",
      note: "Evidence-backed team effectiveness study highlighting psychological safety and role clarity.",
    },
    {
      id: "nasa-crew-resource-management",
      title: "NASA Crew Resource Management",
      href: "https://ntrs.nasa.gov/citations/19960007224",
      note: "High-stakes teamwork and communication patterns under pressure.",
    },
    {
      id: "pixar-braintrust",
      title: "Pixar Braintrust Collaboration Model",
      href: "https://hbr.org/2008/09/how-pixar-fosters-collective-creativity",
      note: "Structured candor model for handling creative friction and decision quality.",
    },
    {
      id: "mayo-clinic-teamwork",
      title: "Mayo Clinic Teamwork in Care",
      href: "https://www.mayoclinicproceedings.org/article/S0025-6196(11)64855-5/fulltext",
      note: "Multi-disciplinary role coordination and patient-centered communication.",
    },
  ]
  if (!run) return baseExamples.slice(0, 3)
  const text = `${run.scenarioTitle} ${run.scenarioCategory} ${run.semanticLens} ${run.risks.join(" ")}`.toLowerCase()
  const picks: ScenarioExample[] = []
  const include = (id: string) => {
    const found = baseExamples.find((item) => item.id === id)
    if (!found) return
    if (picks.some((item) => item.id === id)) return
    picks.push(found)
  }
  if (/(pressure|crisis|failure|incident|high-stakes)/.test(text)) include("nasa-crew-resource-management")
  if (/(team|trust|safety|conflict|communication)/.test(text)) include("google-project-aristotle")
  if (/(creative|board|executive|strategy|challenge)/.test(text)) include("pixar-braintrust")
  if (/(health|caregiver|family|support|role)/.test(text)) include("mayo-clinic-teamwork")
  for (const item of baseExamples) {
    if (picks.length >= 3) break
    if (!picks.some((existing) => existing.id === item.id)) picks.push(item)
  }
  return picks.slice(0, 3)
}

export function TeamSyncWorkspaceClient() {
  const membersRef = useRef<TeamMember[]>([])
  const runHistoryRef = useRef<RunResult[]>([])
  const customScenariosRef = useRef<ScenarioTemplate[]>([])
  const insightsPanelsRef = useRef<HTMLDivElement | null>(null)
  const memberUploadInputRef = useRef<HTMLInputElement | null>(null)
  const memberBulkUploadInputRef = useRef<HTMLInputElement | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [activeStep, setActiveStep] = useState("overview")
  const [isFocusMode, setIsFocusMode] = useState(true)
  const [isMenuRolledUp, setIsMenuRolledUp] = useState(true)
  const [isSimpleView, setIsSimpleView] = useState(true)
  const [groups, setGroups] = useState<WorkspaceGroupSummary[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [newGroupName, setNewGroupName] = useState("")
  const [groupName, setGroupName] = useState("My Team")
  const [memberName, setMemberName] = useState("")
  const [memberRole, setMemberRole] = useState("")
  const [memberStrengths, setMemberStrengths] = useState("")
  const [memberIntakePanel, setMemberIntakePanel] = useState<"name" | "strengths" | "review">("name")
  const [memberFileLoading, setMemberFileLoading] = useState(false)
  const [memberBulkLoading, setMemberBulkLoading] = useState(false)
  const [memberUploadNeedsAuth, setMemberUploadNeedsAuth] = useState(false)
  const [lastUploadedFileName, setLastUploadedFileName] = useState("")
  const [lastUploadSummary, setLastUploadSummary] = useState("")
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarioLibrary[0].id)
  const [selectedExecutivePromptId, setSelectedExecutivePromptId] = useState(executivePromptLibrary[0]?.id || "")
  const [executivePromptPack, setExecutivePromptPack] = useState("all")
  const [executivePromptSearch, setExecutivePromptSearch] = useState("")
  const [useCompanyContext, setUseCompanyContext] = useState(true)
  const [companyUrlInput, setCompanyUrlInput] = useState("")
  const [companyContextInfluence, setCompanyContextInfluence] = useState<"low" | "medium" | "high">("medium")
  const [customScenarioText, setCustomScenarioText] = useState("")
  const [customScenarios, setCustomScenarios] = useState<ScenarioTemplate[]>([])
  const [scenarioMode, setScenarioMode] = useState<"library" | "custom" | "executive">("library")
  const [customScenarioCategory, setCustomScenarioCategory] = useState<ScenarioTemplate["category"]>("Professional")
  const [customScenarioTitle, setCustomScenarioTitle] = useState("")
  const [customScenarioSearch, setCustomScenarioSearch] = useState("")
  const [selectedCustomScenarioId, setSelectedCustomScenarioId] = useState("")
  const [customScenarioVisibility, setCustomScenarioVisibility] = useState<"private" | "shared">("private")
  const [pressureLevel, setPressureLevel] = useState(3)
  const [desiredOutcome, setDesiredOutcome] = useState("")
  const [runHistory, setRunHistory] = useState<RunResult[]>([])
  const [latestRun, setLatestRun] = useState<RunResult | null>(null)
  const [onlineResources, setOnlineResources] = useState<ResourceLink[]>([])
  const [onlineExamples, setOnlineExamples] = useState<ScenarioExample[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesError, setResourcesError] = useState("")
  const [conversationFromMemberId, setConversationFromMemberId] = useState("self")
  const [conversationToMemberId, setConversationToMemberId] = useState("")
  const [conversationGoal, setConversationGoal] = useState("Maintain trust while being clear and direct.")
  const [conversationTone, setConversationTone] = useState<ConversationTone>("clear")
  const [conversationMessage, setConversationMessage] = useState("")
  const [conversationLoading, setConversationLoading] = useState(false)
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([])
  const [compareRunId, setCompareRunId] = useState("")
  const [historySearch, setHistorySearch] = useState("")
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("all")
  const [historySort, setHistorySort] = useState<"newest" | "oldest">("newest")
  const [historyFavoritesOnly, setHistoryFavoritesOnly] = useState(false)
  const [historyPressureFilter, setHistoryPressureFilter] = useState<"all" | "low" | "medium" | "high">("all")
  const [historyWithNotesOnly, setHistoryWithNotesOnly] = useState(false)
  const [historyNeedsReviewOnly, setHistoryNeedsReviewOnly] = useState(false)
  const [savedRunsExpanded, setSavedRunsExpanded] = useState(false)
  const [membersListExpanded, setMembersListExpanded] = useState(true)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editingMemberName, setEditingMemberName] = useState("")
  const [editingMemberRole, setEditingMemberRole] = useState("")
  const [scenarioAdvancedOpen, setScenarioAdvancedOpen] = useState(false)
  const [showAdvancedInsights, setShowAdvancedInsights] = useState(false)
  const [undoDeletedRuns, setUndoDeletedRuns] = useState<RunResult[]>([])
  const [message, setMessage] = useState("")
  const [savePulse, setSavePulse] = useState<{ id: number; label: string } | null>(null)
  const [showFloatingWizardCta, setShowFloatingWizardCta] = useState(true)
  const onboardingAutoStepRef = useRef("")
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem("teamsync-whats-new-hidden-v1") !== "1"
  })
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false)
  const [issueType, setIssueType] = useState("Workflow confusion")
  const [issueDetail, setIssueDetail] = useState("")
  const [issueContactEmail, setIssueContactEmail] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [sendingToSlack, setSendingToSlack] = useState(false)

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
    }

    void loadSession()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.email) return
    setIssueContactEmail((current) => current || session.user.email || "")
  }, [session?.user?.email])

  useEffect(() => {
    if (typeof window === "undefined") return

    // Defer localStorage hydration until after first paint to avoid SSR/client mismatch.
    const timer = window.setTimeout(() => {
      const localActiveGroupId = window.localStorage.getItem(LOCAL_ACTIVE_GROUP_ID_KEY)
      const localGroupName = window.localStorage.getItem(LOCAL_GROUP_NAME_KEY)
      const localMembers = window.localStorage.getItem(LOCAL_MEMBERS_KEY)
      const localRuns = window.localStorage.getItem(LOCAL_RUNS_KEY)
      const localCustomScenarios = window.localStorage.getItem(LOCAL_CUSTOM_SCENARIOS_KEY)
      const localSimpleView = window.localStorage.getItem(LOCAL_SIMPLE_VIEW_KEY)

      if (localActiveGroupId) {
        setSelectedGroupId(localActiveGroupId)
      }

      if (localGroupName) {
        setGroupName(localGroupName)
      }

      if (localMembers) {
        try {
          const parsedMembers = JSON.parse(localMembers) as TeamMember[]
          membersRef.current = parsedMembers
          setMembers(parsedMembers)
        } catch {}
      }

      if (localRuns) {
        try {
          const parsedRuns = (JSON.parse(localRuns) as RunResult[]).map(normalizeRunResult)
          runHistoryRef.current = parsedRuns
          setRunHistory(parsedRuns)
          setLatestRun(parsedRuns[0] ?? null)
        } catch {}
      }

      if (localCustomScenarios) {
        try {
          const parsedScenarios = (JSON.parse(localCustomScenarios) as ScenarioTemplate[])
            .map((item) => normalizeScenarioTemplate(item))
            .filter((item): item is ScenarioTemplate => Boolean(item))
            .slice(0, 40)
          customScenariosRef.current = parsedScenarios
          setCustomScenarios(parsedScenarios)
        } catch {}
      }

      if (localSimpleView === "false") {
        setIsSimpleView(false)
      } else if (localSimpleView === "true") {
        setIsSimpleView(true)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    async function loadWorkspaceFromCloud() {
      if (!session?.access_token || !session?.user?.id) return
      setSyncing(true)
      try {
        const query = selectedGroupId ? `?group_id=${encodeURIComponent(selectedGroupId)}` : ""
        const response = await fetch(`/api/teamsync/workspace${query}`, {
          headers: await getAuthHeaders(),
        })
        const payload = await response.json()

        if (!response.ok) {
          setMessage(payload.error || "Could not load TeamSync cloud workspace.")
          return
        }

        const remoteGroups = Array.isArray(payload.groups) ? (payload.groups as WorkspaceGroupSummary[]) : []
        const remoteMembers = Array.isArray(payload.members) ? (payload.members as TeamMember[]) : []
        const remoteRuns = Array.isArray(payload.runs) ? (payload.runs as RunResult[]).map(normalizeRunResult) : []
        const remoteGroupName = typeof payload.group_name === "string" ? payload.group_name.trim() : "My Team"
        const remoteActiveGroupId = typeof payload.active_group_id === "string" ? payload.active_group_id : ""
        const remoteCustomScenarios = Array.isArray(payload.custom_scenarios)
          ? payload.custom_scenarios
              .map((item: ScenarioTemplate) => normalizeScenarioTemplate(item))
              .filter((item: ScenarioTemplate | null): item is ScenarioTemplate => Boolean(item))
              .slice(0, 40)
          : []

        setGroups(remoteGroups)
        if (remoteActiveGroupId && remoteActiveGroupId !== selectedGroupId) {
          setSelectedGroupId(remoteActiveGroupId)
        }

        membersRef.current = remoteMembers
        runHistoryRef.current = remoteRuns
        customScenariosRef.current = remoteCustomScenarios
        setMembers(remoteMembers)
        setRunHistory(remoteRuns)
        setCustomScenarios(remoteCustomScenarios)
        setLatestRun(remoteRuns[0] || null)
        setGroupName(remoteGroupName || "My Team")
        setMessage("TeamSync workspace loaded from cloud.")
      } catch {
        setMessage("Unable to reach TeamSync cloud sync. Continuing with local data.")
      } finally {
        setSyncing(false)
      }
    }

    void loadWorkspaceFromCloud()
  }, [selectedGroupId, session?.access_token, session?.user?.id])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_ACTIVE_GROUP_ID_KEY, selectedGroupId)
      window.localStorage.setItem(LOCAL_GROUP_NAME_KEY, groupName)
      window.localStorage.setItem(LOCAL_SIMPLE_VIEW_KEY, isSimpleView ? "true" : "false")
    }
  }, [groupName, isSimpleView, selectedGroupId])

  useEffect(() => {
    if (!isSimpleView) return
    setIsFocusMode(true)
    setIsMenuRolledUp(true)
  }, [isSimpleView])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isSimpleView) return
    const targetStep =
      members.length < 2 ? "intake:#teamsync-intake" : latestRun ? "" : "scenario:#teamsync-scenario"
    if (!targetStep || onboardingAutoStepRef.current === targetStep) return
    onboardingAutoStepRef.current = targetStep
    const [stepKey, href] = targetStep.split(":")
    setActiveStep(stepKey)
    setIsMenuRolledUp(true)
    scrollToSelectorWithOffset(href)
  }, [isSimpleView, latestRun, members.length])

  useEffect(() => {
    if (typeof window === "undefined") return

    let lastY = window.scrollY
    const threshold = 12

    const handleScroll = () => {
      const currentY = window.scrollY
      const delta = currentY - lastY

      if (currentY < 80) {
        setShowFloatingWizardCta(true)
      } else if (delta > threshold) {
        setShowFloatingWizardCta(false)
      } else if (delta < -threshold) {
        setShowFloatingWizardCta(true)
      }

      lastY = currentY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!message || typeof window === "undefined") return
    if (/(could not|failed|error|unable|unauthorized|not configured)/i.test(message)) return
    if (!/(saved|created|added|uploaded|imported|updated|synced|shared|exported|loaded|queued|started|completed)/i.test(message)) return

    const label = /(saved|created|added|uploaded|imported|exported|shared)/i.test(message) ? "Saved just now" : "Updated just now"
    const pulseId = Date.now()
    setSavePulse({ id: pulseId, label })
    const timeout = window.setTimeout(() => {
      setSavePulse((current) => (current?.id === pulseId ? null : current))
    }, 2400)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(members))
    }
    membersRef.current = members
  }, [members])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(runHistory))
    }
    runHistoryRef.current = runHistory
  }, [runHistory])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_CUSTOM_SCENARIOS_KEY, JSON.stringify(customScenarios))
    }
    customScenariosRef.current = customScenarios
  }, [customScenarios])

  async function persistWorkspace(
    nextMembers: TeamMember[],
    nextRuns: RunResult[],
    nextGroupName: string,
    groupIdOverride?: string,
    nextCustomScenarios?: ScenarioTemplate[]
  ) {
    if (!session?.access_token) return

    setSyncing(true)
    try {
      const response = await fetch("/api/teamsync/workspace", {
        method: "PUT",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          group_id: groupIdOverride || selectedGroupId || undefined,
          group_name: nextGroupName,
          members: nextMembers,
          runs: nextRuns,
          custom_scenarios: (nextCustomScenarios ?? customScenariosRef.current).map((item) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            focus: item.focus,
            promptText: item.promptText || "",
            visibility: item.visibility === "shared" ? "shared" : "private",
          })),
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setMessage(payload.error || "Could not sync TeamSync workspace to cloud.")
      } else {
        const workspaceId = typeof payload.workspace_id === "string" ? payload.workspace_id : ""
        if (workspaceId && workspaceId !== selectedGroupId) {
          setSelectedGroupId(workspaceId)
        }
        if (workspaceId) {
          setGroups((prev) => {
            const next = [...prev]
            const existingIndex = next.findIndex((group) => group.id === workspaceId)
            const summary: WorkspaceGroupSummary = {
              id: workspaceId,
              group_name: nextGroupName || "My Team",
              updated_at: new Date().toISOString(),
            }
            if (existingIndex >= 0) {
              next[existingIndex] = summary
            } else {
              next.unshift(summary)
            }
            return next
          })
        }
      }
    } catch {
      setMessage("Cloud sync failed. Your local copy is still safe.")
    } finally {
      setSyncing(false)
    }
  }

  const allScenarios = useMemo(() => [...customScenarios, ...scenarioLibrary], [customScenarios])
  const filteredCustomScenarios = useMemo(() => {
    const query = customScenarioSearch.trim().toLowerCase()
    if (!query) return customScenarios
    return customScenarios.filter((item) => {
      const haystack = `${item.title} ${item.category} ${item.focus} ${item.promptText || ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [customScenarioSearch, customScenarios])
  const selectedScenario = useMemo(
    () => allScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? allScenarios[0] ?? scenarioLibrary[0],
    [allScenarios, selectedScenarioId]
  )
  const executivePromptPacks = useMemo(
    () => Array.from(new Set(executivePromptLibrary.map((item) => item.pack))),
    []
  )
  const filteredExecutivePrompts = useMemo(
    () =>
      (executivePromptPack === "all"
        ? executivePromptLibrary
        : executivePromptLibrary.filter((item) => item.pack === executivePromptPack)).filter((item) => {
        const search = executivePromptSearch.trim().toLowerCase()
        if (!search) return true
        const haystack = `${item.id} ${item.title} ${item.category} ${item.pack} ${item.tier} ${item.promptText}`.toLowerCase()
        return haystack.includes(search)
      }),
    [executivePromptPack, executivePromptSearch]
  )
  const selectedExecutivePrompt = useMemo(
    () =>
      filteredExecutivePrompts.find((item) => item.id === selectedExecutivePromptId) ??
      executivePromptLibrary.find((item) => item.id === selectedExecutivePromptId) ??
      filteredExecutivePrompts[0] ??
      executivePromptLibrary[0] ??
      null,
    [filteredExecutivePrompts, selectedExecutivePromptId]
  )

  function loadCustomScenarioFromLibrary(scenarioId: string) {
    const selected = customScenarios.find((item) => item.id === scenarioId)
    if (!selected) return
    setSelectedCustomScenarioId(selected.id)
    setSelectedScenarioId(selected.id)
    setScenarioMode("custom")
    setCustomScenarioCategory(selected.category)
    setCustomScenarioTitle(selected.title)
    setCustomScenarioText((selected.promptText || selected.title).trim())
    setCustomScenarioVisibility(selected.visibility === "shared" ? "shared" : "private")
    setMessage(`Loaded custom scenario "${selected.title}".`)
  }

  async function saveCustomScenario(isUpdate: boolean) {
    const title = customScenarioTitle.trim()
    const promptText = customScenarioText.trim()
    if (!title) {
      setMessage("Add a scenario title before saving.")
      return
    }
    if (!promptText) {
      setMessage("Add scenario detail before saving.")
      return
    }

    const now = new Date().toISOString()
    const existingById = customScenarios.find((item) => item.id === selectedCustomScenarioId)
    const existingByTitle = customScenarios.find((item) => item.title.toLowerCase() === title.toLowerCase())
    const target = isUpdate ? existingById || existingByTitle : null
    const nextScenario: ScenarioTemplate = {
      id: target?.id || uid("custom-scenario"),
      category: customScenarioCategory,
      title,
      focus: "User-defined custom scenario",
      promptText,
      visibility: customScenarioVisibility,
      ownerUserId: session?.user?.id || target?.ownerUserId || "",
      updatedAt: now,
    }

    const nextCustomScenarios = [nextScenario, ...customScenarios.filter((item) => item.id !== nextScenario.id)].slice(0, 40)
    customScenariosRef.current = nextCustomScenarios
    setCustomScenarios(nextCustomScenarios)
    setSelectedCustomScenarioId(nextScenario.id)
    setSelectedScenarioId(nextScenario.id)
    await persistWorkspace(membersRef.current, runHistoryRef.current, groupName, undefined, nextCustomScenarios)
    setMessage(isUpdate ? `Updated scenario "${title}".` : `Saved scenario "${title}".`)
  }

  const teamScores = useMemo(() => scoreTeam(members), [members])
  const totalSignals = teamScores.executor + teamScores.relationship + teamScores.strategy + teamScores.influence
  const readinessPercent = Math.min(100, Math.round((totalSignals / 30) * 100))
  const riskStrip = useMemo(() => (latestRun ? deriveRiskStrip(latestRun) : []), [latestRun])
  const actionTimeline = useMemo(() => (latestRun ? deriveActionTimeline(latestRun) : []), [latestRun])
  const recommendedResources = useMemo(() => buildResourceLinks(latestRun), [latestRun])
  const recommendedExamples = useMemo(() => buildScenarioExamples(latestRun), [latestRun])
  const displayedResources = onlineResources.length > 0 ? onlineResources : recommendedResources
  const displayedExamples = onlineExamples.length > 0 ? onlineExamples : recommendedExamples
  const checklistCompletedCount = latestRun?.actionChecklist.filter((item) => item.done).length ?? 0
  const checklistTotalCount = latestRun?.actionChecklist.length ?? 0
  const priorityLane = useMemo(() => buildPriorityLane(latestRun), [latestRun])
  const facilitationScript = useMemo(() => buildFacilitationScript(latestRun), [latestRun])
  const pairInsights = useMemo(() => buildRelationalHeatmap(members), [members])
  const selectedConversationToMember = useMemo(
    () => members.find((member) => member.id === conversationToMemberId) ?? members[0] ?? null,
    [conversationToMemberId, members]
  )
  const selectedConversationFromMember = useMemo(
    () => (conversationFromMemberId === "self" ? null : members.find((member) => member.id === conversationFromMemberId) ?? null),
    [conversationFromMemberId, members]
  )
  const compareRun = useMemo(
    () => runHistory.find((run) => run.runId === compareRunId) ?? null,
    [compareRunId, runHistory]
  )
  const runComparison = useMemo(() => {
    if (!latestRun || !compareRun) return null
    return buildRunComparison(latestRun, compareRun)
  }, [compareRun, latestRun])
  const runHealth = useMemo(() => (latestRun ? buildRunHealth(latestRun) : null), [latestRun])
  const nextBestActions = useMemo(() => buildNextBestActions(latestRun), [latestRun])
  const overviewSummary = latestRun?.groupSummary || (members.length > 0 ? summarizeTeamBias(teamScores) : "Add members to generate your first strengths-based system summary.")
  const overviewLens = latestRun?.semanticLens || "Run a scenario to load a deeper semantic lens for this group."
  const filteredRunHistory = useMemo(() => {
    const search = historySearch.trim().toLowerCase()
    const filtered = runHistory.filter((run) => {
      const categoryMatch = historyCategoryFilter === "all" || run.scenarioCategory.toLowerCase() === historyCategoryFilter.toLowerCase()
      if (!categoryMatch) return false
      if (historyFavoritesOnly && !run.isFavorite) return false
      if (historyWithNotesOnly && !(run.notes || "").trim()) return false
      if (historyNeedsReviewOnly && run.reviewed) return false
      if (historyPressureFilter === "low" && run.pressureLevel > 2) return false
      if (historyPressureFilter === "medium" && run.pressureLevel !== 3) return false
      if (historyPressureFilter === "high" && run.pressureLevel < 4) return false
      if (!search) return true
      const haystack = `${run.scenarioTitle} ${run.scenarioCategory} ${run.semanticLens} ${run.risks.join(" ")} ${run.actions.join(" ")} ${run.notes || ""} ${run.memberSupportPriorities
        .map((item) => `${item.memberName} ${item.role} ${item.supportMove}`)
        .join(" ")}`.toLowerCase()
      return haystack.includes(search)
    })
    return filtered.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1
      }
      const aTime = new Date(a.timestamp).getTime()
      const bTime = new Date(b.timestamp).getTime()
      return historySort === "oldest" ? aTime - bTime : bTime - aTime
    })
  }, [historyCategoryFilter, historyFavoritesOnly, historyNeedsReviewOnly, historyPressureFilter, historySearch, historySort, historyWithNotesOnly, runHistory])

  const historyQuickStats = useMemo(() => {
    const favorites = runHistory.filter((run) => run.isFavorite).length
    const highPressure = runHistory.filter((run) => run.pressureLevel >= 4).length
    const withNotes = runHistory.filter((run) => (run.notes || "").trim().length > 0).length
    const reviewed = runHistory.filter((run) => run.reviewed).length
    return {
      total: runHistory.length,
      favorites,
      highPressure,
      withNotes,
      reviewed,
      needsReview: Math.max(runHistory.length - reviewed, 0),
    }
  }, [runHistory])

  function resetHistoryFilters() {
    setHistorySearch("")
    setHistoryCategoryFilter("all")
    setHistorySort("newest")
    setHistoryFavoritesOnly(false)
    setHistoryPressureFilter("all")
    setHistoryWithNotesOnly(false)
    setHistoryNeedsReviewOnly(false)
  }

  function captureUndoRuns(runs: RunResult[]) {
    const cleaned = runs.map(normalizeRunResult).filter((run) => Boolean(run.runId))
    setUndoDeletedRuns(cleaned)
  }

  function restoreDeletedRuns() {
    if (undoDeletedRuns.length === 0) {
      setMessage("Nothing to restore.")
      return
    }
    const merged = mergeRunsById([...undoDeletedRuns, ...runHistoryRef.current])
    runHistoryRef.current = merged
    setRunHistory(merged)
    if (!latestRun) {
      setLatestRun(merged[0] ?? null)
    }
    if (!compareRunId && merged.length > 1) {
      setCompareRunId(merged[1].runId)
    }
    void persistWorkspace(membersRef.current, merged, groupName)
    setUndoDeletedRuns([])
    setMessage("Deleted runs restored.")
  }

  function applyHistoryPreset(preset: "favorites" | "highPressure" | "recent" | "withNotes" | "needsReview") {
    if (preset === "favorites") {
      setHistorySearch("")
      setHistoryCategoryFilter("all")
      setHistorySort("newest")
      setHistoryFavoritesOnly(true)
      setHistoryPressureFilter("all")
      setHistoryWithNotesOnly(false)
      setHistoryNeedsReviewOnly(false)
      return
    }
    if (preset === "highPressure") {
      setHistorySearch("")
      setHistoryCategoryFilter("all")
      setHistorySort("newest")
      setHistoryFavoritesOnly(false)
      setHistoryPressureFilter("high")
      setHistoryWithNotesOnly(false)
      setHistoryNeedsReviewOnly(false)
      return
    }
    if (preset === "withNotes") {
      setHistorySearch("")
      setHistoryCategoryFilter("all")
      setHistorySort("newest")
      setHistoryFavoritesOnly(false)
      setHistoryPressureFilter("all")
      setHistoryWithNotesOnly(true)
      setHistoryNeedsReviewOnly(false)
      return
    }
    if (preset === "needsReview") {
      setHistorySearch("")
      setHistoryCategoryFilter("all")
      setHistorySort("newest")
      setHistoryFavoritesOnly(false)
      setHistoryPressureFilter("all")
      setHistoryWithNotesOnly(false)
      setHistoryNeedsReviewOnly(true)
      return
    }
    // recent
    setHistorySearch("")
    setHistoryCategoryFilter("all")
    setHistorySort("newest")
    setHistoryFavoritesOnly(false)
    setHistoryPressureFilter("all")
    setHistoryWithNotesOnly(false)
    setHistoryNeedsReviewOnly(false)
  }

  function exportFilteredRunsCsv() {
    if (filteredRunHistory.length === 0) {
      setMessage("No runs to export with current filters.")
      return
    }

    const headers = [
      "scenario_title",
      "scenario_category",
      "pressure_level",
      "is_favorite",
      "timestamp",
      "top_risk",
      "top_action",
      "notes",
    ]

    const rows = filteredRunHistory.map((run) => [
      run.scenarioTitle,
      run.scenarioCategory,
      run.pressureLevel,
      Boolean(run.isFavorite),
      run.timestamp,
      run.risks[0] || "",
      run.actions[0] || "",
      run.notes || "",
    ])

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => csvEscape(cell)).join(","))].join("\n")
    downloadBlob(
      buildFileName(`${groupName || "group"}-saved-runs`, "csv"),
      csv,
      "text/csv;charset=utf-8"
    )
    setMessage("Saved Runs exported to .csv")
  }

  async function exportFilteredRunsDocx() {
    if (filteredRunHistory.length === 0) {
      setMessage("No runs to export with current filters.")
      return
    }
    try {
      const content = buildFilteredRunsMarkdown(filteredRunHistory, groupName, membersRef.current, displayedResources, displayedExamples)
      const title = `${groupName || "Group"} - TeamSync Saved Runs Report`
      const doc = new Document({
        sections: [
          {
            children: buildDocxParagraphs(title, content),
          },
        ],
      })
      const blob = await Packer.toBlob(doc)
      downloadBlob(buildFileName(`${groupName || "group"}-teamsync-saved-runs`, "docx"), blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      setMessage("Saved Runs exported to .docx")
    } catch {
      setMessage("Failed to export Saved Runs as .docx")
    }
  }

  function openPrintableFilteredRunsReport() {
    if (filteredRunHistory.length === 0) {
      setMessage("No runs to export with current filters.")
      return
    }
    if (typeof window === "undefined") return
    const title = `${groupName || "Group"} - TeamSync Saved Runs`
    const runCards = filteredRunHistory
      .map((run) => {
        const topPriority = run.memberSupportPriorities[0]
        return `<div class="card"><div><strong>${escapeHtml(run.scenarioTitle)}</strong> (${escapeHtml(run.scenarioCategory)})</div><div class="meta">Pressure ${run.pressureLevel}/5</div><div>${escapeHtml(
          run.groupSummary || "No summary provided."
        )}</div><div><strong>Top risk:</strong> ${escapeHtml(run.risks[0] || "No major risk listed.")}</div><div><strong>Top action:</strong> ${escapeHtml(
          run.actions[0] || "No action listed."
        )}</div>${topPriority ? `<div><strong>Priority support:</strong> ${escapeHtml(topPriority.memberName)} - ${escapeHtml(topPriority.supportMove)}</div>` : ""}</div>`
      })
      .join("")
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;margin:28px;line-height:1.45}h1{font-size:22px;margin:0 0 8px}h2{font-size:15px;margin:20px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}.meta{font-size:12px;color:#475569;margin-bottom:12px}.card{border:1px solid #d8e4f2;border-radius:10px;padding:10px 12px;margin:10px 0}ul{margin:8px 0 0 18px}li{margin:4px 0}a{color:#1d4ed8;text-decoration:none}@media print{body{margin:10mm}}</style></head><body><h1>${escapeHtml(
      title
    )}</h1><div class="meta">Generated ${new Date().toLocaleString()}</div><h2>Saved runs</h2>${runCards}<h2>Useful support links</h2><ul>${displayedResources
      .map((item) => `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a> - ${escapeHtml(item.reason)}</li>`)
      .join("")}</ul><h2>Comparable scenario examples</h2><ul>${displayedExamples
      .map((item) => `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a> - ${escapeHtml(item.note)}</li>`)
      .join("")}</ul></body></html>`
    const printWindow = window.open("", "_blank", "noopener,noreferrer")
    if (!printWindow) {
      setMessage("Popup blocked. Allow popups to open print/PDF report.")
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function deleteFilteredRuns() {
    if (filteredRunHistory.length === 0) {
      setMessage("No filtered runs to delete.")
      return
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete ${filteredRunHistory.length} filtered run(s)? This cannot be undone.`)
      if (!confirmed) return
    }

    captureUndoRuns(filteredRunHistory)
    const removeIds = new Set(filteredRunHistory.map((run) => run.runId))
    const nextRuns = runHistoryRef.current.filter((run) => !removeIds.has(run.runId))
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)

    if (!latestRun || removeIds.has(latestRun.runId)) {
      setLatestRun(nextRuns[0] ?? null)
    }

    if (compareRunId && removeIds.has(compareRunId)) {
      setCompareRunId(nextRuns[0]?.runId ?? "")
    }

    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage(`Deleted ${filteredRunHistory.length} filtered run(s).`)
  }
  const conversationTemplates = useMemo<ConversationTemplate[]>(() => {
    const listener = selectedConversationToMember?.name || "this person"
    const scenario = latestRun?.scenarioTitle || "our current scenario"
    return [
      {
        id: "check-in",
        label: "Check-in",
        tone: "warm",
        message: `Hi ${listener}, after ${scenario} I wanted to check in and hear how you're doing before we decide next steps.`,
      },
      {
        id: "boundary",
        label: "Boundary + Priority",
        tone: "clear",
        message: `Hi ${listener}, I want to keep this manageable. Let's agree one top priority for this week and park everything else.`,
      },
      {
        id: "repair",
        label: "Repair",
        tone: "de-escalate",
        message: `Hi ${listener}, I think we may have crossed wires. I want to reset calmly and find a way forward that works for both of us.`,
      },
      {
        id: "support-offer",
        label: "Support Offer",
        tone: "warm",
        message: `Hi ${listener}, I can see this has been heavy. What specific support would help you most over the next 48 hours?`,
      },
    ]
  }, [latestRun?.scenarioTitle, selectedConversationToMember?.name])

  const stepNav = [
    { key: "overview", label: "Overview", href: "#teamsync-overview" },
    { key: "intake", label: "Load Members", href: "#teamsync-intake" },
    { key: "scenario", label: "Scenario", href: "#teamsync-scenario" },
    { key: "run", label: "Run", href: "#teamsync-run" },
    { key: "insights", label: "Insights", href: "#teamsync-insights" },
    { key: "history", label: "History", href: "#teamsync-history" },
  ]
  const activeStepNavItem = stepNav.find((item) => item.key === activeStep) ?? stepNav[0]
  const hideTeamSyncMenuInFocus = isFocusMode && activeStep !== "overview"
  const canAddMember = memberName.trim().length > 1 && memberStrengths.trim().length > 0
  const selectedStrengthCount = parseStrengthTokens(memberStrengths).length
  const membersReady = members.length >= 2
  const scenarioReady =
    scenarioMode === "library"
      ? Boolean(selectedScenario?.id)
      : scenarioMode === "executive"
        ? Boolean(selectedExecutivePrompt?.id)
        : customScenarioText.trim().length > 0
  const runReady = Boolean(latestRun)
  const canRunSimulation = membersReady && scenarioReady && !simulating
  const runBlockers = [
    !membersReady ? "Load at least 2 members" : null,
    !scenarioReady ? "Choose a scenario, executive prompt, or write a custom scenario" : null,
  ].filter((item): item is string => Boolean(item))
  const scenarioModeLabel =
    scenarioMode === "library" ? "Saved scenario card" : scenarioMode === "executive" ? "Executive leadership prompt" : "Custom scenario"
  const scenarioSummaryLabel =
    scenarioMode === "library"
      ? selectedScenario
        ? `${selectedScenario.category} | ${selectedScenario.title}`
        : "No scenario selected"
      : scenarioMode === "executive"
        ? selectedExecutivePrompt
          ? `${selectedExecutivePrompt.tier} | ${selectedExecutivePrompt.title}`
          : "No executive prompt selected"
        : customScenarioText.trim() || "Custom scenario not written yet"
  const readinessItems: Array<{ label: string; ready: boolean; detailReady: string; detailNotReady: string }> = [
    {
      label: "Members loaded",
      ready: membersReady,
      detailReady: `${members.length} members loaded`,
      detailNotReady: "Load at least 2 members",
    },
    {
      label: "Scenario ready",
      ready: scenarioReady,
      detailReady:
        scenarioMode === "custom"
          ? "Custom scenario ready"
          : scenarioMode === "executive"
            ? "Executive prompt selected"
            : "Scenario card selected",
      detailNotReady: "Choose scenario card, executive prompt, or enter custom scenario",
    },
    {
      label: "Run completed",
      ready: runReady,
      detailReady: "Latest run summary available",
      detailNotReady: "Run simulation to generate outputs",
    },
  ]
  const nextAction =
    !membersReady
      ? { title: "Load members first", detail: "Add at least two people and their strengths.", stepKey: "intake", href: "#teamsync-intake", cta: "Go to Load Members" }
      : !scenarioReady
        ? { title: "Set your scenario", detail: "Pick a scenario card, executive prompt, or enter custom scenario text.", stepKey: "scenario", href: "#teamsync-scenario", cta: "Go to Scenario" }
        : !runReady
          ? { title: "Run your first simulation", detail: "Generate risks, actions, and support priorities.", stepKey: "run", href: "#teamsync-run", cta: "Go to Run" }
          : { title: "Review and share insights", detail: "Your latest run is ready for action and sharing.", stepKey: "insights", href: "#teamsync-insights", cta: "Open Insights" }
  const showOnboardingStartCard = members.length < 2 || !latestRun
  const readinessCount = readinessItems.filter((item) => item.ready).length
  const stepStatusByKey: Record<string, boolean> = {
    overview: readinessCount > 0 || Boolean(latestRun),
    intake: membersReady,
    scenario: scenarioReady,
    run: runReady,
    insights: runReady,
    history: runHistory.length > 0,
  }
  const smartCheckTone =
    readinessCount === readinessItems.length
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : readinessCount === 0
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-900"

  function switchGroup(nextGroupId: string) {
    if (!nextGroupId || nextGroupId === selectedGroupId) return
    setSelectedGroupId(nextGroupId)
    setMessage("Loading selected group...")
  }

  async function createNewGroup() {
    const nextName = newGroupName.trim()
    if (!nextName) {
      setMessage("Enter a group name first.")
      return
    }
    if (groups.some((group) => group.group_name.toLowerCase() === nextName.toLowerCase())) {
      setMessage("A group with that name already exists.")
      return
    }

    const emptyMembers: TeamMember[] = []
    const emptyRuns: RunResult[] = []
    membersRef.current = emptyMembers
    runHistoryRef.current = emptyRuns
    setMembers(emptyMembers)
    setRunHistory(emptyRuns)
    setLatestRun(null)
    setGroupName(nextName)
    setNewGroupName("")
    await persistWorkspace(emptyMembers, emptyRuns, nextName)
    setMessage(`Group "${nextName}" created.`)
    openStep("intake", "#teamsync-intake")
  }

  function openStep(stepKey: string, href: string) {
    setActiveStep(stepKey)
    if (stepKey !== "overview" && isFocusMode) {
      setIsMenuRolledUp(true)
    }
    if (typeof window === "undefined") return
    scrollToSelectorWithOffset(href, { offsetPx: 196 })
  }

  function resetWorkspaceView() {
    setIsFocusMode(true)
    setIsMenuRolledUp(true)
    openStep("overview", "#teamsync-overview")
    setMessage("Workspace view reset to guided start.")
  }

  function setInsightsPanelsOpen(open: boolean) {
    if (!insightsPanelsRef.current) return
    const panels = insightsPanelsRef.current.querySelectorAll("details")
    panels.forEach((panel) => {
      ;(panel as HTMLDetailsElement).open = open
    })
  }

  function startSupportConversation(priority: MemberSupportPriority) {
    const fallbackTarget = members.find((member) => member.id === priority.memberId || member.name === priority.memberName) ?? null
    if (!fallbackTarget) {
      setMessage("Could not find this member in the current group.")
      return
    }

    const suggestedOpening = `Hi ${fallbackTarget.name}, I want to check in after "${latestRun?.scenarioTitle || "this scenario"}". I noticed ${priority.rationale.toLowerCase()} What support would help you most this week?`
    setConversationFromMemberId("self")
    setConversationToMemberId(fallbackTarget.id)
    setConversationTone(priority.level === "high" ? "warm" : "clear")
    setConversationGoal(`Support ${fallbackTarget.name} while keeping priorities clear and emotionally safe.`)
    setConversationMessage(suggestedOpening)
    openStep("insights", "#teamsync-insights")
    setInsightsPanelsOpen(true)
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        scrollToSelectorWithOffset("#teamsync-conversation-simulator")
      }, 120)
    }
    setMessage(`Conversation prep loaded for ${fallbackTarget.name}.`)
  }

  function swapConversationDirection() {
    if (!selectedConversationToMember) return
    if (conversationFromMemberId === "self") {
      setConversationFromMemberId(selectedConversationToMember.id)
      setConversationToMemberId(members.find((member) => member.id !== selectedConversationToMember.id)?.id ?? selectedConversationToMember.id)
      return
    }
    const fromId = conversationFromMemberId
    const toId = conversationToMemberId
    if (fromId && toId) {
      setConversationFromMemberId(toId)
      setConversationToMemberId(fromId)
    }
  }

  function focusHighestPriorityConversation() {
    const topPriority = latestRun?.memberSupportPriorities?.[0]
    if (!topPriority) {
      setMessage("Run a scenario first to identify who needs support most.")
      return
    }
    startSupportConversation(topPriority)
  }

  function runNextBestAction(action: NextBestAction["action"]) {
    if (action === "open_support") {
      const topPriority = latestRun?.memberSupportPriorities?.[0]
      if (!topPriority) {
        setMessage("No support priority found yet. Run a simulation first.")
        return
      }
      startSupportConversation(topPriority)
      return
    }

    if (action === "open_checklist") {
      scrollToSelectorWithOffset("#teamsync-action-checklist")
      setMessage("Opened action checklist.")
      return
    }

    if (action === "schedule_pulse") {
      startFollowUpPulse(24)
    }
  }

  function reuseRunScenario(run: RunResult) {
    setScenarioMode("custom")
    setCustomScenarioCategory(run.scenarioCategory as ScenarioTemplate["category"])
    setCustomScenarioText(run.scenarioTitle)
    setPressureLevel(run.pressureLevel)
    setDesiredOutcome(run.actions[0] || "Clear ownership and stable team communication.")
    setMessage(`Loaded "${run.scenarioTitle}" into custom scenario. You can edit and rerun.`)
    openStep("scenario", "#teamsync-scenario")
  }

  async function handleStrengthFileUpload(file: File) {
    setMemberFileLoading(true)
    setMemberUploadNeedsAuth(false)
    setLastUploadedFileName(file.name)
    setLastUploadSummary("Reading file...")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const headers = await getAuthHeaders()
      const response = await fetch("/api/career/parse-upload", {
        method: "POST",
        headers: headers.Authorization ? { Authorization: headers.Authorization } : undefined,
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) {
        const uploadError = payload.error || "Upload failed. Could not read the strengths report."
        if (/auth|session|unauthor/i.test(uploadError)) {
          setMemberUploadNeedsAuth(true)
          setMessage("Auth session missing. Sign in again, then retry this upload.")
        } else {
          setMessage(uploadError)
        }
        setLastUploadSummary("Upload failed. Please try another strengths report.")
        return
      }
      const extractedText = typeof payload.content_text === "string" ? payload.content_text : ""
      const detected = extractGallupStrengths(extractedText)
      let resolvedMemberName = memberName.trim()
      if (!resolvedMemberName) {
        resolvedMemberName = guessMemberNameFromText(extractedText) || guessMemberNameFromFileName(file.name)
        if (resolvedMemberName) setMemberName(resolvedMemberName)
      }
      const hasMemberName = resolvedMemberName.trim().length > 0
      if (detected.length > 0) {
        setMemberStrengths(detected.join(", "))
        setMessage(`Strengths report loaded and mapped: ${detected.length} strengths captured. Click Add member to save.`)
        setLastUploadSummary(
          hasMemberName
            ? `Strengths report loaded and mapped. ${detected.length} strengths detected. Next step: review + add member.`
            : `Strengths report loaded and mapped. ${detected.length} strengths detected. Add a member name, then review + add.`
        )
      } else {
        setMemberStrengths(extractedText.slice(0, 800))
        setMessage("Report loaded. No direct Gallup themes were auto-detected. Review extracted text, then click Add member.")
        setLastUploadSummary(
          hasMemberName
            ? "Report loaded. Review extracted text and confirm strengths before adding the member."
            : "Report loaded. Add a member name, then review extracted strengths before adding the member."
        )
      }
      if (!hasMemberName) {
        setMemberIntakePanel("name")
      }
    } catch {
      setMessage("Upload failed. Please try again.")
      setLastUploadSummary("Upload failed. Please try again.")
    } finally {
      setMemberFileLoading(false)
    }
  }

  function addMember() {
    if (!memberName.trim()) {
      setMessage("Add a member name first.")
      return
    }
    if (!memberStrengths.trim()) {
      setMessage("Add Gallup strengths before saving this member.")
      return
    }

    const nextMember: TeamMember = {
      id: uid("member"),
      name: memberName.trim(),
      role: memberRole.trim(),
      strengths: memberStrengths.trim(),
    }

    const nextMembers = [nextMember, ...membersRef.current]
    membersRef.current = nextMembers
    setMembers(nextMembers)
    void persistWorkspace(nextMembers, runHistoryRef.current, groupName)
    setMemberName("")
    setMemberRole("")
    setMemberStrengths("")
    setMemberIntakePanel("name")
    setMembersListExpanded(true)
    setLastUploadSummary("")
    setLastUploadedFileName("")
    setMessage(`Member saved to ${groupName || "your group"}.`)
  }

  async function handleStrengthFilesBulkUpload(fileList: FileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setMemberBulkLoading(true)
    setMemberUploadNeedsAuth(false)
    setMessage(`Processing ${files.length} strengths report${files.length === 1 ? "" : "s"}...`)
    const createdMembers: TeamMember[] = []
    const skippedFiles: string[] = []
    try {
      const headers = await getAuthHeaders()
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/career/parse-upload", {
          method: "POST",
          headers: headers.Authorization ? { Authorization: headers.Authorization } : undefined,
          body: formData,
        })
        const payload = await response.json()
        if (!response.ok) {
          if ((payload?.error as string | undefined) && /auth|session|unauthor/i.test(String(payload.error))) {
            setMemberUploadNeedsAuth(true)
          }
          skippedFiles.push(file.name)
          continue
        }
        const extractedText = typeof payload.content_text === "string" ? payload.content_text : ""
        const detected = extractGallupStrengths(extractedText)
        if (detected.length === 0) {
          skippedFiles.push(file.name)
          continue
        }
        const baseName = guessMemberNameFromText(extractedText) || guessMemberNameFromFileName(file.name)
        const safeName = uniqueMemberName(baseName || "New Member", [...membersRef.current, ...createdMembers])
        createdMembers.push({
          id: uid("member"),
          name: safeName,
          role: "",
          strengths: detected.join(", "),
        })
      }

      if (createdMembers.length > 0) {
        const nextMembers = [...createdMembers, ...membersRef.current]
        membersRef.current = nextMembers
        setMembers(nextMembers)
        void persistWorkspace(nextMembers, runHistoryRef.current, groupName)
        setMembersListExpanded(true)
      }

      if (createdMembers.length > 0 && skippedFiles.length > 0) {
        setMessage(`Added ${createdMembers.length} members. Skipped ${skippedFiles.length} file(s) with no readable strengths.`)
      } else if (createdMembers.length > 0) {
        setMessage(`Added ${createdMembers.length} members from bulk import.`)
      } else {
        setMessage("No members were added. We could not detect strengths in the selected files.")
      }
      setLastUploadSummary(createdMembers.length > 0 ? `Bulk import added ${createdMembers.length} member(s).` : "Bulk import did not add any members.")
      setLastUploadedFileName(createdMembers.length > 0 ? `${createdMembers.length} files imported` : "")
      setMemberIntakePanel("name")
      setMemberName("")
      setMemberRole("")
      setMemberStrengths("")
    } catch {
      setMemberUploadNeedsAuth(true)
      setMessage("Bulk upload failed. Sign in again, then retry.")
    } finally {
      setMemberBulkLoading(false)
    }
  }

  function removeMember(memberId: string) {
    const nextMembers = membersRef.current.filter((member) => member.id !== memberId)
    membersRef.current = nextMembers
    setMembers(nextMembers)
    void persistWorkspace(nextMembers, runHistoryRef.current, groupName)
    setMessage("Member removed.")
  }

  function startEditMember(member: TeamMember) {
    setEditingMemberId(member.id)
    setEditingMemberName(member.name)
    setEditingMemberRole(member.role)
  }

  function cancelEditMember() {
    setEditingMemberId(null)
    setEditingMemberName("")
    setEditingMemberRole("")
  }

  function saveEditedMember() {
    if (!editingMemberId) return
    if (!editingMemberName.trim()) {
      setMessage("Member name is required.")
      return
    }
    const nextMembers = membersRef.current.map((member) =>
      member.id === editingMemberId
        ? {
            ...member,
            name: editingMemberName.trim(),
            role: editingMemberRole.trim(),
          }
        : member
    )
    membersRef.current = nextMembers
    setMembers(nextMembers)
    void persistWorkspace(nextMembers, runHistoryRef.current, groupName)
    setMessage("Member details updated.")
    cancelEditMember()
  }

  function toggleChecklistItem(runId: string, itemId: string) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
      }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
  }

  function updateChecklistItem(runId: string, itemId: string, patch: Partial<Pick<ActionChecklistItem, "owner" | "dueDate">>) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
  }

  function scoreMemberForAction(member: TeamMember, actionLabel: string) {
    const action = actionLabel.toLowerCase()
    const role = member.role.toLowerCase()
    const strengths = parseStrengthTokens(member.strengths)
    let score = 1

    if (containsAny(action, ["check-in", "support", "conversation", "repair", "trust", "de-escalat"])) {
      if (strengths.some((token) => ["empathy", "relator", "harmony", "developer", "communication"].includes(token))) score += 8
      if (containsAny(role, ["hr", "coach", "partner", "caregiver", "parent"])) score += 4
    }

    if (containsAny(action, ["capture", "owner", "commitment", "follow-up", "schedule", "decision", "risk"])) {
      if (strengths.some((token) => ["discipline", "arranger", "responsibility", "achiever", "focus"].includes(token))) score += 8
      if (containsAny(role, ["manager", "lead", "director", "coordinator", "operations", "project"])) score += 4
    }

    if (containsAny(action, ["define", "success", "signal", "scenario", "strategy", "options"])) {
      if (strengths.some((token) => ["strategic", "analytical", "futuristic", "input", "intellection"].includes(token))) score += 8
      if (containsAny(role, ["strategy", "analyst", "product", "founder"])) score += 4
    }

    if (containsAny(role, ["lead", "head", "director", "manager", "founder"])) {
      score += 2
    }

    return score
  }

  function autoAssignChecklistOwners(runId: string) {
    if (membersRef.current.length === 0) {
      setMessage("Load members first to auto-assign owners.")
      return
    }

    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item) => {
          if (item.owner?.trim()) return item
          const bestMember = [...membersRef.current]
            .map((member) => ({ member, score: scoreMemberForAction(member, item.label) }))
            .sort((a, b) => b.score - a.score)[0]?.member
          return {
            ...item,
            owner: bestMember?.name || item.owner,
          }
        }),
      }
    })

    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage("Owners auto-assigned for unassigned checklist items.")
  }

  function clearChecklistOwners(runId: string) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item) => ({ ...item, owner: "" })),
      }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage("Checklist owners cleared.")
  }

  function toIsoDate(value: Date) {
    return value.toISOString().slice(0, 10)
  }

  function autoAssignChecklistDueDates(runId: string) {
    const today = new Date()
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item, index) => {
          if (item.dueDate?.trim()) return item
          const due = new Date(today)
          due.setDate(today.getDate() + Math.min(index + 1, 7))
          return { ...item, dueDate: toIsoDate(due) }
        }),
      }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage("Due dates auto-assigned for undated checklist items.")
  }

  function clearChecklistDueDates(runId: string) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item) => ({ ...item, dueDate: "" })),
      }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage("Checklist due dates cleared.")
  }

  function setChecklistCompletion(runId: string, done: boolean) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return {
        ...run,
        actionChecklist: run.actionChecklist.map((item) => ({ ...item, done })),
      }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId) ?? null
    setLatestRun(updatedRun)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage(done ? "All checklist items marked complete." : "Checklist progress reset.")
  }

  function deleteRun(runId: string) {
    const runToDelete = runHistoryRef.current.find((run) => run.runId === runId)
    if (!runToDelete) return
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete "${runToDelete.scenarioTitle}" from history?`)
      if (!confirmed) return
    }

    captureUndoRuns([runToDelete])
    const nextRuns = runHistoryRef.current.filter((run) => run.runId !== runId)
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)

    if (!latestRun || latestRun.runId === runId) {
      setLatestRun(nextRuns[0] ?? null)
    }

    if (compareRunId === runId) {
      setCompareRunId(nextRuns.find((run) => run.runId !== (latestRun?.runId || ""))?.runId ?? "")
    }

    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage(`Deleted run: ${runToDelete.scenarioTitle}`)
  }

  function toggleRunFavorite(runId: string) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return { ...run, isFavorite: !run.isFavorite }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId)
    if (updatedRun && latestRun?.runId === runId) {
      setLatestRun(updatedRun)
    }
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage(updatedRun?.isFavorite ? "Run added to favorites." : "Run removed from favorites.")
  }

  function toggleRunReviewed(runId: string) {
    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return { ...run, reviewed: !run.reviewed }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId)
    if (updatedRun && latestRun?.runId === runId) {
      setLatestRun(updatedRun)
    }
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage(updatedRun?.reviewed ? "Run marked as reviewed." : "Run marked as needs review.")
  }

  function compareRunWithLatest(run: RunResult) {
    if (!latestRun) {
      setLatestRun(run)
      setMessage(`Loaded run: ${run.scenarioTitle}`)
      openStep("insights", "#teamsync-insights")
      return
    }

    if (latestRun.runId === run.runId) {
      const fallback = runHistory.find((item) => item.runId !== run.runId)
      if (!fallback) {
        setMessage("Need at least two runs to compare.")
        return
      }
      setCompareRunId(fallback.runId)
      setMessage(`Comparing current run against ${fallback.scenarioTitle}.`)
    } else {
      setCompareRunId(run.runId)
      setMessage(`Comparing latest run against ${run.scenarioTitle}.`)
    }

    openStep("insights", "#teamsync-insights")
  }

  function duplicateRun(runId: string) {
    const sourceRun = runHistoryRef.current.find((run) => run.runId === runId)
    if (!sourceRun) return

    const duplicate: RunResult = normalizeRunResult({
      ...sourceRun,
      runId: uid("teamsync-run"),
      timestamp: new Date().toISOString(),
      isFavorite: false,
      reviewed: false,
      scenarioTitle: `${sourceRun.scenarioTitle} (copy)`,
      notes: sourceRun.notes ? `${sourceRun.notes}\n\nDuplicated on ${new Date().toLocaleString()}` : "",
    })

    const nextRuns = [duplicate, ...runHistoryRef.current].slice(0, 200)
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    setLatestRun(duplicate)
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage(`Duplicated run: ${sourceRun.scenarioTitle}`)
    openStep("insights", "#teamsync-insights")
  }

  function clearRunHistory() {
    if (runHistoryRef.current.length === 0) {
      setMessage("Run history is already empty.")
      return
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Clear all saved runs for this group?")
      if (!confirmed) return
    }
    captureUndoRuns(runHistoryRef.current)
    const nextRuns: RunResult[] = []
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    setLatestRun(null)
    setCompareRunId("")
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage("Run history cleared.")
  }

  function saveRunNotes(runId: string, notes: string) {
    const normalized = notes.trim()
    const existing = runHistoryRef.current.find((run) => run.runId === runId)?.notes?.trim() ?? ""
    if (normalized === existing) return

    const nextRuns = runHistoryRef.current.map((run) => {
      if (run.runId !== runId) return run
      return { ...run, notes: normalized }
    })
    runHistoryRef.current = nextRuns
    setRunHistory(nextRuns)
    const updatedRun = nextRuns.find((run) => run.runId === runId)
    if (updatedRun && latestRun?.runId === runId) {
      setLatestRun(updatedRun)
    }
    void persistWorkspace(membersRef.current, nextRuns, groupName)
    setMessage("Run notes saved.")
  }

  function exportGroupBackup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      groupName: groupName || "My Team",
      members: membersRef.current,
      runs: runHistoryRef.current,
      customScenarios,
    }
    const json = JSON.stringify(payload, null, 2)
    downloadBlob(
      buildFileName(`${groupName || "my-team"}-teamsync-backup`, "json"),
      json,
      "application/json;charset=utf-8"
    )
    setMessage("Group backup downloaded (.json).")
  }

  async function importGroupBackup(file: File) {
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as {
        groupName?: string
        members?: TeamMember[]
        runs?: RunResult[]
        customScenarios?: ScenarioTemplate[]
      }

      const nextGroupName = (typeof parsed.groupName === "string" ? parsed.groupName.trim() : "") || groupName || "My Team"
      const nextMembers = Array.isArray(parsed.members)
        ? parsed.members
            .map((member, index) => ({
              id: typeof member?.id === "string" && member.id.trim() ? member.id : `member-import-${index + 1}`,
              name: typeof member?.name === "string" ? member.name.trim() : "",
              role: typeof member?.role === "string" ? member.role.trim() : "",
              strengths: typeof member?.strengths === "string" ? member.strengths.trim() : "",
            }))
            .filter((member) => member.name && member.strengths)
            .slice(0, 150)
        : []
      const nextRuns = Array.isArray(parsed.runs) ? parsed.runs.map(normalizeRunResult).slice(0, 30) : []
      const nextCustomScenarios = Array.isArray(parsed.customScenarios)
        ? parsed.customScenarios
            .map((scenario, index) => ({
              id: typeof scenario?.id === "string" && scenario.id.trim() ? scenario.id : `custom-scenario-import-${index + 1}`,
              title: typeof scenario?.title === "string" ? scenario.title.trim() : "",
              category:
                scenario?.category === "Professional" || scenario?.category === "Family" || scenario?.category === "Learning"
                  ? scenario.category
                  : "Professional",
              focus: typeof scenario?.focus === "string" ? scenario.focus.trim() : "Imported scenario",
            }))
            .filter((scenario) => scenario.title)
            .slice(0, 40)
        : []

      if (nextMembers.length === 0 && nextRuns.length === 0) {
        setMessage("Backup file did not contain usable TeamSync data.")
        return
      }

      membersRef.current = nextMembers
      runHistoryRef.current = nextRuns
      setGroupName(nextGroupName)
      setMembers(nextMembers)
      setRunHistory(nextRuns)
      setLatestRun(nextRuns[0] ?? null)
      setCustomScenarios(nextCustomScenarios)
      await persistWorkspace(nextMembers, nextRuns, nextGroupName)
      setMessage(`Imported backup for "${nextGroupName}".`)
    } catch {
      setMessage("Could not import backup file. Check JSON format.")
    }
  }

  async function copyShareText(text: string, label: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setMessage(`${label} copied. Paste into Slack, email, or your notes app.`)
      } else {
        if (typeof document !== "undefined") {
          const textarea = document.createElement("textarea")
          textarea.value = text
          textarea.setAttribute("readonly", "true")
          textarea.style.position = "fixed"
          textarea.style.opacity = "0"
          document.body.appendChild(textarea)
          textarea.select()
          try {
            document.execCommand("copy")
            setMessage(`${label} copied. Paste into Slack, email, or your notes app.`)
          } finally {
            document.body.removeChild(textarea)
          }
          return
        }
        setMessage(`Clipboard is unavailable. Copy this manually:\n\n${text}`)
      }
    } catch {
      setMessage(`Could not copy automatically. Copy this manually:\n\n${text}`)
    }
  }

  function getLatestRunForShare(actionLabel: string) {
    if (!latestRun) {
      setMessage(`Run a scenario first, then ${actionLabel}.`)
      return null
    }
    return latestRun
  }

  async function sendLatestRunToSlack() {
    const run = getLatestRunForShare("send to Slack")
    if (!run) {
      return
    }
    setSendingToSlack(true)
    try {
      const response = await fetch("/api/teamsync/share/slack", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          groupName: groupName || "Group",
          run,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        await copyShareText(buildSlackUpdate(run, groupName), "Slack update")
        setMessage(`${payload?.error || "Could not send to Slack."} Slack update copied instead.`)
        return
      }
      setMessage("Sent to Slack channel successfully.")
    } catch {
      await copyShareText(buildSlackUpdate(run, groupName), "Slack update")
      setMessage("Slack send failed. Slack update copied instead.")
    } finally {
      setSendingToSlack(false)
    }
  }

  async function downloadRunDocx() {
    if (!latestRun) {
      setMessage("Run a scenario first, then export the report.")
      return
    }
    try {
      const content = buildTeamSyncReportMarkdown(latestRun, groupName, membersRef.current, displayedResources, displayedExamples)
      const title = `${groupName || "Group"} - ${latestRun.scenarioTitle} TeamSync Report`
      const doc = new Document({
        sections: [
          {
            children: buildDocxParagraphs(title, content),
          },
        ],
      })
      const blob = await Packer.toBlob(doc)
      downloadBlob(
        buildFileName(`${groupName || "group"}-${latestRun.scenarioTitle}-teamsync-report`, "docx"),
        blob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
      setMessage("Downloaded polished TeamSync .docx report.")
    } catch {
      setMessage("Failed to create TeamSync .docx report.")
    }
  }

  function openPrintableReport() {
    if (!latestRun) {
      setMessage("Run a scenario first, then open print/PDF report.")
      return
    }
    if (typeof window === "undefined") return
    const reportTitle = `${groupName || "Group"} - ${latestRun.scenarioTitle} TeamSync Report`
    const memberRowsHtml =
      membersRef.current.length > 0
        ? membersRef.current
            .map(
              (member) =>
                `<li><strong>${escapeHtml(member.name)}</strong> (${escapeHtml(member.role || "Role not set")})<br/><span>${escapeHtml(summarizeMemberGallup(member.strengths))}</span></li>`
            )
            .join("")
        : "<li>No members loaded.</li>"
    const roleReactionsHtml =
      latestRun.roleReactions.length > 0
        ? latestRun.roleReactions
            .map(
              (item) =>
                `<li><strong>${escapeHtml(item.audience)}</strong>: ${escapeHtml(item.likelyResponse)}<br/><em>Support action:</em> ${escapeHtml(item.supportAction)}</li>`
            )
            .join("")
        : "<li>No role reactions listed.</li>"
    const resourceLinksHtml =
      displayedResources.length > 0
        ? displayedResources
            .map(
              (item) =>
                `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><br/><span>${escapeHtml(item.reason)}</span></li>`
            )
            .join("")
        : "<li>No support links available.</li>"
    const scenarioExamplesHtml =
      displayedExamples.length > 0
        ? displayedExamples
            .map(
              (item) =>
                `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><br/><span>${escapeHtml(item.note)}</span></li>`
            )
            .join("")
        : "<li>No comparable examples available.</li>"
    const signalMapRows = buildSignalMapRows(latestRun)
    const signalMapSvg = buildSignalMapSvgMarkup(latestRun)
    const riskStrip = deriveRiskStrip(latestRun)
    const actionTimeline = deriveActionTimeline(latestRun)
    const signalMapSummaryHtml =
      signalMapRows.length > 0
        ? signalMapRows
            .map(
              (item) =>
                `<tr><td>${item.rank}</td><td>${escapeHtml(item.member)}</td><td>${escapeHtml(item.role)}</td><td>${escapeHtml(item.level)}</td><td>${item.score}</td><td>${escapeHtml(item.move)}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="6">No team signal map data available.</td></tr>`
    const riskStripHtml =
      riskStrip.length > 0
        ? riskStrip
            .map((item) => {
              const toneClass =
                item.status === "red"
                  ? "tone-red"
                  : item.status === "amber"
                    ? "tone-amber"
                    : "tone-green"
              return `<div class="signal-card ${toneClass}"><div class="signal-label">${escapeHtml(item.label)}</div><div class="signal-status">${escapeHtml(item.status.toUpperCase())}</div><div class="signal-detail">${escapeHtml(item.detail)}</div></div>`
            })
            .join("")
        : `<div class="signal-card">No signal strip available.</div>`
    const actionTimelineHtml =
      actionTimeline.length > 0
        ? actionTimeline
            .map(
              (bucket) =>
                `<div class="timeline-card"><div class="timeline-title">${escapeHtml(bucket.horizon)}</div><ul>${
                  bucket.items.length > 0 ? bucket.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>No actions queued.</li>"
                }</ul></div>`
            )
            .join("")
        : `<div class="timeline-card">No timeline available.</div>`
    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${reportTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      .meta { font-size: 12px; color: #475569; margin-bottom: 16px; }
      ul { margin: 8px 0 0 18px; }
      li { margin: 4px 0; }
      .card { border: 1px solid #d8e4f2; border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
      .pill { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 8px; font-size: 11px; margin-right: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
      th, td { border: 1px solid #dbe3ef; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f8fbff; color: #334155; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
      .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
      .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
      .signal-card { border: 1px solid #dbe3ef; border-radius: 10px; padding: 8px; }
      .signal-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; font-weight: 700; }
      .signal-status { margin-top: 4px; font-size: 14px; font-weight: 700; }
      .signal-detail { margin-top: 4px; font-size: 11px; color: #334155; }
      .tone-red { background: #fff1f2; border-color: #fecdd3; color: #881337; }
      .tone-amber { background: #fffbeb; border-color: #fde68a; color: #78350f; }
      .tone-green { background: #ecfdf5; border-color: #bbf7d0; color: #065f46; }
      .timeline-card { border: 1px solid #dbe3ef; border-radius: 10px; padding: 8px; background: #f8fbff; }
      .timeline-title { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; font-weight: 700; margin-bottom: 4px; }
      .timeline-card ul { margin: 0 0 0 16px; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <h1>${reportTitle}</h1>
    <div class="meta">Generated ${new Date().toLocaleString()}</div>

    <h2>Scenario</h2>
    <div class="card">
      <div><strong>${escapeHtml(latestRun.scenarioTitle)}</strong> (${escapeHtml(latestRun.scenarioCategory)})</div>
      <div class="meta">Pressure ${latestRun.pressureLevel}/5</div>
      ${
        latestRun.companyUrl
          ? `<div class="meta"><strong>Company URL:</strong> <a href="${escapeHtml(latestRun.companyUrl)}" target="_blank" rel="noreferrer">${escapeHtml(latestRun.companyUrl)}</a></div>`
          : ""
      }
      ${
        latestRun.companyContextInfluence
          ? `<div class="meta"><strong>Context influence:</strong> ${escapeHtml(latestRun.companyContextInfluence.toUpperCase())}</div>`
          : ""
      }
      <div>${escapeHtml(latestRun.groupSummary || "No summary provided.")}</div>
    </div>
    <h2>Company Context</h2>
    <div class="card">${escapeHtml(latestRun.companyContextSummary || "Not enabled for this run.")}</div>

    <h2>Members and Strengths Summary</h2>
    <ul>${memberRowsHtml}</ul>

    <h2>Role-by-role Reactions</h2>
    <ul>${roleReactionsHtml}</ul>

    <h2>Top Risks</h2>
    <ul>${(latestRun.risks.length > 0 ? latestRun.risks : ["No major risks listed."]).map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>

    <h2>Recommended Actions</h2>
    <ul>${(latestRun.actions.length > 0 ? latestRun.actions : ["No actions listed."]).map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>

    <h2>Support Priorities</h2>
    ${(latestRun.memberSupportPriorities.length > 0
      ? latestRun.memberSupportPriorities
          .map(
            (item) => `<div class="card"><div><strong>${escapeHtml(item.memberName)}</strong> <span class="pill">${escapeHtml(item.level)}</span><span class="pill">${item.score}/100</span></div><div class="meta">${escapeHtml(item.role || "Role not set")}</div><div>${escapeHtml(item.rationale)}</div><div><strong>Support move:</strong> ${escapeHtml(item.supportMove)}</div></div>`
          )
          .join("")
      : `<div class="card">No member support priorities generated.</div>`)}

    <h2>Team Signal Map</h2>
    <div class="card">
      ${signalMapSvg}
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Member</th>
            <th>Role</th>
            <th>Signal</th>
            <th>Score</th>
            <th>Priority move</th>
          </tr>
        </thead>
        <tbody>${signalMapSummaryHtml}</tbody>
      </table>
    </div>

    <h2>Executive Signal Strip</h2>
    <div class="grid-4">${riskStripHtml}</div>

    <h2>Action Timeline</h2>
    <div class="grid-3">${actionTimelineHtml}</div>

    <h2>Useful Support Links</h2>
    <ul>${resourceLinksHtml}</ul>

    <h2>Comparable Scenario Examples (People/Organizations)</h2>
    <ul>${scenarioExamplesHtml}</ul>
  </body>
</html>`
    const printWindow = window.open("", "_blank", "noopener,noreferrer")
    if (!printWindow) {
      setMessage("Popup blocked. Allow popups to open print/PDF report.")
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function openEmailDraft() {
    if (!latestRun) {
      setMessage("Run a scenario first, then open an email draft.")
      return
    }
    if (typeof window === "undefined") return
    const subject = encodeURIComponent(`TeamSync Brief - ${groupName || "Group"} - ${latestRun.scenarioTitle}`)
    const body = encodeURIComponent(buildEmailBrief(latestRun, groupName))
    window.location.href = `mailto:?subject=${subject}&body=${body}`
    setMessage("Email draft opened in your default mail app.")
  }

  function startFollowUpPulse(hoursAhead: number) {
    if (!latestRun) return
    const base = new Date()
    base.setHours(base.getHours() + hoursAhead)
    const followUpDate = base.toLocaleString()
    setScenarioMode("custom")
    setCustomScenarioCategory(latestRun.scenarioCategory as ScenarioTemplate["category"])
    setCustomScenarioText(`Follow-up pulse (${hoursAhead}h): ${latestRun.scenarioTitle}`)
    setDesiredOutcome(`Review action progress and emotional load by ${followUpDate}.`)
    setMessage(`Follow-up pulse prepared for ${followUpDate}. Run when ready.`)
    openStep("scenario", "#teamsync-scenario")
  }

  function downloadPulseInvite(hoursAhead: number) {
    if (!latestRun) {
      setMessage("Run a scenario first to create a pulse invite.")
      return
    }
    if (typeof window === "undefined") return

    const start = new Date()
    start.setHours(start.getHours() + hoursAhead)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const now = new Date()

    const title = `${hoursAhead >= 168 ? "7-day" : "24-hour"} TeamSync Pulse - ${groupName || "Group"}`
    const description = [
      `Scenario: ${latestRun.scenarioTitle}`,
      `Pressure: ${latestRun.pressureLevel}/5`,
      `Top action: ${latestRun.actions[0] || "Review current commitments"}`,
      `Top risk: ${latestRun.risks[0] || "No major risk flagged"}`,
    ].join("\n")

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PersonaFoundry//TeamSync//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:teamsync-${latestRun.runId}-${hoursAhead}@personafoundry`,
      `DTSTAMP:${formatIcsDate(now)}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n")

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    setMessage(`${hoursAhead >= 168 ? "7-day" : "24-hour"} pulse invite downloaded.`)
  }

  useEffect(() => {
    async function loadOnlineResources() {
      if (!latestRun || !session?.access_token) {
        setOnlineResources([])
        setOnlineExamples([])
        setResourcesError("")
        return
      }

      setResourcesLoading(true)
      setResourcesError("")
      try {
        const response = await fetch("/api/teamsync/resources", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            scenario_title: latestRun.scenarioTitle,
            scenario_category: latestRun.scenarioCategory,
            semantic_lens: latestRun.semanticLens,
            risks: latestRun.risks,
            role_reactions: latestRun.roleReactions,
            actions: latestRun.actions,
          }),
        })
        const payload = await response.json()
        if (!response.ok) {
          setResourcesError(payload.error || "Could not load live resources.")
          setOnlineResources([])
          setOnlineExamples([])
          return
        }
        const resources = Array.isArray(payload.resources)
          ? payload.resources
              .map((item: unknown, index: number) => {
                const row = item as Record<string, unknown>
                const title = typeof row.title === "string" ? row.title.trim() : ""
                const href = typeof row.url === "string" ? row.url.trim() : ""
                const reason = typeof row.reason === "string" ? row.reason.trim() : ""
                if (!title || !href) return null
                return {
                  id: `online-${index + 1}`,
                  title,
                  href,
                  reason: reason || "Relevant to this scenario.",
                } as ResourceLink
              })
              .filter(Boolean)
              .slice(0, 5)
          : []
        const examples = Array.isArray(payload.examples)
          ? payload.examples
              .map((item: unknown, index: number) => {
                const row = item as Record<string, unknown>
                const title = typeof row.title === "string" ? row.title.trim() : ""
                const href = typeof row.url === "string" ? row.url.trim() : ""
                const note = typeof row.note === "string" ? row.note.trim() : ""
                if (!title || !href) return null
                return {
                  id: `example-${index + 1}`,
                  title,
                  href,
                  note: note || "Comparable scenario reference.",
                } as ScenarioExample
              })
              .filter(Boolean)
              .slice(0, 3)
          : []
        setOnlineResources(resources as ResourceLink[])
        setOnlineExamples(examples as ScenarioExample[])
      } catch {
        setResourcesError("Live resource search is unavailable right now.")
        setOnlineResources([])
        setOnlineExamples([])
      } finally {
        setResourcesLoading(false)
      }
    }

    void loadOnlineResources()
  }, [latestRun, session?.access_token])

  useEffect(() => {
    if (members.length === 0) return
    if (!conversationToMemberId || !members.some((member) => member.id === conversationToMemberId)) {
      setConversationToMemberId(members[0].id)
    }
    if (
      conversationFromMemberId !== "self" &&
      !members.some((member) => member.id === conversationFromMemberId) &&
      members.length > 1
    ) {
      const fallback = members.find((member) => member.id !== conversationToMemberId)?.id ?? "self"
      setConversationFromMemberId(fallback)
    }
  }, [conversationFromMemberId, conversationToMemberId, members])

  useEffect(() => {
    if (!latestRun) return
    const fallback = runHistory.find((run) => run.runId !== latestRun.runId)?.runId ?? ""
    if (!fallback) {
      setCompareRunId("")
      return
    }
    if (!compareRunId || compareRunId === latestRun.runId) {
      setCompareRunId(fallback)
    }
  }, [compareRunId, latestRun, runHistory])

  useEffect(() => {
    if (filteredExecutivePrompts.length === 0) return
    if (!filteredExecutivePrompts.some((item) => item.id === selectedExecutivePromptId)) {
      setSelectedExecutivePromptId(filteredExecutivePrompts[0].id)
    }
  }, [filteredExecutivePrompts, selectedExecutivePromptId])

  async function runConversationSimulation() {
    if (!latestRun) {
      setMessage("Run a scenario first to unlock conversation simulation.")
      return
    }
    if (!selectedConversationToMember) {
      setMessage("Load members first to run conversation simulation.")
      return
    }
    if (conversationFromMemberId !== "self" && conversationFromMemberId === conversationToMemberId) {
      setMessage("Choose different people for speaker and listener.")
      return
    }
    if (!conversationMessage.trim()) {
      setMessage("Write your message before running simulation.")
      return
    }

    const speakerName = selectedConversationFromMember?.name || "You"
    const speakerRole = selectedConversationFromMember?.role || "Facilitator"
    const speakerStrengths = selectedConversationFromMember?.strengths || ""
    const listenerName = selectedConversationToMember.name
    const listenerRole = selectedConversationToMember.role
    const listenerStrengths = selectedConversationToMember.strengths

    setConversationLoading(true)
    try {
      const response = await fetch("/api/teamsync/conversation", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          scenario_title: latestRun.scenarioTitle,
          scenario_category: latestRun.scenarioCategory,
          semantic_lens: latestRun.semanticLens,
          relationship_goal: conversationGoal,
          user_message: applyConversationTone(conversationMessage, conversationTone),
          source_member: {
            name: speakerName,
            role: speakerRole,
            strengths: speakerStrengths,
            summary: speakerStrengths ? summarizeMemberGallup(speakerStrengths) : "Facilitator speaking directly.",
          },
          target_member: {
            name: listenerName,
            role: listenerRole,
            strengths: listenerStrengths,
            summary: summarizeMemberGallup(listenerStrengths),
          },
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.result) {
        setMessage(payload?.error || "Conversation simulation failed.")
        return
      }

      const turn: ConversationTurn = {
        id: uid("conversation-turn"),
        speakerName,
        listenerName,
        userMessage: conversationMessage.trim(),
        memberReply: typeof payload.result.memberReply === "string" ? payload.result.memberReply : "",
        whatWorked: Array.isArray(payload.result.coachFeedback?.whatWorked) ? payload.result.coachFeedback.whatWorked : [],
        whatToAdjust: Array.isArray(payload.result.coachFeedback?.whatToAdjust) ? payload.result.coachFeedback.whatToAdjust : [],
        improvedRewrite: typeof payload.result.coachFeedback?.improvedRewrite === "string" ? payload.result.coachFeedback.improvedRewrite : "",
        safetyScore: Number.isFinite(payload.result.coachFeedback?.safetyScore) ? Number(payload.result.coachFeedback.safetyScore) : 70,
      }
      setConversationTurns((prev) => [turn, ...prev].slice(0, 8))
      setMessage("Conversation simulation completed.")
    } catch {
      setMessage("Conversation simulation is temporarily unavailable.")
    } finally {
      setConversationLoading(false)
    }
  }

  async function runSimulation() {
    const membersForRun = membersRef.current
    if (membersForRun.length < 2) {
      setMessage("Load at least two members before running a scenario.")
      return
    }

    const customText = customScenarioText.trim()
    if (scenarioMode === "custom" && !customText) {
      setMessage("Add custom scenario text before running.")
      return
    }
    if (scenarioMode === "executive" && !selectedExecutivePrompt) {
      setMessage("Choose an executive prompt before running.")
      return
    }
    const normalizedCompanyUrl =
      scenarioMode === "executive" && useCompanyContext ? normalizeCompanyUrlInput(companyUrlInput) : ""
    if (scenarioMode === "executive" && useCompanyContext && companyUrlInput.trim() && !normalizedCompanyUrl) {
      setMessage("Company URL format is invalid. Use a public website URL.")
      return
    }

    let scenarioForRun = selectedScenario
    let scenarioContextTextForRun = scenarioMode === "custom" ? customText : ""

    if (scenarioMode === "executive" && selectedExecutivePrompt) {
      scenarioForRun = {
        id: selectedExecutivePrompt.id,
        category: selectedExecutivePrompt.tier === "Boardroom" ? "Boardroom" : "Executive",
        title: selectedExecutivePrompt.title,
        focus: selectedExecutivePrompt.category,
      }
      scenarioContextTextForRun = selectedExecutivePrompt.promptText
    }

    if (scenarioMode === "custom" && customText) {
      const selectedCustom = customScenarios.find((scenario) => scenario.id === selectedCustomScenarioId)
      const existing = customScenarios.find((scenario) => scenario.title.toLowerCase() === customScenarioTitle.trim().toLowerCase())
      const customTitle = customScenarioTitle.trim() || selectedCustom?.title || customText
      if (selectedCustom) {
        scenarioForRun = {
          ...selectedCustom,
          title: customTitle,
          category: customScenarioCategory,
        }
        scenarioContextTextForRun = customText
      } else if (existing) {
        scenarioForRun = {
          ...existing,
          title: customTitle,
        }
        scenarioContextTextForRun = customText || existing.promptText || existing.title
        setSelectedScenarioId(existing.id)
      } else {
        scenarioForRun = {
          id: uid("custom-scenario"),
          category: customScenarioCategory,
          title: customTitle,
          focus: "User-defined custom scenario",
        }
        scenarioContextTextForRun = customText
      }
    }

    if (scenarioMode === "custom" && !scenarioContextTextForRun.trim()) {
      setMessage("Add custom scenario detail before running.")
      return
    }

    if (scenarioMode === "custom" && customText) {
      const existing = customScenarios.find((scenario) => scenario.title.toLowerCase() === scenarioForRun.title.toLowerCase())
      if (existing) {
        scenarioForRun = {
          ...existing,
          category: customScenarioCategory,
          promptText: customText,
          visibility: customScenarioVisibility,
        }
        setSelectedScenarioId(existing.id)
        setSelectedCustomScenarioId(existing.id)
      } else {
        const newCustomScenario: ScenarioTemplate = {
          id: uid("custom-scenario"),
          category: customScenarioCategory,
          title: scenarioForRun.title,
          focus: "User-defined custom scenario",
          promptText: customText,
          visibility: customScenarioVisibility,
          ownerUserId: session?.user?.id || "",
          updatedAt: new Date().toISOString(),
        }
        const nextCustomScenarios = [newCustomScenario, ...customScenarios].slice(0, 30)
        customScenariosRef.current = nextCustomScenarios
        setCustomScenarios(nextCustomScenarios)
        setSelectedScenarioId(newCustomScenario.id)
        setSelectedCustomScenarioId(newCustomScenario.id)
        scenarioForRun = newCustomScenario
      }
    }

    setSimulating(true)
    let run = buildScenarioResult(membersForRun, scenarioForRun, scenarioContextTextForRun, pressureLevel, desiredOutcome)

    try {
      const response = await fetch("/api/teamsync/simulate", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          group_name: groupName,
          scenario_title: scenarioForRun.title,
          scenario_category: scenarioForRun.category,
          scenario_prompt_id: scenarioMode === "executive" ? selectedExecutivePrompt?.id ?? null : null,
          scenario_prompt_text: scenarioContextTextForRun || null,
          company_context_enabled: scenarioMode === "executive" ? useCompanyContext : false,
          company_url: scenarioMode === "executive" ? normalizedCompanyUrl || null : null,
          company_context_influence: scenarioMode === "executive" ? companyContextInfluence : "low",
          pressure_level: pressureLevel,
          desired_outcome: desiredOutcome,
          members: membersForRun,
        }),
      })
      const payload = await response.json()
      if (response.ok && payload?.result) {
        const ai = payload.result as AiSimulationResponse
        const nextActions = Array.isArray(ai.actions) ? ai.actions : run.actions
        run = {
          ...run,
          groupSummary: ai.groupSummary || run.groupSummary,
          semanticLens: ai.semanticLens || run.semanticLens,
          likelyBehaviors: Array.isArray(ai.likelyBehaviors) ? ai.likelyBehaviors : run.likelyBehaviors,
          roleReactions: Array.isArray(ai.roleReactions) ? ai.roleReactions : run.roleReactions,
          risks: Array.isArray(ai.risks) ? ai.risks : run.risks,
          adjustments: Array.isArray(ai.adjustments) ? ai.adjustments : run.adjustments,
          actions: nextActions,
          actionChecklist: buildActionChecklist(nextActions, run.actionChecklist),
          companyUrl: scenarioMode === "executive" ? normalizedCompanyUrl || undefined : undefined,
          companyContextInfluence: scenarioMode === "executive" && useCompanyContext ? companyContextInfluence : undefined,
          companyContextSummary:
            typeof ai.companyContextSummary === "string" && ai.companyContextSummary.trim()
              ? ai.companyContextSummary.trim()
              : undefined,
          memberSupportPriorities: buildMemberSupportPriorities(
            membersForRun,
            scenarioForRun.title,
            pressureLevel,
            Array.isArray(ai.risks) ? ai.risks : run.risks,
            Array.isArray(ai.roleReactions) ? ai.roleReactions : run.roleReactions
          ),
        }
      }
    } catch {}

    const nextRuns = [run, ...runHistoryRef.current].slice(0, 30)
    runHistoryRef.current = nextRuns
    setLatestRun(run)
    setRunHistory(nextRuns)
    void persistWorkspace(membersForRun, nextRuns, groupName, undefined, customScenariosRef.current)
    if (scenarioMode === "custom") {
      if (!selectedCustomScenarioId) {
        setCustomScenarioText("")
      }
    }
    setSimulating(false)
    setMessage("Scenario simulation completed.")
    openStep("insights", "#teamsync-insights")
  }

  function dismissWhatsNewPanel() {
    setIsWhatsNewOpen(false)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("teamsync-whats-new-hidden-v1", "1")
    }
  }

  async function submitIssueReport() {
    const trimmedDetail = issueDetail.trim()
    if (!trimmedDetail) {
      setMessage("Add a short issue description first.")
      return
    }

    try {
      const response = await fetch("/api/tester-notes", {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note_type: "bug",
          severity: "medium",
          message: `${issueType}: ${trimmedDetail}`,
          module: "teamsync",
          route_path: typeof window !== "undefined" ? window.location.pathname : "/teamsync",
          full_url: typeof window !== "undefined" ? window.location.href : null,
          section_anchor: activeStepNavItem.href,
          metadata: {
            issue_type: issueType,
            active_step: activeStepNavItem.label,
            contact_email: issueContactEmail || null,
          },
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || "Could not submit issue.")
      }
      setMessage("Issue sent. Thanks, our team can now review this report.")
    } catch {
      setMessage("Could not send issue report right now. Please try again.")
    }

    setIsReportIssueOpen(false)
  }

  return (
    <main id="teamsync-workspace-root" className="min-h-screen bg-[#f5f8fc] text-[#0f172a]">
      <div className="w-full px-4 py-5 lg:pl-[240px] lg:pr-4">
        <PlatformModuleNav />
        <AdaptiveProductTour moduleKey="teamsync" />
        <WelcomeBackNotice userId={session?.user?.id} moduleLabel="TeamSync" />
        <aside id="teamsync-left-nav" className="fixed left-0 top-0 z-20 hidden h-screen w-[220px] border-r border-[#d8e4f2] bg-white/95 px-2.5 pb-4 pt-20 shadow-sm backdrop-blur lg:block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">TeamSync nav</div>
          <div className="mt-1 text-[11px] text-neutral-600">One module, one clear workflow</div>
          <div className="mt-3 space-y-1.5">
            {stepNav.map((item) => {
              const active = item.key === activeStep
              const complete = stepStatusByKey[item.key] ?? false
              return (
                <button
                  key={`teamsync-left-nav-${item.key}`}
                  type="button"
                  onClick={() => openStep(item.key, item.href)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                    active
                      ? "border-sky-300 bg-sky-100 text-sky-900"
                      : complete
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <button
              type="button"
              onClick={resetWorkspaceView}
              className="mb-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-left text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Reset view
            </button>
            <button
              type="button"
              onClick={() => setIsReportIssueOpen(true)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-left text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Report issue
            </button>
          </div>
        </aside>
        {isWhatsNewOpen ? (
          <section className="mb-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">What&apos;s new</div>
                <p className="mt-0.5 text-xs text-sky-900">
                  Cleaner step flow, tighter controls, and faster setup cues are now live.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissWhatsNewPanel}
                className="rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700 hover:bg-sky-100"
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : null}
        <section className="rounded-3xl border border-[#d7e8f0] bg-[linear-gradient(180deg,#ffffff_0%,#f5fbfd_100%)] p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0f766e]">TeamSync</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">Team and family dynamics intelligence</h1>
              <p className="mt-1.5 text-sm text-[#475569]">
                Load strengths, simulate scenarios, and get clear people-first actions.
              </p>
              <ModuleExplainerPanel
                buttonLabel="Why TeamSync Works"
                title="Why TeamSync Works"
                summary="TeamSync turns Gallup strengths into practical relational intelligence so teams and families can predict friction, support each other faster, and communicate with more precision."
                docHref="/docs/personara-ai-teamsync-explainer.docx"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href="/docs/personara-ai-teamsync-explainer.docx"
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip"
                >
                  Open TeamSync explainer
                </a>
                <a
                  href={TEAMSYNC_EXECUTIVE_BRIEF_PDF}
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip"
                >
                  Open executive briefing
                </a>
                <a
                  href={TEAMSYNC_EXECUTIVE_DECK_PDF}
                  target="_blank"
                  rel="noreferrer"
                  className="personara-explainer-chip"
                >
                  Open executive deck
                </a>
                <a
                  href="/resources#teamsync"
                  className="personara-explainer-chip"
                >
                  Open resource hub
                </a>
              </div>
              <details open className="mt-2 rounded-xl border border-[#d8e4f2] bg-white/80 px-3 py-2">
                <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.12em] text-[#334155]">
                  Executive Intelligence Briefing
                </summary>
                <p className="mt-1 text-xs text-[#334155]">
                  TeamSync converts executive Gallup strengths into live operating intelligence for structure design, pressure simulation,
                  succession planning, and board-level readiness.
                </p>
                <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                  <div className="rounded-lg border border-[#dbe4f2] bg-[#f8fbff] px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569]">Core flow</div>
                    <p className="mt-0.5 text-xs text-[#334155]">
                      Input layer → intelligence engine → premium prompts → boardroom scenarios → actionable leadership outcomes.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#dbe4f2] bg-[#f8fbff] px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569]">Board-level question</div>
                    <p className="mt-0.5 text-xs text-[#334155]">
                      Do we have the right people, in the right roles, making decisions in the right way for the future we are trying to build?
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#dbe4f2] bg-[#f8fbff] px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569]">Problem solved</div>
                    <p className="mt-0.5 text-xs text-[#334155]">
                      Exposes structural conflict, hidden strengths gaps, and likely crisis-response failure points before they become expensive.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#dbe4f2] bg-[#f8fbff] px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569]">Primary users</div>
                    <p className="mt-0.5 text-xs text-[#334155]">
                      CEOs, CHROs, executive teams, and boards needing role-fit clarity, governance readiness, and pre-emptive team design.
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={TEAMSYNC_EXECUTIVE_BRIEF_PDF}
                    target="_blank"
                    rel="noreferrer"
                    className="personara-explainer-chip"
                  >
                    Open executive brief (PDF)
                  </a>
                  <a
                    href={TEAMSYNC_EXECUTIVE_DECK_PDF}
                    target="_blank"
                    rel="noreferrer"
                    className="personara-explainer-chip"
                  >
                    Open executive deck (PDF)
                  </a>
                  <a
                    href={TEAMSYNC_EXECUTIVE_VISUAL_IMAGE}
                    target="_blank"
                    rel="noreferrer"
                    className="personara-explainer-chip"
                  >
                    View visual architecture
                  </a>
                </div>
              </details>
            </div>
            <div className="rounded-2xl border border-[#bfdbfe] bg-white px-3 py-2 text-xs text-[#334155]">
              {session?.user?.email ? (
                <span>
                  Signed in as {session.user.email}
                  {syncing ? " · syncing..." : " · cloud sync on"}
                </span>
              ) : (
                <span>Please sign in to sync data across modules.</span>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#64748b]">Group</div>
              <div className="mt-0.5 text-sm font-semibold">{groupName || "Unnamed group"}</div>
            </div>
            <div className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#64748b]">Members loaded</div>
              <div className="mt-0.5 text-base font-semibold">{members.length}</div>
            </div>
            <div className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#64748b]">Readiness score</div>
              <div className="mt-0.5 text-base font-semibold">{readinessPercent}%</div>
            </div>
            <div className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#64748b]">Scenario runs</div>
              <div className="mt-0.5 text-base font-semibold">{runHistory.length}</div>
            </div>
            <div className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#64748b]">Current pressure</div>
              <div className="mt-0.5 text-base font-semibold">{pressureLevel}/5</div>
            </div>
          </div>

        </section>

        {showOnboardingStartCard ? (
          <section className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Start here</div>
                <p className="mt-0.5 text-xs text-sky-900">{nextAction.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => openStep(nextAction.stepKey, nextAction.href)}
                className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
              >
                {nextAction.cta}
              </button>
            </div>
          </section>
        ) : null}

        {hideTeamSyncMenuInFocus ? (
          <nav data-sticky-nav="true" className="sticky top-3 z-20 mt-3 rounded-2xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-neutral-600">
                Working in <span className="font-semibold text-neutral-900">{activeStepNavItem.label}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {savePulse ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    {savePulse.label}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => openStep(nextAction.stepKey, nextAction.href)}
                  className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                >
                  {nextAction.cta}
                </button>
                <button
                  type="button"
                  onClick={resetWorkspaceView}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Reset view
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportIssueOpen(true)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Report issue
                </button>
                {isSimpleView ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSimpleView(false)
                      setIsFocusMode(false)
                      setIsMenuRolledUp(false)
                    }}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    Open full checklist
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFocusMode(false)
                      setIsMenuRolledUp(false)
                    }}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    Show menu
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFocusMode(false)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Exit focus
                </button>
              </div>
            </div>
          </nav>
        ) : (
          <nav data-sticky-nav="true" className="sticky top-3 z-20 mt-3 rounded-2xl border border-neutral-200 bg-white/95 p-2.5 shadow-sm backdrop-blur lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b6b7c]">Step-by-step menu</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Current: {activeStepNavItem.label}</div>
                {savePulse ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                    {savePulse.label}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => openStep(nextAction.stepKey, nextAction.href)}
                  className="rounded-full border border-[#0a66c2] bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                >
                  {nextAction.cta}
                </button>
                <button
                  type="button"
                  onClick={resetWorkspaceView}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Reset view
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportIssueOpen(true)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  Report issue
                </button>
                {isSimpleView ? null : (
                  <button
                    type="button"
                    onClick={() => setIsMenuRolledUp((current) => !current)}
                    className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    {isMenuRolledUp ? "Expand" : "Collapse"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFocusMode((current) => !current)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {isFocusMode ? "Focus mode on" : "Focus mode off"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSimpleView((current) => !current)}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {isSimpleView ? "Simple mode on" : "Simple mode off"}
                </button>
              </div>
            </div>
            {!isMenuRolledUp ? (
              <>
                <div className="ui-action-row mt-2">
                  {stepNav.map((item) => {
                    const active = item.key === activeStep
                    const complete = stepStatusByKey[item.key] ?? false
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => openStep(item.key, item.href)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "border border-sky-200 bg-sky-50 text-sky-800"
                            : complete
                              ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {complete ? "✓ " : ""}
                        {item.label}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 grid gap-1.5 text-[11px] text-neutral-600 md:grid-cols-3">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">1) Load at least 2 members</div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">2) Pick or write a scenario</div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">3) Run and review insights</div>
                </div>
              </>
            ) : null}
            {isMenuRolledUp ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2">
                <div className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${smartCheckTone}`}>
                  {readinessCount}/{readinessItems.length} ready
                </div>
                <button
                  type="button"
                  onClick={() => openStep(nextAction.stepKey, nextAction.href)}
                  className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                >
                  {nextAction.cta}
                </button>
              </div>
            ) : (
              <div className={`mt-2 rounded-lg border px-2.5 py-2 ${smartCheckTone}`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em]">Smart check</div>
                <p className="mt-0.5 text-[11px] leading-4">
                  {readinessCount}/{readinessItems.length} core steps ready.
                  {readinessCount < readinessItems.length ? ` Next: ${nextAction.title.toLowerCase()}.` : " You are ready to review and share."}
                </p>
              </div>
            )}
          </nav>
        )}

        <section className="sticky top-2 z-20 mt-2 rounded-xl border border-[#d8e4f2] bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[11px] text-neutral-600">
              <span className="font-semibold text-neutral-900">{activeStepNavItem.label}</span>
              <span className="text-neutral-400"> · </span>
              <span>{readinessCount}/{readinessItems.length} ready</span>
            </div>
            <button
              type="button"
              onClick={() => openStep(nextAction.stepKey, nextAction.href)}
              className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
            >
              Continue
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            {message}
          </div>
        )}

        <div className="mt-3 grid gap-3">
          <section
            id="teamsync-overview"
            className={`scroll-mt-56 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm md:scroll-mt-60 ${activeStep === "overview" ? "" : "hidden"}`}
          >
            <h2 className="text-base font-semibold">Step 1: Overview</h2>
            <p className="mt-0.5 text-sm text-[#475569]">
              A fast snapshot of how this group is likely to respond under pressure.
            </p>
            <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
              {readinessItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-lg border px-2.5 py-1.5 ${
                    item.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#334155]">{item.label}</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-[#475569]">{item.ready ? item.detailReady : item.detailNotReady}</div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 grid gap-1.5 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-lg border border-[#d8e4f2] bg-white p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Do this next</div>
                <p className="mt-0.5 text-sm font-semibold text-[#0f172a]">{nextAction.title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[#475569]">{nextAction.detail}</p>
                <button
                  type="button"
                  onClick={() => openStep(nextAction.stepKey, nextAction.href)}
                  className="mt-1.5 rounded-md border border-[#1d4ed8] bg-[#dbeafe] px-2.5 py-1 text-[11px] font-semibold text-[#1e3a8a] hover:bg-[#bfdbfe]"
                >
                  {nextAction.cta}
                </button>
              </div>
              <div className="rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                  Current summary {latestRun ? `- ${latestRun.scenarioCategory}` : ""}
                </div>
                <p className="mt-0.5 text-sm text-[#0f172a]">{overviewSummary}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[#475569]">{overviewLens}</p>
              </div>
            </div>
            <details className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">More info</summary>
              <div className="mt-1.5 space-y-1 text-[11px] leading-4 text-[#0f172a]">
                <p>
                  <span className="font-semibold">Individual:</span> how each person typically decides and communicates.
                </p>
                <p>
                  <span className="font-semibold">Pairwise:</span> where trust grows quickly and where friction may appear.
                </p>
                <p>
                  <span className="font-semibold">Group system:</span> where the group is strong and what support habits help most.
                </p>
              </div>
            </details>
          </section>

          <section
            id="teamsync-intake"
            className={`scroll-mt-56 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm md:scroll-mt-60 ${activeStep === "intake" ? "" : "hidden"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Step 2: Load members</h2>
                <p className="mt-0.5 text-[11px] text-[#64748b]">Add names + strengths to build the group model.</p>
                {!membersReady ? <p className="mt-0.5 text-[11px] font-medium text-[#b45309]">Add at least 2 members to run a simulation.</p> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextMembers: TeamMember[] = []
                  membersRef.current = nextMembers
                  setMembers(nextMembers)
                  void persistWorkspace(nextMembers, runHistoryRef.current, groupName)
                  setMessage("Member list cleared.")
                }}
                className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-neutral-50"
              >
                Clear members
              </button>
            </div>

            {members.length === 0 ? (
              <div className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2.5 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[#64748b]">No members loaded yet. Start by entering the member name below, then upload the strengths report.</p>
                  <span className="rounded-full border border-[#d8e4f2] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                    0 loaded
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569]">Loaded members</div>
                  <span className="rounded-full border border-[#d8e4f2] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                    {members.length} loaded
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {members.slice(0, 8).map((member) => (
                    <span key={`loaded-pill-${member.id}`} className="rounded-full border border-[#c7d2fe] bg-white px-2 py-0.5 text-[10px] font-medium text-[#334155]">
                      {member.name}
                    </span>
                  ))}
                  {members.length > 8 ? (
                    <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] text-neutral-600">
                      +{members.length - 8} more
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            <input
              ref={memberUploadInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void handleStrengthFileUpload(file)
                event.currentTarget.value = ""
              }}
              className="hidden"
            />
            <input
              ref={memberBulkUploadInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              multiple
              onChange={(event) => {
                const files = event.target.files
                if (!files || files.length === 0) return
                void handleStrengthFilesBulkUpload(files)
                event.currentTarget.value = ""
              }}
              className="hidden"
            />

            <details className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569]">
                Group settings and backups
              </summary>
              <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Current Group</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => switchGroup(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
                  >
                    {groups.length === 0 ? <option value="">My Team</option> : null}
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.group_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Rename Current Group</label>
                    <div className="flex gap-1.5">
                    <input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Example: Product Leadership Team"
                       className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void persistWorkspace(membersRef.current, runHistoryRef.current, groupName)}
                       className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-1.5">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Create New Group</label>
                <div className="flex gap-1.5">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Example: Ferguson Family"
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void createNewGroup()}
                    className="rounded-lg border border-[#1d4ed8] bg-[#dbeafe] px-2.5 py-1.5 text-xs font-semibold text-[#1e3a8a] hover:bg-[#bfdbfe]"
                  >
                    Create
                  </button>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={exportGroupBackup}
                   className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-50"
                >
                  Export group backup (.json)
                </button>
                 <label className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-50">
                  Import group backup
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      void importGroupBackup(file)
                      event.currentTarget.value = ""
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </details>

            <div className="mt-1 rounded-lg border border-neutral-200 p-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Add one member</div>
                    <p className="mt-0.5 text-[11px] text-[#64748b]">One path: name, upload report, review strengths, then add.</p>
                  </div>
                <span className="rounded-full border border-[#d8e4f2] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                  {memberIntakePanel === "name" ? "Step 1 of 3" : memberIntakePanel === "strengths" ? "Step 2 of 3" : "Step 3 of 3"}
                </span>
              </div>

              <div className="mt-1.5 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-1">
                  <button
                    type="button"
                    onClick={() => setMemberIntakePanel("name")}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                      memberIntakePanel === "name"
                        ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                        : "border border-transparent bg-white text-[#64748b] hover:border-[#d8e4f2]"
                    }`}
                  >
                    1. Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberIntakePanel("strengths")}
                    disabled={!memberName.trim()}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                      memberIntakePanel === "strengths"
                        ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                        : "border border-transparent bg-white text-[#64748b] hover:border-[#d8e4f2]"
                    } ${!memberName.trim() ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    2. Strengths
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberIntakePanel("review")}
                    disabled={selectedStrengthCount === 0}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                      memberIntakePanel === "review"
                        ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                        : "border border-transparent bg-white text-[#64748b] hover:border-[#d8e4f2]"
                    } ${selectedStrengthCount === 0 ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    3. Review
                  </button>
                </div>

                <div className="rounded-lg border border-[#d8e4f2] bg-white p-2">
                  {memberIntakePanel === "name" ? (
                    <div className="grid gap-1 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Member Name</label>
                        <input
                          value={memberName}
                          onFocus={() => setMemberIntakePanel("name")}
                          onKeyDown={(event) => event.stopPropagation()}
                          onKeyUp={(event) => event.stopPropagation()}
                          onKeyPress={(event) => event.stopPropagation()}
                          onChange={(e) => {
                            setMemberName(e.target.value)
                            setMemberIntakePanel("name")
                          }}
                          placeholder="Full name"
                          className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Role (Optional)</label>
                        <input
                          value={memberRole}
                          onFocus={() => setMemberIntakePanel("name")}
                          onKeyDown={(event) => event.stopPropagation()}
                          onKeyUp={(event) => event.stopPropagation()}
                          onKeyPress={(event) => event.stopPropagation()}
                          onChange={(e) => {
                            setMemberRole(e.target.value)
                            setMemberIntakePanel("name")
                          }}
                          placeholder="Role or relationship"
                          className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={() => setMemberIntakePanel("strengths")}
                          disabled={!memberName.trim()}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            memberName.trim()
                              ? "border border-[#1d4ed8] bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                              : "cursor-not-allowed border border-neutral-300 bg-neutral-100 text-[#64748b]"
                          }`}
                        >
                          Continue to upload
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {memberIntakePanel === "strengths" ? (
                    <div className="space-y-1.5">
                      {memberUploadNeedsAuth ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                          <div className="font-semibold">Session expired</div>
                          <p className="mt-0.5">Sign in again, then retry upload.</p>
                          <a
                            href="/platform"
                            className="mt-1 inline-flex rounded-md border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                          >
                            Go to sign in
                          </a>
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1e3a8a]">Upload strengths report</div>
                            <p className="mt-0.5 text-[11px] text-[#1e3a8a]">Upload once, then continue to review + add.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              memberUploadInputRef.current?.click()
                            }}
                            disabled={!memberName.trim() || memberFileLoading || memberBulkLoading}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                              !memberName.trim() || memberFileLoading || memberBulkLoading
                                ? "cursor-not-allowed border border-neutral-300 bg-neutral-100 text-[#64748b]"
                                : "border border-[#1d4ed8] bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                            }`}
                          >
                            {!memberName.trim() ? "Enter name first" : memberFileLoading ? "Reading file..." : "Upload report"}
                          </button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => memberBulkUploadInputRef.current?.click()}
                            disabled={memberFileLoading || memberBulkLoading}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                              memberFileLoading || memberBulkLoading
                                ? "cursor-not-allowed border-neutral-300 bg-neutral-100 text-[#64748b]"
                                : "border-[#93c5fd] bg-white text-[#1e40af] hover:bg-[#dbeafe]"
                            }`}
                          >
                            {memberBulkLoading ? "Bulk importing..." : "Bulk import reports"}
                          </button>
                          <span className="text-[11px] text-[#475569]">Adds multiple members at once, auto-named from report content/file name.</span>
                        </div>
                        {lastUploadedFileName ? (
                          <div className="mt-1 rounded-lg border border-[#bfdbfe] bg-white px-2 py-1 text-[11px] text-[#334155]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">Latest report:</span> {lastUploadedFileName}
                              {!memberFileLoading && selectedStrengthCount > 0 ? (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                                  Ready to review
                                </span>
                              ) : null}
                            </div>
                            {lastUploadSummary ? <span className="mt-0.5 block text-[#475569]">{lastUploadSummary}</span> : null}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-[#475569]">No report loaded yet. Click Upload report to continue.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMemberIntakePanel("name")}
                          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:bg-neutral-50"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemberIntakePanel("review")}
                          disabled={memberFileLoading || selectedStrengthCount === 0}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            memberFileLoading || selectedStrengthCount === 0
                              ? "cursor-not-allowed border border-neutral-300 bg-neutral-100 text-[#64748b]"
                              : "border border-[#1d4ed8] bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                          }`}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {memberIntakePanel === "review" ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2 py-1.5 text-[11px] text-[#334155]">
                        <span>Final step: confirm strengths, then save this member to the current group.</span>
                        <button
                          type="button"
                          onClick={() => setMemberIntakePanel("strengths")}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#475569] hover:bg-neutral-50"
                        >
                          Back to upload
                        </button>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Strengths</label>
                        <textarea
                          value={memberStrengths}
                          onChange={(e) => setMemberStrengths(e.target.value)}
                          onKeyDown={(event) => event.stopPropagation()}
                          onKeyUp={(event) => event.stopPropagation()}
                          onKeyPress={(event) => event.stopPropagation()}
                          placeholder="Achiever, Relator, Strategic, Learner..."
                          className="min-h-[74px] w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#64748b]">
                        <span>{memberFileLoading ? "Reading strengths file..." : "Check strengths, then save the member."}</span>
                        <span>{selectedStrengthCount} strengths captured</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMemberIntakePanel("strengths")}
                          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:bg-neutral-50"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={addMember}
                          disabled={!canAddMember || memberFileLoading}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold text-white ${
                            canAddMember && !memberFileLoading ? "bg-[#1d4ed8] hover:bg-[#1e40af]" : "cursor-not-allowed bg-[#94a3b8]"
                          }`}
                        >
                          Add member to group
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-1">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748b]">
                  Members loaded: {members.length}
                </div>
                <button
                  type="button"
                  onClick={() => setMembersListExpanded((current) => !current)}
                  className="ui-compact-pill"
                >
                  {membersListExpanded ? "Collapse list" : "Expand list"}
                </button>
              </div>
              <div className={`grid gap-1.5 ${membersListExpanded ? "" : "hidden"}`}>
              {members.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-2.5 text-sm text-[#64748b]">
                  No members loaded yet. Add at least two members to run simulations.
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-neutral-200 bg-[#fbfdff] px-2 py-1.5">
                    <div>
                      {editingMemberId === member.id ? (
                        <div className="grid gap-1.5 md:grid-cols-2">
                          <input
                            value={editingMemberName}
                            onChange={(event) => setEditingMemberName(event.target.value)}
                            className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                            placeholder="Member name"
                          />
                          <input
                            value={editingMemberRole}
                            onChange={(event) => setEditingMemberRole(event.target.value)}
                            className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                            placeholder="Role"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-semibold leading-5">{member.name}</div>
                          <div className="text-xs leading-4 text-[#64748b]">{member.role || "Role not set"}</div>
                        </>
                      )}
                      <div className="mt-0.5 text-xs text-[#334155]">{member.strengths}</div>
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-[#1d4ed8]">View summary</summary>
                        <p className="mt-0.5 text-xs leading-4 text-[#475569]">{summarizeMemberGallup(member.strengths)}</p>
                      </details>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {editingMemberId === member.id ? (
                        <>
                          <button
                            type="button"
                            onClick={saveEditedMember}
                            className="rounded-lg border border-[#1d4ed8] bg-[#1d4ed8] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1e40af]"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditMember}
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditMember(member)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </section>

          <section
            id="teamsync-scenario"
            className={`scroll-mt-56 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm md:scroll-mt-60 ${activeStep === "scenario" ? "" : "hidden"}`}
          >
            <h2 className="text-lg font-semibold">Step 3: Scenario setup</h2>
            <p className="mt-0.5 text-xs text-[#475569]">Pick a scenario path, then run.</p>
            {!scenarioReady ? <p className="mt-1 text-xs font-medium text-[#b45309]">Pick or write one scenario before you run.</p> : null}
            <div className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2.5 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Current scenario</div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${scenarioReady ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                  {scenarioReady ? "Ready" : "Not ready"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#0f172a]">{scenarioSummaryLabel}</p>
                <span className="rounded-full border border-[#cbd5e1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                  {scenarioModeLabel}
                </span>
              </div>
            </div>
            <details className="mt-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">How to choose</summary>
              <div className="mt-1.5 space-y-1 text-xs text-[#334155]">
                <p>
                  <span className="font-semibold">Saved:</span> use a ready scenario for speed.
                </p>
                <p>
                  <span className="font-semibold">Executive:</span> premium board and leadership scenarios.
                </p>
                <p>
                  <span className="font-semibold">Custom:</span> write and save your own scenario.
                </p>
              </div>
            </details>

            <div className="ui-action-row mt-1">
              <button
                type="button"
                onClick={() => setScenarioMode("library")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  scenarioMode === "library" ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]" : "border border-neutral-300 bg-white text-[#334155]"
                }`}
              >
                Saved scenarios
              </button>
              <button
                type="button"
                onClick={() => setScenarioMode("executive")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  scenarioMode === "executive" ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]" : "border border-neutral-300 bg-white text-[#334155]"
                }`}
              >
                Executive pack
              </button>
              <button
                type="button"
                onClick={() => setScenarioMode("custom")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  scenarioMode === "custom" ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]" : "border border-neutral-300 bg-white text-[#334155]"
                }`}
              >
                Custom scenario
              </button>
            </div>

            <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
              <div className={scenarioMode === "library" ? "" : "hidden"}>
                <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Scenario card</label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {allScenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.category} - {scenario.title}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-xs text-[#64748b]">Focus: {selectedScenario.focus}</p>
              </div>
              <div className={scenarioMode === "executive" ? "" : "hidden"}>
                <div className="grid gap-1.5 md:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Prompt pack</label>
                    <select
                      value={executivePromptPack}
                      onChange={(e) => setExecutivePromptPack(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    >
                      <option value="all">All packs</option>
                      {executivePromptPacks.map((pack) => (
                        <option key={`exec-pack-${pack}`} value={pack}>
                          {pack}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Search prompts</label>
                    <input
                      value={executivePromptSearch}
                      onChange={(e) => setExecutivePromptSearch(e.target.value)}
                      placeholder="Search by prompt ID, title, or keyword"
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <label className="mb-0.5 mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Executive scenario prompt</label>
                <select
                  value={filteredExecutivePrompts.some((prompt) => prompt.id === selectedExecutivePrompt?.id) ? selectedExecutivePrompt?.id : ""}
                  onChange={(e) => setSelectedExecutivePromptId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                >
                  {filteredExecutivePrompts.length === 0 ? (
                    <option value="" disabled>
                      No prompts found for this filter
                    </option>
                  ) : null}
                  {filteredExecutivePrompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.tier} | {prompt.id} | {prompt.title}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-[11px] text-[#64748b]">{filteredExecutivePrompts.length} prompt(s) in this view.</p>
                <div className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-white px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Company context (optional)</label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#334155]">
                      <input
                        type="checkbox"
                        checked={useCompanyContext}
                        onChange={(e) => setUseCompanyContext(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-neutral-300"
                      />
                      Use company/industry context
                    </label>
                  </div>
                  <div className="mt-1 grid gap-1.5 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <input
                        value={companyUrlInput}
                        onChange={(e) => setCompanyUrlInput(e.target.value)}
                        placeholder="example.com or https://example.com"
                        disabled={!useCompanyContext}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm ${
                          useCompanyContext ? "border-neutral-300 bg-white" : "border-neutral-200 bg-neutral-100 text-neutral-500"
                        }`}
                      />
                    </div>
                    <div>
                      <select
                        value={companyContextInfluence}
                        onChange={(e) => setCompanyContextInfluence(e.target.value as "low" | "medium" | "high")}
                        disabled={!useCompanyContext}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-sm ${
                          useCompanyContext ? "border-neutral-300 bg-white" : "border-neutral-200 bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        <option value="low">Influence: Low</option>
                        <option value="medium">Influence: Medium</option>
                        <option value="high">Influence: High</option>
                      </select>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748b]">
                    Gallup strengths remain primary. Company context only refines scenario language and external pressure cues.
                  </p>
                </div>
                {selectedExecutivePrompt ? (
                  <div className="mt-1 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          selectedExecutivePrompt.tier === "Boardroom"
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {selectedExecutivePrompt.tier}
                      </span>
                      <span>{selectedExecutivePrompt.pack}</span>
                      <span>|</span>
                      <span>{selectedExecutivePrompt.category}</span>
                    </div>
                    {selectedExecutivePrompt.promptText.length > 220 ? (
                      <>
                        <p className="mt-0.5 line-clamp-3 text-xs text-[#334155]">{selectedExecutivePrompt.promptText}</p>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] font-semibold text-[#1d4ed8]">View full prompt</summary>
                          <p className="mt-1 text-xs text-[#334155]">{selectedExecutivePrompt.promptText}</p>
                        </details>
                      </>
                    ) : (
                      <p className="mt-0.5 text-xs text-[#334155]">{selectedExecutivePrompt.promptText}</p>
                    )}
                  </div>
                ) : null}
                <details className="mt-1.5 rounded-xl border border-[#c7d8f5] bg-[#eff6ff] px-3 py-2">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[#1e3a8a]">
                    TeamSync Executive Intelligence Engine: why this matters
                  </summary>
                  <p className="mt-1 text-xs text-[#334155]">
                    TeamSync Premium converts executive Gallup strengths into a decision-support layer for team structure,
                    pressure simulation, governance readiness, and high-stakes leadership execution.
                  </p>
                  <div className="mt-1.5 grid gap-1 text-[11px] text-[#334155] md:grid-cols-2">
                    <div className="rounded-lg border border-[#bfdbfe] bg-white/80 px-2 py-1.5">
                      <span className="font-semibold text-[#1e3a8a]">Input and interaction mapping:</span> reveal blind spots,
                      friction patterns, and role-fit risks.
                    </div>
                    <div className="rounded-lg border border-[#bfdbfe] bg-white/80 px-2 py-1.5">
                      <span className="font-semibold text-[#1e3a8a]">Simulation core:</span> model team behavior in crisis, restructuring,
                      investor pressure, and strategic reset.
                    </div>
                    <div className="rounded-lg border border-[#bfdbfe] bg-white/80 px-2 py-1.5">
                      <span className="font-semibold text-[#1e3a8a]">Premium boardroom layer:</span> stress-test leadership readiness for
                      governance and capital decisions.
                    </div>
                    <div className="rounded-lg border border-[#bfdbfe] bg-white/80 px-2 py-1.5">
                      <span className="font-semibold text-[#1e3a8a]">Business outcomes:</span> optimized executive structure, reduced
                      operational friction, and stronger board confidence.
                    </div>
                  </div>
                  <details className="mt-2 rounded-lg border border-[#bfdbfe] bg-white/90 px-2 py-2">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[#1e3a8a]">
                      View architecture graphic
                    </summary>
                    <a
                      href={TEAMSYNC_EXECUTIVE_ENGINE_IMAGE}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-xs font-semibold text-[#1d4ed8] underline-offset-2 hover:underline"
                    >
                      Open full image
                    </a>
                    <Image
                      src={TEAMSYNC_EXECUTIVE_ENGINE_IMAGE}
                      alt="TeamSync Executive Intelligence Engine architecture"
                      width={1365}
                      height={768}
                      className="mt-1.5 h-auto w-full rounded-lg border border-[#bfdbfe] bg-white"
                    />
                  </details>
                </details>
                <p className="mt-0.5 text-xs text-[#64748b]">Premium pack loaded from your executive prompt library. Boardroom scenarios are marked as add-on tier.</p>
              </div>
              <div className={scenarioMode === "custom" ? "" : "hidden"}>
                <div className="grid gap-1.5 md:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Find saved custom scenario</label>
                    <input
                      value={customScenarioSearch}
                      onChange={(e) => setCustomScenarioSearch(e.target.value)}
                      placeholder="Search saved scenarios"
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Saved scenarios</label>
                    <select
                      value={selectedCustomScenarioId}
                      onChange={(e) => loadCustomScenarioFromLibrary(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    >
                      <option value="">Select saved scenario</option>
                      {filteredCustomScenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.category} - {scenario.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Scenario title</label>
                    <input
                      value={customScenarioTitle}
                      onChange={(e) => setCustomScenarioTitle(e.target.value)}
                      placeholder="Example: Executive offsite reset"
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Visibility</label>
                    <select
                      value={customScenarioVisibility}
                      onChange={(e) => setCustomScenarioVisibility(e.target.value === "shared" ? "shared" : "private")}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    >
                      <option value="private">Private (only me)</option>
                      <option value="shared">Shared with TeamSync users</option>
                    </select>
                  </div>
                </div>
                <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
                  <div>
                    <label className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Custom category</label>
                    <select
                      value={customScenarioCategory}
                      onChange={(e) => setCustomScenarioCategory(e.target.value as ScenarioTemplate["category"])}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                    >
                      <option value="Professional">Professional</option>
                      <option value="Family">Family</option>
                      <option value="Learning">Learning</option>
                      <option value="Executive">Executive</option>
                      <option value="Boardroom">Boardroom</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => void saveCustomScenario(false)}
                      className="rounded-full border border-[#1d4ed8] bg-[#1d4ed8] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1e40af]"
                    >
                      Save new
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveCustomScenario(true)}
                      className="rounded-full border border-[#1d4ed8] bg-white px-3 py-1 text-xs font-semibold text-[#1d4ed8] hover:bg-[#eff6ff]"
                    >
                      Update selected
                    </button>
                  </div>
                </div>
                <label className="mb-0.5 mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Scenario details</label>
                <textarea
                  value={customScenarioText}
                  onChange={(e) => setCustomScenarioText(e.target.value)}
                  placeholder="Describe the scenario, stakes, and what success looks like."
                  className="min-h-[92px] w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                />
                <p className="mt-0.5 text-xs text-[#64748b]">Private by default. Choose Shared only when this scenario should be reusable by others.</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScenarioAdvancedOpen((current) => !current)}
                className="ui-compact-pill"
              >
                {scenarioAdvancedOpen ? "Hide advanced settings" : "Show advanced settings"}
              </button>
            </div>
            {scenarioAdvancedOpen ? (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Pressure level: {pressureLevel}/5</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={pressureLevel}
                    onChange={(e) => setPressureLevel(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Desired outcome</label>
                  <input
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    placeholder="Example: clear ownership and faster decisions"
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>
            ) : null}
          </section>

          <section
            id="teamsync-run"
            className={`scroll-mt-56 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm md:scroll-mt-60 ${activeStep === "run" ? "" : "hidden"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Step 4: Run Simulation</h2>
                <p className="mt-0.5 text-xs text-[#64748b]">Generate behavior, risk, and next-step outputs.</p>
                {!canRunSimulation ? (
                  <p className="mt-1 text-xs font-medium text-[#b45309]">
                    {simulating ? "Simulation in progress..." : runBlockers.length > 0 ? `Before running: ${runBlockers.join(" | ")}` : "Complete setup before running."}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-emerald-700">Ready to run.</p>
                )}
              </div>
              <button
                type="button"
                onClick={runSimulation}
                disabled={!canRunSimulation}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition ${
                  !canRunSimulation
                    ? "cursor-not-allowed bg-[#94a3b8]"
                    : simulating
                      ? "bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#1e40af] shadow-[0_0_0_1px_rgba(59,130,246,0.2)] animate-pulse"
                      : "bg-[#1d4ed8] hover:bg-[#1e40af]"
                }`}
                >
                {simulating ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
                    Running simulation...
                  </>
                ) : (
                  "Run simulation"
                )}
              </button>
            </div>
            <p className="mt-0.5 text-xs text-[#475569]">Profile balance preview before you run.</p>

            <div className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-1.5">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[#cfe0f7] bg-white px-2 py-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Executor</div>
                  <div className="text-base font-semibold text-[#0f172a]">{teamScores.executor}</div>
                </div>
                <div className="rounded-lg border border-[#cfe0f7] bg-white px-2 py-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Relationship</div>
                  <div className="text-base font-semibold text-[#0f172a]">{teamScores.relationship}</div>
                </div>
                <div className="rounded-lg border border-[#cfe0f7] bg-white px-2 py-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Strategy</div>
                  <div className="text-base font-semibold text-[#0f172a]">{teamScores.strategy}</div>
                </div>
                <div className="rounded-lg border border-[#cfe0f7] bg-white px-2 py-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Influence</div>
                  <div className="text-base font-semibold text-[#0f172a]">{teamScores.influence}</div>
                </div>
              </div>
            </div>
          </section>

          <section
            id="teamsync-insights"
            className={`scroll-mt-56 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm md:scroll-mt-60 ${activeStep === "insights" ? "" : "hidden"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Step 5: Insights</h2>
                <p className="mt-0.5 text-xs text-[#64748b]">Review priorities, scripts, and share-ready outputs.</p>
              </div>
              <div className="ui-action-row">
                <button
                  type="button"
                  onClick={() => setShowAdvancedInsights((current) => !current)}
                  className="ui-compact-pill"
                >
                  {showAdvancedInsights ? "Hide advanced" : "Show advanced"}
                </button>
                {showAdvancedInsights ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setInsightsPanelsOpen(true)}
                      className="ui-compact-pill"
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      onClick={() => setInsightsPanelsOpen(false)}
                      className="ui-compact-pill"
                    >
                      Collapse all
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {latestRun ? (
              <div ref={insightsPanelsRef} className="mt-2 grid gap-2">
                <div className="rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                    Latest run · {latestRun.scenarioCategory} · Pressure {latestRun.pressureLevel}/5
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">{latestRun.scenarioTitle}</div>
                  <p className="mt-1 text-sm text-[#334155]">{latestRun.groupSummary}</p>
                  <p className="mt-2 text-xs text-[#475569]">{latestRun.semanticLens}</p>
                  {latestRun.companyUrl || latestRun.companyContextSummary ? (
                    <div className="mt-2 rounded-lg border border-[#bfdbfe] bg-white px-2.5 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e3a8a]">Company context overlay</div>
                      {latestRun.companyUrl ? (
                        <p className="mt-0.5 text-xs text-[#334155]">
                          URL:{" "}
                          <a className="text-[#1d4ed8] underline-offset-2 hover:underline" href={latestRun.companyUrl} target="_blank" rel="noreferrer">
                            {latestRun.companyUrl}
                          </a>
                          {latestRun.companyContextInfluence ? ` | Influence: ${latestRun.companyContextInfluence.toUpperCase()}` : ""}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-[#334155]">{latestRun.companyContextSummary || "No company context summary available for this run."}</p>
                    </div>
                  ) : null}
                  <div className="ui-action-row mt-2">
                    <button
                      type="button"
                      onClick={() => startFollowUpPulse(24)}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      Pulse in 24h
                    </button>
                    <button
                      type="button"
                      onClick={() => startFollowUpPulse(168)}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      Pulse in 7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPulseInvite(24)}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      24h invite
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPulseInvite(168)}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      7-day invite
                    </button>
                  </div>
                </div>

                {riskStrip.length > 0 ? (
                  <div className="rounded-lg border border-[#d8e4f2] bg-white p-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Executive signal strip</div>
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-4">
                      {riskStrip.map((signal) => (
                        <div
                          key={signal.key}
                          className={`rounded-lg border px-2 py-1.5 ${
                            signal.status === "red"
                              ? "border-rose-200 bg-rose-50 text-rose-900"
                              : signal.status === "amber"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-emerald-200 bg-emerald-50 text-emerald-900"
                          }`}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{signal.label}</div>
                          <div className="mt-0.5 text-sm font-semibold">{signal.status.toUpperCase()}</div>
                          <p className="mt-0.5 text-[11px]">{signal.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {actionTimeline.length > 0 ? (
                  <div className="rounded-lg border border-[#d8e4f2] bg-white p-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Action timeline</div>
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
                      {actionTimeline.map((bucket) => (
                        <div key={bucket.horizon} className="rounded-lg border border-[#dbe4f2] bg-[#f8fbff] px-2 py-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#475569]">{bucket.horizon}</div>
                          {bucket.items.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {bucket.items.slice(0, 3).map((item, index) => (
                                <li key={`${bucket.horizon}-${index}`} className="text-xs text-[#0f172a]">
                                  {index + 1}. {item}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-[#64748b]">No actions queued in this window.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {runHealth ? (
                  <div className="rounded-lg border border-[#d8e4f2] bg-white p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Run health score</div>
                        <div className="mt-1 text-sm font-semibold text-[#0f172a]">{runHealth.label}</div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          runHealth.band === "strong"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : runHealth.band === "watch"
                              ? "border border-amber-200 bg-amber-50 text-amber-800"
                              : "border border-rose-200 bg-rose-50 text-rose-800"
                        }`}
                      >
                        Score {runHealth.score}/100
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#475569]">{runHealth.guidance}</p>
                  </div>
                ) : null}

                {nextBestActions.length > 0 ? (
                  <div className="rounded-lg border border-[#d8e4f2] bg-white p-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Next actions</div>
                    <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
                      {nextBestActions.map((action, index) => (
                        <div
                          key={`${action.title}-${index}`}
                          className={`rounded-lg border px-2.5 py-2 ${
                            action.tone === "high"
                              ? "border-rose-200 bg-rose-50 text-rose-900"
                              : action.tone === "medium"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-emerald-200 bg-emerald-50 text-emerald-900"
                          }`}
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                            {action.tone === "high" ? "Now" : action.tone === "medium" ? "Next" : "Steady"}
                          </div>
                          <div className="mt-1 text-sm font-semibold">{action.title}</div>
                          <p className="mt-1 text-xs">{action.detail}</p>
                          {action.action !== "none" ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => runNextBestAction(action.action)}
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f172a] hover:bg-neutral-50"
                              >
                                {action.action === "open_support"
                                  ? "Open support simulation"
                                  : action.action === "open_checklist"
                                    ? "Open checklist"
                                    : "24h pulse"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showAdvancedInsights ? (
                <>
                <ExpandableCard title="Support priority lane" subtitle="Top 3 priorities by urgency">
                  <div className="grid gap-2 md:grid-cols-3">
                    {priorityLane.map((item, index) => (
                      <div key={`${item.title}-${index}`} className={`rounded-lg border px-2.5 py-2 ${levelToneClass(item.level)}`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.1em]">{item.level} priority</div>
                        <div className="mt-1 text-sm font-semibold">{item.title}</div>
                        <p className="mt-1 text-xs">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </ExpandableCard>

                <ExpandableCard title="Run comparison" subtitle="Compare current run to a previous run">
                  {runHistory.length > 1 ? (
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Compare against</label>
                        <select
                          value={compareRunId}
                          onChange={(event) => setCompareRunId(event.target.value)}
                          className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                        >
                          {runHistory
                            .filter((run) => run.runId !== latestRun.runId)
                            .map((run) => (
                              <option key={`compare-${run.runId}`} value={run.runId}>
                                {run.scenarioTitle} ({relativeTime(run.timestamp)})
                              </option>
                            ))}
                        </select>
                      </div>

                      {compareRun && runComparison ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Pressure shift</div>
                            <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                              {runComparison.pressureDelta === 0
                                ? "No change"
                                : runComparison.pressureDelta > 0
                                  ? `+${runComparison.pressureDelta} (higher pressure)`
                                  : `${runComparison.pressureDelta} (lower pressure)`}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Current vs previous</div>
                            <p className="mt-1 text-xs text-[#334155]">
                              Current: {latestRun.scenarioTitle}
                              <br />
                              Previous: {compareRun.scenarioTitle}
                            </p>
                          </div>
                          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-800">New risks</div>
                            <p className="mt-1 text-xs text-rose-900">
                              {runComparison.newlyAddedRisks.slice(0, 2).join(" | ") || "No newly added risks."}
                            </p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800">Resolved risks</div>
                            <p className="mt-1 text-xs text-emerald-900">
                              {runComparison.resolvedRisks.slice(0, 2).join(" | ") || "No risks resolved yet."}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#d8e4f2] bg-white p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">New actions</div>
                            <p className="mt-1 text-xs text-[#334155]">{runComparison.newActions.slice(0, 2).join(" | ") || "No new actions."}</p>
                          </div>
                          <div className="rounded-lg border border-[#d8e4f2] bg-white p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Dropped actions</div>
                            <p className="mt-1 text-xs text-[#334155]">
                              {runComparison.droppedActions.slice(0, 2).join(" | ") || "No dropped actions."}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-[#64748b]">Run at least two simulations to compare.</p>
                  )}
                </ExpandableCard>
                </>
                ) : null}

                <ExpandableCard title="Who needs support first" subtitle="Member-level support scoring">
                  {latestRun.memberSupportPriorities.length > 0 ? (
                    <div className="mb-2 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Team signal map</div>
                      <svg viewBox="0 0 760 344" className="w-full rounded-md border border-[#dbe7f5] bg-gradient-to-b from-[#f8fbff] to-white">
                        <defs>
                          <linearGradient id="signalCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#dbeafe" />
                            <stop offset="100%" stopColor="#e0e7ff" />
                          </linearGradient>
                          <filter id="signalCardShadow" x="-40%" y="-40%" width="180%" height="180%">
                            <feDropShadow dx="0" dy="2" stdDeviation="2.4" floodColor="#0f172a" floodOpacity="0.14" />
                          </filter>
                        </defs>
                        <circle cx="380" cy="176" r="76" fill="url(#signalCenter)" stroke="#93c5fd" strokeWidth="2.2" filter="url(#signalCardShadow)" />
                        <text x="380" y="158" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e3a8a">
                          SCENARIO
                        </text>
                        <text x="380" y="174" textAnchor="middle" fontSize="12" fontWeight="600" fill="#0f172a">
                          {wrapTextForCard(latestRun.scenarioTitle, 24, 2).map((line, lineIndex) => (
                            <tspan key={`scenario-line-${lineIndex}`} x="380" dy={lineIndex === 0 ? 0 : 13}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                        <text x="380" y="203" textAnchor="middle" fontSize="10" fill="#334155">
                          Pressure {latestRun.pressureLevel}/5
                        </text>
                        {latestRun.memberSupportPriorities.slice(0, 5).map((item, index) => {
                          const slots = [
                            { x: 134, y: 66 },
                            { x: 626, y: 66 },
                            { x: 626, y: 258 },
                            { x: 134, y: 258 },
                            { x: 380, y: 294 },
                          ]
                          const slot = slots[index] ?? slots[0]
                          const tone = toneForLevel(item.level, item.score)
                          const moveLines = wrapTextForCard(item.supportMove, 28, 2)
                          return (
                            <g key={`signal-node-${item.memberId}-${index}`}>
                              <line
                                x1="380"
                                y1="176"
                                x2={slot.x}
                                y2={slot.y - 2}
                                stroke={tone.stroke}
                                strokeOpacity={tone.edgeOpacity}
                                strokeWidth={tone.edgeWidth}
                                strokeDasharray={tone.edgeDash}
                              />
                              <rect
                                x={slot.x - 112}
                                y={slot.y - 44}
                                width="224"
                                height="88"
                                rx="14"
                                fill={tone.fill}
                                stroke={tone.stroke}
                                strokeWidth="1.7"
                                filter="url(#signalCardShadow)"
                              />
                              <text x={slot.x - 100} y={slot.y - 20} fontSize="11" fontWeight="700" fill="#0f172a">
                                {truncateWords(item.memberName, 3)}
                              </text>
                              <text x={slot.x - 100} y={slot.y - 4} fontSize="10" fill={tone.text}>
                                {item.level.toUpperCase()} | Score {item.score}
                              </text>
                              <text x={slot.x - 100} y={slot.y + 14} fontSize="10" fill="#334155">
                                {moveLines.map((line, lineIndex) => (
                                  <tspan key={`support-line-${item.memberId}-${lineIndex}`} x={slot.x - 100} dy={lineIndex === 0 ? 0 : 12}>
                                    {line}
                                  </tspan>
                                ))}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                      <p className="mt-1 text-[11px] text-[#64748b]">
                        Visual map shows where support pressure sits right now and the first move for each member.
                      </p>
                    </div>
                  ) : null}
                  {latestRun.memberSupportPriorities.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {latestRun.memberSupportPriorities.map((item) => (
                        <div key={`${item.memberId}-${item.memberName}`} className={`rounded-lg border px-3 py-2 ${levelToneClass(item.level)}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold">{item.memberName}</div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em]">
                              {item.level} - Score {item.score}
                            </div>
                          </div>
                          <div className="mt-0.5 text-xs opacity-80">{item.role || "Role not set"}</div>
                          <p className="mt-1 text-xs">{item.rationale}</p>
                          <p className="mt-1 text-xs font-medium">Support move: {item.supportMove}</p>
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => startSupportConversation(item)}
                              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f172a] hover:bg-neutral-50"
                            >
                              Open simulator
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#64748b]">Run a scenario to generate member-level support priorities.</p>
                  )}
                </ExpandableCard>

                {showAdvancedInsights ? (
                <>
                <ExpandableCard title="Relational heatmap" subtitle="Pair-level trust and friction signals">
                  {pairInsights.length > 0 ? (
                    <div className="grid gap-2">
                      {pairInsights.map((pair) => (
                        <div key={pair.id} className={`rounded-lg border px-3 py-2 ${levelToneClass(pair.frictionRisk)}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold">{pair.aName} and {pair.bName}</div>
                            <div className="text-xs font-semibold uppercase tracking-[0.08em]">
                              Synergy {pair.synergyScore} / Friction {pair.frictionRisk}
                            </div>
                          </div>
                          <p className="mt-1 text-xs">{pair.summary}</p>
                          <p className="mt-1 text-xs font-medium">Best next move: {pair.coachingMove}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#64748b]">Load at least two members to generate pair insights.</p>
                  )}
                </ExpandableCard>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Likely behaviors</div>
                    <ul className="mt-2 space-y-1 text-sm text-[#0f172a]">
                      {latestRun.likelyBehaviors.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Role-by-role responses</div>
                    {latestRun.roleReactions.length > 0 ? (
                      <ExpandableCard title="Role-by-role details" subtitle={`${latestRun.roleReactions.length} role responses`}>
                        <ul className="space-y-2 text-sm text-[#0f172a]">
                          {latestRun.roleReactions.map((item, index) => (
                            <li key={`${item.audience}-${index}`} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#475569]">{item.audience}</div>
                              <p className="mt-1 text-sm text-[#0f172a]">{item.likelyResponse}</p>
                              <p className="mt-1 text-xs text-[#334155]">Support move: {item.supportAction}</p>
                            </li>
                          ))}
                        </ul>
                      </ExpandableCard>
                    ) : (
                      <p className="mt-2 text-sm text-[#64748b]">Run a simulation to generate role-specific responses.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Risk hotspots</div>
                    <ul className="mt-2 space-y-1 text-sm text-[#0f172a]">
                      {latestRun.risks.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Adjustments</div>
                    <ul className="mt-2 space-y-1 text-sm text-[#0f172a]">
                      {latestRun.adjustments.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Action plan</div>
                    <ul className="mt-2 space-y-1 text-sm text-[#0f172a]">
                      {latestRun.actions.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div id="teamsync-action-checklist">
                <ExpandableCard title="Action checklist" subtitle={`${checklistCompletedCount}/${checklistTotalCount} complete`} defaultOpen>
                  {latestRun.actionChecklist.length > 0 ? (
                    <div className="space-y-2">
                      <div className="ui-action-row">
                        <button
                          type="button"
                          onClick={() => autoAssignChecklistOwners(latestRun.runId)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Auto-assign owners
                        </button>
                        <button
                          type="button"
                          onClick={() => clearChecklistOwners(latestRun.runId)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Clear owners
                        </button>
                        <button
                          type="button"
                          onClick={() => autoAssignChecklistDueDates(latestRun.runId)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Auto-assign due dates
                        </button>
                        <button
                          type="button"
                          onClick={() => clearChecklistDueDates(latestRun.runId)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Clear due dates
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklistCompletion(latestRun.runId, true)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Mark all done
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklistCompletion(latestRun.runId, false)}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          Reset progress
                        </button>
                      </div>
                      {latestRun.actionChecklist.map((item) => (
                        <div key={item.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2">
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleChecklistItem(latestRun.runId, item.id)}
                              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#1d4ed8] focus:ring-[#1d4ed8]"
                            />
                            <span className={item.done ? "text-[#64748b] line-through" : "text-[#0f172a]"}>{item.label}</span>
                          </label>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Owner</label>
                              <select
                                value={item.owner}
                                onChange={(e) => updateChecklistItem(latestRun.runId, item.id, { owner: e.target.value })}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                              >
                                <option value="">Unassigned</option>
                                {members.map((member) => (
                                  <option key={`owner-${item.id}-${member.id}`} value={member.name}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Due date</label>
                              <input
                                type="date"
                                value={item.dueDate}
                                onChange={(e) => updateChecklistItem(latestRun.runId, item.id, { dueDate: e.target.value })}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#64748b]">No action checklist available for this run yet.</p>
                  )}
                </ExpandableCard>
                </div>

                <ExpandableCard title="Facilitation script" subtitle="Meeting-ready language">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#1e3a8a]">Opening lines</div>
                      <ul className="mt-1 space-y-1 text-xs text-[#1e3a8a]">
                        {facilitationScript.opening.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#92400e]">Key prompts</div>
                      <ul className="mt-1 space-y-1 text-xs text-[#92400e]">
                        {facilitationScript.prompts.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#166534]">Close + commitments</div>
                      <ul className="mt-1 space-y-1 text-xs text-[#166534]">
                        {facilitationScript.close.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </ExpandableCard>

                <ExpandableCard title="Share and integrations" subtitle="One-click handoff to collaboration tools">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        latestRun
                          ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                          : "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]"
                      }`}
                    >
                      {latestRun ? "Ready to share" : "Run a scenario first"}
                    </span>
                  </div>
                  <div className="ui-action-row">
                    <button
                      type="button"
                      onClick={() => void downloadRunDocx()}
                      disabled={!latestRun}
                      title="Download a polished Word report of the latest run."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Download report (.docx)
                    </button>
                    <button
                      type="button"
                      onClick={openPrintableReport}
                      disabled={!latestRun}
                      title="Open a print-friendly report you can save as PDF."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Print / Save PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendLatestRunToSlack()}
                      disabled={sendingToSlack}
                      title="Send the latest run summary to your Slack webhook."
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        sendingToSlack
                          ? "cursor-not-allowed border-[#94a3b8] bg-[#e2e8f0] text-[#475569]"
                          : "border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe]"
                      }`}
                    >
                      {sendingToSlack ? "Sending to Slack..." : "Send to Slack"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const run = getLatestRunForShare("copy a Slack update")
                        if (!run) return
                        void copyShareText(buildSlackUpdate(run, groupName), "Slack update")
                      }}
                      disabled={!latestRun}
                      title="Copy a Slack-ready summary to your clipboard."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Slack update
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const run = getLatestRunForShare("copy a Teams update")
                        if (!run) return
                        void copyShareText(buildTeamsUpdate(run, groupName), "Teams update")
                      }}
                      disabled={!latestRun}
                      title="Copy a Microsoft Teams-ready summary."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Teams update
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const run = getLatestRunForShare("copy an email brief")
                        if (!run) return
                        void copyShareText(buildEmailBrief(run, groupName), "Email brief")
                      }}
                      disabled={!latestRun}
                      title="Copy an email-ready brief with summary and actions."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Email brief
                    </button>
                    <button
                      type="button"
                      onClick={openEmailDraft}
                      disabled={!latestRun}
                      title="Open your default email app with a prefilled draft."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Email draft
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const run = getLatestRunForShare("copy a meeting agenda")
                        if (!run) return
                        void copyShareText(buildMeetingAgenda(run), "Meeting agenda")
                      }}
                      disabled={!latestRun}
                      title="Copy a facilitation agenda for your next sync."
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Meeting agenda
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#64748b]">
                    These formats are optimized for Slack, Teams chat, email, and Notion notes.
                  </p>
                </ExpandableCard>

                <div id="teamsync-conversation-simulator">
                <ExpandableCard title="Conversation simulator (Expert)" subtitle="Roleplay + coaching for difficult conversations">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Speaker</label>
                      <select
                        value={conversationFromMemberId}
                        onChange={(e) => setConversationFromMemberId(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="self">You (facilitator)</option>
                        {members.map((member) => (
                          <option key={`conversation-speaker-${member.id}`} value={member.id}>
                            {member.name} {member.role ? `- ${member.role}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Listener</label>
                      <select
                        value={selectedConversationToMember?.id ?? ""}
                        onChange={(e) => setConversationToMemberId(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                      >
                        {members.map((member) => (
                          <option key={`conversation-member-${member.id}`} value={member.id}>
                            {member.name} {member.role ? `- ${member.role}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-1.5 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2.5 py-1.5 text-xs text-[#334155]">
                    Simulation path: <span className="font-semibold">{selectedConversationFromMember?.name || "You"}</span> to{" "}
                    <span className="font-semibold">{selectedConversationToMember?.name || "selected member"}</span>
                  </div>
                  <div className="ui-action-row mt-2">
                    <button
                      type="button"
                      onClick={swapConversationDirection}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Swap direction
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConversationFromMemberId("self")
                        setConversationMessage("")
                        setConversationTone("clear")
                        setMessage("Reset speaker to You and cleared draft message.")
                      }}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Reset draft
                    </button>
                    <button
                      type="button"
                      onClick={focusHighestPriorityConversation}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Focus top priority
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConversationTurns([])
                        setMessage("Conversation history cleared.")
                      }}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                    >
                      Clear history
                    </button>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Quick templates</div>
                    <div className="ui-action-row">
                      {conversationTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setConversationTone(template.tone)
                            setConversationMessage(template.message)
                            setMessage(`Loaded ${template.label.toLowerCase()} template.`)
                          }}
                          className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                        >
                          {template.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Conversation goal</label>
                      <input
                        value={conversationGoal}
                        onChange={(e) => setConversationGoal(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Message direction</label>
                      <div className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-[#334155]">
                        {selectedConversationFromMember?.name || "You"} send the opening message. {selectedConversationToMember?.name || "Listener"} replies.
                      </div>
                    </div>
                  </div>
                  <div className="ui-action-row mt-2">
                    {([
                      { key: "clear", label: "Clear" },
                      { key: "warm", label: "Warm" },
                      { key: "de-escalate", label: "De-escalate" },
                    ] as Array<{ key: ConversationTone; label: string }>).map((tone) => (
                      <button
                        key={`tone-${tone.key}`}
                        type="button"
                        onClick={() => setConversationTone(tone.key)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          conversationTone === tone.key
                            ? "border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                            : "border border-neutral-300 bg-white text-[#334155] hover:bg-neutral-50"
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                      Opening message ({selectedConversationFromMember?.name || "You"} to {selectedConversationToMember?.name || "listener"})
                    </label>
                    <textarea
                      value={conversationMessage}
                      onChange={(e) => setConversationMessage(e.target.value)}
                      placeholder={`Write the message ${selectedConversationFromMember?.name || "you"} want to send to ${selectedConversationToMember?.name || "the listener"}...`}
                      className="min-h-[90px] w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={runConversationSimulation}
                      disabled={conversationLoading}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                        conversationLoading ? "cursor-not-allowed bg-[#94a3b8]" : "bg-[#1d4ed8] hover:bg-[#1e40af]"
                      }`}
                    >
                      {conversationLoading ? "Simulating..." : "Run conversation simulation"}
                    </button>
                  </div>
                  {conversationTurns.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Practice history ({conversationTurns.length})
                      </div>
                      {conversationTurns.map((turn, index) => (
                        <details key={turn.id} open={index === 0} className="rounded-lg border border-neutral-200 bg-[#fbfdff] px-2.5 py-2">
                          <summary className="cursor-pointer list-none">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                                {turn.speakerName} to {turn.listenerName}
                              </div>
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                                Safety {turn.safetyScore}/100
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-[#0f172a]">{turn.userMessage}</p>
                          </summary>

                          <div className="mt-2 border-t border-neutral-200 pt-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                              {turn.speakerName} message
                            </div>
                            <p className="mt-1 text-sm text-[#0f172a]">{turn.userMessage}</p>
                            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{turn.listenerName} likely reply</div>
                            <p className="mt-1 text-sm text-[#0f172a]">{turn.memberReply}</p>
                            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Coach feedback</div>
                            <div className="mt-1 text-xs text-[#334155]">
                              <div>Worked: {turn.whatWorked.join(" ") || "No highlights provided."}</div>
                              <div className="mt-1">Adjust: {turn.whatToAdjust.join(" ") || "No adjustments provided."}</div>
                              <div className="mt-1 font-medium text-[#0f172a]">Rewrite: {turn.improvedRewrite || "No rewrite provided."}</div>
                            </div>
                            <div className="ui-action-row mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setConversationMessage(turn.improvedRewrite || turn.userMessage)
                                  setMessage("Loaded coached rewrite into the message box. Edit if needed, then run again.")
                                }}
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                              >
                                Use rewrite
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConversationTone("clear")
                                  setConversationMessage(turn.improvedRewrite || turn.userMessage)
                                  setMessage("Loaded clear version. Run again to test.")
                                }}
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                              >
                                Use clear version
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConversationTone("warm")
                                  setConversationMessage(turn.improvedRewrite || turn.userMessage)
                                  setMessage("Loaded warm version. Run again to test.")
                                }}
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                              >
                                Use warm version
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConversationTone("de-escalate")
                                  setConversationMessage(turn.improvedRewrite || turn.userMessage)
                                  setMessage("Loaded de-escalation version. Run again to test.")
                                }}
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                              >
                                De-escalate version
                              </button>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </ExpandableCard>
                </div>
                </>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-neutral-300 px-2.5 py-2.5 text-sm text-[#64748b]">
                No run yet. Complete steps 2-4, then run your first TeamSync scenario.
              </div>
            )}
          </section>

          <section
            id="teamsync-history"
            className={`scroll-mt-56 rounded-2xl border border-neutral-200 bg-white p-2.5 shadow-sm md:scroll-mt-60 ${activeStep === "history" ? "" : "hidden"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Step 6: Saved Runs</h2>
                <p className="mt-0.5 text-[11px] text-[#64748b]">Search, compare, and reuse past runs.</p>
              </div>
              <div className="ui-action-row">
                <button
                  type="button"
                  onClick={() => setSavedRunsExpanded((prev) => !prev)}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                >
                  {savedRunsExpanded ? "Collapse" : "Expand"}
                </button>
                <button
                  type="button"
                  onClick={clearRunHistory}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                >
                  Clear run history
                </button>
                <button
                  type="button"
                  onClick={restoreDeletedRuns}
                  disabled={undoDeletedRuns.length === 0}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                    undoDeletedRuns.length === 0
                      ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                      : "border-neutral-300 bg-white hover:bg-neutral-50"
                  }`}
                >
                  Undo delete
                </button>
              </div>
            </div>

            {savedRunsExpanded ? (
              <>
                <details className="mt-1 rounded-lg border border-neutral-200 bg-[#fbfdff] px-2 py-1.5">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                    Filters and presets
                  </summary>
                  <div className="mt-1 grid gap-1.5 md:grid-cols-5">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Search runs</label>
                      <input
                        value={historySearch}
                        onChange={(event) => setHistorySearch(event.target.value)}
                        placeholder="Search by scenario, risk, or lens..."
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Category</label>
                      <select
                        value={historyCategoryFilter}
                        onChange={(event) => setHistoryCategoryFilter(event.target.value)}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px]"
                      >
                        <option value="all">All categories</option>
                        <option value="professional">Professional</option>
                        <option value="family">Family</option>
                        <option value="learning">Learning</option>
                        <option value="executive">Executive</option>
                        <option value="boardroom">Boardroom</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Sort</label>
                      <select
                        value={historySort}
                        onChange={(event) => setHistorySort(event.target.value as "newest" | "oldest")}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px]"
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Pressure</label>
                      <select
                        value={historyPressureFilter}
                        onChange={(event) => setHistoryPressureFilter(event.target.value as "all" | "low" | "medium" | "high")}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px]"
                      >
                        <option value="all">All levels</option>
                        <option value="low">Low (1-2)</option>
                        <option value="medium">Medium (3)</option>
                        <option value="high">High (4-5)</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHistoryFavoritesOnly((prev) => !prev)}
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                        historyFavoritesOnly
                          ? "border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                          : "border-neutral-300 bg-white text-[#334155] hover:bg-neutral-50"
                      }`}
                    >
                      {historyFavoritesOnly ? "Favorites only on" : "Show favorites only"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryWithNotesOnly((prev) => !prev)}
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                        historyWithNotesOnly
                          ? "border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                          : "border-neutral-300 bg-white text-[#334155] hover:bg-neutral-50"
                      }`}
                    >
                      {historyWithNotesOnly ? "With notes only on" : "Show with notes only"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryNeedsReviewOnly((prev) => !prev)}
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                        historyNeedsReviewOnly
                          ? "border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]"
                          : "border-neutral-300 bg-white text-[#334155] hover:bg-neutral-50"
                      }`}
                    >
                      {historyNeedsReviewOnly ? "Needs review only on" : "Show needs review only"}
                    </button>
                  </div>
                </details>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2 py-1.5">
                  <div className="text-[11px] text-[#334155]">
                    Showing <span className="font-semibold">{filteredRunHistory.length}</span> of{" "}
                    <span className="font-semibold">{runHistory.length}</span> runs
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={exportFilteredRunsCsv}
                      className="ui-compact-pill"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportFilteredRunsDocx()}
                      className="ui-compact-pill"
                    >
                      Export Word
                    </button>
                    <button
                      type="button"
                      onClick={openPrintableFilteredRunsReport}
                      className="ui-compact-pill"
                    >
                      Export PDF
                    </button>
                    <button
                      type="button"
                      onClick={deleteFilteredRuns}
                      className="ui-compact-pill border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      Delete filtered
                    </button>
                    <button
                      type="button"
                      onClick={resetHistoryFilters}
                      className="ui-compact-pill"
                    >
                      Reset filters
                    </button>
                  </div>
                </div>
                <div className="mt-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-[#475569]">
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">Total {historyQuickStats.total}</span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">Fav {historyQuickStats.favorites}</span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">High {historyQuickStats.highPressure}</span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">Notes {historyQuickStats.withNotes}</span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">Rev {historyQuickStats.reviewed}</span>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">Need {historyQuickStats.needsReview}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyHistoryPreset("favorites")}
                        className="ui-compact-pill"
                      >
                        Favorites
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHistoryPreset("highPressure")}
                        className="ui-compact-pill"
                      >
                        High pressure
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHistoryPreset("recent")}
                        className="ui-compact-pill"
                      >
                        Most recent
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHistoryPreset("withNotes")}
                        className="ui-compact-pill"
                      >
                        With notes
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHistoryPreset("needsReview")}
                        className="ui-compact-pill"
                      >
                        Needs review
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 grid gap-1.5">
                  {filteredRunHistory.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-2.5 text-sm text-[#64748b]">
                      {runHistory.length === 0 ? "Run history is empty." : "No runs match your current filters."}
                    </div>
                  ) : (
                    filteredRunHistory.map((run) => (
                      <div key={run.runId} className="rounded-lg border border-neutral-200 bg-[#fbfdff] px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLatestRun(run)
                            setMessage(`Loaded run: ${run.scenarioTitle}`)
                            openStep("insights", "#teamsync-insights")
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {run.isFavorite ? "★ " : ""}
                              {run.scenarioTitle}
                              {run.reviewed ? " ✓" : ""}
                            </div>
                            <div className="text-xs text-[#64748b]">{relativeTime(run.timestamp)}</div>
                          </div>
                          <div className="mt-1 text-xs text-[#64748b]">
                            {run.scenarioCategory} · Pressure {run.pressureLevel}/5
                          </div>
                        </button>
                        <div className="ui-action-row mt-1.5">
                          <button
                            type="button"
                            onClick={() => reuseRunScenario(run)}
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                          >
                            Reuse this scenario
                          </button>
                          <button
                            type="button"
                            onClick={() => compareRunWithLatest(run)}
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                          >
                            Compare with latest
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateRun(run.runId)}
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                          >
                            Duplicate run
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRunReviewed(run.runId)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                              run.reviewed
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border-neutral-300 bg-white hover:bg-neutral-50"
                            }`}
                          >
                            {run.reviewed ? "Reviewed" : "Mark reviewed"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleRunFavorite(run.runId)}
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                          >
                            {run.isFavorite ? "Unfavorite" : "Favorite"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRun(run.runId)}
                            className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Delete run
                          </button>
                        </div>
                        <details className="mt-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                            Notes and detail
                          </summary>
                          <div className="mt-1.5 grid gap-1.5 text-xs text-[#475569] md:grid-cols-2">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Top risk</div>
                              <p className="mt-0.5">{run.risks[0] || "No major risk listed."}</p>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Top action</div>
                              <p className="mt-0.5">{run.actions[0] || "No action listed."}</p>
                            </div>
                          </div>
                          <div className="mt-1.5">
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Notes</label>
                            <textarea
                              defaultValue={run.notes || ""}
                              onBlur={(event) => saveRunNotes(run.runId, event.target.value)}
                              placeholder="Add context, decisions, or follow-up notes for this run..."
                              className="min-h-[56px] w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                            />
                          </div>
                        </details>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-[#64748b]">Saved runs are collapsed. Click Expand to view history.</p>
            )}
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <ExpandableCard
              title="Useful resources"
              subtitle={resourcesLoading ? "Searching online..." : onlineResources.length > 0 ? "Live web results (top 5)" : "Context fallback links"}
            >
            {resourcesError ? <p className="text-xs text-amber-700">{resourcesError}</p> : null}
            <div className="mt-1 grid gap-2 md:grid-cols-2">
              {displayedResources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-neutral-200 bg-[#fbfdff] px-2.5 py-2.5 hover:bg-[#f4f9ff]"
                >
                  <div className="text-sm font-semibold text-[#0f172a]">{resource.title}</div>
                  <div className="mt-1 break-all text-xs text-[#1d4ed8]">{resource.href}</div>
                  <p className="mt-1 text-xs text-[#475569]">{resource.reason}</p>
                  <div className="mt-2 text-xs font-medium text-[#1d4ed8]">Open resource</div>
                </a>
              ))}
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Comparable scenario examples</div>
              <p className="mt-0.5 text-xs text-[#475569]">Examples of organizations or people in similar situations.</p>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                {displayedExamples.map((example) => (
                  <a
                    key={example.id}
                    href={example.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-neutral-200 bg-[#fbfdff] px-3 py-2 hover:bg-[#f4f9ff]"
                  >
                    <div className="text-sm font-semibold text-[#0f172a]">{example.title}</div>
                    <div className="mt-1 break-all text-xs text-[#1d4ed8]">{example.href}</div>
                    <p className="mt-1 text-xs text-[#475569]">{example.note}</p>
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">TeamSync executive materials</div>
              <p className="mt-0.5 text-xs text-[#475569]">Additional board-ready context and architecture references.</p>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <a
                  href={TEAMSYNC_EXECUTIVE_BRIEF_PDF}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-neutral-200 bg-[#fbfdff] px-3 py-2 hover:bg-[#f4f9ff]"
                >
                  <div className="text-sm font-semibold text-[#0f172a]">TeamSync Executive Intelligence Brief</div>
                  <div className="mt-1 break-all text-xs text-[#1d4ed8]">{TEAMSYNC_EXECUTIVE_BRIEF_PDF}</div>
                  <p className="mt-1 text-xs text-[#475569]">Comprehensive briefing: architecture, strategic use-cases, and stakeholder value.</p>
                </a>
                <a
                  href={TEAMSYNC_EXECUTIVE_DECK_PDF}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-neutral-200 bg-[#fbfdff] px-3 py-2 hover:bg-[#f4f9ff]"
                >
                  <div className="text-sm font-semibold text-[#0f172a]">TeamSync Executive Deck</div>
                  <div className="mt-1 break-all text-xs text-[#1d4ed8]">{TEAMSYNC_EXECUTIVE_DECK_PDF}</div>
                  <p className="mt-1 text-xs text-[#475569]">Presentation-ready deck for leadership and board conversations.</p>
                </a>
              </div>
              <a
                href={TEAMSYNC_EXECUTIVE_VISUAL_IMAGE}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block rounded-lg border border-neutral-200 bg-[#fbfdff] p-2 hover:bg-[#f4f9ff]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-[#475569]">Executive visual explainer</div>
                <Image
                  src={TEAMSYNC_EXECUTIVE_VISUAL_IMAGE}
                  alt="TeamSync executive intelligence visual"
                  width={1365}
                  height={768}
                  className="mt-1 h-auto w-full rounded-md border border-[#dbe4f2] bg-white"
                />
              </a>
            </div>
            </ExpandableCard>
          </section>
        </div>
      </div>
      {isReportIssueOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/35 px-4"
          onClick={() => setIsReportIssueOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Report an issue"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Report issue</div>
                <h3 className="mt-1 text-base font-semibold text-neutral-900">Tell us what is blocking you</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(false)}
                className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Type
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-800"
                >
                  <option>Workflow confusion</option>
                  <option>Button or link not working</option>
                  <option>Missing saved run</option>
                  <option>Simulation result issue</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Contact email
                <input
                  value={issueContactEmail}
                  onChange={(event) => setIssueContactEmail(event.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-800"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
              What happened?
              <textarea
                value={issueDetail}
                onChange={(event) => setIssueDetail(event.target.value)}
                rows={4}
                placeholder="Example: I added members and the run still used old data."
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal normal-case text-neutral-800"
              />
            </label>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(false)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitIssueReport()}
                className="rounded-full bg-[#0a66c2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#004182]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div
        className={`pointer-events-none fixed bottom-4 left-4 z-40 transition-all duration-200 ${
          showFloatingWizardCta ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => openStep(nextAction.stepKey, nextAction.href)}
          className="pointer-events-auto rounded-full border border-[#0a66c2]/40 bg-white/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] shadow-sm backdrop-blur hover:bg-[#eef6ff]"
        >
          Resume wizard
        </button>
      </div>
    </main>
  )
}
