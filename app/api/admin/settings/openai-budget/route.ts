import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

const SETTING_KEY = "openai_monthly_budget_usd"

function parseBudgetValue(rawValue: unknown) {
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
    return null
  }

  return Number(rawValue.toFixed(2))
}

export async function PATCH(req: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })

    if (!capabilities.isSuperuser) {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 })
    }

    const admin = createAdminClient()

    if (!admin) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to enable admin settings updates." },
        { status: 500 }
      )
    }

    const body = (await req.json()) as { openai_monthly_budget_usd?: unknown }
    const budgetValue = parseBudgetValue(body.openai_monthly_budget_usd)

    if (budgetValue === null) {
      return NextResponse.json({ error: "Enter a budget greater than 0." }, { status: 400 })
    }

    const { error } = await admin.from("admin_settings").upsert(
      {
        key: SETTING_KEY,
        value_json: { value: budgetValue },
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )

    if (error) {
      throw error
    }

    await logUsageEvent(admin, {
      userId: user.id,
      module: "admin",
      eventType: "openai_budget_updated",
      metadata: {
        openai_monthly_budget_usd: budgetValue,
      },
    })

    return NextResponse.json({
      openai_monthly_budget_usd: budgetValue,
      source: "database",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
