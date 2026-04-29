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
  start_time?: number | null
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
  daily_costs: { day_key: string; total_cost_usd: number }[]
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
    let detail = response.statusText || "Request failed"
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; type?: string; code?: string } }
      const message = parsed?.error?.message || ""
      if (message.toLowerCase().includes("incorrect api key") || message.toLowerCase().includes("invalid_api_key")) {
        detail = "Invalid OPENAI_ADMIN_KEY for organization usage endpoints"
      } else if (message) {
        detail = message
      }
    } catch {
      if (response.status === 401) {
        detail = "Invalid OPENAI_ADMIN_KEY for organization usage endpoints"
      }
    }
    throw new Error(`OpenAI usage request failed (${response.status}): ${detail}`)
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
      daily_costs: [],
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
    const dailyCosts: { day_key: string; total_cost_usd: number }[] = []

    for (const bucket of costResponse.data ?? []) {
      let bucketCost = 0
      for (const result of bucket.results ?? []) {
        bucketCost += Number(result.amount?.value ?? 0)
      }
      totalCostUsd += bucketCost
      const startTime = Number(bucket.start_time ?? 0)
      if (Number.isFinite(startTime) && startTime > 0) {
        const dayKey = new Date(startTime * 1000).toISOString().slice(0, 10)
        dailyCosts.push({
          day_key: dayKey,
          total_cost_usd: Number(bucketCost.toFixed(6)),
        })
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
      daily_costs: dailyCosts,
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
      daily_costs: [],
      error: error instanceof Error ? error.message : "Failed to load OpenAI organization usage",
    }
  }
}
