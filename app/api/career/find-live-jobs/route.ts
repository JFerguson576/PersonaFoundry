import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { runLiveJobSearch } from "@/lib/career-live-jobs"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const { user, accessToken, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)
    const body = await req.json()
    const candidateId = normalizeString(body?.candidate_id)
    const targetRole = normalizeString(body?.target_role)
    const location = normalizeString(body?.location)
    const marketNotes = normalizeString(body?.market_notes)

    if (!candidateId || !targetRole) {
      return NextResponse.json({ error: "candidate_id and target_role are required" }, { status: 400 })
    }
    const result = await runLiveJobSearch({
      supabase,
      userId: user.id,
      candidateId,
      targetRole,
      location,
      marketNotes,
    })

    return NextResponse.json({ asset: result.asset })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
