'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import PersonaChatSandbox from '@/components/PersonaChatSandbox'
import { PlatformModuleNav } from '@/components/navigation/PlatformModuleNav'
import { WelcomeBackNotice } from '@/components/navigation/WelcomeBackNotice'
import type { AuthProviderStatus } from '@/lib/auth-provider-status'
import { getAuthHeaders } from '@/lib/career-client'

type Traits = {
  warmth: number
  bluntness: number
  humor: number
  formality: number
  creativity: number
  skepticism: number
  structure: number
  verbosity: number
  proactiveness: number
  technicalDepth: number
  empathy: number
  caution: number
}

type Preset = {
  name: string
  description: string
  traits: Traits
  category?: 'preset' | 'role'
  goodFor?: string[]
  avoidFor?: string[]
  examplePrompt?: string
}

type ExportTab = 'custom' | 'gpt' | 'api' | 'claude' | 'json'

type SavedProfile = {
  id: string
  name: string
  description: string
  traits: Traits
  createdAt: string
}

type AnalysisResult = {
  traits: Traits
  preset: string
  summary: string
  rationale: string[]
  confidence: 'Low' | 'Medium' | 'High'
}

type StoredDraft = {
  traits?: Traits
  profileName?: string
  profileDescription?: string
  analysisText?: string
}

type SupabaseProfileRow = {
  id: string | number
  name: string | null
  description: string | null
  traits: Traits | null
  created_at: string | null
}

type VersionEntry = {
  id: string
  label: string
  description: string
  note?: string
  traits: Traits
  createdAt: string
  source: 'manual' | 'analysis' | 'ai' | 'preset' | 'role' | 'tuning'
}

type RecommendationHistoryEntry = {
  id: string
  createdAt: string
  sourceLabel: string
  preset: string
  confidence: AnalysisResult['confidence']
  summary: string
  traits: Traits
}

type SandboxRunEntry = {
  id: string
  createdAt: string
  prompt: string
  outputs: {
    label: string
    output: string
  }[]
}

type PersonalityExplainer = {
  summary: string
  strengths: string[]
  risks: string[]
  bestFor: string[]
  avoidFor: string[]
}

type PreviewScenario = {
  id: string
  label: string
  prompt: string
}

type CareerGallupSource = {
  id: string
  candidate_id: string
  candidate_name: string
  title: string
  content_text: string
  source_type: string
  created_at: string | null
}

const LOCAL_DRAFT_KEY = 'personafoundry-draft-v2'
const LOCAL_VERSIONS_KEY = 'personafoundry-versions-v2'
const LOCAL_RECOMMENDATIONS_KEY = 'personafoundry-recommendations-v1'
const LOCAL_SANDBOX_RUNS_KEY = 'personafoundry-sandbox-runs-v1'
const LOCAL_BEGINNER_MODE_KEY = 'personafoundry-beginner-mode-v1'
const LOCAL_FIRST_EXPORT_KEY = 'personafoundry-first-export-v1'
const LOCAL_QUICKSTART_DISMISSED_KEY = 'personafoundry-quickstart-dismissed-v1'

const previewScenarios: PreviewScenario[] = [
  {
    id: 'executive',
    label: 'Executive update',
    prompt: 'Give me a concise status update on a project that is behind schedule.',
  },
  {
    id: 'coaching',
    label: 'Coaching conversation',
    prompt: 'I am feeling overwhelmed at work. How should I reset and move forward this week?',
  },
  {
    id: 'technical',
    label: 'Technical review',
    prompt: 'Review this architecture idea and call out risks before we commit.',
  },
]

const defaultTraits: Traits = {
  warmth: 50,
  bluntness: 50,
  humor: 40,
  formality: 50,
  creativity: 60,
  skepticism: 50,
  structure: 70,
  verbosity: 50,
  proactiveness: 60,
  technicalDepth: 50,
  empathy: 50,
  caution: 60,
}

const presets: Preset[] = [
  {
    name: 'Blunt Engineer',
    description: 'Direct, technical, structured, low-fluff.',
    category: 'preset',
    goodFor: ['Technical design reviews', 'Debugging', 'Direct feedback'],
    avoidFor: ['Sensitive coaching', 'Customer empathy-heavy conversations'],
    examplePrompt: 'Review this system design and tell me what is weak.',
    traits: {
      warmth: 20,
      bluntness: 90,
      humor: 20,
      formality: 60,
      creativity: 50,
      skepticism: 80,
      structure: 90,
      verbosity: 30,
      proactiveness: 70,
      technicalDepth: 85,
      empathy: 20,
      caution: 60,
    },
  },
  {
    name: 'Warm Tutor',
    description: 'Encouraging, patient, clear, supportive.',
    category: 'preset',
    goodFor: ['Teaching', 'Explaining concepts', 'Beginner support'],
    avoidFor: ['Hard-nosed executive critique', 'Aggressive debate'],
    examplePrompt: 'Explain machine learning to a beginner in simple language.',
    traits: {
      warmth: 85,
      bluntness: 25,
      humor: 40,
      formality: 40,
      creativity: 60,
      skepticism: 35,
      structure: 75,
      verbosity: 70,
      proactiveness: 60,
      technicalDepth: 50,
      empathy: 90,
      caution: 50,
    },
  },
  {
    name: 'Strategic Advisor',
    description: 'Sharp, practical, executive-style guidance.',
    category: 'preset',
    goodFor: ['Strategy', 'Decision support', 'Board-level summaries'],
    avoidFor: ['Casual chat', 'Highly playful brainstorming'],
    examplePrompt: 'Summarize the strategic options and recommend a direction.',
    traits: {
      warmth: 50,
      bluntness: 70,
      humor: 20,
      formality: 80,
      creativity: 60,
      skepticism: 75,
      structure: 85,
      verbosity: 55,
      proactiveness: 80,
      technicalDepth: 70,
      empathy: 40,
      caution: 75,
    },
  },
  {
    name: 'Creative Brainstormer',
    description: 'Inventive, energetic, playful, idea-rich.',
    category: 'preset',
    goodFor: ['Ideation', 'Creative campaigns', 'Concept generation'],
    avoidFor: ['Strict compliance analysis', 'Risk-heavy domains'],
    examplePrompt: 'Generate 10 unusual product ideas for a new AI app.',
    traits: {
      warmth: 65,
      bluntness: 30,
      humor: 75,
      formality: 25,
      creativity: 95,
      skepticism: 25,
      structure: 45,
      verbosity: 75,
      proactiveness: 85,
      technicalDepth: 35,
      empathy: 60,
      caution: 25,
    },
  },
  {
    name: 'Skeptical Analyst',
    description: 'Evidence-focused, rigorous, cautious, precise.',
    category: 'preset',
    goodFor: ['Research', 'Critical analysis', 'Due diligence'],
    avoidFor: ['Warm relationship-building', 'Loose creative exploration'],
    examplePrompt: 'Evaluate this claim and identify weaknesses in the evidence.',
    traits: {
      warmth: 30,
      bluntness: 70,
      humor: 10,
      formality: 85,
      creativity: 35,
      skepticism: 95,
      structure: 85,
      verbosity: 60,
      proactiveness: 55,
      technicalDepth: 80,
      empathy: 20,
      caution: 85,
    },
  },
]

const roleTemplates: Preset[] = [
  {
    name: 'Executive Advisor',
    description: 'Polished, practical, concise, strategic.',
    category: 'role',
    goodFor: ['Board papers', 'Decision memos', 'Exec briefings'],
    avoidFor: ['Playful brainstorming', 'Beginner tutoring'],
    examplePrompt: 'Summarize this issue in board-ready language and recommend a path.',
    traits: {
      warmth: 50,
      bluntness: 68,
      humor: 15,
      formality: 85,
      creativity: 58,
      skepticism: 72,
      structure: 88,
      verbosity: 45,
      proactiveness: 82,
      technicalDepth: 68,
      empathy: 42,
      caution: 74,
    },
  },
  {
    name: 'Startup Coach',
    description: 'Supportive, energetic, action-oriented, pragmatic.',
    category: 'role',
    goodFor: ['Founder coaching', 'Momentum planning', 'Growth ideas'],
    avoidFor: ['Highly formal policy writing', 'Forensic technical review'],
    examplePrompt: 'Give me the next 5 practical moves for my startup this month.',
    traits: {
      warmth: 75,
      bluntness: 45,
      humor: 35,
      formality: 45,
      creativity: 72,
      skepticism: 48,
      structure: 72,
      verbosity: 58,
      proactiveness: 86,
      technicalDepth: 52,
      empathy: 76,
      caution: 48,
    },
  },
  {
    name: 'Technical Architect',
    description: 'Deeply technical, structured, rigorous, direct.',
    category: 'role',
    goodFor: ['Architecture decisions', 'System reviews', 'Tech planning'],
    avoidFor: ['Emotionally sensitive coaching', 'Casual social tone'],
    examplePrompt: 'Design a scalable architecture for this product and note tradeoffs.',
    traits: {
      warmth: 28,
      bluntness: 78,
      humor: 10,
      formality: 72,
      creativity: 50,
      skepticism: 86,
      structure: 92,
      verbosity: 48,
      proactiveness: 74,
      technicalDepth: 94,
      empathy: 22,
      caution: 78,
    },
  },
  {
    name: 'Research Analyst',
    description: 'Evidence-based, careful, thorough, nuanced.',
    category: 'role',
    goodFor: ['Research synthesis', 'Evidence reviews', 'Market scanning'],
    avoidFor: ['Fast hype generation', 'Loose ideation'],
    examplePrompt: 'Assess this market and separate evidence from assumption.',
    traits: {
      warmth: 35,
      bluntness: 60,
      humor: 8,
      formality: 80,
      creativity: 38,
      skepticism: 92,
      structure: 88,
      verbosity: 74,
      proactiveness: 56,
      technicalDepth: 82,
      empathy: 28,
      caution: 90,
    },
  },
  {
    name: 'Chief of Staff',
    description: 'Organized, anticipatory, strategic, concise.',
    category: 'role',
    goodFor: ['Meeting prep', 'Action plans', 'Executive coordination'],
    avoidFor: ['Wild ideation', 'Humor-forward voice'],
    examplePrompt: 'Turn this meeting mess into clear actions, owners, and priorities.',
    traits: {
      warmth: 52,
      bluntness: 62,
      humor: 12,
      formality: 76,
      creativity: 52,
      skepticism: 68,
      structure: 94,
      verbosity: 42,
      proactiveness: 92,
      technicalDepth: 58,
      empathy: 46,
      caution: 78,
    },
  },
]

const labels: Record<keyof Traits, string> = {
  warmth: 'Warmth',
  bluntness: 'Bluntness',
  humor: 'Humor',
  formality: 'Formality',
  creativity: 'Creativity',
  skepticism: 'Skepticism',
  structure: 'Structure',
  verbosity: 'Verbosity',
  proactiveness: 'Proactiveness',
  technicalDepth: 'Technical Depth',
  empathy: 'Empathy',
  caution: 'Caution',
}

const traitDescriptions: Record<keyof Traits, string> = {
  warmth: 'How supportive and encouraging the assistant feels.',
  bluntness: 'How direct and unfiltered the assistant sounds.',
  humor: 'How playful or witty the assistant is.',
  formality: 'How casual versus professional the language feels.',
  creativity: 'How inventive versus conventional the assistant is.',
  skepticism: 'How strongly the assistant questions assumptions.',
  structure: 'How organized and clearly formatted responses are.',
  verbosity: 'How concise versus detailed responses should be.',
  proactiveness: 'How much the assistant anticipates next steps.',
  technicalDepth: 'How simple or expert-level explanations should be.',
  empathy: 'How emotionally aware and validating the assistant is.',
  caution: 'How much the assistant emphasizes risks and tradeoffs.',
}

