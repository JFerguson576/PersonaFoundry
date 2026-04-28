"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import type { Edge, Node } from "@xyflow/react"
import clsx from "clsx"

type VisualMember = {
  id: string
  name: string
  role: string
  strengths: string
}

type VisualRun = {
  runId: string
  scenarioTitle: string
  scenarioCategory: string
  pressureLevel: number
  groupSummary: string
  semanticLens: string
  likelyBehaviors: string[]
  risks: string[]
  actions: string[]
  memberSupportPriorities: Array<{
    memberId: string
    memberName: string
    role: string
    score: number
    level: "high" | "medium" | "low"
    rationale: string
    supportMove: string
  }>
}

type HeatCell = {
  personId: string
  personName: string
  dimension: string
  score: number
  watch: boolean
  summary: string
  action: string
}

type FlowLink = {
  source: string
  target: string
  sourceName: string
  targetName: string
  value: number
  flowType: "communication" | "influence" | "support" | "conflict" | "execution"
  explanation: string
}

type GraphPoint = {
  id: string
  label: string
  type: "scenario" | "person" | "risk" | "action"
  summary: string
}

type VisualView = "cockpit" | "heatmap" | "energy" | "graph"

type CockpitHotspot = {
  id: string
  cell: HeatCell
  x: number
  y: number
  rx: number
  ry: number
  zone: string
  meaning: string
  tone: "emerald" | "cyan" | "amber" | "rose" | "violet"
}

type CockpitNode = {
  id: string
  label: string
  x: number
  y: number
  type: "scenario" | "person" | "risk" | "action"
  tone: "emerald" | "cyan" | "amber" | "rose" | "violet"
}

type CockpitEdge = {
  id: string
  source: CockpitNode
  target: CockpitNode
  tone: CockpitNode["tone"]
  strength: number
}

type TeamRoleName = "Stabiliser" | "Accelerator" | "Translator" | "Challenger" | "Owner" | "Risk Carrier"

const ReactFlowCanvas = dynamic(
  async () => {
    const { Background, Controls, ReactFlow } = await import("@xyflow/react")

    return function TeamSyncFlowCanvas({ nodes, edges, onNodeSelect }: { nodes: Node[]; edges: Edge[]; onNodeSelect: (id: string) => void }) {
      return (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => onNodeSelect(node.id)}
        >
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      )
    }
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-lg border border-[#d8e4f2] bg-[#f8fbff] text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
        Loading graph
      </div>
    ),
  }
)

const dimensions = [
  {
    label: "Decision speed",
    watch: false,
    strengths: ["activator", "command", "focus", "strategic", "self-assurance"],
    terms: ["delay", "commitment", "decision"],
    action: "Use this person to clarify the first decision and reduce drift.",
  },
  {
    label: "Communication clarity",
    watch: false,
    strengths: ["communication", "relator", "harmony", "empathy", "context"],
    terms: ["listening", "tone", "alignment"],
    action: "Ask this person to translate the message into plain working language.",
  },
  {
    label: "Conflict risk",
    watch: true,
    strengths: ["command", "competition", "significance", "self-assurance"],
    terms: ["conflict", "blunt", "dominant", "overshadow"],
    action: "Set debate rules before the meeting moves into problem solving.",
  },
  {
    label: "Strategic alignment",
    watch: false,
    strengths: ["strategic", "analytical", "futuristic", "context", "ideation"],
    terms: ["strategy", "options", "pattern", "ambiguity"],
    action: "Use this person to frame options, trade-offs, and second-order effects.",
  },
  {
    label: "Execution reliability",
    watch: false,
    strengths: ["achiever", "discipline", "responsibility", "arranger", "focus"],
    terms: ["handoff", "ownership", "execution", "follow-up"],
    action: "Give this person a defined owner role and a visible deadline.",
  },
  {
    label: "Emotional load",
    watch: true,
    strengths: ["empathy", "harmony", "developer", "connectedness", "relator"],
    terms: ["trust", "emotion", "support", "relationship"],
    action: "Protect recovery space and avoid making this person the default absorber.",
  },
  {
    label: "Creativity contribution",
    watch: false,
    strengths: ["ideation", "futuristic", "strategic", "input", "learner"],
    terms: ["creative", "innovation", "options", "reset"],
    action: "Invite divergent options before narrowing the plan.",
  },
  {
    label: "Bottleneck risk",
    watch: true,
    strengths: ["responsibility", "focus", "achiever", "command", "analytical"],
    terms: ["overload", "bottleneck", "dependency", "pressure"],
    action: "Split ownership so this person is not carrying the whole system.",
  },
]

const domainStrengths = {
  execution: ["achiever", "discipline", "focus", "responsibility", "consistency", "arranger", "deliberative", "restorative"],
  relationship: ["relator", "harmony", "empathy", "includer", "connectedness", "developer", "positivity", "adaptability"],
  strategy: ["strategic", "analytical", "context", "ideation", "intellection", "learner", "futuristic", "input"],
  influence: ["command", "communication", "maximizer", "self-assurance", "competition", "woo", "significance", "activator"],
}

const gallupThemeOrder = [
  "achiever",
  "activator",
  "adaptability",
  "analytical",
  "arranger",
  "belief",
  "command",
  "communication",
  "competition",
  "connectedness",
  "consistency",
  "context",
  "deliberative",
  "developer",
  "discipline",
  "empathy",
  "focus",
  "futuristic",
  "harmony",
  "ideation",
  "includer",
  "input",
  "intellection",
  "learner",
  "maximizer",
  "positivity",
  "relator",
  "responsibility",
  "restorative",
  "self-assurance",
  "significance",
  "strategic",
  "woo",
]

const cockpitStoryZones = [
  { label: "Decision room", detail: "speed, message clarity, debate rules", x: 100, y: 82, width: 510, height: 96 },
  { label: "Trust climate", detail: "emotion, conflict, recovery load", x: 98, y: 210, width: 210, height: 58 },
  { label: "Execution path", detail: "ownership, handoffs, bottlenecks", x: 330, y: 210, width: 220, height: 58 },
  { label: "Option space", detail: "creative range and strategic choices", x: 585, y: 210, width: 118, height: 58 },
]

