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
  interactionKey?: string | null
  schemaVersion?: string | null
  qualityScoreTotal?: number | null
  userActionAfterOutput?: string | null
  timeToFirstActionMs?: number | null
  metadata?: Record<string, unknown>
}

function parseNumeric(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type ModelPrice = {
  inputPer1M: number
  outputPer1M: number
}

const FALLBACK_MODEL_PRICES: Record<string, ModelPrice> = {
  GPT_5: { inputPer1M: 1.25, outputPer1M: 10 },
  GPT_5_3: { inputPer1M: 1.25, outputPer1M: 10 },
  GPT_5_4: { inputPer1M: 1.25, outputPer1M: 10 },
  GPT_5_3_MEDIUM: { inputPer1M: 1.25, outputPer1M: 10 },
  GPT_5_4_MINI: { inputPer1M: 0.25, outputPer1M: 2 },
  GPT_5_MINI: { inputPer1M: 0.25, outputPer1M: 2 },
}

function resolveModelPrice(model: string) {
  const normalized = model.toUpperCase().replace(/[^A-Z0-9]/g, "_")
  const directInput = parseNumeric(process.env[`OPENAI_PRICE_${normalized}_INPUT_PER_1M`])
  const directOutput = parseNumeric(process.env[`OPENAI_PRICE_${normalized}_OUTPUT_PER_1M`])
  if (directInput != null && directOutput != null) {
    return { inputPer1M: directInput, outputPer1M: directOutput }
  }

  const familyKey = normalized
    .split("_")
    .slice(0, 3)
    .join("_")
  const familyInput = parseNumeric(process.env[`OPENAI_PRICE_${familyKey}_INPUT_PER_1M`])
  const familyOutput = parseNumeric(process.env[`OPENAI_PRICE_${familyKey}_OUTPUT_PER_1M`])
  if (familyInput != null && familyOutput != null) {
    return { inputPer1M: familyInput, outputPer1M: familyOutput }
  }

  const defaultInput = parseNumeric(process.env.OPENAI_PRICE_DEFAULT_INPUT_PER_1M)
  const defaultOutput = parseNumeric(process.env.OPENAI_PRICE_DEFAULT_OUTPUT_PER_1M)
  if (defaultInput != null && defaultOutput != null) {
    return { inputPer1M: defaultInput, outputPer1M: defaultOutput }
  }

  return FALLBACK_MODEL_PRICES[normalized] ?? FALLBACK_MODEL_PRICES[familyKey] ?? null
}

export function estimateOpenAICost(
  model: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
  totalTokens?: number | null
) {
  const price = resolveModelPrice(model)
  if (!price) return null

  let normalizedInputTokens = inputTokens ?? 0
  let normalizedOutputTokens = outputTokens ?? 0

  if (
    totalTokens != null &&
    Number.isFinite(totalTokens) &&
    totalTokens > 0 &&
    normalizedInputTokens === 0 &&
    normalizedOutputTokens === 0
  ) {
    // Backfill older telemetry rows that only have total tokens.
    normalizedInputTokens = Math.round(totalTokens * 0.7)
    normalizedOutputTokens = Math.max(0, totalTokens - normalizedInputTokens)
  }

  const inputCost = (normalizedInputTokens / 1_000_000) * price.inputPer1M
  const outputCost = (normalizedOutputTokens / 1_000_000) * price.outputPer1M

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
        estimated_cost_usd: estimateOpenAICost(input.model, input.inputTokens, input.outputTokens, input.totalTokens),
        interaction_key: input.interactionKey ?? null,
        schema_version: input.schemaVersion ?? null,
        quality_score_total: input.qualityScoreTotal ?? null,
        user_action_after_output: input.userActionAfterOutput ?? null,
        time_to_first_action_ms: input.timeToFirstActionMs ?? null,
        metadata: input.metadata ?? {},
      },
    ])
  } catch {}
}
