type OpenAIUsageBucketResult = {
  input_tokens?: number | null
  output_tokens?: number | null
  num_model_requests?: number | null
}

type OpenAIUsageBucket = {
  results?: OpenAIUsageBucketResult[] | null
}

type OpenAIUsageResponse = {
  data?: OpenAIUsageBucket[] | null
}

type OpenAICostBucketResult = {
  amount?: {
    value?: number | null
  } | null
}

type OpenAICostBucket = {
  results?: OpenAICostBucketResult[] | null
}

type OpenAICostResponse = {
  data?: OpenAICostBucket[] | null
}

export type OpenAIOrganizationUsageSummary = {
  available: boolean
  source: "openai_org_api" | "telemetry_only"
  window_days: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_requests: number
  total_cost_usd: number
  error?: string | null
}

async function fetchJson<T>(url: string, adminKey: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI usage request failed (${response.status}): ${text || response.statusText}`)
  }

  return (await response.json()) as T
}

export async function getOpenAIOrganizationUsageSummary(windowDays = 7): Promise<OpenAIOrganizationUsageSummary> {
  const adminKey = process.env.OPENAI_ADMIN_KEY

  if (!adminKey) {
    return {
      available: false,
      source: "telemetry_only",
      window_days: windowDays,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      total_requests: 0,
      total_cost_usd: 0,
      error: "Missing OPENAI_ADMIN_KEY",
    }
  }

  try {
    const endTime = Math.floor(Date.now() / 1000)
    const startTime = endTime - windowDays * 24 * 60 * 60
    const usageUrl = `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=${windowDays}`
    const costUrl = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=${windowDays}`

    const [usageResponse, costResponse] = await Promise.all([
      fetchJson<OpenAIUsageResponse>(usageUrl, adminKey),
      fetchJson<OpenAICostResponse>(costUrl, adminKey),
    ])

    let inputTokens = 0
    let outputTokens = 0
    let totalRequests = 0

    for (const bucket of usageResponse.data ?? []) {
      for (const result of bucket.results ?? []) {
        inputTokens += result.input_tokens ?? 0
        outputTokens += result.output_tokens ?? 0
        totalRequests += result.num_model_requests ?? 0
      }
    }

    let totalCostUsd = 0

    for (const bucket of costResponse.data ?? []) {
      for (const result of bucket.results ?? []) {
        totalCostUsd += Number(result.amount?.value ?? 0)
      }
    }

    return {
      available: true,
      source: "openai_org_api",
      window_days: windowDays,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      total_requests: totalRequests,
      total_cost_usd: Number(totalCostUsd.toFixed(6)),
      error: null,
    }
  } catch (error) {
    return {
      available: false,
      source: "telemetry_only",
      window_days: windowDays,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      total_requests: 0,
      total_cost_usd: 0,
      error: error instanceof Error ? error.message : "Failed to load OpenAI organization usage",
    }
  }
}