function clamp(value: number, min = 12, max = 96) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function hashText(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function parseStrengths(value: string) {
  const normalized = value.toLowerCase()
  const explicitList = normalized
    .split(/[,/\n|]+/)
    .map((item) => item.trim().replace(/^\d+[.)\s-]+/, ""))
    .filter(Boolean)
    .map((item) => gallupThemeOrder.find((theme) => item === theme || item.includes(theme)))
    .filter((item): item is string => Boolean(item))

  const rankedFromList = dedupe(explicitList)
  if (rankedFromList.length > 0) return rankedFromList.slice(0, 10)

  return gallupThemeOrder
    .map((theme) => ({ theme, index: normalized.indexOf(theme) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.theme)
    .slice(0, 10)
}

function dedupe(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function countMatches(source: string[], targets: string[]) {
  return source.filter((item) => targets.some((target) => item.includes(target))).length
}

function rankedStrengthFit(source: string[], targets: string[]) {
  const rankWeights = [22, 18, 15, 12, 9, 7, 5, 4, 3, 2]
  return source.reduce((total, item, index) => {
    const matches = targets.some((target) => item === target || item.includes(target) || target.includes(item))
    return matches ? total + (rankWeights[index] ?? 1) : total
  }, 0)
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`
}

function formatGraphDetailText(value: string) {
  const clean = value.replace(/\s+/g, " ").trim()
  if (!clean) return ["No detail available yet."]

  return clean
    .replace(/\s+(Source label:)/g, "\n$1")
    .replace(/\s+(Privacy handling:)/g, "\n$1")
    .replace(/\s+(Redaction summary:)/g, "\n$1")
    .replace(/\s+(Planning instruction:)/g, "\n$1")
    .replace(/\s+(Strategic themes:)/g, "\n$1")
    .replace(/\s+(Anonymised source notes:)/g, "\n$1")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function shortSignalLabel(value: string, prefix: "Risk" | "Action", max = 34) {
  const clean = value.replace(/\s+/g, " ").replace(/[.:;]+$/, "").trim()
  if (!clean) return prefix
  return `${prefix}: ${truncate(clean, max)}`
}

function labelLines(value: string, maxLineLength = 13, maxLines = 2) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []

  words.forEach((word) => {
    const current = lines[lines.length - 1] || ""
    if (!current) {
      lines.push(word)
    } else if (`${current} ${word}`.length <= maxLineLength) {
      lines[lines.length - 1] = `${current} ${word}`
    } else if (lines.length < maxLines) {
      lines.push(word)
    }
  })

  if (lines.length > maxLines) lines.length = maxLines
  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length
  if (usedWords < words.length && lines.length > 0) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], Math.max(5, maxLineLength - 1))
  }
  return lines.length > 0 ? lines : [truncate(value, maxLineLength)]
}

function average(values: number[], fallback = 0) {
  if (values.length === 0) return fallback
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}

function supportFor(member: VisualMember, run: VisualRun) {
  return run.memberSupportPriorities.find((item) => item.memberId === member.id || item.memberName === member.name)
}

function buildHeatCells(members: VisualMember[], run: VisualRun) {
  const riskText = `${run.risks.join(" ")} ${run.groupSummary} ${run.semanticLens}`.toLowerCase()

  return members.slice(0, 8).flatMap((member) => {
    const strengths = parseStrengths(member.strengths)
    const supportScore = supportFor(member, run)?.score ?? 44

    return dimensions.map((dimension) => {
      const strengthFit = rankedStrengthFit(strengths, dimension.strengths)
      const scenarioFit = dimension.terms.filter((term) => riskText.includes(term)).length * 7
      const pressure = run.pressureLevel * (dimension.watch ? 5 : 2)
      const variation = (hashText(`${run.runId}-${member.id}-${dimension.label}`) % 17) - 8
      const score = clamp(
        dimension.watch
          ? 24 + strengthFit * 0.72 + scenarioFit + pressure + supportScore / 12 + variation
          : 34 + strengthFit + scenarioFit + pressure - supportScore / 16 + variation,
        18,
        94
      )

      return {
        personId: member.id,
        personName: member.name || "Member",
        dimension: dimension.label,
        score,
        watch: dimension.watch,
        summary: dimension.watch
          ? `${dimension.label} is a watch signal for ${member.name || "this member"} under pressure ${run.pressureLevel}/5.`
          : `${dimension.label} is a likely contribution area for ${member.name || "this member"} under pressure ${run.pressureLevel}/5.`,
        action: dimension.action,
      }
    })
  })
}

function heatClass(cell: HeatCell) {
  if (cell.watch) {
    if (cell.score >= 76) return "border-rose-300 bg-rose-500 text-white"
    if (cell.score >= 58) return "border-amber-300 bg-amber-200 text-amber-950"
    return "border-emerald-300 bg-emerald-100 text-emerald-900"
  }
  if (cell.score >= 76) return "border-emerald-400 bg-emerald-600 text-white"
  if (cell.score >= 58) return "border-sky-300 bg-sky-100 text-sky-950"
  return "border-amber-300 bg-amber-100 text-amber-950"
}

function flowTypeForPair(sourceStrengths: string[], targetStrengths: string[], run: VisualRun): FlowLink["flowType"] {
  const text = `${run.risks.join(" ")} ${run.semanticLens}`.toLowerCase()
  const execution = countMatches(sourceStrengths, domainStrengths.execution) + countMatches(targetStrengths, domainStrengths.execution)
  const relationship = countMatches(sourceStrengths, domainStrengths.relationship) + countMatches(targetStrengths, domainStrengths.relationship)
  const strategy = countMatches(sourceStrengths, domainStrengths.strategy) + countMatches(targetStrengths, domainStrengths.strategy)
  const influence = countMatches(sourceStrengths, domainStrengths.influence) + countMatches(targetStrengths, domainStrengths.influence)

  if (text.includes("dominant") || text.includes("conflict") || text.includes("blunt")) return "conflict"
  if (relationship >= Math.max(execution, strategy, influence)) return "support"
  if (influence >= Math.max(execution, strategy)) return "influence"
  if (execution >= strategy) return "execution"
  return "communication"
}

function buildFlowLinks(members: VisualMember[], run: VisualRun) {
  const visibleMembers = members.slice(0, 6)
  const links: FlowLink[] = []

  visibleMembers.forEach((source, sourceIndex) => {
    visibleMembers.slice(sourceIndex + 1).forEach((target, offsetIndex) => {
      const sourceStrengths = parseStrengths(source.strengths)
      const targetStrengths = parseStrengths(target.strengths)
      const overlap = sourceStrengths.filter((item) => targetStrengths.includes(item)).length
      const flowType = flowTypeForPair(sourceStrengths, targetStrengths, run)
      const sourceSupport = supportFor(source, run)?.score ?? 44
      const targetSupport = supportFor(target, run)?.score ?? 44
      const value = clamp(32 + overlap * 8 + run.pressureLevel * 5 + Math.abs(sourceSupport - targetSupport) / 4 + (hashText(`${source.id}-${target.id}-${offsetIndex}`) % 12), 16, 92)
      const supportReversed = flowType === "support" && targetSupport > sourceSupport

      links.push({
        source: supportReversed ? target.id : source.id,
        target: supportReversed ? source.id : target.id,
        sourceName: supportReversed ? target.name : source.name,
        targetName: supportReversed ? source.name : target.name,
        value,
        flowType,
        explanation: `${source.name || "Member"} and ${target.name || "Member"} show a ${flowType} flow under this scenario.`,
      })
    })
  })

  return links.sort((a, b) => b.value - a.value).slice(0, 8)
}

function flowClass(type: FlowLink["flowType"]) {
  if (type === "conflict") return "border-rose-200 bg-rose-50 text-rose-900"
  if (type === "support") return "border-emerald-200 bg-emerald-50 text-emerald-900"
  if (type === "influence") return "border-violet-200 bg-violet-50 text-violet-900"
  if (type === "execution") return "border-sky-200 bg-sky-50 text-sky-900"
  return "border-cyan-200 bg-cyan-50 text-cyan-900"
}

function flowStroke(type: FlowLink["flowType"]) {
  if (type === "conflict") return "#fb7185"
  if (type === "support") return "#10b981"
  if (type === "influence") return "#8b5cf6"
  if (type === "execution") return "#0ea5e9"
  return "#06b6d4"
}

function flowText(type: FlowLink["flowType"]) {
  if (type === "conflict") return "Tension"
  if (type === "support") return "Support"
  if (type === "influence") return "Influence"
  if (type === "execution") return "Execution"
  return "Communication"
}

function buildGraphPoints(members: VisualMember[], run: VisualRun) {
  const points: GraphPoint[] = [
    {
      id: "scenario",
      label: run.scenarioTitle,
      type: "scenario",
      summary: run.groupSummary || "Scenario output.",
    },
    ...members.slice(0, 5).map((member) => ({
      id: `person-${member.id}`,
      label: member.name || "Member",
      type: "person" as const,
      summary: `${member.role || "Role not set"} | ${parseStrengths(member.strengths).slice(0, 5).join(", ") || "Strengths not set"}`,
    })),
    ...run.risks.slice(0, 3).map((risk, index) => ({
      id: `risk-${index}`,
      label: shortSignalLabel(risk, "Risk", 38),
      type: "risk" as const,
      summary: risk,
    })),
    ...run.actions.slice(0, 3).map((action, index) => ({
      id: `action-${index}`,
      label: shortSignalLabel(action, "Action", 38),
      type: "action" as const,
      summary: action,
    })),
  ]

  return points
}

function graphStyles(type: GraphPoint["type"]) {
  if (type === "scenario") return { background: "#111827", color: "#ffffff", border: "1px solid #111827" }
  if (type === "risk") return { background: "#fff1f2", color: "#881337", border: "1px solid #fb7185" }
  if (type === "action") return { background: "#ecfdf5", color: "#064e3b", border: "1px solid #34d399" }
  return { background: "#eff6ff", color: "#1e3a8a", border: "1px solid #60a5fa" }
}

function graphNodeLabel(point: GraphPoint) {
  const fullText = point.summary || point.label
  const displayText = point.type === "person" ? truncate(point.label, 32) : truncate(point.label, 76)
  const typeLabel = point.type === "person" ? "" : titleCase(point.type)

  return (
    <div title={fullText} className="leading-tight">
      {typeLabel ? <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] opacity-70">{typeLabel}</div> : null}
      <div>{displayText}</div>
    </div>
  )
}

function graphDetailAction(point: GraphPoint) {
  if (point.type === "risk") return "Use this as a watch point before the next group conversation."
  if (point.type === "action") return "Turn this into an owner, deadline, and first follow-up."
  if (point.type === "person") return "Use this person according to their visible strengths and support needs."
  return "Read connected risks and actions around this scenario before deciding the next move."
}

type EvidenceTag = "strengths" | "pressure" | "run" | "support" | "relationship" | "signal"

function EvidenceTags({ tags }: { tags: EvidenceTag[] }) {
  const labels: Record<EvidenceTag, string> = {
    strengths: "Strengths evidence",
    pressure: "Scenario pressure",
    run: "Run output",
    support: "Support score",
    relationship: "Pair signal",
    signal: "Signal map",
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-100">
          {labels[tag]}
        </span>
      ))}
    </div>
  )
}

function buildFlowGraph(points: GraphPoint[]) {
  const centerX = 360
  const centerY = 220
  const nodes: Node[] = points.map((point, index) => {
    const isScenario = point.id === "scenario"
    const ringIndex = Math.max(index - 1, 0)
    const angle = (-150 + ringIndex * (300 / Math.max(points.length - 2, 1))) * (Math.PI / 180)
    const x = isScenario ? centerX : centerX + Math.cos(angle) * 310
    const y = isScenario ? centerY : centerY + Math.sin(angle) * 170

    return {
      id: point.id,
      position: { x, y },
      data: { label: graphNodeLabel(point) },
      draggable: false,
      style: {
        ...graphStyles(point.type),
        borderRadius: 14,
        fontSize: point.type === "person" ? 11 : 10.5,
        fontWeight: 700,
        lineHeight: 1.25,
        minHeight: point.type === "person" ? 46 : 64,
        padding: point.type === "person" ? 10 : 12,
        whiteSpace: "normal",
        width: point.type === "person" ? 190 : 220,
        textAlign: "center",
      },
    }
  })

  const edges: Edge[] = points
    .filter((point) => point.id !== "scenario")
    .map((point) => ({
      id: `scenario-${point.id}`,
      source: point.type === "risk" ? point.id : "scenario",
      target: point.type === "risk" ? "scenario" : point.id,
      animated: point.type === "risk" || point.type === "action",
      label: point.type === "risk" ? "amplifies" : point.type === "action" ? "recommends" : "connects",
      style: { stroke: point.type === "risk" ? "#fb7185" : point.type === "action" ? "#10b981" : "#60a5fa", strokeWidth: 1.8 },
    }))

  return { nodes, edges }
}

function heatTone(cell: HeatCell): CockpitHotspot["tone"] {
  if (cell.watch && cell.score >= 74) return "rose"
  if (cell.watch && cell.score >= 58) return "amber"
  if (!cell.watch && cell.score >= 74) return "emerald"
  if (!cell.watch && cell.score >= 58) return "cyan"
  return "violet"
}

function buildCockpitHotspots(heatCells: HeatCell[]) {
  if (heatCells.length === 0) return []

  const anchorsByDimension: Record<string, Omit<CockpitHotspot, "id" | "cell" | "tone">> = {
    "Decision speed": { x: 24, y: 25, rx: 16, ry: 10, zone: "Decision room", meaning: "Who can accelerate a clear choice." },
    "Communication clarity": { x: 51, y: 25, rx: 22, ry: 10, zone: "Decision room", meaning: "Who can turn pressure into plain language." },
    "Conflict risk": { x: 75, y: 31, rx: 14, ry: 16, zone: "Decision room", meaning: "Where disagreement may distort the call." },
    "Strategic alignment": { x: 62, y: 47, rx: 13, ry: 13, zone: "Option space", meaning: "Who can frame the bigger trade-offs." },
    "Execution reliability": { x: 53, y: 75, rx: 21, ry: 12, zone: "Execution path", meaning: "Who can carry ownership and follow-through." },
    "Emotional load": { x: 25, y: 74, rx: 17, ry: 11, zone: "Trust climate", meaning: "Where recovery space and support matter." },
    "Creativity contribution": { x: 78, y: 70, rx: 14, ry: 13, zone: "Option space", meaning: "Who can open alternatives before the plan narrows." },
    "Bottleneck risk": { x: 35, y: 48, rx: 24, ry: 12, zone: "Execution path", meaning: "Where too much ownership may concentrate." },
  }

  const sortedCells = selectDiverseSignals(heatCells, 8)

  return sortedCells.map((cell, index) => {
    const anchor = anchorsByDimension[cell.dimension] ?? {
      x: 22 + index * 8,
      y: 26 + (index % 3) * 16,
      rx: 16,
      ry: 10,
      zone: "Scenario map",
      meaning: "A visible signal from this scenario.",
    }
    const nudge = index % 2 === 0 ? -1.5 : 1.5

    return {
      id: `hotspot-${index}`,
      cell,
      ...anchor,
      x: Math.max(12, Math.min(88, anchor.x + nudge)),
      y: Math.max(16, Math.min(84, anchor.y + (index % 3) - 1)),
      tone: heatTone(cell),
    } satisfies CockpitHotspot
  })
}

function cockpitToneColor(tone: CockpitHotspot["tone"], stop: "start" | "middle" | "end") {
  const colors = {
    emerald: { start: "#16a34a", middle: "#34d399", end: "#0f766e" },
    cyan: { start: "#0891b2", middle: "#67e8f9", end: "#2563eb" },
    amber: { start: "#f59e0b", middle: "#fde047", end: "#ea580c" },
    rose: { start: "#e11d48", middle: "#fb7185", end: "#7f1d1d" },
    violet: { start: "#7c3aed", middle: "#c084fc", end: "#4338ca" },
  }

  return colors[tone][stop]
}

function nodeTone(type: CockpitNode["type"], score = 70): CockpitNode["tone"] {
  if (type === "risk") return score > 72 ? "rose" : "amber"
  if (type === "action") return "emerald"
  if (type === "scenario") return "violet"
  return score > 72 ? "cyan" : "emerald"
}

function buildCockpitNetwork(members: VisualMember[], run: VisualRun, heatCells: HeatCell[]) {
  const center: CockpitNode = {
    id: "scenario",
    label: truncate(run.scenarioTitle || "Scenario", 28),
    x: 50,
    y: 50,
    type: "scenario",
    tone: "violet",
  }
  const visibleMembers = members.slice(0, 7)
  const memberNodes = visibleMembers.map((member, index) => {
    const angle = (-160 + index * (320 / Math.max(visibleMembers.length - 1, 1))) * (Math.PI / 180)
    const score = average(heatCells.filter((cell) => cell.personId === member.id && !cell.watch).map((cell) => cell.score), 62)

    return {
      id: `member-${member.id}`,
      label: truncate(member.name || "Member", 14),
      x: 50 + Math.cos(angle) * 34,
      y: 50 + Math.sin(angle) * 31,
      type: "person",
      tone: nodeTone("person", score),
    } satisfies CockpitNode
  })
  const riskNodes = run.risks.slice(0, 3).map((risk, index) => {
    const positions = [
      { x: 78, y: 24 },
      { x: 83, y: 50 },
      { x: 77, y: 75 },
    ]

    return {
      id: `risk-${index}`,
      label: shortSignalLabel(risk, "Risk", 28),
      x: positions[index]?.x ?? 78,
      y: positions[index]?.y ?? 50,
      type: "risk",
      tone: risk.toLowerCase().includes("trust") ? "amber" : "rose",
    } satisfies CockpitNode
  })
  const actionNodes = run.actions.slice(0, 3).map((action, index) => {
    const positions = [
      { x: 22, y: 25 },
      { x: 18, y: 52 },
      { x: 24, y: 78 },
    ]

    return {
      id: `action-${index}`,
      label: shortSignalLabel(action, "Action", 28),
      x: positions[index]?.x ?? 22,
      y: positions[index]?.y ?? 50,
      type: "action",
      tone: "emerald",
    } satisfies CockpitNode
  })
  const nodes = [center, ...memberNodes, ...riskNodes, ...actionNodes]
  const edges: CockpitEdge[] = [
    ...memberNodes.map((node, index) => ({
      id: `scenario-${node.id}`,
      source: center,
      target: node,
      tone: node.tone,
      strength: 2.2 + (index % 3) * 0.45,
    })),
    ...riskNodes.flatMap((riskNode, index) =>
      memberNodes.slice(index, index + 3).map((memberNode, memberIndex) => ({
        id: `${riskNode.id}-${memberNode.id}-${memberIndex}`,
        source: riskNode,
        target: memberNode,
        tone: riskNode.tone,
        strength: 1.1,
      }))
    ),
    ...actionNodes.flatMap((actionNode, index) =>
      memberNodes.slice(Math.max(0, memberNodes.length - 3 - index), memberNodes.length - index).map((memberNode, memberIndex) => ({
        id: `${actionNode.id}-${memberNode.id}-${memberIndex}`,
        source: actionNode,
        target: memberNode,
        tone: actionNode.tone,
        strength: 1.05,
      }))
    ),
  ]

  return { nodes, edges, center, memberNodes, riskNodes, actionNodes }
}

function selectDiverseSignals(cells: HeatCell[], limit: number) {
  const sorted = [...cells].sort((a, b) => b.score - a.score || a.personName.localeCompare(b.personName))
  const picked: HeatCell[] = []
  const usedPeople = new Set<string>()

  for (const cell of sorted) {
    if (picked.length >= limit) break
    if (usedPeople.has(cell.personId)) continue
    picked.push(cell)
    usedPeople.add(cell.personId)
  }

  for (const cell of sorted) {
    if (picked.length >= limit) break
    if (picked.some((item) => item.personId === cell.personId && item.dimension === cell.dimension)) continue
    picked.push(cell)
  }

  return picked
}

function buildMemberSignalReadings(members: VisualMember[], heatCells: HeatCell[], run: VisualRun) {
  return members.slice(0, 6).map((member) => {
    const memberCells = heatCells.filter((cell) => cell.personId === member.id)
    const watchSignal = [...memberCells].filter((cell) => cell.watch).sort((a, b) => b.score - a.score)[0] ?? null
    const contributionSignal = [...memberCells].filter((cell) => !cell.watch).sort((a, b) => b.score - a.score)[0] ?? null
    const support = supportFor(member, run)
    const supportLevel = support?.level ?? (watchSignal && watchSignal.score >= 76 ? "high" : "medium")
    const nextMove = support?.supportMove || watchSignal?.action || contributionSignal?.action || "Give this person one clear role in the next conversation."

    return {
      member,
      watchSignal,
      contributionSignal,
      supportLevel,
      nextMove,
    }
  })
}

function roleTone(role: TeamRoleName) {
  if (role === "Risk Carrier") return "border-rose-300/40 bg-rose-500/15 text-rose-50"
  if (role === "Owner") return "border-emerald-300/40 bg-emerald-500/15 text-emerald-50"
  if (role === "Translator") return "border-cyan-300/40 bg-cyan-500/15 text-cyan-50"
  if (role === "Challenger") return "border-violet-300/40 bg-violet-500/15 text-violet-50"
  if (role === "Accelerator") return "border-amber-300/40 bg-amber-500/15 text-amber-50"
  return "border-sky-300/40 bg-sky-500/15 text-sky-50"
}

function highestCell(cells: HeatCell[], label?: string) {
  return [...cells]
    .filter((cell) => (label ? cell.dimension === label : true))
    .sort((a, b) => b.score - a.score)[0] ?? null
}

function buildTeamRoleMap(members: VisualMember[], heatCells: HeatCell[], run: VisualRun) {
  return members.slice(0, 6).map((member) => {
    const strengths = parseStrengths(member.strengths)
    const domainScores = {
      execution: countMatches(strengths, domainStrengths.execution),
      relationship: countMatches(strengths, domainStrengths.relationship),
      strategy: countMatches(strengths, domainStrengths.strategy),
      influence: countMatches(strengths, domainStrengths.influence),
    }
    const strongestDomain = Object.entries(domainScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "relationship"
    const memberCells = heatCells.filter((cell) => cell.personId === member.id)
    const topWatch = highestCell(memberCells.filter((cell) => cell.watch))
    const topContribution = highestCell(memberCells.filter((cell) => !cell.watch))
    const support = supportFor(member, run)
    let role: TeamRoleName = "Stabiliser"

    if ((topWatch?.score ?? 0) >= 86 || support?.level === "high") {
      role = "Risk Carrier"
    } else if (topContribution?.dimension === "Execution reliability" || strongestDomain === "execution") {
      role = "Owner"
    } else if (topContribution?.dimension === "Communication clarity" || strongestDomain === "relationship") {
      role = "Translator"
    } else if (topContribution?.dimension === "Decision speed" || strongestDomain === "influence") {
      role = "Accelerator"
    } else if (strongestDomain === "strategy") {
      role = "Challenger"
    }

    return {
      member,
      role,
      evidence: topContribution
        ? `${topContribution.dimension} ${topContribution.score}/100`
        : `${titleCase(strongestDomain)} strengths`,
      risk: topWatch ? `${topWatch.dimension} ${topWatch.score}/100` : "No major watch point",
      action: support?.supportMove || topWatch?.action || topContribution?.action || "Give this person a clear role before the conversation starts.",
      topWatch,
      topContribution,
    }
  })
}

function buildDecisionRoute(heatCells: HeatCell[], members: VisualMember[], run: VisualRun) {
  const fallbackMember = members[0]?.name || "Team lead"
  const picks = [
    {
      stage: "Frame",
      purpose: "Set the context, options, and trade-offs.",
      signal: highestCell(heatCells, "Strategic alignment") ?? highestCell(heatCells, "Creativity contribution"),
    },
    {
      stage: "Challenge",
      purpose: "Surface tension before it becomes side-channel resistance.",
      signal: highestCell(heatCells, "Conflict risk") ?? highestCell(heatCells.filter((cell) => cell.watch)),
    },
    {
      stage: "Decide",
      purpose: "Convert ambiguity into the first clear decision.",
      signal: highestCell(heatCells, "Decision speed"),
    },
    {
      stage: "Translate",
      purpose: "Put the decision into plain working language.",
      signal: highestCell(heatCells, "Communication clarity"),
    },
    {
      stage: "Own",
      purpose: "Create follow-through, deadline, and visible accountability.",
      signal: highestCell(heatCells, "Execution reliability") ?? highestCell(heatCells, "Bottleneck risk"),
    },
  ]

  return picks.map((item, index) => ({
    ...item,
    owner: item.signal?.personName || run.memberSupportPriorities[index]?.memberName || fallbackMember,
    action: item.signal?.action || run.actions[index] || "Assign a clear next move and confirm who owns it.",
  }))
}

function tensionMove(type: FlowLink["flowType"]) {
  if (type === "conflict") return "Name the tension early, set debate rules, and separate challenge from personal critique."
  if (type === "support") return "Use this pair as a support bridge, but avoid making one person carry the emotional load."
  if (type === "execution") return "Turn the relationship into a clean handoff with owner, deadline, and decision rights."
  if (type === "influence") return "Clarify who has the final call so energy does not become competing authority."
  return "Use this pair to translate intent into shared working language before decisions harden."
}

function tensionLabel(type: FlowLink["flowType"]) {
  if (type === "conflict") return "Tension pair"
  if (type === "support") return "Support bridge"
  if (type === "execution") return "Execution handoff"
  if (type === "influence") return "Influence collision"
  return "Communication bridge"
}

function tensionTone(severity: "high" | "medium" | "low") {
  if (severity === "high") return "border-rose-300/40 bg-rose-500/15 text-rose-50"
  if (severity === "medium") return "border-amber-300/40 bg-amber-500/15 text-amber-50"
  return "border-emerald-300/40 bg-emerald-500/15 text-emerald-50"
}

function buildTensionPairs(members: VisualMember[], heatCells: HeatCell[], flowLinks: FlowLink[]) {
  const memberById = new Map(members.map((member) => [member.id, member]))
  const watchAverageFor = (memberId: string) => average(heatCells.filter((cell) => cell.personId === memberId && cell.watch).map((cell) => cell.score), 0)
  const topWatchFor = (memberId: string) => highestCell(heatCells.filter((cell) => cell.personId === memberId && cell.watch))

  return flowLinks
    .map((link) => {
      const source = memberById.get(link.source)
      const target = memberById.get(link.target)
      const sourceWatch = watchAverageFor(link.source)
      const targetWatch = watchAverageFor(link.target)
      const pressure = Math.max(sourceWatch, targetWatch)
      const severityScore = link.value + pressure / 4 + (link.flowType === "conflict" ? 18 : 0) + (link.flowType === "influence" ? 8 : 0)
      const severity: "high" | "medium" | "low" = severityScore >= 106 ? "high" : severityScore >= 84 ? "medium" : "low"
      const watchSignal = topWatchFor(sourceWatch >= targetWatch ? link.source : link.target)

      return {
        id: `${link.source}-${link.target}-${link.flowType}`,
        sourceName: source?.name || link.sourceName || "Member",
        targetName: target?.name || link.targetName || "Member",
        label: tensionLabel(link.flowType),
        severity,
        value: link.value,
        pressure,
        reason: `${link.flowType.replaceAll("_", " ")} flow ${link.value}/100 with pair pressure ${pressure}/100.`,
        move: tensionMove(link.flowType),
        watchSignal,
      }
    })
    .sort((a, b) => {
      const severityRank = { high: 3, medium: 2, low: 1 }
      return severityRank[b.severity] - severityRank[a.severity] || b.value + b.pressure - (a.value + a.pressure)
    })
    .slice(0, 4)
}

function gapTone(level: "red" | "amber" | "green") {
  if (level === "red") return "border-rose-300/40 bg-rose-500/15 text-rose-50"
  if (level === "amber") return "border-amber-300/40 bg-amber-500/15 text-amber-50"
  return "border-emerald-300/40 bg-emerald-500/15 text-emerald-50"
}

function buildCoverageGaps(heatCells: HeatCell[], run: VisualRun) {
  const avgFor = (labels: string[]) => average(heatCells.filter((cell) => labels.includes(cell.dimension)).map((cell) => cell.score), 0)
  const configs = [
    {
      label: "Decision clarity",
      score: avgFor(["Decision speed", "Strategic alignment"]),
      watch: false,
      reason: "Can the group turn ambiguity into a clear first call?",
      move: "Use the decision route before discussion expands.",
    },
    {
      label: "Communication bridge",
      score: avgFor(["Communication clarity"]),
      watch: false,
      reason: "Can the team translate the decision into plain working language?",
      move: "Assign one person to restate the decision, owner, and next action.",
    },
    {
      label: "Follow-through ownership",
      score: avgFor(["Execution reliability"]),
      watch: false,
      reason: "Can the group convert the scenario into visible accountability?",
      move: "Close with owner, deadline, and a follow-up check.",
    },
    {
      label: "Emotional load",
      score: avgFor(["Emotional load"]),
      watch: true,
      reason: "Could one person become the default absorber of pressure?",
      move: "Protect recovery space and distribute listening work.",
    },
    {
      label: "Bottleneck pressure",
      score: avgFor(["Bottleneck risk"]),
      watch: true,
      reason: "Could accountability narrow onto one person or role?",
      move: "Split ownership before the next meeting ends.",
    },
    {
      label: "Option generation",
      score: avgFor(["Creativity contribution"]),
      watch: false,
      reason: "Does the group have enough alternative paths before narrowing?",
      move: run.actions.find((action) => /option|alternative|scenario|choice/i.test(action)) || "Invite divergent options before choosing the execution path.",
    },
  ]

  return configs
    .map((item) => {
      const level: "red" | "amber" | "green" = item.watch
        ? item.score >= 78
          ? "red"
          : item.score >= 62
            ? "amber"
            : "green"
        : item.score < 58
          ? "red"
          : item.score < 74
            ? "amber"
            : "green"
      const urgency = item.watch ? item.score : 100 - item.score
      return { ...item, level, urgency }
    })
    .sort((a, b) => {
      const levelRank = { red: 3, amber: 2, green: 1 }
      return levelRank[b.level] - levelRank[a.level] || b.urgency - a.urgency
    })
    .slice(0, 4)
}

export function TeamSyncVisualOutputPanel({ run, members }: { run: VisualRun; members: VisualMember[] }) {
  const [activeView, setActiveView] = useState<VisualView>("cockpit")
  const heatCells = useMemo(() => buildHeatCells(members, run), [members, run])
  const [selectedCell, setSelectedCell] = useState<HeatCell | null>(null)
  const flowLinks = useMemo(() => buildFlowLinks(members, run), [members, run])
  const graphPoints = useMemo(() => buildGraphPoints(members, run), [members, run])
  const graph = useMemo(() => buildFlowGraph(graphPoints), [graphPoints])
  const cockpitHotspots = useMemo(() => buildCockpitHotspots(heatCells), [heatCells])
  const cockpitNetwork = useMemo(() => buildCockpitNetwork(members, run, heatCells), [members, run, heatCells])
  const [selectedGraphId, setSelectedGraphId] = useState("scenario")
  const people = members.slice(0, 8)
  const selectedInsight = selectedCell ?? heatCells[0] ?? null
  const selectedGraphPoint = graphPoints.find((point) => point.id === selectedGraphId) ?? graphPoints[0]
  const graphDetailLines = useMemo(() => formatGraphDetailText(selectedGraphPoint.label), [selectedGraphPoint.label])
  const graphSummaryLines = useMemo(
    () => (selectedGraphPoint.summary === selectedGraphPoint.label ? [] : formatGraphDetailText(selectedGraphPoint.summary)),
    [selectedGraphPoint.label, selectedGraphPoint.summary]
  )
  const visualId = `teamsync-${run.runId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24) || "visual"}`
  const watchAverage = average(heatCells.filter((cell) => cell.watch).map((cell) => cell.score), 0)
  const contributionAverage = average(heatCells.filter((cell) => !cell.watch).map((cell) => cell.score), 0)
  const flowIntensity = average(flowLinks.map((link) => link.value), 0)
  const topWatchSignals = selectDiverseSignals(
    heatCells.filter((cell) => cell.watch),
    3
  )
  const topContributionSignals = selectDiverseSignals(
    heatCells.filter((cell) => !cell.watch),
    3
  )
  const memberSignalReadings = useMemo(() => buildMemberSignalReadings(members, heatCells, run), [members, heatCells, run])
  const teamRoleMap = useMemo(() => buildTeamRoleMap(members, heatCells, run), [members, heatCells, run])
  const decisionRoute = useMemo(() => buildDecisionRoute(heatCells, members, run), [heatCells, members, run])
  const tensionPairs = useMemo(() => buildTensionPairs(members, heatCells, flowLinks), [members, heatCells, flowLinks])
  const coverageGaps = useMemo(() => buildCoverageGaps(heatCells, run), [heatCells, run])
  const primaryWatch = topWatchSignals[0] ?? null
  const primaryContribution = topContributionSignals[0] ?? null
  const cockpitInterpretation =
    primaryWatch && watchAverage >= contributionAverage
      ? `${primaryWatch.dimension} is the first pressure point to manage. Start with ${primaryWatch.personName}, then reduce single-person dependency.`
      : primaryContribution
        ? `${primaryContribution.personName} is the strongest visible stabiliser for this scenario. Use that contribution before the group narrows decisions.`
        : "The visual is ready once the simulation produces member-level signals."
  const facilitationMove = primaryWatch?.action || run.actions[0] || "Open the next team conversation with one clear decision and one visible owner."

  if (members.length === 0) return null

  return (
    <div className="rounded-lg border border-[#cfe0f7] bg-white p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1e3a8a]">Visual intelligence</div>
          <p className="mt-0.5 text-xs text-[#64748b]">Executive cockpit, heat, flow, and graph views for the latest scenario output. Click any signal to inspect its meaning.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { key: "cockpit", label: "Cockpit" },
            { key: "heatmap", label: "Heat map" },
            { key: "energy", label: "Energy flow" },
            { key: "graph", label: "Dynamics graph" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveView(item.key as VisualView)}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                activeView === item.key ? "border-[#1d4ed8] bg-[#1d4ed8] text-white" : "border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fbff]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#d8e4f2] bg-[#f8fbff] px-2.5 py-2 text-[11px] text-[#475569]">
        <span className="font-semibold uppercase tracking-[0.12em] text-[#1e3a8a]">Visual key</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-[#10b981]" />
          Stabiliser
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
          Risk or watch point
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
          Support flow
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
          <span className="h-2 w-8 rounded-full bg-[#94a3b8]" />
          Thicker line means stronger signal
        </span>
        <span className="ml-auto text-[#64748b]">
          {activeView === "energy"
            ? "Read left to right: source member, flow type, target member."
            : activeView === "graph"
              ? "Click a graph node or side-list item to inspect scenario, person, risk, and action details."
              : "Click a signal to see the recommended management action."}
        </span>
      </div>

      {activeView === "cockpit" ? (
        <div className="mt-2 rounded-lg border border-[#1f2937] bg-[#111827] p-2 text-white shadow-sm">
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-lg border border-white/10 bg-[#17212f]">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Scenario signal map</div>
                  <div className="mt-0.5 text-xs text-slate-300">Where this scenario creates pressure, support, and follow-through risk.</div>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">Pressure {run.pressureLevel}/5</div>
              </div>
              <svg viewBox="0 0 760 360" role="img" aria-label="TeamSync scenario signal map" className="h-[430px] w-full">
                <defs>
                  <filter id={`${visualId}-heat-blur`} x="-35%" y="-35%" width="170%" height="170%">
                    <feGaussianBlur stdDeviation="18" />
                  </filter>
                  <linearGradient id={`${visualId}-rail`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="22%" stopColor="#0891b2" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="74%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                  {cockpitHotspots.map((hotspot) => (
                    <radialGradient key={`gradient-${hotspot.id}`} id={`${visualId}-${hotspot.id}`}>
                      <stop offset="0%" stopColor={cockpitToneColor(hotspot.tone, "middle")} stopOpacity="0.98" />
                      <stop offset="48%" stopColor={cockpitToneColor(hotspot.tone, "start")} stopOpacity="0.7" />
                      <stop offset="100%" stopColor={cockpitToneColor(hotspot.tone, "end")} stopOpacity="0.05" />
                    </radialGradient>
                  ))}
                </defs>
                <rect width="760" height="360" rx="18" fill="#17212f" />
                <g>
                  <rect x="62" y="38" width="620" height="282" rx="18" fill="#243447" opacity="0.58" />
                  {cockpitStoryZones.map((zone) => (
                    <g key={`story-zone-${zone.label}`}>
                      <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="12" fill="#31475f" opacity="0.64" stroke="#ffffff" strokeOpacity="0.18" />
                      <text x={zone.x + 14} y={zone.y + 24} fill="#e0f2fe" fontSize="12" fontWeight="800">
                        {zone.label}
                      </text>
                      <text x={zone.x + 14} y={zone.y + 42} fill="#cbd5e1" fontSize="10">
                        {zone.detail}
                      </text>
                    </g>
                  ))}
                  <path d="M 160 120 C 260 92, 448 92, 552 124" fill="none" stroke="#5eead4" strokeOpacity="0.18" strokeWidth="14" strokeLinecap="round" />
                  <path d="M 184 238 C 296 194, 426 194, 613 235" fill="none" stroke="#facc15" strokeOpacity="0.15" strokeWidth="13" strokeLinecap="round" />
                </g>
                <g filter={`url(#${visualId}-heat-blur)`}>
                  {cockpitHotspots.map((hotspot) => (
                    <ellipse
                      key={`blur-${hotspot.id}`}
                      cx={hotspot.x * 7.6}
                      cy={hotspot.y * 3.6}
                      rx={hotspot.rx * 5.4}
                      ry={hotspot.ry * 4.8}
                      fill={`url(#${visualId}-${hotspot.id})`}
                    />
                  ))}
                </g>
                <g opacity="0.7">
                  <rect x="62" y="38" width="620" height="282" rx="18" fill="none" stroke="#ffffff" strokeOpacity="0.12" />
                </g>
                {cockpitHotspots.slice(0, 6).map((hotspot, index) => {
                  const cx = hotspot.x * 7.6
                  const cy = hotspot.y * 3.6
                  const color = cockpitToneColor(hotspot.tone, "middle")
                  const pinNumber = index + 1
                  return (
                    <g key={`point-${hotspot.id}`} className="cursor-pointer" onClick={() => setSelectedCell(hotspot.cell)}>
                      <title>
                        {hotspot.cell.personName}: {hotspot.cell.dimension} {hotspot.cell.score}/100. {hotspot.meaning}
                      </title>
                      <circle cx={cx} cy={cy} r="16" fill="#0f172a" fillOpacity="0.88" stroke={color} strokeOpacity="0.88" strokeWidth="2.4" />
                      <circle cx={cx} cy={cy} r="24" fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="2" />
                      <text x={cx} y={cy + 4} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">
                        {pinNumber}
                      </text>
                    </g>
                  )
                })}
                <g>
                  <rect x="68" y="42" width="120" height="16" rx="8" fill="#ffffff" opacity="0.14" />
                  <text x="76" y="54" fill="#ffffff" fontSize="10" fontWeight="700">
                    READ LEFT TO RIGHT
                  </text>
                  <rect x="512" y="48" width="176" height="20" rx="10" fill={`url(#${visualId}-rail)`} opacity="0.9" />
                  <text x="512" y="86" fill="#cbd5e1" fontSize="11">
                    Green: stabiliser | Pink/amber: watch area
                  </text>
                </g>
              </svg>
              <div className="border-t border-white/10 bg-white/[0.05] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Top signals on this map</div>
                  <div className="text-[11px] text-slate-300">Numbers match the pins above.</div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {cockpitHotspots.slice(0, 6).map((hotspot, index) => {
                    const color = cockpitToneColor(hotspot.tone, "middle")
                    return (
                      <button
                        key={`signal-card-${hotspot.id}`}
                        type="button"
                        onClick={() => setSelectedCell(hotspot.cell)}
                        className="rounded-lg border border-white/10 bg-[#0f172a]/75 p-2 text-left text-xs text-slate-100 hover:border-cyan-200/60"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-[#0f172a]" style={{ backgroundColor: color }}>
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold">{truncate(hotspot.cell.personName || "Member", 24)}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{hotspot.cell.score}/100</span>
                        </div>
                        <div className="mt-1 font-semibold text-cyan-100">{hotspot.cell.dimension}</div>
                        <p className="mt-0.5 leading-4 text-slate-300">{hotspot.meaning}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid gap-2 border-t border-white/10 bg-white/[0.05] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">What this means</div>
                  <p className="mt-1 text-sm leading-5 text-slate-100">{cockpitInterpretation}</p>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">First facilitation move</div>
                  <p className="mt-1 text-sm leading-5 text-slate-100">{facilitationMove}</p>
                </div>
              </div>
            </section>

            <aside className="grid gap-2">
              {[
                { label: "Contribution lift", value: `${contributionAverage}/100`, detail: primaryContribution ? `${primaryContribution.personName}: ${primaryContribution.dimension}` : "Likely strengths under this scenario.", tone: "emerald" as const },
                { label: "Watch load", value: `${watchAverage}/100`, detail: primaryWatch ? `${primaryWatch.personName}: ${primaryWatch.dimension}` : "Conflict, emotion, and bottleneck pressure.", tone: watchAverage > 74 ? ("rose" as const) : ("amber" as const) },
                { label: "Flow intensity", value: `${flowIntensity}/100`, detail: flowLinks[0] ? `${flowLinks[0].sourceName} to ${flowLinks[0].targetName}` : "Relationship and execution energy across the group.", tone: "cyan" as const },
                { label: "Mapped members", value: `${members.length}`, detail: `${members.length} people included in this simulation output.`, tone: "violet" as const },
              ].map((metric) => (
                <div key={`cockpit-metric-${metric.label}`} className="rounded-lg border border-white/10 bg-white/[0.07] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">{metric.label}</div>
                      <div className="mt-1 text-2xl font-semibold text-white">{metric.value}</div>
                    </div>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cockpitToneColor(metric.tone, "middle") }} />
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: metric.label === "Mapped members" ? `${Math.min(100, members.length * 16)}%` : metric.value.replace("/100", "%"),
                        backgroundColor: cockpitToneColor(metric.tone, "middle"),
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{metric.detail}</p>
                </div>
              ))}
            </aside>
          </div>

          <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="rounded-lg border border-white/10 bg-[#f8fbff] p-2 text-[#0f172a]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e3a8a]">Relationship network</div>
                  <p className="mt-0.5 text-xs text-[#475569]">Members, risks, and recommended actions from the same scenario output.</p>
                </div>
                <button type="button" onClick={() => setActiveView("graph")} className="rounded-full border border-[#bfdbfe] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8]">
                  Open graph
                </button>
              </div>
              <svg viewBox="0 0 100 100" role="img" aria-label="TeamSync relationship network" className="mt-1 h-[430px] w-full">
                <defs>
                  <radialGradient id={`${visualId}-network-glow`}>
                    <stop offset="0%" stopColor="#dbeafe" stopOpacity="1" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="100" height="100" rx="7" fill="#ffffff" />
                <circle cx="50" cy="50" r="30" fill={`url(#${visualId}-network-glow)`} />
                {cockpitNetwork.edges.map((edge) => (
                  <line
                    key={`network-edge-${edge.id}`}
                    x1={edge.source.x}
                    y1={edge.source.y}
                    x2={edge.target.x}
                    y2={edge.target.y}
                    stroke={cockpitToneColor(edge.tone, "start")}
                    strokeWidth={edge.strength}
                    strokeOpacity={edge.tone === "rose" ? 0.36 : 0.24}
                  />
                ))}
                {cockpitNetwork.nodes.map((node) => (
                  <g key={`network-node-${node.id}`}>
                    <circle cx={node.x} cy={node.y} r={node.type === "scenario" ? 5.9 : 3.9} fill={cockpitToneColor(node.tone, "middle")} stroke="#0f172a" strokeWidth="0.25" />
                    {labelLines(node.label, node.type === "person" ? 12 : 14, 2).map((line, lineIndex) => (
                      <text key={`network-label-${node.id}-${lineIndex}`} x={node.x} y={node.y + 7 + lineIndex * 3.6} textAnchor="middle" fontSize="2.6" fontWeight="700" fill="#0f172a">
                        {line}
                      </text>
                    ))}
                  </g>
                ))}
              </svg>
            </section>

            <aside className="rounded-lg border border-white/10 bg-white/[0.07] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Executive signal strip</div>
              <div className="mt-2 rounded-lg border border-cyan-200/30 bg-cyan-300/10 p-2 text-xs text-cyan-50">
                <div className="font-semibold">How to read it</div>
                <p className="mt-1 text-cyan-100">
                  Signals are now spread across people first, then ranked. Pink shows watch points, green shows stabilisers, and the lines show where pressure or support may travel first.
                </p>
              </div>
              <div className="mt-2 grid gap-2">
                {topWatchSignals.map((cell) => (
                  <button
                    key={`watch-strip-${cell.personId}-${cell.dimension}`}
                    type="button"
                    onClick={() => setSelectedCell(cell)}
                    className="rounded-lg border border-rose-300/40 bg-rose-500/15 p-2 text-left text-xs text-rose-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{cell.dimension}</span>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{cell.score}</span>
                    </div>
                    <p className="mt-1 text-rose-100">{truncate(`${cell.personName}: ${cell.action}`, 96)}</p>
                  </button>
                ))}
                {topContributionSignals.map((cell) => (
                  <button
                    key={`contribution-strip-${cell.personId}-${cell.dimension}`}
                    type="button"
                    onClick={() => setSelectedCell(cell)}
                    className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 p-2 text-left text-xs text-emerald-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{cell.dimension}</span>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{cell.score}</span>
                    </div>
                    <p className="mt-1 text-emerald-100">{truncate(`${cell.personName}: ${cell.action}`, 96)}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.06] p-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">Member spread</div>
                <div className="mt-2 grid gap-1.5">
                  {memberSignalReadings.map((reading) => (
                    <button
                      key={`member-reading-${reading.member.id}`}
                      type="button"
                      onClick={() => setSelectedCell(reading.watchSignal ?? reading.contributionSignal)}
                      className="rounded-lg border border-white/10 bg-white/[0.06] p-2 text-left text-xs text-slate-100 hover:bg-white/[0.1]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{truncate(reading.member.name || "Member", 24)}</span>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                            reading.supportLevel === "high"
                              ? "bg-rose-400/20 text-rose-100"
                              : reading.supportLevel === "medium"
                                ? "bg-amber-300/20 text-amber-100"
                                : "bg-emerald-300/20 text-emerald-100"
                          )}
                        >
                          {reading.supportLevel} support
                        </span>
                      </div>
                      <div className="mt-1 grid gap-1 sm:grid-cols-2">
                        <span className="rounded-md border border-rose-300/20 bg-rose-400/10 px-2 py-1 text-rose-50">
                          Watch: {reading.watchSignal ? `${reading.watchSignal.dimension} ${reading.watchSignal.score}` : "No strong watch point"}
                        </span>
                        <span className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-emerald-50">
                          Stabiliser: {reading.contributionSignal ? `${reading.contributionSignal.dimension} ${reading.contributionSignal.score}` : "No clear stabiliser"}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-300">{truncate(reading.nextMove, 112)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="rounded-lg border border-white/10 bg-white/[0.07] p-3">
              <div className="mb-2 rounded-lg border border-cyan-200/20 bg-cyan-300/10 p-2 text-xs text-cyan-50">
                <div className="font-semibold uppercase tracking-[0.14em]">Evidence layer</div>
                <p className="mt-1 text-cyan-100">Tags show whether an insight is grounded in Gallup strengths, scenario pressure, support scoring, pair dynamics, or the latest run output.</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Team role map</div>
                  <p className="mt-0.5 text-xs text-slate-300">A working role for each person in this scenario, based on strengths, pressure, and support signals.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                  {teamRoleMap.length} roles
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {teamRoleMap.map((item) => (
                  <button
                    key={`team-role-${item.member.id}`}
                    type="button"
                    onClick={() => setSelectedCell(item.topWatch ?? item.topContribution)}
                    className={clsx("rounded-lg border p-2 text-left text-xs", roleTone(item.role))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{truncate(item.member.name || "Member", 26)}</div>
                        <div className="mt-0.5 text-[11px] text-slate-200">{item.member.role || item.evidence}</div>
                      </div>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{item.role}</span>
                    </div>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1">Evidence: {item.evidence}</span>
                      <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1">Watch: {item.risk}</span>
                    </div>
                    <EvidenceTags tags={["strengths", "pressure", "support"]} />
                    <p className="mt-2 text-slate-200">{truncate(item.action, 128)}</p>
                  </button>
                ))}
              </div>
            </section>

            <aside className="rounded-lg border border-white/10 bg-white/[0.07] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Decision route</div>
              <p className="mt-1 text-xs text-slate-300">Use this as a meeting path: who frames, who challenges, who decides, who translates, and who owns follow-through.</p>
              <div className="mt-2 grid gap-2">
                {decisionRoute.map((step, index) => (
                  <button
                    key={`decision-route-${step.stage}`}
                    type="button"
                    onClick={() => setSelectedCell(step.signal)}
                    className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-2 text-left text-xs text-cyan-50 hover:bg-cyan-300/15"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">{index + 1}</span>
                      <div>
                        <div className="font-semibold">{step.stage}: {step.owner}</div>
                        <div className="text-cyan-100">{step.purpose}</div>
                      </div>
                    </div>
                    <EvidenceTags tags={["strengths", "pressure", "run"]} />
                    <p className="mt-1 text-slate-300">{truncate(step.action, 116)}</p>
                  </button>
                ))}
              </div>
            </aside>
          </div>

          <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="rounded-lg border border-white/10 bg-white/[0.07] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Tension pairs</div>
                  <p className="mt-0.5 text-xs text-slate-300">Likely friction, useful challenge, or support bridges to manage before the conversation gets messy.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                  {tensionPairs.length} pairs
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {tensionPairs.map((pair) => (
                  <button
                    key={`tension-pair-${pair.id}`}
                    type="button"
                    onClick={() => setSelectedCell(pair.watchSignal)}
                    className={clsx("rounded-lg border p-2 text-left text-xs", tensionTone(pair.severity))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {truncate(pair.sourceName, 18)} + {truncate(pair.targetName, 18)}
                        </div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-slate-200">{pair.label}</div>
                      </div>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{pair.severity}</span>
                    </div>
                    <EvidenceTags tags={["relationship", "pressure", "signal"]} />
                    <p className="mt-2 text-slate-100">{pair.reason}</p>
                    <p className="mt-1 text-slate-300">{truncate(pair.move, 124)}</p>
                  </button>
                ))}
              </div>
            </section>

            <aside className="rounded-lg border border-white/10 bg-white/[0.07] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Coverage gaps</div>
              <p className="mt-1 text-xs text-slate-300">What the team should deliberately cover: missing capability, overloaded signal, or pressure concentration.</p>
              <div className="mt-2 grid gap-2">
                {coverageGaps.map((gap) => (
                  <div key={`coverage-gap-${gap.label}`} className={clsx("rounded-lg border p-2 text-xs", gapTone(gap.level))}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{gap.label}</div>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                        {gap.level} {gap.score}/100
                      </span>
                    </div>
                    <EvidenceTags tags={["signal", "pressure", "run"]} />
                    <p className="mt-1 text-slate-100">{gap.reason}</p>
                    <p className="mt-1 text-slate-300">{gap.move}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {activeView === "heatmap" ? (
        <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="overflow-auto rounded-lg border border-[#e2e8f0] bg-[#f8fbff] p-1.5">
            <table className="min-w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 rounded-md bg-[#f8fbff] px-2 py-1.5 text-left font-semibold text-[#475569]">Behaviour</th>
                  {people.map((member) => (
                    <th key={`heat-head-${member.id}`} className="min-w-[112px] rounded-md bg-white px-2 py-1.5 text-center font-semibold text-[#0f172a]">
                      {truncate(member.name || "Member", 18)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dimensions.map((dimension) => (
                  <tr key={`heat-row-${dimension.label}`}>
                    <td className="sticky left-0 z-10 rounded-md bg-white px-2 py-1.5 font-medium text-[#334155]">{dimension.label}</td>
                    {people.map((member) => {
                      const cell = heatCells.find((item) => item.personId === member.id && item.dimension === dimension.label)
                      return (
                        <td key={`heat-cell-${member.id}-${dimension.label}`} className="p-0.5">
                          {cell ? (
                            <button
                              type="button"
                              onClick={() => setSelectedCell(cell)}
                              className={clsx("w-full rounded-md border px-2 py-1.5 text-center text-xs font-semibold", heatClass(cell))}
                              title={`${cell.personName}: ${cell.dimension} ${cell.score}/100`}
                            >
                              {cell.score}
                            </button>
                          ) : (
                            <span className="block rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-neutral-400">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Selected signal</div>
            {selectedInsight ? (
              <>
                <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                  {selectedInsight.personName}: {selectedInsight.dimension}
                </div>
                <div className="mt-1 inline-flex rounded-full border border-[#cbd5e1] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#334155]">
                  Score {selectedInsight.score}/100
                </div>
                <p className="mt-2 text-xs text-[#334155]">{selectedInsight.summary}</p>
                <p className="mt-1 text-xs font-medium text-[#0f172a]">Action: {selectedInsight.action}</p>
              </>
            ) : null}
          </aside>
        </div>
      ) : null}

      {activeView === "energy" ? (
        <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fbff] p-2">
            <svg viewBox="0 0 960 420" role="img" aria-label="Labeled TeamSync energy flow" className="h-[420px] w-full">
              <defs>
                <filter id={`${visualId}-flow-shadow`} x="-20%" y="-40%" width="140%" height="180%">
                  <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.12" />
                </filter>
              </defs>
              <rect width="960" height="420" rx="16" fill="#f8fbff" />
              <text x="42" y="32" fill="#475569" fontSize="13" fontWeight="700">
                Source member
              </text>
              <text x="414" y="32" fill="#475569" fontSize="13" fontWeight="700">
                Flow type and strength
              </text>
              <text x="778" y="32" fill="#475569" fontSize="13" fontWeight="700">
                Target member
              </text>
              {flowLinks.slice(0, 6).map((link, index) => {
                const y = 68 + index * 56
                const color = flowStroke(link.flowType)
                const strokeWidth = Math.max(4, Math.min(18, link.value / 6))
                return (
                  <g key={`energy-flow-${link.source}-${link.target}-${link.flowType}`}>
                    <path
                      d={`M 176 ${y} C 310 ${y - 28}, 620 ${y + 28}, 766 ${y}`}
                      fill="none"
                      stroke={color}
                      strokeOpacity="0.26"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <rect x="24" y={y - 19} width="152" height="38" rx="10" fill="#ffffff" stroke="#cbd5e1" filter={`url(#${visualId}-flow-shadow)`} />
                    <text x="38" y={y - 2} fill="#0f172a" fontSize="12" fontWeight="700">
                      {truncate(link.sourceName || "Member", 20)}
                    </text>
                    <text x="38" y={y + 12} fill="#64748b" fontSize="10">
                      source
                    </text>
                    <rect x="395" y={y - 20} width="170" height="40" rx="12" fill="#ffffff" stroke={color} strokeOpacity="0.55" filter={`url(#${visualId}-flow-shadow)`} />
                    <circle cx="414" cy={y} r="6" fill={color} />
                    <text x="430" y={y - 3} fill="#0f172a" fontSize="12" fontWeight="700">
                      {flowText(link.flowType)}
                    </text>
                    <text x="430" y={y + 11} fill="#64748b" fontSize="10">
                      strength {link.value}/100
                    </text>
                    <rect x="766" y={y - 19} width="168" height="38" rx="10" fill="#ffffff" stroke="#cbd5e1" filter={`url(#${visualId}-flow-shadow)`} />
                    <text x="780" y={y - 2} fill="#0f172a" fontSize="12" fontWeight="700">
                      {truncate(link.targetName || "Member", 22)}
                    </text>
                    <text x="780" y={y + 12} fill="#64748b" fontSize="10">
                      target
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="grid gap-1.5">
            {flowLinks.slice(0, 5).map((link) => (
              <div key={`flow-${link.source}-${link.target}-${link.flowType}`} className={clsx("rounded-lg border px-2 py-1.5", flowClass(link.flowType))}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em]">{link.flowType.replaceAll("_", " ")}</div>
                  <div className="text-[11px] font-semibold">{link.value}/100</div>
                </div>
                <p className="mt-1 text-xs">
                  {link.sourceName || "Member"} -&gt; {link.targetName || "Member"}
                </p>
                <p className="mt-0.5 text-[11px] opacity-85">{link.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeView === "graph" ? (
        <div className="mt-2 grid gap-2">
          <div className="h-[460px] overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fbff]">
            <ReactFlowCanvas nodes={graph.nodes} edges={graph.edges} onNodeSelect={setSelectedGraphId} />
          </div>
          <section className="rounded-lg border border-[#d8e4f2] bg-[#f8fbff] p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Graph detail</div>
              <div className="text-[11px] text-[#64748b]">Click a graph node, or choose one below.</div>
            </div>
            <div className="mt-2 rounded-lg border border-[#d8e4f2] bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#cbd5e1] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#475569]">
                  {selectedGraphPoint.type}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Selected node</span>
              </div>
              <div className="mt-2 max-h-40 overflow-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                <div className="grid gap-1.5">
                  {graphDetailLines.map((line) => (
                    <p key={line} className="break-words text-sm font-semibold leading-5 text-[#0f172a]">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              {graphSummaryLines.length ? (
                <div className="mt-2 max-h-28 overflow-auto rounded-md border border-[#e2e8f0] bg-white px-3 py-2">
                  <div className="grid gap-1.5">
                    {graphSummaryLines.map((line) => (
                      <p key={line} className="break-words text-xs leading-5 text-[#334155]">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-2 rounded-md border border-cyan-100 bg-cyan-50 px-2 py-1.5 text-xs font-medium text-cyan-950">{graphDetailAction(selectedGraphPoint)}</div>
            </div>
            <div className="mt-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Open another node</div>
              <div className="mt-1 grid max-h-32 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {graphPoints.slice(0, 9).map((point) => (
                  <button
                    key={`graph-point-${point.id}`}
                    type="button"
                    onClick={() => setSelectedGraphId(point.id)}
                    title={point.summary || point.label}
                    className={clsx(
                      "rounded-md border px-2 py-1.5 text-left text-[11px] font-medium leading-4",
                      point.id === selectedGraphId ? "border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]" : "border-[#d8e4f2] bg-white text-[#334155] hover:bg-[#f8fbff]"
                    )}
                  >
                    <span className="block text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">{point.type}</span>
                    <span className="block truncate">{truncate(point.label, point.type === "person" ? 28 : 54)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
