'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import PersonaChatSandbox from '@/components/PersonaChatSandbox'
import { PlatformModuleNav } from '@/components/navigation/PlatformModuleNav'
import { getOAuthRedirectTo } from '@/lib/oauth-return'

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

const LOCAL_DRAFT_KEY = 'personafoundry-draft-v2'
const LOCAL_VERSIONS_KEY = 'personafoundry-versions-v2'
const LOCAL_RECOMMENDATIONS_KEY = 'personafoundry-recommendations-v1'
const LOCAL_SANDBOX_RUNS_KEY = 'personafoundry-sandbox-runs-v1'

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
  return parts.join(' • ')
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

  const warnings = useMemo(() => detectWarnings(traits), [traits])
  const exportContent = useMemo(
    () => getExportPack(activeTab, traits, profileName, profileDescription),
    [activeTab, traits, profileName, profileDescription]
  )

  const sharePayload = useMemo(() => {
    return JSON.stringify({ name: profileName, description: profileDescription, traits }, null, 2)
  }, [profileDescription, profileName, traits])

  const personalityExplainer = useMemo(() => explainPersonality(traits), [traits])

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
    const redirectTo = getOAuthRedirectTo('/')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    })

    if (error) {
      console.error(`${provider} sign-in failed:`, error)
      const providerLabel = provider === 'linkedin_oidc' ? 'LinkedIn' : provider.charAt(0).toUpperCase() + provider.slice(1)
      flashMessage(`${providerLabel} sign-in failed: ${error.message}`)
    }
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

  function clearLocalDraft() {
    try {
      localStorage.removeItem(LOCAL_DRAFT_KEY)
      flashMessage('Browser draft cleared.')
    } catch (error) {
      console.error('Failed to clear local draft:', error)
      flashMessage('Could not clear browser draft.')
    }
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

  const isSignedIn = Boolean(session?.user)
  const platformModules = [
    {
      key: 'career-intelligence',
      order: '1',
      title: 'Career Intelligence',
      subtitle: 'Profile-to-outcome career workflow',
      detail: 'Candidate onboarding, document generation, interview prep, company dossiers, and job search actions.',
      href: '/career-intelligence',
      cta: 'Open Workspace',
    },
    {
      key: 'teamsync',
      order: '2',
      title: 'TeamSync',
      subtitle: 'Strengths-based team dynamics',
      detail: 'Analyze team or family Gallup strengths, run scenarios, and generate practical collaboration guidance.',
      href: '/teamsync',
      cta: 'Open Workspace',
    },
    {
      key: 'persona-foundry',
      order: '3',
      title: 'Persona Foundry',
      subtitle: 'Build your custom AI working voice',
      detail: 'Tune communication traits, test in sandbox, and export profile instructions for GPT and API workflows.',
      href: '/persona-foundry',
      cta: 'Open Studio',
    },
  ] as const

  return (
    <main className="min-h-screen bg-neutral-50 text-black">
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
        <div className="mb-8 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid gap-6 p-8 lg:grid-cols-[1.4fr_0.6fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">PersonaFoundry</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">Your AI Career Intelligence Platform</h1>
              <p className="mt-4 max-w-3xl text-neutral-600">
                Create a custom AI personality, then turn it into real career outcomes with guided CV and cover-letter drafting, company dossier research, interview prep, and live opportunity analysis.
              </p>

              <div className="mt-4 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">Build your custom GPT-style career personality</div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">Generate tailored CV, LinkedIn, and cover-letter assets</div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">Research target companies and align tone automatically</div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">Prepare interviews and run job, fit, and salary intelligence</div>
              </div>

              <div className="mt-5 inline-flex rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
                Persona DNA: {personaDNA(traits)}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {session?.user ? (
                  <Link
                    href="/career-intelligence"
                    className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Open Career Intelligence
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => signInWithProvider('google')}
                    className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Enroll Free
                  </button>
                )}
                <Link
                  href="/career-intelligence"
                  className="inline-flex rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Explore Career Intelligence
                </Link>
                <Link
                  href="/career-test"
                  className="inline-flex rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Take Career Test
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold uppercase tracking-[0.12em] text-neutral-500">Menu</span>
                <a href="#about" className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-700 hover:bg-neutral-50">
                  About
                </a>
                <a href="#help" className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-700 hover:bg-neutral-50">
                  Help
                </a>
                <a href="#pricing" className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-700 hover:bg-neutral-50">
                  Pricing
                </a>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {platformModules.map((module) => (
                  <article key={module.key} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Module {module.order}</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          isSignedIn
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                        }`}
                      >
                        {isSignedIn ? 'Ready' : 'Sign in required'}
                      </span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-[#0f172a]">{module.title}</h2>
                    <p className="mt-1 text-xs font-medium text-[#334155]">{module.subtitle}</p>
                    <p className="mt-2 text-xs leading-5 text-[#475569]">{module.detail}</p>
                    <Link
                      href={module.href}
                      title={isSignedIn ? `Open ${module.title}` : `Open ${module.title} (sign in from account panel if needed)`}
                      className={`mt-3 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold ${
                        isSignedIn
                          ? 'bg-[#0f172a] text-white hover:bg-[#1e293b]'
                          : 'border border-neutral-300 bg-white text-[#334155] hover:bg-neutral-50'
                      }`}
                    >
                      {isSignedIn ? module.cta : 'Sign in, then open'}
                    </Link>
                  </article>
                ))}
              </div>

              <div className="mt-5 grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">How it works · 1</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-900">Create your workspace</div>
                  <p className="mt-1 text-xs text-neutral-600">Sign up, add your details, and open your candidate workspace.</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">How it works · 2</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-900">Load key inputs</div>
                  <p className="mt-1 text-xs text-neutral-600">Upload CV, Gallup Strengths, LinkedIn, and supporting proof.</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">How it works · 3</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-900">Generate and execute</div>
                  <p className="mt-1 text-xs text-neutral-600">Create assets, prepare interviews, and run market intelligence.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-900 p-5 text-white">
              <div className="text-sm text-neutral-300">Current voice</div>
              <div className="mt-2 text-2xl font-semibold">{voiceSummary(traits)}</div>

              <div className="mt-4 text-sm text-neutral-300">Preset / mode</div>
              <div className="mt-1 font-medium">{activePreset}</div>

              <div className="mt-5 border-t border-neutral-700 pt-4">
                <div className="text-sm text-neutral-300">Account</div>

                {session?.user ? (
                  <div className="mt-2">
                    <div className="text-sm font-medium">{session.user.email}</div>
                    <button
                      onClick={signOut}
                      className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="text-sm text-neutral-300">Not signed in</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => signInWithProvider('google')}
                        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200"
                      >
                        Google
                      </button>
                      <button
                        onClick={() => signInWithProvider('facebook')}
                        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200"
                      >
                        Facebook
                      </button>
                      <button
                        onClick={() => signInWithProvider('linkedin_oidc')}
                        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200"
                      >
                        LinkedIn
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400">Google works now. Facebook and LinkedIn need to be enabled in Supabase Auth Providers first.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <article id="about" className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">About</div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">What this platform does</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Persona Foundry helps people build a stronger career system using AI: define personal voice, generate high-quality job assets, and run practical decision support across career and team contexts.
            </p>
          </article>

          <article id="help" className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Help</div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">How to get started</h2>
            <ol className="mt-2 space-y-1 text-sm leading-6 text-neutral-600">
              <li>1. Sign in and create your workspace.</li>
              <li>2. Upload your core files (CV + Gallup strengths).</li>
              <li>3. Run generators and review saved outputs.</li>
              <li>4. Use TeamSync for strengths-based scenario planning.</li>
            </ol>
          </article>

          <article id="pricing" className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Pricing</div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">Pricing starter copy</h2>
            <div className="mt-2 space-y-2 text-sm text-neutral-600">
              <p><span className="font-semibold text-neutral-900">Starter:</span> Basic workspace + core generators.</p>
              <p><span className="font-semibold text-neutral-900">Pro:</span> Full career intelligence + advanced exports.</p>
              <p><span className="font-semibold text-neutral-900">Team:</span> TeamSync group analysis + collaboration tools.</p>
            </div>
            <p className="mt-3 text-xs text-neutral-500">You can replace this with final pricing once your packaging is ready.</p>
          </article>
        </section>

        {flashNotice && (
          <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {flashNotice}
          </div>
        )}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Presets</h2>
            <span className="text-sm text-neutral-500">Instant archetypes</span>
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

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Role templates</h2>
            <span className="text-sm text-neutral-500">Use-case starting points</span>
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

        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-8">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Analyze and synthesize profile text</h2>
              <p className="mt-2 text-sm text-neutral-500">
                Paste text, upload one document, or synthesize up to five documents into one personality profile.
              </p>

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
                <button
                  onClick={runProfileAnalysis}
                  disabled={aiAnalyzing}
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                    aiAnalyzing ? 'cursor-not-allowed bg-neutral-400' : 'bg-black'
                  }`}
                >
                  Analyze pasted text
                </button>

                <button
                  onClick={() => void runAiProfileAnalysis()}
                  disabled={aiAnalyzing}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                    aiAnalyzing ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400' : 'border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {aiAnalyzing ? 'AI analyzing...' : 'Analyze with AI'}
                </button>

                <button
                  onClick={() => {
                    setAnalysisText('')
                    clearAnalysisState()
                  }}
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
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Trait controls</h2>
                  <p className="mt-1 text-sm text-neutral-500">Fine-tune how the assistant behaves.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={resetTraits} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Reset traits
                  </button>
                  <button onClick={handleSaveVersionWithNote} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Save version
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

              <div className="space-y-5">
                {(Object.keys(traits) as (keyof Traits)[]).map((key) => (
                  <div key={key} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div>
                        <label className="text-sm font-semibold">{labels[key]}</label>
                        <p className="mt-1 text-xs text-neutral-500">{traitDescriptions[key]}</p>
                      </div>
                      <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                        {traits[key]} · {getTraitTone(traits[key])}
                      </div>
                    </div>

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
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Personality explainer</h2>
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
            </div>

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

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Profile details</h2>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Profile name</label>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="My Personality"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <input
                    value={profileDescription}
                    onChange={(e) => setProfileDescription(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="Short description"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={saveCurrentProfile}
                    disabled={!session?.user}
                    className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                      session?.user ? 'bg-black' : 'cursor-not-allowed bg-neutral-400'
                    }`}
                  >
                    {session?.user ? 'Save to cloud' : 'Sign in to save'}
                  </button>
                  <button onClick={duplicateCurrentProfile} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Duplicate profile
                  </button>
                  <button onClick={exportJsonFile} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Export JSON
                  </button>
                  <button onClick={() => copyTextToClipboard(sharePayload, 'Share JSON copied.')} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Copy share JSON
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={() => flashMessage('Browser draft auto-saved.')} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Draft saved locally
                  </button>
                  <button onClick={clearLocalDraft} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                    Clear browser draft
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Saved profiles</h2>
              {!session?.user ? (
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
              )}
            </div>
          </section>

          <section className="space-y-6">
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

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Version history</h2>
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
                              {version.source} • {new Date(version.createdAt).toLocaleString()}
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
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Recommendation history</h2>
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
                            {entry.sourceLabel} • {entry.confidence} • {new Date(entry.createdAt).toLocaleString()}
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
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Saved sandbox runs</h2>
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
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Warnings</h2>
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
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Export packs</h2>
                <button onClick={() => copyTextToClipboard(exportContent, 'Export copied.')} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50">
                  Copy export
                </button>
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
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Share / Import JSON</h2>
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
                <button onClick={importJsonText} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                  Import JSON
                </button>
                <button onClick={() => setImportText('')} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                  Clear
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
