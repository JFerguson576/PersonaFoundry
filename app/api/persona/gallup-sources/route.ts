import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

export async function GET(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)

    const { data: docs, error: docsError } = await supabase
      .from("career_source_documents")
      .select("id, candidate_id, title, content_text, source_type, created_at")
      .eq("user_id", user.id)
      .in("source_type", ["gallup_strengths", "strengths"])
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50)

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 400 })
    }

    const candidateIds = Array.from(new Set((docs ?? []).map((doc) => doc.candidate_id).filter(Boolean)))

    let candidateNameById = new Map<string, string>()
    if (candidateIds.length > 0) {
      const { data: candidates, error: candidateError } = await supabase
        .from("career_candidates")
        .select("id, full_name")
        .eq("user_id", user.id)
        .in("id", candidateIds)

      if (candidateError) {
        return NextResponse.json({ error: candidateError.message }, { status: 400 })
      }

      candidateNameById = new Map((candidates ?? []).map((candidate) => [candidate.id, candidate.full_name || "Candidate"]))
    }

    const sources = (docs ?? []).map((doc) => ({
      id: doc.id,
      candidate_id: doc.candidate_id,
      candidate_name: candidateNameById.get(doc.candidate_id) || "Candidate",
      title: doc.title || "Gallup Strengths",
      content_text: doc.content_text || "",
      source_type: doc.source_type,
      created_at: doc.created_at,
    }))

    return NextResponse.json({ sources })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

