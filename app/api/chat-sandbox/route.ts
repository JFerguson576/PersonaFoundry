import { NextRequest, NextResponse } from 'next/server'

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

type SandboxProfile = {
  label: string
  traits: Traits
}

type OpenAIResponseContent = {
  type?: string
  text?: string
}

type OpenAIResponseItem = {
  content?: OpenAIResponseContent[]
}

type OpenAIResponseEnvelope = {
  output_text?: string
  output?: OpenAIResponseItem[]
  error?: {
    message?: string
  }
}

function getLevel(value: number) {
  if (value < 20) return 'very_low'
  if (value < 40) return 'low'
  if (value < 60) return 'medium'
  if (value < 80) return 'high'
  return 'very_high'
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

function buildInstructions(traits: Traits) {
  const rule = <K extends keyof Traits>(key: K) =>
    traitRules[key][getLevel(traits[key]) as keyof (typeof traitRules)[K]]

  return `
You are a configurable AI assistant.

Style:
- ${rule('warmth')}
- ${rule('bluntness')}
- ${rule('humor')}
- ${rule('formality')}

Behavior:
- ${rule('skepticism')}
- ${rule('proactiveness')}
- ${rule('empathy')}
- ${rule('caution')}

Depth:
- ${rule('technicalDepth')}
- ${rule('verbosity')}

Output:
- ${rule('structure')}
- ${rule('creativity')}

Boundaries:
- Do not fabricate facts.
- State uncertainty clearly when unsure.
- Adapt to the user's goal and context.
`.trim()
}

function extractOutputText(data: OpenAIResponseEnvelope): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const parts: string[] = []

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue
      for (const content of item.content) {
        if (content?.type === 'output_text' && typeof content?.text === 'string') {
          parts.push(content.text)
        }
      }
    }
  }

  return parts.join('\n').trim()
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_SANDBOX_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY in server environment.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const message = String(body?.message || '').trim()
    const profiles = Array.isArray(body?.profiles) ? (body.profiles as SandboxProfile[]) : []

    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    if (!profiles.length) {
      return NextResponse.json({ error: 'At least one profile is required.' }, { status: 400 })
    }

    const results = await Promise.all(
      profiles.map(async (profile) => {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            instructions: buildInstructions(profile.traits),
            input: message,
            max_output_tokens: 700,
          }),
        })

        const raw = await response.text()

        let data: OpenAIResponseEnvelope
        try {
          data = JSON.parse(raw)
        } catch {
          return {
            label: profile.label,
            output: 'The sandbox returned non-JSON output.',
          }
        }

        if (!response.ok) {
          return {
            label: profile.label,
            output: data?.error?.message || 'Sandbox request failed.',
          }
        }

        return {
          label: profile.label,
          output: extractOutputText(data) || 'No output returned.',
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    console.error('chat-sandbox route error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected sandbox error.',
      },
      { status: 500 }
    )
  }
}
