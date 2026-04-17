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

type AnalysisResult = {
  traits: Traits
  preset: string
  summary: string
  rationale: string[]
  confidence: 'Low' | 'Medium' | 'High'
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

const traitKeys = [
  'warmth',
  'bluntness',
  'humor',
  'formality',
  'creativity',
  'skepticism',
  'structure',
  'verbosity',
  'proactiveness',
  'technicalDepth',
  'empathy',
  'caution',
] as const

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function normalizeTraits(input: unknown): Traits {
  const source: Record<string, unknown> =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}

  return {
    warmth: clamp(Number(source.warmth ?? 50)),
    bluntness: clamp(Number(source.bluntness ?? 50)),
    humor: clamp(Number(source.humor ?? 40)),
    formality: clamp(Number(source.formality ?? 50)),
    creativity: clamp(Number(source.creativity ?? 60)),
    skepticism: clamp(Number(source.skepticism ?? 50)),
    structure: clamp(Number(source.structure ?? 70)),
    verbosity: clamp(Number(source.verbosity ?? 50)),
    proactiveness: clamp(Number(source.proactiveness ?? 60)),
    technicalDepth: clamp(Number(source.technicalDepth ?? 50)),
    empathy: clamp(Number(source.empathy ?? 50)),
    caution: clamp(Number(source.caution ?? 60)),
  }
}

function isConfidence(value: unknown): value is AnalysisResult['confidence'] {
  return value === 'Low' || value === 'Medium' || value === 'High'
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
    const model = process.env.OPENAI_ANALYZER_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY in server environment.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const text = String(body?.text || '').trim()

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
    }

    const prompt = `
You are analyzing a user's writing, profile, CV, bio, or uploaded text to infer a recommended AI assistant personality.

Score each trait from 0 to 100:
- warmth
- bluntness
- humor
- formality
- creativity
- skepticism
- structure
- verbosity
- proactiveness
- technicalDepth
- empathy
- caution

Then choose the best preset from:
- Blunt Engineer
- Warm Tutor
- Strategic Advisor
- Creative Brainstormer
- Skeptical Analyst
- Executive Advisor
- Startup Coach
- Technical Architect
- Research Analyst
- Chief of Staff
- Custom

Rules:
- Base the result only on the supplied text.
- Be conservative when evidence is weak.
- Use "Custom" if no preset is a strong fit.
- Keep rationale concise and specific.
- Summary should be 1 to 2 sentences.
- Confidence should be Low, Medium, or High.

Input text:
"""
${text.slice(0, 15000)}
"""
`.trim()

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 900,
        text: {
          format: {
            type: 'json_schema',
            name: 'personality_analysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                traits: {
                  type: 'object',
                  additionalProperties: false,
                  properties: Object.fromEntries(
                    traitKeys.map((key) => [
                      key,
                      { type: 'number', minimum: 0, maximum: 100 },
                    ])
                  ),
                  required: [...traitKeys],
                },
                preset: {
                  type: 'string',
                  enum: [
                    'Blunt Engineer',
                    'Warm Tutor',
                    'Strategic Advisor',
                    'Creative Brainstormer',
                    'Skeptical Analyst',
                    'Executive Advisor',
                    'Startup Coach',
                    'Technical Architect',
                    'Research Analyst',
                    'Chief of Staff',
                    'Custom',
                  ],
                },
                summary: { type: 'string' },
                rationale: {
                  type: 'array',
                  items: { type: 'string' },
                },
                confidence: {
                  type: 'string',
                  enum: ['Low', 'Medium', 'High'],
                },
              },
              required: ['traits', 'preset', 'summary', 'rationale', 'confidence'],
            },
          },
        },
      }),
    })

    const raw = await response.text()

    let data: OpenAIResponseEnvelope
    try {
      data = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'AI analyzer returned non-JSON output.' },
        { status: 500 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'AI analyzer request failed.' },
        { status: response.status }
      )
    }

    const jsonText = extractOutputText(data)

    if (!jsonText) {
      return NextResponse.json(
        { error: 'AI analyzer returned empty output.' },
        { status: 500 }
      )
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { error: 'AI analyzer returned invalid JSON content.' },
        { status: 500 }
      )
    }

    const result: AnalysisResult = {
      traits: normalizeTraits(parsed?.traits),
      preset: typeof parsed?.preset === 'string' ? parsed.preset : 'Custom',
      summary:
        typeof parsed?.summary === 'string'
          ? parsed.summary
          : 'AI analysis completed.',
      rationale: Array.isArray(parsed?.rationale)
        ? parsed.rationale.map((item: unknown) => String(item))
        : ['AI analysis completed.'],
      confidence: isConfidence(parsed?.confidence) ? parsed.confidence : 'Medium',
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('analyze-profile-ai route error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected AI analyzer error.',
      },
      { status: 500 }
    )
  }
}