function getLevel(value: number) {
  if (value < 20) return 'very_low'
  if (value < 40) return 'low'
  if (value < 60) return 'medium'
  if (value < 80) return 'high'
  return 'very_high'
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function personaDNA(traits: Traits) {
  const parts: string[] = []
  parts.push(traits.warmth >= 65 ? 'Warm' : traits.warmth <= 35 ? 'Cool' : 'Balanced')
  parts.push(traits.bluntness >= 65 ? 'Direct' : traits.bluntness <= 35 ? 'Diplomatic' : 'Measured')
  parts.push(traits.structure >= 70 ? 'Structured' : traits.structure <= 40 ? 'Fluid' : 'Balanced')
  parts.push(traits.creativity >= 70 ? 'Creative' : traits.creativity <= 40 ? 'Practical' : 'Adaptive')
  parts.push(traits.technicalDepth >= 70 ? 'Technical' : traits.technicalDepth <= 40 ? 'Accessible' : 'Versatile')
  return parts.join(' | ')
}

function explainPersonality(traits: Traits): PersonalityExplainer {
  const strengths: string[] = []
  const risks: string[] = []
  const bestFor: string[] = []
  const avoidFor: string[] = []

  if (traits.warmth >= 70) {
    strengths.push('Supportive and encouraging tone')
    bestFor.push('Teaching, coaching, reassurance')
  } else if (traits.warmth <= 35) {
    strengths.push('Neutral and emotionally detached when needed')
    risks.push('May feel cold in relationship-heavy interactions')
    avoidFor.push('Sensitive or emotional conversations')
  }

  if (traits.bluntness >= 70) {
    strengths.push('Clear and direct communication')
    bestFor.push('Tough feedback, decision support, fast evaluation')
    risks.push('Can feel sharp or abrupt')
  } else if (traits.bluntness <= 35) {
    strengths.push('Tactful and diplomatic delivery')
    bestFor.push('Stakeholder communication, careful messaging')
    risks.push('May soften difficult truths too much')
  }

  if (traits.structure >= 75) {
    strengths.push('Highly organized and easy to follow')
    bestFor.push('Plans, summaries, action lists')
  } else if (traits.structure <= 40) {
    risks.push('May feel loose or less organized')
    avoidFor.push('Formal reports and structured decision documents')
  }

  if (traits.creativity >= 75) {
    strengths.push('Generates novel ideas and options')
    bestFor.push('Ideation, product concepts, creative exploration')
    if (traits.caution <= 40) {
      risks.push('May generate bold ideas with less risk filtering')
    }
  }

  if (traits.skepticism >= 75) {
    strengths.push('Challenges assumptions and spots weak logic')
    bestFor.push('Research, analysis, due diligence')
    if (traits.warmth <= 40) {
      risks.push('Can feel interrogative or severe')
    }
  }

  if (traits.technicalDepth >= 75) {
    strengths.push('Comfortable with detailed technical reasoning')
    bestFor.push('Architecture, technical planning, specialist discussions')
  } else if (traits.technicalDepth <= 40) {
    strengths.push('Accessible and easier for non-experts')
    bestFor.push('Beginner explanations, broad audiences')
  }

  if (traits.empathy >= 75) {
    strengths.push('Emotionally aware and validating')
    bestFor.push('Coaching, support, relationship-sensitive work')
  } else if (traits.empathy <= 35) {
    risks.push('May stay too task-focused for emotional contexts')
    avoidFor.push('Sensitive coaching and personal support')
  }

  if (traits.caution >= 75) {
    strengths.push('Strong risk awareness and careful tradeoff thinking')
    bestFor.push('Risk reviews, policy, safety-sensitive decisions')
  } else if (traits.caution <= 35) {
    risks.push('May underweight downsides and constraints')
  }

  const summary = `This profile reads as ${personaDNA(traits).toLowerCase()}. It is best when the task matches its communication style, depth, and risk posture.`

  return {
    summary,
    strengths: strengths.slice(0, 6),
    risks: risks.slice(0, 5),
    bestFor: bestFor.slice(0, 6),
    avoidFor: avoidFor.slice(0, 5),
  }
}

function summarizeVersionDelta(current: Traits, previous: Traits) {
  return (Object.keys(current) as (keyof Traits)[])
    .map((key) => ({
      key,
      label: labels[key],
      delta: current[key] - previous[key],
    }))
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
}

const traitRules = {
  warmth: {
    very_low: 'Use restrained emotional language. Maintain a neutral tone.',
    low: 'Be polite but not overly warm.',
    medium: 'Use a balanced and approachable tone.',
    high: 'Use warm and encouraging language where appropriate.',
    very_high: 'Be highly supportive and reassuring while remaining useful.',
  },
  bluntness: {
    very_low: 'Use diplomatic and softened phrasing.',
    low: 'Be tactful when delivering feedback.',
    medium: 'Be clear and straightforward when useful.',
    high: 'Be direct and avoid unnecessary softening.',
    very_high: 'Be highly direct and efficient. Do not pad feedback.',
  },
  humor: {
    very_low: 'Avoid humor and keep the tone serious.',
    low: 'Use humor sparingly.',
    medium: 'Use light humor when appropriate.',
    high: 'Use a playful and witty tone where helpful.',
    very_high: 'Use frequent, tasteful humor without undermining clarity.',
  },
  formality: {
    very_low: 'Use casual, conversational language.',
    low: 'Keep the tone relaxed and natural.',
    medium: 'Use a balanced professional-conversational tone.',
    high: 'Use polished and professional language.',
    very_high: 'Use highly formal, precise, and professional wording.',
  },
  creativity: {
    very_low: 'Prefer conventional and proven ideas.',
    low: 'Stay mostly practical with limited exploration.',
    medium: 'Balance practical thinking with some originality.',
    high: 'Generate original ideas and explore varied options.',
    very_high: 'Prioritize bold, inventive, and unconventional thinking.',
  },
  skepticism: {
    very_low: 'Accept user assumptions unless clearly incorrect.',
    low: 'Question assumptions lightly when needed.',
    medium: 'Test assumptions when useful.',
    high: 'Challenge weak assumptions and distinguish fact from opinion.',
    very_high: 'Rigorously interrogate assumptions, evidence, and logic.',
  },
  structure: {
    very_low: 'Responses can be loose and conversational.',
    low: 'Use minimal structure unless necessary.',
    medium: 'Use light structure where it improves clarity.',
    high: 'Organize responses with clear sections, bullets, or steps.',
    very_high: 'Always use strong structure with headings and clearly ordered points.',
  },
  verbosity: {
    very_low: 'Keep responses brief and compact.',
    low: 'Prefer concise answers with limited elaboration.',
    medium: 'Provide a moderate level of detail.',
    high: 'Provide detailed explanations and useful context.',
    very_high: 'Be highly thorough and expansive when answering.',
  },
  proactiveness: {
    very_low: 'Only answer what was directly asked.',
    low: 'Avoid going beyond the immediate request unless necessary.',
    medium: 'Offer next steps when clearly helpful.',
    high: 'Proactively suggest useful next steps and considerations.',
    very_high: 'Anticipate needs, suggest improvements, and surface adjacent opportunities.',
  },
  technicalDepth: {
    very_low: 'Keep explanations simple and non-technical.',
    low: 'Use basic explanations and avoid jargon.',
    medium: 'Use moderate technical depth where relevant.',
    high: 'Provide detailed technical reasoning and specifics.',
    very_high: 'Answer with expert-level technical precision and depth.',
  },
  empathy: {
    very_low: 'Stay task-focused and avoid emotional framing.',
    low: 'Acknowledge the user briefly without dwelling on emotion.',
    medium: 'Balance practical help with basic emotional awareness.',
    high: 'Acknowledge user perspective and respond with care.',
    very_high: 'Be highly empathetic, validating, and emotionally aware while staying useful.',
  },
  caution: {
    very_low: 'Be bold and action-oriented with minimal emphasis on risk.',
    low: 'Mention risks only when significant.',
    medium: 'Balance opportunity with reasonable caution.',
    high: 'Highlight risks, tradeoffs, and limitations clearly.',
    very_high: 'Be highly risk-aware and explicit about uncertainty, constraints, and downside.',
  },
} as const

function getRule<K extends keyof Traits>(trait: K, value: number) {
  const level = getLevel(value) as keyof (typeof traitRules)[K]
  return traitRules[trait][level]
}

function buildCoreSections(traits: Traits) {
  return {
    style: [
      getRule('warmth', traits.warmth),
      getRule('bluntness', traits.bluntness),
      getRule('humor', traits.humor),
      getRule('formality', traits.formality),
    ],
    behavior: [
      getRule('skepticism', traits.skepticism),
      getRule('proactiveness', traits.proactiveness),
      getRule('empathy', traits.empathy),
      getRule('caution', traits.caution),
    ],
    depth: [
      getRule('technicalDepth', traits.technicalDepth),
      getRule('verbosity', traits.verbosity),
    ],
    output: [
      getRule('structure', traits.structure),
      getRule('creativity', traits.creativity),
    ],
    boundaries: [
      'Do not fabricate facts.',
      'State uncertainty clearly when unsure.',
      "Adapt to the user's goal and context.",
    ],
  }
}

function compileApiPrompt(traits: Traits) {
  const sections = buildCoreSections(traits)
  return `Role
You are a configurable AI assistant whose behavior should match the personality settings below.

Style
${sections.style.join('\n')}

Behavior
${sections.behavior.join('\n')}

Depth
${sections.depth.join('\n')}

Output Preferences
${sections.output.join('\n')}

Boundaries
${sections.boundaries.join('\n')}`
}

function compileGptInstructions(traits: Traits) {
  const sections = buildCoreSections(traits)
  return `You are a configurable GPT assistant.

Your personality and response style must follow these rules:

STYLE
${sections.style.map((item) => `- ${item}`).join('\n')}

BEHAVIOR
${sections.behavior.map((item) => `- ${item}`).join('\n')}

DEPTH
${sections.depth.map((item) => `- ${item}`).join('\n')}

OUTPUT PREFERENCES
${sections.output.map((item) => `- ${item}`).join('\n')}

BOUNDARIES
${sections.boundaries.map((item) => `- ${item}`).join('\n')}

Always stay consistent with this personality unless the user explicitly asks for a different mode.`
}

function compileCustomInstructions(traits: Traits) {
  const sections = buildCoreSections(traits)
  return `How would you like ChatGPT to respond?

Please follow this personality profile:

- ${sections.style.join('\n- ')}
- ${sections.behavior.join('\n- ')}
- ${sections.depth.join('\n- ')}
- ${sections.output.join('\n- ')}
- ${sections.boundaries.join('\n- ')}

Keep responses aligned with these settings unless I ask you to change tone or depth for a specific task.`
}

function compileClaudeInstructions(traits: Traits) {
  const sections = buildCoreSections(traits)
  return `You are Claude acting with the following voice and behavior profile.

Style:
${sections.style.map((item) => `- ${item}`).join('\n')}

Behavior:
${sections.behavior.map((item) => `- ${item}`).join('\n')}

Depth:
${sections.depth.map((item) => `- ${item}`).join('\n')}

Output:
${sections.output.map((item) => `- ${item}`).join('\n')}

Boundaries:
${sections.boundaries.map((item) => `- ${item}`).join('\n')}

Stay consistent with this profile unless the user explicitly requests a different mode.`
}

function getExportPack(activeTab: ExportTab, traits: Traits, name: string, description: string) {
  if (activeTab === 'custom') return compileCustomInstructions(traits)
  if (activeTab === 'gpt') return compileGptInstructions(traits)
  if (activeTab === 'api') return compileApiPrompt(traits)
  if (activeTab === 'claude') return compileClaudeInstructions(traits)

  return JSON.stringify(
    {
      name,
      description,
      traits,
      exports: {
        custom: compileCustomInstructions(traits),
        gpt: compileGptInstructions(traits),
        api: compileApiPrompt(traits),
        claude: compileClaudeInstructions(traits),
      },
    },
    null,
    2
  )
}

function detectWarnings(traits: Traits) {
  const warnings: string[] = []
  if (traits.bluntness > 80 && traits.warmth < 30) warnings.push('High bluntness with low warmth may feel harsh.')
  if (traits.creativity > 80 && traits.caution > 80) warnings.push('High creativity and high caution can pull in opposite directions.')
  if (traits.verbosity > 80 && traits.structure < 40) warnings.push('High verbosity with low structure may feel messy.')
  if (traits.empathy > 80 && traits.bluntness > 80) warnings.push('High empathy and very high bluntness may feel inconsistent.')
  return warnings
}

function voiceSummary(traits: Traits) {
  const parts: string[] = []
  parts.push(traits.warmth >= 60 ? 'warm' : traits.warmth <= 35 ? 'cool-toned' : 'balanced')
  parts.push(traits.bluntness >= 65 ? 'direct' : 'measured')
  parts.push(traits.structure >= 65 ? 'structured' : 'conversational')
  parts.push(traits.creativity >= 70 ? 'creative' : 'practical')
  parts.push(traits.technicalDepth >= 70 ? 'technical' : 'accessible')
  return parts.join(', ')
}

function getTraitTone(value: number) {
  if (value < 20) return 'Very low'
  if (value < 40) return 'Low'
  if (value < 60) return 'Medium'
  if (value < 80) return 'High'
  return 'Very high'
}

function buildLivePreviewResponse(traits: Traits, scenario: PreviewScenario) {
  const greeting =
    traits.warmth >= 70
      ? 'Thanks for sharing this.'
      : traits.warmth <= 35
        ? 'Here is the direct view.'
        : 'Here is a clear take.'

  const openingStyle =
    traits.formality >= 65
      ? 'I will keep this professional and structured.'
      : traits.formality <= 35
        ? 'I will keep this practical and straightforward.'
        : 'I will keep this focused and easy to scan.'

  const directness =
    traits.bluntness >= 70
      ? 'Main issue: scope and timing are out of sync with current capacity.'
      : traits.bluntness <= 35
        ? 'One challenge may be that scope and timing are currently misaligned with capacity.'
        : 'The main challenge appears to be a mismatch between scope, timing, and capacity.'

  const actionLead =
    traits.proactiveness >= 70
      ? 'Recommended next steps:'
      : traits.proactiveness <= 35
        ? 'Options to consider:'
        : 'Suggested next actions:'

  const riskStyle =
    traits.caution >= 70
      ? 'Protective check: confirm owners, decision deadlines, and fallback plans before execution.'
      : traits.caution <= 35
        ? 'Move fast with a light checkpoint plan.'
        : 'Add a simple checkpoint plan to reduce execution risk.'

  const depthLine =
    traits.technicalDepth >= 70
      ? 'Use explicit assumptions, dependencies, and validation criteria.'
      : traits.technicalDepth <= 35
        ? 'Keep details plain-language and outcome-focused.'
        : 'Balance practical detail with readability.'

  const empathyLine =
    traits.empathy >= 70
      ? 'I am treating pace, clarity, and confidence as equally important outcomes.'
      : traits.empathy <= 35
        ? 'Priority is objective execution and measurable progress.'
        : 'We should combine measurable progress with team clarity.'

  const creativityLine =
    traits.creativity >= 70
      ? 'Alternative approach: run a short two-track experiment to de-risk the decision.'
      : traits.creativity <= 35
        ? 'Stay with a proven path and remove optional complexity.'
        : 'Use one primary plan with one controlled backup option.'

  const structure =
    traits.structure >= 70
      ? `${actionLead}
1) Confirm the immediate target outcome.
2) Remove or defer non-critical scope.
3) Set a 7-day checkpoint and review evidence.
${riskStyle}
${depthLine}
${creativityLine}`
      : `${actionLead} confirm the target outcome, trim non-critical scope, and set a 7-day checkpoint. ${riskStyle} ${depthLine} ${creativityLine}`

  const verbosityWrap =
    traits.verbosity <= 35
      ? `${greeting} ${openingStyle} ${directness} ${structure}`
      : `${greeting}
${openingStyle}
Prompt tested: "${scenario.prompt}"
${directness}
${empathyLine}
${structure}`

  return traits.humor >= 70 && traits.formality < 60
    ? `${verbosityWrap}
Small reminder: momentum beats perfection when decisions are time-boxed.`
    : verbosityWrap
}

function getConfidence(hitCount: number, preset: string): AnalysisResult['confidence'] {
  if (hitCount >= 4 && preset !== 'Custom') return 'High'
  if (hitCount >= 2) return 'Medium'
  return 'Low'
}

function analyzeProfileText(text: string): AnalysisResult {
  const lower = text.toLowerCase()
  const nextTraits: Traits = { ...defaultTraits }
  const hits: string[] = []

  const applyBoost = (keys: (keyof Traits)[], amount: number, reason: string) => {
    keys.forEach((key) => {
      nextTraits[key] = clamp(nextTraits[key] + amount)
    })
    hits.push(reason)
  }

  const strategicWords = [
    'strategy',
    'strategic',
    'analysis',
    'analytical',
    'logic',
    'evidence',
    'systems',
    'planning',
    'problem-solving',
    'critical thinking',
  ]

  const warmWords = [
    'support',
    'mentor',
    'mentoring',
    'helping',
    'relationships',
    'collaboration',
    'encourage',
    'encouraging',
    'empathy',
    'empathetic',
    'people-focused',
  ]

  const creativeWords = [
    'creative',
    'creativity',
    'innovation',
    'innovative',
    'ideas',
    'brainstorm',
    'design',
    'imagination',
    'explore',
  ]

  const executionWords = [
    'execute',
    'execution',
    'operations',
    'efficient',
    'efficiency',
    'deliver',
    'delivery',
    'outcomes',
    'process',
    'deadline',
  ]

  const directWords = ['direct', 'clear', 'concise', 'straightforward', 'practical']
  const formalWords = ['professional', 'executive', 'formal', 'stakeholders', 'leadership']

  const countMatches = (words: string[]) => words.filter((word) => lower.includes(word)).length

  const strategicCount = countMatches(strategicWords)
  const warmCount = countMatches(warmWords)
  const creativeCount = countMatches(creativeWords)
  const executionCount = countMatches(executionWords)
  const directCount = countMatches(directWords)
  const formalCount = countMatches(formalWords)

  if (strategicCount > 0) {
    applyBoost(['skepticism', 'structure', 'technicalDepth', 'caution'], 8 * strategicCount, 'Detected strategic / analytical signals.')
  }

  if (warmCount > 0) {
    applyBoost(['warmth', 'empathy', 'proactiveness'], 8 * warmCount, 'Detected supportive / people-oriented signals.')
  }

  if (creativeCount > 0) {
    applyBoost(['creativity', 'proactiveness'], 9 * creativeCount, 'Detected creative / ideation signals.')
  }

  if (executionCount > 0) {
    applyBoost(['structure', 'caution', 'proactiveness'], 7 * executionCount, 'Detected execution / delivery signals.')
    nextTraits.bluntness = clamp(nextTraits.bluntness + 4 * executionCount)
  }

  if (directCount > 0) {
    applyBoost(['bluntness'], 7 * directCount, 'Detected direct / concise communication signals.')
    nextTraits.verbosity = clamp(nextTraits.verbosity - 5 * directCount)
  }

  if (formalCount > 0) {
    applyBoost(['formality', 'structure'], 7 * formalCount, 'Detected professional / executive tone signals.')
  }

  let preset = 'Custom'
  const creativityHigh = nextTraits.creativity >= 80
  const warmthHigh = nextTraits.warmth >= 75
  const skepticismHigh = nextTraits.skepticism >= 80
  const structureHigh = nextTraits.structure >= 80
  const technicalHigh = nextTraits.technicalDepth >= 75

  if (skepticismHigh && structureHigh && technicalHigh) {
    preset = 'Skeptical Analyst'
  } else if (warmthHigh && nextTraits.empathy >= 75) {
    preset = 'Warm Tutor'
  } else if (creativityHigh) {
    preset = 'Creative Brainstormer'
  } else if (structureHigh && nextTraits.bluntness >= 65) {
    preset = 'Blunt Engineer'
  } else if (structureHigh && nextTraits.caution >= 70) {
    preset = 'Strategic Advisor'
  }

  const summary =
    hits.length > 0
      ? `${hits.join(' ')} Recommended preset: ${preset}.`
      : 'No strong signals detected. Using balanced defaults.'

  return {
    traits: nextTraits,
    preset,
    summary,
    rationale: hits.length > 0 ? hits : ['No strong keyword clusters were found, so balanced defaults were used.'],
    confidence: getConfidence(hits.length, preset),
  }
}

function diffTraits(a: Traits, b: Traits) {
  return (Object.keys(a) as (keyof Traits)[])
    .map((key) => ({
      key,
      label: labels[key],
      a: a[key],
      b: b[key],
      delta: a[key] - b[key],
    }))
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
}

function blendTraits(a: Traits, b: Traits): Traits {
  const result = {} as Traits
  ;(Object.keys(a) as (keyof Traits)[]).forEach((key) => {
    result[key] = Math.round((a[key] + b[key]) / 2)
  })
  return result
}

function tuneTraits(traits: Traits, mode: 'persuasive' | 'executive' | 'safer' | 'human' | 'concise') {
  const next = { ...traits }

  if (mode === 'persuasive') {
    next.warmth = clamp(next.warmth + 8)
    next.proactiveness = clamp(next.proactiveness + 12)
    next.structure = clamp(next.structure + 8)
    next.creativity = clamp(next.creativity + 6)
    next.caution = clamp(next.caution - 6)
  }

  if (mode === 'executive') {
    next.formality = clamp(next.formality + 15)
    next.structure = clamp(next.structure + 12)
    next.bluntness = clamp(next.bluntness + 10)
    next.verbosity = clamp(next.verbosity - 10)
    next.humor = clamp(next.humor - 10)
  }

  if (mode === 'safer') {
    next.caution = clamp(next.caution + 18)
    next.skepticism = clamp(next.skepticism + 12)
    next.creativity = clamp(next.creativity - 8)
  }

  if (mode === 'human') {
    next.warmth = clamp(next.warmth + 10)
    next.empathy = clamp(next.empathy + 14)
    next.humor = clamp(next.humor + 8)
    next.formality = clamp(next.formality - 10)
  }

  if (mode === 'concise') {
    next.verbosity = clamp(next.verbosity - 18)
    next.structure = clamp(next.structure + 8)
    next.bluntness = clamp(next.bluntness + 6)
  }

  return next
}

function traitsEqual(a: Traits, b: Traits) {
  return (Object.keys(a) as (keyof Traits)[]).every((key) => a[key] === b[key])
}

export default function Home() {
  const [traits, setTraits] = useState<Traits>(defaultTraits)
  const [activePreset, setActivePreset] = useState<string>('Custom')
  const [activeTab, setActiveTab] = useState<ExportTab>('custom')
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([])
  const [profileName, setProfileName] = useState('My Personality')
  const [profileDescription, setProfileDescription] = useState('Custom personality profile')
  const [versionNoteDraft, setVersionNoteDraft] = useState('')
  const [importText, setImportText] = useState('')
  const [flashNotice, setFlashNotice] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [analysisText, setAnalysisText] = useState('')
  const [analysisSummary, setAnalysisSummary] = useState('')
  const [analysisRationale, setAnalysisRationale] = useState<string[]>([])
  const [analysisConfidence, setAnalysisConfidence] = useState<AnalysisResult['confidence'] | ''>('')
  const [recommendedPreset, setRecommendedPreset] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [recommendationHistory, setRecommendationHistory] = useState<RecommendationHistoryEntry[]>([])
  const [sandboxRuns, setSandboxRuns] = useState<SandboxRunEntry[]>([])
  const [compareLeft, setCompareLeft] = useState('current')
  const [compareRight, setCompareRight] = useState('default')
  const [synthesizingDocs, setSynthesizingDocs] = useState(false)
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState('presets')
  const [isMenuRolledUp, setIsMenuRolledUp] = useState(true)
  const [hasCompletedFirstExport, setHasCompletedFirstExport] = useState(false)
  const [beginnerMode, setBeginnerMode] = useState(true)
  const [showQuickStartWizard, setShowQuickStartWizard] = useState(true)
  const [showGallupExplainer, setShowGallupExplainer] = useState(false)
  const [compactWorkflowMode, setCompactWorkflowMode] = useState(true)
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({
    analysis: false,
    traits: false,
    explainer: true,
    savedProfiles: true,
    sandbox: false,
    versionHistory: true,
    recommendationHistory: true,
    sandboxRuns: true,
    warnings: true,
    exports: false,
    share: true,
  })
  const [selectedPreviewScenario, setSelectedPreviewScenario] = useState(previewScenarios[0].id)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [busyProvider, setBusyProvider] = useState<'google' | 'facebook' | 'linkedin_oidc' | null>(null)
  const [providerStatus, setProviderStatus] = useState<Record<'google' | 'facebook' | 'linkedin_oidc', AuthProviderStatus>>({
    google: { key: 'google', label: 'Google', enabled: true },
    facebook: { key: 'facebook', label: 'Facebook', enabled: false, reason: 'Not configured yet' },
    linkedin_oidc: { key: 'linkedin_oidc', label: 'LinkedIn', enabled: false, reason: 'Not configured yet' },
  })
  const [careerGallupSources, setCareerGallupSources] = useState<CareerGallupSource[]>([])
  const [selectedGallupSourceId, setSelectedGallupSourceId] = useState('')
  const [isLoadingGallupSources, setIsLoadingGallupSources] = useState(false)
  const [isApplyingGallupSource, setIsApplyingGallupSource] = useState(false)

  const analysisResultsRef = useRef<HTMLDivElement | null>(null)
  const flashTimeoutRef = useRef<number | null>(null)

  function flashMessage(text: string) {
    setFlashNotice(text)

    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current)
    }

    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashNotice('')
      flashTimeoutRef.current = null
    }, 2200)
  }

  function togglePanel(panelKey: string) {
    setCollapsedPanels((current) => ({
      ...current,
      [panelKey]: !current[panelKey],
    }))
  }

  function saveVersion(
    source: VersionEntry['source'],
    label?: string,
    description?: string,
    customTraits?: Traits,
    note?: string
  ) {
    const entry: VersionEntry = {
      id: uid('ver'),
      label: label || profileName || 'Untitled version',
      description: description || profileDescription || '',
      note: note?.trim() || versionNoteDraft.trim() || undefined,
      traits: customTraits || traits,
      createdAt: new Date().toISOString(),
      source,
    }
    setVersions((prev) => [entry, ...prev].slice(0, 50))
    setVersionNoteDraft('')
  }

  function addRecommendationHistory(sourceLabel: string, result: AnalysisResult) {
    const entry: RecommendationHistoryEntry = {
      id: uid('rec'),
      createdAt: new Date().toISOString(),
      sourceLabel,
      preset: result.preset,
      confidence: result.confidence,
      summary: result.summary,
      traits: result.traits,
    }
    setRecommendationHistory((prev) => [entry, ...prev].slice(0, 50))
  }

  function clearAnalysisState() {
    setAnalysisSummary('')
    setAnalysisRationale([])
    setAnalysisConfidence('')
    setRecommendedPreset('')
    setUploadedFileName('')
  }

  function scrollToAnalysisResults() {
    window.setTimeout(() => {
      analysisResultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
  }

  function applyAnalysisResult(
    result: AnalysisResult,
    options?: { description?: string; profileNameOverride?: string; sourceLabel?: string; source?: VersionEntry['source'] }
  ) {
    setTraits(result.traits)
    setRecommendedPreset(result.preset)
    setAnalysisSummary(result.summary)
    setAnalysisRationale(result.rationale)
    setAnalysisConfidence(result.confidence)
    setActivePreset(`${result.preset} (recommended)`)

    if (result.preset !== 'Custom') {
      setProfileName(options?.profileNameOverride || result.preset)
      setProfileDescription(options?.description || 'Generated from profile text analysis')
    }

    addRecommendationHistory(options?.sourceLabel || 'Analysis', result)
    saveVersion(
      options?.source || 'analysis',
      options?.profileNameOverride || result.preset,
      options?.description,
      result.traits,
      `Auto-saved from ${options?.sourceLabel || 'analysis'}`
    )

    scrollToAnalysisResults()
  }

  async function copyTextToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      flashMessage(successMessage)
    } catch (error) {
      console.error('Clipboard copy failed:', error)
      flashMessage('Failed to copy to clipboard.')
    }
  }

  useEffect(() => {
    async function getInitialSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      subscription.unsubscribe()
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id

    if (!userId) {
      setCareerGallupSources([])
      setSelectedGallupSourceId('')
      return
    }

    let cancelled = false

    async function loadCareerGallupSources() {
      setIsLoadingGallupSources(true)
      try {
        const response = await fetch('/api/persona/gallup-sources', {
          headers: await getAuthHeaders(),
        })
        const json = await response.json()
        if (!response.ok) {
          if (!cancelled && response.status === 401) {
            flashMessage('Please sign in again, then reload Gallup Strengths.')
          }
          return
        }

        if (cancelled) return

        const sources = Array.isArray(json.sources) ? (json.sources as CareerGallupSource[]) : []
        setCareerGallupSources(sources)
        setSelectedGallupSourceId((current) => current || sources[0]?.id || '')
      } finally {
        if (!cancelled) {
          setIsLoadingGallupSources(false)
        }
      }
    }

    void loadCareerGallupSources()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  useEffect(() => {
    async function loadProviderStatus() {
      try {
        const response = await fetch('/api/auth/provider-status')
        const json = await response.json()
        const providers = Array.isArray(json.providers) ? (json.providers as AuthProviderStatus[]) : []
        setProviderStatus((current) => {
          const next = { ...current }
          for (const provider of providers) {
            next[provider.key] = provider
          }
          return next
        })
      } catch {}
    }

    void loadProviderStatus()
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setSavedProfiles([])
      return
    }

    async function loadProfilesFromSupabase() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Load failed:', error)
        flashMessage(`Load failed: ${error.message}`)
        return
      }

      if (data) {
        const mapped: SavedProfile[] = (data as SupabaseProfileRow[]).map((item) => ({
          id: String(item.id),
          name: item.name ?? 'Untitled Profile',
          description: item.description ?? '',
          traits: item.traits ?? defaultTraits,
          createdAt: item.created_at ?? new Date().toISOString(),
        }))
        setSavedProfiles(mapped)
      }
    }

    loadProfilesFromSupabase()
  }, [session])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDraft
        if (parsed.traits) setTraits(parsed.traits)
        if (parsed.profileName) setProfileName(parsed.profileName)
        if (parsed.profileDescription) setProfileDescription(parsed.profileDescription)
        if (parsed.analysisText) setAnalysisText(parsed.analysisText)
      }

      const versionRaw = localStorage.getItem(LOCAL_VERSIONS_KEY)
      if (versionRaw) setVersions(JSON.parse(versionRaw) as VersionEntry[])

      const recommendationRaw = localStorage.getItem(LOCAL_RECOMMENDATIONS_KEY)
      if (recommendationRaw) setRecommendationHistory(JSON.parse(recommendationRaw) as RecommendationHistoryEntry[])

      const runRaw = localStorage.getItem(LOCAL_SANDBOX_RUNS_KEY)
      if (runRaw) setSandboxRuns(JSON.parse(runRaw) as SandboxRunEntry[])

      const firstExportRaw = localStorage.getItem(LOCAL_FIRST_EXPORT_KEY)
      if (firstExportRaw === 'true') {
        setHasCompletedFirstExport(true)
      }

      const beginnerModeRaw = localStorage.getItem(LOCAL_BEGINNER_MODE_KEY)
      if (beginnerModeRaw === 'true') {
        setBeginnerMode(true)
      } else if (beginnerModeRaw === 'false') {
        setBeginnerMode(false)
      } else {
        setBeginnerMode(firstExportRaw !== 'true')
      }

      const quickStartDismissedRaw = localStorage.getItem(LOCAL_QUICKSTART_DISMISSED_KEY)
      if (quickStartDismissedRaw === 'true') {
        setShowQuickStartWizard(false)
      }
    } catch (error) {
      console.error('Failed to restore local state:', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_DRAFT_KEY,
        JSON.stringify({
          traits,
          profileName,
          profileDescription,
          analysisText,
        })
      )
    } catch (error) {
      console.error('Failed to save draft:', error)
    }
  }, [traits, profileName, profileDescription, analysisText])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(versions))
    } catch (error) {
      console.error('Failed to save versions:', error)
    }
  }, [versions])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_RECOMMENDATIONS_KEY, JSON.stringify(recommendationHistory))
    } catch (error) {
      console.error('Failed to save recommendation history:', error)
    }
  }, [recommendationHistory])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_SANDBOX_RUNS_KEY, JSON.stringify(sandboxRuns))
    } catch (error) {
      console.error('Failed to save sandbox runs:', error)
    }
  }, [sandboxRuns])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_FIRST_EXPORT_KEY, hasCompletedFirstExport ? 'true' : 'false')
      localStorage.setItem(LOCAL_BEGINNER_MODE_KEY, beginnerMode ? 'true' : 'false')
      localStorage.setItem(LOCAL_QUICKSTART_DISMISSED_KEY, showQuickStartWizard ? 'false' : 'true')
    } catch (error) {
      console.error('Failed to save beginner mode state:', error)
    }
  }, [beginnerMode, hasCompletedFirstExport, showQuickStartWizard])

  const warnings = useMemo(() => detectWarnings(traits), [traits])
  const exportContent = useMemo(
    () => getExportPack(activeTab, traits, profileName, profileDescription),
    [activeTab, traits, profileName, profileDescription]
  )

  const sharePayload = useMemo(() => {
    return JSON.stringify({ name: profileName, description: profileDescription, traits }, null, 2)
  }, [profileDescription, profileName, traits])

  const personalityExplainer = useMemo(() => explainPersonality(traits), [traits])
  const activePreviewScenario = useMemo(
    () => previewScenarios.find((scenario) => scenario.id === selectedPreviewScenario) ?? previewScenarios[0],
    [selectedPreviewScenario]
  )
  const livePreviewOutput = useMemo(
    () => buildLivePreviewResponse(traits, activePreviewScenario),
    [traits, activePreviewScenario]
  )

  const compareOptions = useMemo(() => {
    const base = [
      { id: 'current', label: 'Current editor state', traits },
      { id: 'default', label: 'Default profile', traits: defaultTraits },
      ...presets.map((p) => ({ id: `preset:${p.name}`, label: p.name, traits: p.traits })),
      ...roleTemplates.map((p) => ({ id: `role:${p.name}`, label: p.name, traits: p.traits })),
      ...savedProfiles.map((p) => ({ id: `saved:${p.id}`, label: `Saved: ${p.name}`, traits: p.traits })),
      ...versions.map((v) => ({ id: `version:${v.id}`, label: `Version: ${v.label}`, traits: v.traits })),
    ]
    return base
  }, [traits, savedProfiles, versions])

  const compareLeftTraits = compareOptions.find((x) => x.id === compareLeft)?.traits ?? traits
  const compareRightTraits = compareOptions.find((x) => x.id === compareRight)?.traits ?? defaultTraits
  const compareRows = useMemo(() => diffTraits(compareLeftTraits, compareRightTraits), [compareLeftTraits, compareRightTraits])
  const topCompareRows = useMemo(() => compareRows.slice(0, 3), [compareRows])

  async function signInWithProvider(provider: 'google' | 'facebook' | 'linkedin_oidc') {
    if (!providerStatus[provider]?.enabled) {
      const providerLabel = providerStatus[provider]?.label || 'This provider'
      flashMessage(`${providerLabel} login is not configured yet.`)
      return
    }
    setBusyProvider(provider)
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })

    if (error) {
      console.error(`${provider} sign-in failed:`, error)
      const text = (error.message || '').toLowerCase()
      if (text.includes('unsupported provider') || text.includes('provider is not enabled')) {
        setProviderStatus((current) => ({
          ...current,
          [provider]: {
            ...current[provider],
            enabled: false,
            reason: 'Provider not enabled in Supabase',
          },
        }))
      }
      const providerLabel = provider === 'linkedin_oidc' ? 'LinkedIn' : provider.charAt(0).toUpperCase() + provider.slice(1)
      flashMessage(`${providerLabel} sign-in failed: ${error.message}`)
    }
    setBusyProvider(null)
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign-out failed:', error)
      flashMessage(`Sign-out failed: ${error.message}`)
      return
    }

    setSavedProfiles([])
    flashMessage('Signed out.')
  }

  async function saveCurrentProfile() {
    if (!session?.user) {
      flashMessage('Please sign in to save profiles.')
      return
    }

    const profileToSave = {
      name: profileName.trim() || 'Untitled Profile',
      description: profileDescription.trim() || 'Saved personality profile',
      traits,
      user_id: session.user.id,
    }

    const { data, error } = await supabase.from('profiles').insert([profileToSave]).select()

    if (error) {
      console.error('Save failed:', error)
      flashMessage(`Save failed: ${error.message}`)
      return
    }

    if (data && data.length > 0) {
      const savedRow = data[0] as SupabaseProfileRow
      const mapped: SavedProfile = {
        id: String(savedRow.id),
        name: savedRow.name ?? profileToSave.name,
        description: savedRow.description ?? profileToSave.description,
        traits: savedRow.traits ?? traits,
        createdAt: savedRow.created_at ?? new Date().toISOString(),
      }

      setSavedProfiles((prev) => [mapped, ...prev])
    }

    saveVersion('manual', undefined, undefined, undefined, 'Saved to cloud')
    flashMessage('Profile saved.')
  }

  function duplicateCurrentProfile() {
    const duplicatedName = profileName.trim() ? `${profileName} Copy` : 'Untitled Profile Copy'
    setProfileName(duplicatedName)
    setActivePreset('Custom')
    saveVersion('manual', duplicatedName, profileDescription, undefined, 'Duplicated profile')
    flashMessage('Profile duplicated in editor.')
  }

  function loadProfile(profile: SavedProfile) {
    setTraits(profile.traits)
    setProfileName(profile.name)
    setProfileDescription(profile.description)
    setActivePreset('Loaded')
    clearAnalysisState()
    flashMessage(`Loaded "${profile.name}".`)
  }

  async function deleteProfile(id: string) {
    const { error } = await supabase.from('profiles').delete().eq('id', id)

    if (error) {
      console.error('Delete failed:', error)
      flashMessage(`Delete failed: ${error.message}`)
      return
    }

    setSavedProfiles((prev) => prev.filter((profile) => profile.id !== id))
    flashMessage('Profile deleted.')
  }

  function exportJsonFile() {
    const blob = new Blob([sharePayload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(profileName || 'personality').replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
    if (!hasCompletedFirstExport) {
      setHasCompletedFirstExport(true)
      setBeginnerMode(false)
      flashMessage('First export complete. Advanced mode unlocked.')
      return
    }
    flashMessage('JSON exported.')
  }

  function importJsonText() {
    try {
      const parsed = JSON.parse(importText) as {
        name?: string
        description?: string
        traits?: Traits
      }

      if (!parsed.traits) {
        flashMessage('Import failed: no traits found.')
        return
      }

      setTraits(parsed.traits)
      setProfileName(parsed.name || 'Imported Profile')
      setProfileDescription(parsed.description || 'Imported personality profile')
      setActivePreset('Imported')
      clearAnalysisState()
      saveVersion('manual', parsed.name || 'Imported Profile', parsed.description || 'Imported profile', parsed.traits, 'Imported from JSON')
      flashMessage('Profile imported.')
    } catch {
      flashMessage('Import failed: invalid JSON.')
    }
  }

  function resetTraits() {
    setTraits(defaultTraits)
    setActivePreset('Custom')
    setProfileName('My Personality')
    setProfileDescription('Custom personality profile')
    clearAnalysisState()
    flashMessage('Traits reset to default.')
  }

  function handleCopyExportPack() {
    void copyTextToClipboard(exportContent, 'Export copied.')
    if (!hasCompletedFirstExport) {
      setHasCompletedFirstExport(true)
      setBeginnerMode(false)
      flashMessage('First export complete. Advanced mode unlocked.')
    }
  }

  async function runAiProfileAnalysis(inputText?: string, sourceLabel = 'AI Analysis') {
    const textToAnalyze = (inputText ?? analysisText).trim()

    if (!textToAnalyze) {
      flashMessage('Paste some profile text first.')
      return
    }

    try {
      setAiAnalyzing(true)

      const response = await fetch('/api/analyze-profile-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze }),
      })

      const payload = await response.json()

      if (!response.ok) {
        flashMessage(payload?.error || 'AI analysis failed.')
        return
      }

      applyAnalysisResult(payload as AnalysisResult, {
        description: 'Generated from AI profile analysis',
        profileNameOverride: payload?.preset && payload.preset !== 'Custom' ? payload.preset : profileName,
        sourceLabel,
        source: 'ai',
      })

      flashMessage('AI profile analysis completed.')
    } catch (error) {
      console.error('AI profile analysis failed:', error)
      flashMessage('AI analysis failed.')
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function applyCareerGallupSource() {
    const selected = careerGallupSources.find((source) => source.id === selectedGallupSourceId)
    if (!selected) {
      flashMessage('Select a Gallup Strengths source first.')
      return
    }

    const sourceText = (selected.content_text || '').trim()
    if (!sourceText) {
      flashMessage('The selected Gallup source has no readable content.')
      return
    }

    setIsApplyingGallupSource(true)
    try {
      setAnalysisText(sourceText)
      setUploadedFileName(`Career Gallup strengths • ${selected.candidate_name}`)
      setShowQuickStartWizard(false)
      openPersonaSection('analysis', '#persona-analysis')
      await runAiProfileAnalysis(sourceText, `Career Gallup strengths (${selected.candidate_name})`)
      flashMessage(`Gallup Strengths loaded from ${selected.candidate_name}.`)
    } finally {
      setIsApplyingGallupSource(false)
    }
  }

  function runProfileAnalysis() {
    if (!analysisText.trim()) {
      flashMessage('Paste some profile text first.')
      return
    }

    const result = analyzeProfileText(analysisText)

    applyAnalysisResult(result, {
      description: 'Generated from profile text analysis',
      sourceLabel: uploadedFileName || 'Pasted text',
      source: 'analysis',
    })

    flashMessage('Profile text analyzed.')

    if (result.confidence === 'Low') {
      void runAiProfileAnalysis(analysisText, uploadedFileName || 'Pasted text (AI refined)')
    }
  }

  async function handleProfileFileUpload(file: File) {
    try {
      setUploadingFile(true)
      clearAnalysisState()

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/analyze-profile', {
        method: 'POST',
        body: formData,
      })

      const raw = await response.text()
      let payload: { text?: string; error?: string }

      try {
        payload = JSON.parse(raw) as { text?: string; error?: string }
      } catch {
        flashMessage('Upload failed: server did not return valid JSON.')
        return
      }

      if (!response.ok) {
        flashMessage(payload.error || 'File extraction failed.')
        return
      }

      const extractedText = String(payload.text || '').trim()
      if (!extractedText) {
        flashMessage('No readable text was extracted.')
        return
      }

      setAnalysisText(extractedText)
      setUploadedFileName(file.name)

      const result = analyzeProfileText(extractedText)

      applyAnalysisResult(result, {
        description: `Generated from uploaded file: ${file.name}`,
        sourceLabel: file.name,
        source: 'analysis',
      })

      flashMessage(`Uploaded and analyzed ${file.name}.`)

      if (result.confidence === 'Low') {
        void runAiProfileAnalysis(extractedText, `${file.name} (AI refined)`)
      }
    } catch (error) {
      console.error('Upload analysis failed:', error)
      flashMessage('Failed to process uploaded file.')
    } finally {
      setUploadingFile(false)
      setIsDragging(false)
    }
  }

  async function handleMultiDocumentSynthesis(files: FileList | null) {
    const docs = Array.from(files || [])
    if (docs.length === 0) return

    try {
      setSynthesizingDocs(true)

      const extractedTexts: string[] = []

      for (const file of docs.slice(0, 5)) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/analyze-profile', {
          method: 'POST',
          body: formData,
        })

        const payload = await response.json()
        if (response.ok && payload?.text) {
          extractedTexts.push(`FILE: ${file.name}\n${String(payload.text).trim()}`)
        }
      }

      const combined = extractedTexts.join('\n\n---\n\n').trim()
      if (!combined) {
        flashMessage('Could not extract readable text from the selected files.')
        return
      }

      setAnalysisText(combined)
      setUploadedFileName(`${docs.length} files synthesized`)
      await runAiProfileAnalysis(combined, `${docs.length} documents synthesized`)
    } catch (error) {
      console.error('Multi-document synthesis failed:', error)
      flashMessage('Multi-document synthesis failed.')
    } finally {
      setSynthesizingDocs(false)
    }
  }

  async function handleDroppedFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    await handleProfileFileUpload(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    await handleDroppedFiles(e.dataTransfer.files)
  }

  function applyRoleTemplate(template: Preset) {
    setTraits(template.traits)
    setProfileName(template.name)
    setProfileDescription(template.description)
    setActivePreset(`${template.name} (role)`)
    saveVersion('role', template.name, template.description, template.traits, 'Applied role template')
    flashMessage(`Loaded role template: ${template.name}`)
  }

  function applyPreset(preset: Preset) {
    setTraits(preset.traits)
    setActivePreset(preset.name)
    setProfileName(preset.name)
    setProfileDescription(preset.description)
    clearAnalysisState()
    saveVersion('preset', preset.name, preset.description, preset.traits, 'Applied preset')
  }

  function restoreVersion(version: VersionEntry) {
    setTraits(version.traits)
    setProfileName(version.label)
    setProfileDescription(version.description)
    setVersionNoteDraft(version.note || '')
    setActivePreset(`Restored: ${version.label}`)
    flashMessage(`Restored version "${version.label}".`)
  }

  function applyTuning(mode: Parameters<typeof tuneTraits>[1]) {
    const tuned = tuneTraits(traits, mode)
    setTraits(tuned)
    saveVersion('tuning', `${profileName} (${mode})`, profileDescription, tuned, `Applied tuning: ${mode}`)
    flashMessage(`Applied tuning: ${mode}`)
  }

  function handleSaveVersionWithNote() {
    const note = window.prompt('Optional version note:', versionNoteDraft) ?? versionNoteDraft
    saveVersion('manual', undefined, undefined, undefined, note)
    flashMessage('Version saved.')
  }

  const personaQuickLinks = [
    { key: 'presets', label: '1. Presets', href: '#persona-presets' },
    { key: 'templates', label: '2. Templates', href: '#persona-templates' },
    { key: 'analysis', label: '3. Analyze', href: '#persona-analysis' },
    { key: 'traits', label: '4. Traits', href: '#persona-traits' },
    { key: 'sandbox', label: '5. Sandbox', href: '#persona-sandbox' },
    { key: 'exports', label: '6. Exports', href: '#persona-exports' },
    { key: 'share', label: '7. Share', href: '#persona-share' },
  ] as const

  const activePersonaIndex = Math.max(0, personaQuickLinks.findIndex((item) => item.key === activeWorkspaceSection))
  const activePersonaLink = personaQuickLinks[activePersonaIndex] ?? personaQuickLinks[0]
  const canGoPrevPersonaStep = activePersonaIndex > 0
  const canGoNextPersonaStep = activePersonaIndex < personaQuickLinks.length - 1
  const goToPrevPersonaStep = () => {
    if (!canGoPrevPersonaStep) return
    const prev = personaQuickLinks[activePersonaIndex - 1]
    if (!prev) return
    openPersonaSection(prev.key, prev.href)
  }
  const goToNextPersonaStep = () => {
    if (!canGoNextPersonaStep) return
    const next = personaQuickLinks[activePersonaIndex + 1]
    if (!next) return
    openPersonaSection(next.key, next.href)
  }
  const hasCustomizedTraits = !traitsEqual(traits, defaultTraits)
  const hasAnalysisSource = Boolean(analysisText.trim() || uploadedFileName.trim())
  const hasAnalysisText = Boolean(analysisText.trim())
  const hasSavedProfile = savedProfiles.length > 0
  const canImportJson = Boolean(importText.trim())
  const personaJourneySteps = [
    {
      id: "source",
      label: "Understand your voice",
      done: hasAnalysisSource,
      description: "Add writing or upload source material so Persona Foundry can infer your style.",
      sectionKey: "analysis",
      href: "#persona-analysis",
      actionLabel: hasAnalysisSource ? "Review source input" : "Add source input",
    },
    {
      id: "tune",
      label: "Shape the personality",
      done: hasCustomizedTraits,
      description: "Use presets and trait sliders to shape tone, depth, and behavior.",
      sectionKey: "traits",
      href: "#persona-traits",
      actionLabel: hasCustomizedTraits ? "Fine-tune traits" : "Tune traits",
    },
    {
      id: "ship",
      label: "Export and deploy",
      done: hasSavedProfile,
      description: "Save your profile and export the instructions into your GPT workflow.",
      sectionKey: "exports",
      href: "#persona-exports",
      actionLabel: hasSavedProfile ? "Export profile" : "Save and export",
    },
  ] as const
  const nextPersonaStep = personaJourneySteps.find((step) => !step.done) ?? personaJourneySteps[personaJourneySteps.length - 1]
  const personaReadinessItems = [
    {
      label: "Source",
      ready: hasAnalysisSource,
      readyText: "Voice source loaded",
      nextText: "Add source text",
      sectionKey: "analysis",
      href: "#persona-analysis",
    },
    {
      label: "Traits",
      ready: hasCustomizedTraits,
      readyText: "Traits tuned",
      nextText: "Tune sliders",
      sectionKey: "traits",
      href: "#persona-traits",
    },
    {
      label: "Export",
      ready: hasSavedProfile,
      readyText: "Profile saved",
      nextText: "Save + export",
      sectionKey: "exports",
      href: "#persona-exports",
    },
  ] as const
  const showAdvancedPanels = hasCompletedFirstExport && !beginnerMode
  const isStepVisible = (keys: string[]) => !compactWorkflowMode || keys.includes(activeWorkspaceSection)
  const showLeftWorkspaceColumn = isStepVisible(['analysis', 'traits'])
  const showRightWorkspaceColumn = isStepVisible(['sandbox', 'exports', 'share'])
  const workspaceGridClass =
    showLeftWorkspaceColumn && showRightWorkspaceColumn
      ? "grid gap-8 xl:grid-cols-[1.15fr_0.85fr]"
      : "grid gap-8"

  function openPersonaSection(sectionKey: string, href: string) {
    setActiveWorkspaceSection(sectionKey)

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const target = document.querySelector(href)
        if (!(target instanceof HTMLElement)) return

        const stickyNav = document.querySelector('[data-sticky-nav="true"]')
        let stickyOffset = 160
        if (stickyNav instanceof HTMLElement) {
          const stickyTop = Number.parseFloat(window.getComputedStyle(stickyNav).top || '0')
          stickyOffset = Math.ceil(stickyNav.getBoundingClientRect().height + stickyTop + 20)
        }
        const top = window.scrollY + target.getBoundingClientRect().top - stickyOffset
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }, 40)
    }
  }

  function applyQuickStart(path: 'executive' | 'coach' | 'technical' | 'creative') {
    if (path === 'executive') {
      const template = roleTemplates.find((item) => item.name === 'Executive Advisor')
      if (template) applyRoleTemplate(template)
    }

    if (path === 'coach') {
      const preset = presets.find((item) => item.name === 'Warm Tutor')
      if (preset) applyPreset(preset)
    }

    if (path === 'technical') {
      const template = roleTemplates.find((item) => item.name === 'Technical Architect')
      if (template) applyRoleTemplate(template)
    }

    if (path === 'creative') {
      const preset = presets.find((item) => item.name === 'Creative Brainstormer')
      if (preset) applyPreset(preset)
    }

    setShowQuickStartWizard(false)
    openPersonaSection('traits', '#persona-traits')
    flashMessage('Quick start applied. Fine-tune traits, then export when ready.')
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-neutral-900">
      {uploadingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-3xl bg-white px-8 py-7 shadow-2xl">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-black" />
              <div className="mt-4 text-base font-semibold">Uploading and analyzing...</div>
              <div className="mt-1 text-sm text-neutral-500">Extracting text and tuning the personality engine.</div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 py-8">
        <PlatformModuleNav />
        <WelcomeBackNotice userId={session?.user?.id} moduleLabel="Persona Foundry" />
        <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_45%,#f3f8ff_100%)] shadow-sm">
          <div className="p-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b6b7c]">Persona Foundry</p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0f172a]">Design your custom AI personality with precision</h1>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#cdd9e5] bg-white text-[#334155] shadow-sm hover:bg-[#f8fbff]"
                    aria-label="Account"
                    title={session?.user?.email ? "Account" : "Sign in"}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                  </button>
                  {accountMenuOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-[#d9e2ec] bg-white p-3 shadow-lg">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Account</p>
                      {session?.user?.email ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-[#334155]">
                            Signed in as <span className="font-semibold">{session.user.email}</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              void signOut()
                              setAccountMenuOpen(false)
                            }}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                          >
                            Sign out
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <button
                            type="button"
                            onClick={() => void signInWithProvider('google')}
                            disabled={busyProvider !== null || !providerStatus.google.enabled}
                            className="w-full rounded-xl bg-[#0a66c2] px-3 py-2 text-sm font-medium text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyProvider === 'google' ? 'Connecting...' : 'Continue with Google'}
                          </button>
                          {!providerStatus.google.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.google.reason || 'Not configured yet.'}</p> : null}
                          <button
                            type="button"
                            onClick={() => void signInWithProvider('facebook')}
                            disabled={busyProvider !== null || !providerStatus.facebook.enabled}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyProvider === 'facebook' ? 'Connecting...' : 'Continue with Facebook'}
                          </button>
                          {!providerStatus.facebook.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.facebook.reason || 'Not configured yet.'}</p> : null}
                          <button
                            type="button"
                            onClick={() => void signInWithProvider('linkedin_oidc')}
                            disabled={busyProvider !== null || !providerStatus.linkedin_oidc.enabled}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyProvider === 'linkedin_oidc' ? 'Connecting...' : 'Continue with LinkedIn'}
                          </button>
                          {!providerStatus.linkedin_oidc.enabled ? <p className="text-[11px] text-neutral-500">{providerStatus.linkedin_oidc.reason || 'Not configured yet.'}</p> : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 max-w-4xl text-sm leading-5 text-[#475569]">
                Start with Gallup Strengths, tune the voice, then export a production-ready AI personality.
              </p>
              <div className="mt-2 grid gap-1.5 md:grid-cols-3">
                {personaReadinessItems.map((item) => (
                  <button
                    key={`persona-readiness-${item.label}`}
                    type="button"
                    onClick={() => openPersonaSection(item.sectionKey, item.href)}
                    className={`rounded-xl border px-2.5 py-2 text-left ${
                      item.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">{item.label}</div>
                    <div className="mt-0.5 text-xs font-medium text-neutral-800">{item.ready ? item.readyText : item.nextText}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">Do this next</div>
                <p className="mt-0.5 text-xs text-neutral-700">{nextPersonaStep.description}</p>
                <button
                  type="button"
                  onClick={() => openPersonaSection(nextPersonaStep.sectionKey, nextPersonaStep.href)}
                  className="mt-1.5 rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0a66c2] hover:bg-[#dcecff]"
                >
                  {nextPersonaStep.actionLabel}
                </button>
              </div>

              <div className="mt-2 rounded-xl border border-[#d8e4f2] bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#334155]">Gallup source</div>
                    <p className="text-[11px] text-[#64748b]">Use saved Career Strengths, or jump to Analyze and paste/upload now.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPersonaSection("analysis", "#persona-analysis")}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                  >
                    Open analyze step
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedGallupSourceId}
                    onChange={(e) => setSelectedGallupSourceId(e.target.value)}
                    disabled={isLoadingGallupSources || careerGallupSources.length === 0 || isApplyingGallupSource}
                    className="min-w-[240px] rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {careerGallupSources.length === 0 ? (
                      <option value="">{isLoadingGallupSources ? "Loading strengths..." : "No saved Career Gallup source"}</option>
                    ) : (
                      careerGallupSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.candidate_name} | {source.title}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => void applyCareerGallupSource()}
                    disabled={careerGallupSources.length === 0 || !selectedGallupSourceId || isApplyingGallupSource}
                    className="rounded-full bg-[#0a66c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApplyingGallupSource ? "Applying..." : "Use strengths"}
                  </button>
                  {careerGallupSources.length === 0 && !isLoadingGallupSources ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.location.href = "/career-intelligence"
                        }
                      }}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                    >
                      Add in Career Intelligence
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-1 text-xs text-[#64748b]">
                Current voice: <span className="font-semibold text-[#334155]">{personaDNA(traits)}</span>
              </div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowGallupExplainer((current) => !current)}
                  className="rounded-full border border-[#cdd9e5] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#334155] hover:bg-[#f8fbff]"
                >
                  {showGallupExplainer ? "Hide why this works" : "Why this works (Gallup-based)"}
                </button>
              </div>
              {showGallupExplainer ? (
                <div className="mt-2 rounded-xl border border-[#d8e4f2] bg-[#f8fbff] px-3 py-2 text-xs text-[#334155]">
                  <p className="font-semibold text-[#0f172a]">
                    A Gallup-aligned personality makes your AI feel natural from day one.
                  </p>
                  <p className="mt-1">
                    Instead of forcing you to adapt to a generic assistant, Personara tunes the assistant to your natural strengths, communication style, and decision patterns.
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[#475569]">
                    <li>Better fit and faster onboarding</li>
                    <li>Higher trust, engagement, and repeat use</li>
                    <li>Stronger output quality and actionability</li>
                    <li>Less friction in daily workflows</li>
                  </ul>
                  <a
                    href="/docs/personara-ai-gallup-strengths-explainer.docx"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex rounded-full border border-[#cdd9e5] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#334155] hover:bg-[#eef4ff]"
                  >
                    Read full explainer
                  </a>
                </div>
              ) : null}
            </div>

            <div className="mt-1 text-xs text-[#64748b]">
              Mode: <span className="font-semibold text-[#334155]">{activePreset}</span> | Saved versions:{" "}
              <span className="font-semibold text-[#334155]">{versions.length}</span> | Cloud:{" "}
              <span className="font-semibold text-[#334155]">{session?.user ? "Connected" : "Local draft mode"}</span>
            </div>
          </div>
        </div>

        {flashNotice && (
          <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {flashNotice}
          </div>
        )}

        <section data-sticky-nav="true" className="sticky top-3 z-30 mb-3 rounded-2xl border border-[#d8e4f2] bg-[linear-gradient(180deg,#fcfdff_0%,#f4f8fc_100%)] p-2.5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6b7c]">Step-by-step menu</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                {activePersonaIndex + 1}/{personaQuickLinks.length} steps
              </div>
              <button
                type="button"
                onClick={() => setIsMenuRolledUp((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {isMenuRolledUp ? "Expand menu" : "Roll up menu"}
              </button>
              <button
                type="button"
                onClick={() => setCompactWorkflowMode((current) => !current)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                {compactWorkflowMode ? "Show all steps" : "Compact mode"}
              </button>
            </div>
          </div>
          {!isMenuRolledUp ? (
            <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="shrink-0 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                Workflow steps
              </span>
              {personaQuickLinks.map((link) => (
                <button
                  key={`persona-step-${link.key}`}
                  type="button"
                  onClick={() => openPersonaSection(link.key, link.href)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                    activeWorkspaceSection === link.key
                      ? "border-sky-300 bg-sky-100 text-sky-900"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-1.5 grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5">
              <div className="text-[11px] text-neutral-600">
                Current: <span className="font-semibold text-neutral-900">{activePersonaLink.label.replace(/^\d+\.\s*/, "")}</span>
              </div>
              {!isMenuRolledUp ? (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                    Step {activePersonaIndex + 1} of {personaQuickLinks.length}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={goToPrevPersonaStep}
                      disabled={!canGoPrevPersonaStep}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={goToNextPersonaStep}
                      disabled={!canGoNextPersonaStep}
                      className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-neutral-600">
                <span className="font-semibold text-neutral-700">Path:</span>
                <button
                  type="button"
                  onClick={() => openPersonaSection(activePersonaLink.key, activePersonaLink.href)}
                  className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Persona workflow
                </button>
                <span className="text-neutral-400">/</span>
                <button
                  type="button"
                  onClick={() => openPersonaSection(activePersonaLink.key, activePersonaLink.href)}
                  className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  {activePersonaLink.label.replace(/^\d+\.\s*/, "")}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">Do next</div>
              <div className="mt-1 text-[11px] font-semibold text-[#0f172a]">{nextPersonaStep.label}</div>
              <p className="mt-0.5 text-[10px] leading-4 text-[#475569]">{nextPersonaStep.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => openPersonaSection(nextPersonaStep.sectionKey, nextPersonaStep.href)}
                  className="rounded-full bg-[#0a66c2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                >
                  {nextPersonaStep.actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setBeginnerMode((current) => !current)}
                  disabled={!hasCompletedFirstExport && beginnerMode}
                  className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {beginnerMode ? "Beginner on" : "Advanced on"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {showQuickStartWizard ? (
          <section className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-indigo-900">
                <span className="font-semibold uppercase tracking-[0.08em] text-indigo-700">60-second quick start:</span>{" "}
                choose one path to preload your baseline.
              </div>
              <button
                type="button"
                onClick={() => setShowQuickStartWizard(false)}
                className="rounded-full border border-indigo-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-800 hover:bg-indigo-100"
              >
                Skip
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickStart('executive')}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-900 hover:bg-indigo-100"
              >
                Executive strategy
              </button>
              <button
                type="button"
                onClick={() => applyQuickStart('coach')}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-900 hover:bg-indigo-100"
              >
                Teaching and coaching
              </button>
              <button
                type="button"
                onClick={() => applyQuickStart('technical')}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-900 hover:bg-indigo-100"
              >
                Technical depth
              </button>
              <button
                type="button"
                onClick={() => applyQuickStart('creative')}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-900 hover:bg-indigo-100"
              >
                Creative ideation
              </button>
            </div>
          </section>
        ) : null}

        {isStepVisible(['presets']) ? (
        <section id="persona-presets" className="mb-8">
          <div className="mb-3">
            <h2 className="text-xl font-semibold">Step 1: Choose a starting preset</h2>
            <p className="mt-1 text-xs text-neutral-500">Pick an instant archetype to establish a fast baseline voice.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <button
              onClick={() => {
                setTraits(defaultTraits)
                setActivePreset('Custom')
                setProfileName('My Personality')
                setProfileDescription('Custom personality profile')
                clearAnalysisState()
              }}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                activePreset === 'Custom' ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white hover:bg-neutral-100'
              }`}
            >
              <div className="font-semibold">Custom</div>
              <div className={`mt-2 text-sm ${activePreset === 'Custom' ? 'text-neutral-200' : 'text-neutral-600'}`}>
                Balanced default profile.
              </div>
            </button>

            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                  activePreset === preset.name ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white hover:bg-neutral-100'
                }`}
              >
                <div className="font-semibold">{preset.name}</div>
                <div className={`mt-2 text-sm ${activePreset === preset.name ? 'text-neutral-200' : 'text-neutral-600'}`}>
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </section>
        ) : null}

        {isStepVisible(['templates']) ? (
        <section id="persona-templates" className="mb-8">
          <div className="mb-3">
            <h2 className="text-xl font-semibold">Step 2: Pick a role template</h2>
            <p className="mt-1 text-xs text-neutral-500">Use role-specific starting points for faster tuning.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {roleTemplates.map((template) => (
              <div
                key={template.name}
                className="rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:bg-neutral-100"
              >
                <button onClick={() => applyRoleTemplate(template)} className="w-full text-left">
                  <div className="font-semibold">{template.name}</div>
                  <div className="mt-2 text-sm text-neutral-600">{template.description}</div>
                </button>

                {(template.goodFor?.length || template.avoidFor?.length || template.examplePrompt) && (
                  <div className="mt-3 space-y-2">
                    {template.goodFor && template.goodFor.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Good for</div>
                        <div className="mt-1 text-xs text-neutral-700">{template.goodFor.join(', ')}</div>
                      </div>
                    )}

                    {template.avoidFor && template.avoidFor.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Avoid for</div>
                        <div className="mt-1 text-xs text-neutral-700">{template.avoidFor.join(', ')}</div>
                      </div>
                    )}

                    {template.examplePrompt && (
                      <button
                        onClick={() => {
                          setAnalysisText(template.examplePrompt || '')
                          flashMessage(`Loaded example prompt from ${template.name}`)
                        }}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-white"
                      >
                        Use example prompt
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        ) : null}

        <div className={workspaceGridClass}>
          {showLeftWorkspaceColumn ? (
          <section className="space-y-8">
            {isStepVisible(['analysis']) ? (
            <div id="persona-analysis" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold">Step 3: Analyze source writing</h2>
                  <p className="mt-2 text-sm text-neutral-500">
                    Paste text, upload one document, or synthesize up to five documents into one personality profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel('analysis')}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.analysis ? 'Expand' : 'Collapse'}
                </button>
              </div>

              {!collapsedPanels.analysis ? (
              <>

              <div
                className={`mt-4 rounded-2xl border border-dashed p-4 transition ${
                  isDragging ? 'border-black bg-neutral-100' : 'border-neutral-300 bg-neutral-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium">Upload a profile file</div>
                    <div className="mt-1 text-xs text-neutral-500">Supported: TXT, PDF, DOCX. Drag-and-drop supported.</div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100">
                      <input
                        type="file"
                        accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={async (e) => {
                          const input = e.currentTarget
                          const file = input.files?.[0]
                          if (!file) return
                          input.value = ''
                          await handleProfileFileUpload(file)
                        }}
                      />
                      {uploadingFile ? 'Uploading...' : 'Upload file'}
                    </label>

                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100">
                      <input
                        type="file"
                        multiple
                        accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        disabled={synthesizingDocs}
                        onChange={async (e) => {
                          const input = e.currentTarget
                          await handleMultiDocumentSynthesis(input.files)
                          input.value = ''
                        }}
                      />
                      {synthesizingDocs ? 'Synthesizing...' : 'Synthesize documents'}
                    </label>
                  </div>
                </div>

                {uploadedFileName && <p className="mt-3 text-xs text-neutral-600">Last upload: {uploadedFileName}</p>}
              </div>

              <textarea
                value={analysisText}
                onChange={(e) => setAnalysisText(e.target.value)}
                className="mt-4 min-h-[180px] w-full rounded-2xl border border-neutral-300 p-3 text-sm"
                placeholder="Paste profile text here..."
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    hasAnalysisText ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                  }`}
                >
                  {hasAnalysisText ? 'Ready to analyze' : 'Paste text to enable'}
                </span>
                <button
                  onClick={runProfileAnalysis}
                  disabled={aiAnalyzing || !hasAnalysisText}
                  title="Analyze pasted text with the fast local inference model."
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                    aiAnalyzing || !hasAnalysisText ? 'cursor-not-allowed bg-neutral-400' : 'bg-black'
                  }`}
                >
                  Analyze pasted text
                </button>

                <button
                  onClick={() => void runAiProfileAnalysis()}
                  disabled={aiAnalyzing || !hasAnalysisText}
                  title="Run a deeper AI analysis to refine trait recommendations."
                  className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                    aiAnalyzing || !hasAnalysisText
                      ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
                      : 'border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {aiAnalyzing ? 'AI analyzing...' : 'Analyze with AI'}
                </button>

                <button
                  onClick={() => {
                    setAnalysisText('')
                    clearAnalysisState()
                  }}
                  title="Clear pasted text and reset analysis results."
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Clear
                </button>
              </div>

              {(analysisSummary || recommendedPreset || analysisConfidence || aiAnalyzing) && (
                <div ref={analysisResultsRef} className="mt-4 rounded-2xl bg-neutral-50 p-4">
                  {aiAnalyzing && <p className="text-sm text-neutral-500">AI is refining the recommendation...</p>}

                  <div className="flex flex-wrap items-center gap-3">
                    {recommendedPreset && (
                      <p className="text-sm">
                        <span className="font-semibold">Recommended preset:</span> {recommendedPreset}
                      </p>
                    )}
                    {analysisConfidence && (
                      <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">
                        Confidence: {analysisConfidence}
                      </span>
                    )}
                  </div>

                  {analysisSummary && <p className="mt-2 text-sm text-neutral-700">{analysisSummary}</p>}

                  {analysisRationale.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rationale</div>
                      <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                        {analysisRationale.map((item) => (
                          <li key={item} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-700">Next steps</div>
                <p className="mt-1 text-sm text-sky-900">
                  Step 4: Fine-tune traits to match your voice, then Step 5: Export your final personality profile.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openPersonaSection('traits', '#persona-traits')}
                    className="rounded-full bg-[#0a66c2] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                  >
                    Continue to trait tuning
                  </button>
                  <button
                    type="button"
                    onClick={() => openPersonaSection('exports', '#persona-exports')}
                    className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800 hover:bg-sky-100"
                  >
                    Skip to export
                  </button>
                </div>
              </div>
              </>
              ) : null}
            </div>
            ) : null}

            {isStepVisible(['traits']) ? (
            <div id="persona-traits" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Step 4: Tune trait controls</h2>
                  <p className="mt-1 text-sm text-neutral-500">Fine-tune how the assistant behaves.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePanel('traits')}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                  >
                    {collapsedPanels.traits ? 'Expand' : 'Collapse'}
                  </button>
                  <button onClick={resetTraits} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Reset traits
                  </button>
                  <button onClick={handleSaveVersionWithNote} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Save version
                  </button>
                </div>
              </div>

              {!collapsedPanels.traits ? (
              <>

              <div className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Profile name</label>
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                      placeholder="My Personality"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Description</label>
                    <input
                      value={profileDescription}
                      onChange={(e) => setProfileDescription(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                      placeholder="Short description"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={saveCurrentProfile}
                    disabled={!session?.user}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${
                      session?.user ? 'bg-black' : 'cursor-not-allowed bg-neutral-400'
                    }`}
                  >
                    {session?.user ? 'Save profile' : 'Sign in to save'}
                  </button>
                  <button onClick={duplicateCurrentProfile} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">
                    Duplicate
                  </button>
                  <button onClick={exportJsonFile} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">
                    Export JSON
                  </button>
                  <button onClick={() => copyTextToClipboard(sharePayload, 'Share JSON copied.')} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">
                    Copy JSON
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">Next version note</label>
                <input
                  value={versionNoteDraft}
                  onChange={(e) => setVersionNoteDraft(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Optional note for next saved version"
                />
              </div>

              <div className="mb-5">
                <div className="mb-2 text-sm font-semibold">Outcome tuning</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => applyTuning('persuasive')} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                    More persuasive
                  </button>
                  <button onClick={() => applyTuning('executive')} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                    More executive
                  </button>
                  <button onClick={() => applyTuning('safer')} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                    Safer / more cautious
                  </button>
                  <button onClick={() => applyTuning('human')} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                    More human
                  </button>
                  <button onClick={() => applyTuning('concise')} className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                    More concise
                  </button>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0f172a]">Live answer preview</div>
                    <p className="mt-1 text-xs text-neutral-600">Change sliders and watch this output update instantly.</p>
                  </div>
                  <div className="rounded-full border border-[#d8e4f2] bg-white px-3 py-1 text-xs font-medium text-[#0f172a]">
                    Current voice: {voiceSummary(traits)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {previewScenarios.map((scenario) => {
                    const isActive = scenario.id === activePreviewScenario.id
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => setSelectedPreviewScenario(scenario.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? 'border border-[#1d4ed8] bg-[#dbeafe] text-[#1e3a8a]'
                            : 'border border-[#d8e4f2] bg-white text-[#334155] hover:bg-[#eef4ff]'
                        }`}
                      >
                        {scenario.label}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 rounded-xl border border-[#d8e4f2] bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">Prompt</div>
                  <p className="mt-1 text-sm text-[#0f172a]">{activePreviewScenario.prompt}</p>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]">Sample output</div>
                  <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#0f172a]">{livePreviewOutput}</pre>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(Object.keys(traits) as (keyof Traits)[]).map((key) => (
                  <div key={key} className="rounded-xl border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-semibold text-[#0f172a]">{labels[key]}</label>
                      <div className="rounded-full border border-[#d8e4f2] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#334155]">
                        {traits[key]} | {getTraitTone(traits[key])}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[11px] text-neutral-500">{traitDescriptions[key]}</p>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={traits[key]}
                      onChange={(e) => {
                        setTraits((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                        setActivePreset('Custom')
                      }}
                      className="mt-2 h-1.5 w-full cursor-pointer accent-[#0a66c2]"
                    />
                    <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-neutral-400">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                ))}
              </div>
              </>
              ) : null}
            </div>
            ) : null}

            {isStepVisible(['traits']) ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Personality explainer</h2>
                <button
                  type="button"
                  onClick={() => togglePanel('explainer')}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.explainer ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.explainer ? (
              <>
              <p className="mt-2 text-sm text-neutral-500">{personalityExplainer.summary}</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Strengths</div>
                  <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                    {personalityExplainer.strengths.length > 0 ? (
                      personalityExplainer.strengths.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>Balanced across multiple contexts.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Risks</div>
                  <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                    {personalityExplainer.risks.length > 0 ? (
                      personalityExplainer.risks.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No major personality risks detected.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Best for</div>
                  <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                    {personalityExplainer.bestFor.length > 0 ? (
                      personalityExplainer.bestFor.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>General-purpose assistant work.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Avoid for</div>
                  <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                    {personalityExplainer.avoidFor.length > 0 ? (
                      personalityExplainer.avoidFor.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No strong mismatch zones detected.</li>
                    )}
                  </ul>
                </div>
              </div>
              </>
              ) : null}
            </div>
            ) : null}

            {showAdvancedPanels && isStepVisible(['traits']) ? (
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Compare + trait delta</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Left profile</label>
                  <select value={compareLeft} onChange={(e) => setCompareLeft(e.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2">
                    {compareOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Right profile</label>
                  <select value={compareRight} onChange={(e) => setCompareRight(e.target.value)} className="w-full rounded-xl border border-neutral-300 px-3 py-2">
                    {compareOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setTraits(compareLeftTraits)
                    setActivePreset('Applied left comparison profile')
                    flashMessage('Applied left profile to editor.')
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Apply Left
                </button>

                <button
                  onClick={() => {
                    setTraits(compareRightTraits)
                    setActivePreset('Applied right comparison profile')
                    flashMessage('Applied right profile to editor.')
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Apply Right
                </button>

                <button
                  onClick={() => {
                    const blended = blendTraits(compareLeftTraits, compareRightTraits)
                    setTraits(blended)
                    setActivePreset('Blended comparison profile')
                    saveVersion('tuning', `${profileName} (blend 50/50)`, profileDescription, blended, 'Blended compare left/right')
                    flashMessage('Blended both profiles 50/50.')
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Blend 50/50
                </button>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold">Top 3 biggest differences</div>
                <div className="space-y-2">
                  {topCompareRows.map((row) => (
                    <div
                      key={`top-${row.key}`}
                      className="flex items-center justify-between rounded-xl border-2 border-black bg-white px-4 py-3 text-sm"
                    >
                      <div className="font-semibold">{row.label}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-500">{row.a}</span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.delta > 0 ? 'bg-emerald-100 text-emerald-700' : row.delta < 0 ? 'bg-rose-100 text-rose-700' : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </span>
                        <span className="text-neutral-500">{row.b}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {compareRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                    <div className="font-medium">{row.label}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500">{row.a}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        row.delta > 0 ? 'bg-emerald-100 text-emerald-700' : row.delta < 0 ? 'bg-rose-100 text-rose-700' : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </span>
                      <span className="text-neutral-500">{row.b}</span>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            ) : null}

            {isStepVisible(['traits']) ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Your saved profiles</h2>
                <button
                  type="button"
                  onClick={() => togglePanel('savedProfiles')}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
                >
                  {collapsedPanels.savedProfiles ? 'Expand' : 'Collapse'}
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">Only profiles from your signed-in account are shown.</p>
              {!collapsedPanels.savedProfiles ? (!session?.user ? (
                <p className="mt-3 text-sm text-neutral-500">Sign in to view your saved profiles.</p>
              ) : savedProfiles.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No saved profiles yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {savedProfiles.map((profile) => (
                    <div key={profile.id} className="rounded-2xl border border-neutral-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{profile.name}</div>
                          <div className="mt-1 text-sm text-neutral-600">{profile.description}</div>
                          <div className="mt-1 text-xs text-neutral-400">Saved {new Date(profile.createdAt).toLocaleString()}</div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => loadProfile(profile)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
                            Load
                          </button>
                          <button onClick={() => deleteProfile(profile.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )) : null}
            </div>
            ) : null}
          </section>
          ) : null}

          {showRightWorkspaceColumn ? (
          <section id="persona-sandbox" className="space-y-6">
            {isStepVisible(['sandbox']) ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-neutral-900">Step 5: Sandbox test</h2>
                <button type="button" onClick={() => togglePanel('sandbox')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                  {collapsedPanels.sandbox ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.sandbox ? (
              <PersonaChatSandbox
                currentTraits={traits}
                onSaveRun={(run) => {
                  const entry: SandboxRunEntry = {
                    id: uid('run'),
                    createdAt: new Date().toISOString(),
                    prompt: run.prompt,
                    outputs: run.outputs,
                  }
                  setSandboxRuns((prev) => [entry, ...prev].slice(0, 50))
                  flashMessage('Sandbox run saved.')
                }}
              />
              ) : null}
            </div>
            ) : null}

            {showAdvancedPanels && isStepVisible(['sandbox']) ? (
              <>
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Version history</h2>
                <button type="button" onClick={() => togglePanel('versionHistory')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                  {collapsedPanels.versionHistory ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.versionHistory ? (
              <>
              {versions.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No saved versions yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {versions.map((version, index) => {
                    const previous = versions[index + 1]
                    const deltaSummary = previous ? summarizeVersionDelta(version.traits, previous.traits) : []

                    return (
                      <div key={version.id} className="rounded-2xl border border-neutral-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{version.label}</div>
                            <div className="mt-1 text-sm text-neutral-600">{version.description}</div>
                            {version.note && (
                              <div className="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                                Note: {version.note}
                              </div>
                            )}
                            {deltaSummary.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {deltaSummary.map((item) => (
                                  <span
                                    key={`${version.id}-${item.key}`}
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                      item.delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                    }`}
                                  >
                                    {item.label} {item.delta > 0 ? `+${item.delta}` : item.delta}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-neutral-400">
                              {version.source} | {new Date(version.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <button onClick={() => restoreVersion(version)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
                            Restore
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </>
              ) : null}
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Recommendation history</h2>
                <button type="button" onClick={() => togglePanel('recommendationHistory')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                  {collapsedPanels.recommendationHistory ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.recommendationHistory ? (
              <>
              {recommendationHistory.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No recommendations yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recommendationHistory.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-neutral-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{entry.preset}</div>
                          <div className="mt-1 text-sm text-neutral-600">{entry.summary}</div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {entry.sourceLabel} | {entry.confidence} | {new Date(entry.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setTraits(entry.traits)
                            setActivePreset(`${entry.preset} (history)`)
                            flashMessage(`Loaded recommendation: ${entry.preset}`)
                          }}
                          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
              ) : null}
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Saved sandbox runs</h2>
                <button type="button" onClick={() => togglePanel('sandboxRuns')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                  {collapsedPanels.sandboxRuns ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.sandboxRuns ? (
              <>
              {sandboxRuns.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No sandbox runs saved yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {sandboxRuns.map((run) => (
                    <div key={run.id} className="rounded-2xl border border-neutral-200 p-4">
                      <div className="font-semibold">{run.prompt}</div>
                      <div className="mt-1 text-xs text-neutral-400">{new Date(run.createdAt).toLocaleString()}</div>
                      <div className="mt-3 space-y-2">
                        {run.outputs.map((output) => (
                          <div key={output.label} className="rounded-xl bg-neutral-50 px-3 py-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{output.label}</div>
                            <div className="mt-1 text-sm text-neutral-700 line-clamp-3">{output.output}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
              ) : null}
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Warnings</h2>
                <button type="button" onClick={() => togglePanel('warnings')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                  {collapsedPanels.warnings ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.warnings ? (
              <>
              {warnings.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-amber-900">
                  {warnings.map((warning) => (
                    <li key={warning} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">No major trait conflicts detected.</p>
              )}
              </>
              ) : null}
            </div>
              </>
            ) : isStepVisible(['sandbox']) ? (
              <div className="rounded-3xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-sky-950">Advanced tools are hidden in Beginner Mode</h2>
                <p className="mt-2 text-sm leading-6 text-sky-900">
                  Complete your first export to unlock version history, recommendation history, sandbox run archive, and advanced diagnostics.
                </p>
                <button
                  type="button"
                  onClick={() => openPersonaSection('exports', '#persona-exports')}
                  className="mt-3 rounded-full bg-[#0a66c2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#0958a8]"
                >
                  Go to export step
                </button>
              </div>
            ) : null}

            {isStepVisible(['exports']) ? (
            <div id="persona-exports" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Step 5: Export your persona profile</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => togglePanel('exports')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                    {collapsedPanels.exports ? 'Expand' : 'Collapse'}
                  </button>
                  <button onClick={handleCopyExportPack} title="Copy the active export pack (ChatGPT/API/Claude/JSON)." className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50">
                    Copy export
                  </button>
                </div>
              </div>
              {!collapsedPanels.exports ? (
              <>
              <p className="mt-1 text-xs text-neutral-500">Choose your output format, then copy or deploy it in your target stack.</p>
              <div
                className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  hasSavedProfile ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                }`}
              >
                {hasSavedProfile ? 'Ready to export' : 'Save your profile first for the strongest workflow'}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(['custom', 'gpt', 'api', 'claude', 'json'] as ExportTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      activeTab === tab ? 'bg-black text-white' : 'border border-neutral-300 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    {tab === 'custom'
                      ? 'ChatGPT Custom'
                      : tab === 'gpt'
                      ? 'GPT Instructions'
                      : tab === 'api'
                      ? 'API Prompt'
                      : tab === 'claude'
                      ? 'Claude Prompt'
                      : 'JSON Pack'}
                  </button>
                ))}
              </div>

              <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-800">
                {exportContent}
              </pre>
              </>
              ) : null}
            </div>
            ) : null}

            {showAdvancedPanels && isStepVisible(['share']) ? (
            <div id="persona-share" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Share / Import JSON</h2>
                <button type="button" onClick={() => togglePanel('share')} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100">
                  {collapsedPanels.share ? 'Expand' : 'Collapse'}
                </button>
              </div>
              {!collapsedPanels.share ? (
              <>
              <p className="mt-2 text-sm text-neutral-500">Copy this payload to move a personality between devices, or paste one here to import.</p>

              <label className="mt-4 block text-sm font-medium">Current share payload</label>
              <textarea value={sharePayload} readOnly className="mt-2 min-h-[180px] w-full rounded-2xl border border-neutral-300 bg-neutral-50 p-3 font-mono text-sm" />

              <label className="mt-4 block text-sm font-medium">Paste JSON to import</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="mt-2 min-h-[180px] w-full rounded-2xl border border-neutral-300 p-3 font-mono text-sm"
                placeholder='{"name":"My Profile","description":"...","traits":{...}}'
              />

              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={importJsonText} disabled={!canImportJson} title="Import the pasted JSON profile into Persona Foundry." className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Import JSON
                </button>
                <button onClick={() => setImportText('')} title="Clear the import text area." className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                  Clear
                </button>
              </div>
              <div
                className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  canImportJson ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                }`}
              >
                {canImportJson ? 'Ready to import JSON' : 'Paste JSON to enable import'}
              </div>
              </>
              ) : null}
            </div>
            ) : null}
          </section>
          ) : null}
        </div>
      </div>
    </main>
  )
}

