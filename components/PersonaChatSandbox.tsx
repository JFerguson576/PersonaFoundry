'use client'

import { useMemo, useState } from 'react'

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

type SandboxResult = {
  label: string
  output: string
}

type Props = {
  currentTraits: Traits
  onSaveRun?: (run: { prompt: string; outputs: SandboxResult[] }) => void
}

const balancedProfile: { label: string; traits: Traits } = {
  label: 'Balanced Default',
  traits: {
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
  },
}

const presetProfiles: { label: string; traits: Traits }[] = [
  {
    label: 'Blunt Engineer',
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
    label: 'Warm Tutor',
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
    label: 'Strategic Advisor',
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
]

const starterPrompts = [
  'How should I expand my business into Europe?',
  'Explain quantum computing to a beginner.',
  'Give me feedback on my product idea.',
  'How do I handle a difficult stakeholder meeting?',
]

export default function PersonaChatSandbox({ currentTraits, onSaveRun }: Props) {
  const [message, setMessage] = useState(starterPrompts[0])
  const [results, setResults] = useState<SandboxResult[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [includeBalanced, setIncludeBalanced] = useState(true)
  const [includePresets, setIncludePresets] = useState(true)

  const profiles = useMemo(() => {
    const nextProfiles: { label: string; traits: Traits }[] = [
      { label: 'Your Current Profile', traits: currentTraits },
    ]

    if (includeBalanced) {
      nextProfiles.push(balancedProfile)
    }

    if (includePresets) {
      nextProfiles.push(...presetProfiles)
    }

    return nextProfiles
  }, [currentTraits, includeBalanced, includePresets])

  async function runSandbox() {
    const trimmed = message.trim()
    if (!trimmed) {
      setError('Enter a test message first.')
      return
    }

    try {
      setRunning(true)
      setError('')
      setResults([])

      const response = await fetch('/api/chat-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          profiles,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error || 'Sandbox request failed.')
        return
      }

      const nextResults = Array.isArray(payload?.results) ? payload.results : []
      setResults(nextResults)
    } catch (err) {
      console.error('Sandbox failed:', err)
      setError('Failed to run the chat sandbox.')
    } finally {
      setRunning(false)
    }
  }

  function saveRun() {
    if (!message.trim() || results.length === 0) return
    onSaveRun?.({
      prompt: message.trim(),
      outputs: results,
    })
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Test-drive chat sandbox</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Run the same prompt across multiple personalities and compare the outputs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setMessage(prompt)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
            >
              Use example
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="mt-4 min-h-[140px] w-full rounded-2xl border border-neutral-300 p-3 text-sm"
        placeholder="Type a message to test different personalities..."
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={includeBalanced}
            onChange={(e) => setIncludeBalanced(e.target.checked)}
          />
          Include balanced default
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={includePresets}
            onChange={(e) => setIncludePresets(e.target.checked)}
          />
          Include preset comparisons
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={runSandbox}
          disabled={running}
          className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
            running ? 'cursor-not-allowed bg-neutral-400' : 'bg-black'
          }`}
        >
          {running ? 'Running sandbox...' : 'Run sandbox'}
        </button>

        <button
          onClick={saveRun}
          disabled={results.length === 0}
          className={`rounded-xl border px-4 py-2 text-sm font-medium ${
            results.length === 0
              ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
              : 'border-neutral-300 hover:bg-neutral-50'
          }`}
        >
          Save run
        </button>

        <button
          onClick={() => {
            setMessage('')
            setResults([])
            setError('')
          }}
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {results.map((result) => (
            <div key={result.label} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                  {result.label}
                </h3>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                {result.output}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}