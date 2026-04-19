import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

type TourModule = "career" | "persona" | "teamsync"

const allowedModules = new Set<TourModule>(["career", "persona", "teamsync"])

function normalizeModule(value: unknown): TourModule | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  if (!allowedModules.has(trimmed as TourModule)) return null
  return trimmed as TourModule
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return error.code === "42P01" || (error.message || "").toLowerCase().includes("user_tour_progress")
}

export async function GET(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const moduleName = normalizeModule(url.searchParams.get("module"))
  if (!moduleName) {
    return NextResponse.json({ error: "module is required" }, { status: 400 })
  }

  const supabase = createRouteClient(accessToken ?? undefined)
  const { data, error } = await supabase
    .from("user_tour_progress")
    .select("completed")
    .eq("user_id", user.id)
    .eq("module", moduleName)
    .eq("tour_version", "2026-04-20-v1")
    .maybeSingle()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ completed: null, table_missing: true })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ completed: data?.completed ?? false, table_missing: false })
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)
  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  let payload: { module?: string; completed?: boolean } = {}
  try {
    payload = (await request.json()) as { module?: string; completed?: boolean }
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const moduleName = normalizeModule(payload.module)
  if (!moduleName) {
    return NextResponse.json({ error: "module is required" }, { status: 400 })
  }

  const completed = payload.completed === true
  const supabase = createRouteClient(accessToken ?? undefined)

  const { error } = await supabase
    .from("user_tour_progress")
    .upsert(
      [
        {
          user_id: user.id,
          module: moduleName,
          tour_version: "2026-04-20-v1",
          completed,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id,module,tour_version" }
    )

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ completed, table_missing: true })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ completed, table_missing: false })
}
