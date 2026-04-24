type TelemetryClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>[]) => PromiseLike<{ error?: { message?: string } | null }> | unknown
  }
}

type UsageEventInput = {
  userId?: string | null
  module: string
  eventType: string
  candidateId?: string | null
  metadata?: Record<string, unknown>
}

type ApiUsageInput = {
  userId?: string | null
  module: string
  feature: string
  model: string
  provider?: "openai" | "codex"
  status: "success" | "error"
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  metadata?: Record<string, unknown>
}

function parseNumeric(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function estimateOpenAICost(model: string, inputTokens?: number | null, outputTokens?: number | null) {
  const normalized = model.toUpperCase().replace(/[^A-Z0-9]/g, "_")
  const inputPrice = parseNumeric(process.env[`OPENAI_PRICE_${normalized}_INPUT_PER_1M`])
  const outputPrice = parseNumeric(process.env[`OPENAI_PRICE_${normalized}_OUTPUT_PER_1M`])

  if (inputPrice == null || outputPrice == null) {
    return null
  }

  const inputCost = ((inputTokens ?? 0) / 1_000_000) * inputPrice
  const outputCost = ((outputTokens ?? 0) / 1_000_000) * outputPrice

  return Number((inputCost + outputCost).toFixed(6))
}

export async function logUsageEvent(client: TelemetryClient, input: UsageEventInput) {
  try {
    await client.from("usage_events").insert([
      {
        user_id: input.userId ?? null,
        module: input.module,
        event_type: input.eventType,
        candidate_id: input.candidateId ?? null,
        metadata: input.metadata ?? {},
      },
    ])
  } catch {}
}

export async function logApiUsage(client: TelemetryClient, input: ApiUsageInput) {
  try {
    const inferredProvider = input.provider ?? (input.model.toLowerCase().includes("codex") ? "codex" : "openai")
    await client.from("api_usage_logs").insert([
      {
        user_id: input.userId ?? null,
        module: input.module,
        feature: input.feature,
        provider: inferredProvider,
        model: input.model,
        status: input.status,
        input_tokens: input.inputTokens ?? null,
        output_tokens: input.outputTokens ?? null,
        total_tokens: input.totalTokens ?? null,
        estimated_cost_usd: estimateOpenAICost(input.model, input.inputTokens, input.outputTokens),
        metadata: input.metadata ?? {},
      },
    ])
  } catch {}
}
