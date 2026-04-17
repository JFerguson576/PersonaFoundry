import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

export async function POST(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)

    const body = await req.json()
    const candidateId = normalizeString(body?.candidate_id)
    const sourceType = normalizeString(body?.source_type)
    const title = normalizeString(body?.title)
    const contentText = normalizeString(body?.content_text)

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 })
    }

    if (!sourceType) {
      return NextResponse.json({ error: "source_type is required" }, { status: 400 })
    }

    if (!contentText) {
      return NextResponse.json({ error: "content_text is required" }, { status: 400 })
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("career_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single()

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    const { data: document, error } = await supabase
      .from("career_source_documents")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          source_type: sourceType,
          title: title || null,
          content_text: contentText,
          is_active: true,
        },
      ])
      .select("id, candidate_id, source_type, title, content_text")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logUsageEvent(supabase, {
      userId: user.id,
      module: "career_advisor",
      eventType: "background_material_saved",
      candidateId,
      metadata: {
        source_type: sourceType,
        title: title || null,
      },
    })

    return NextResponse.json({ document })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
