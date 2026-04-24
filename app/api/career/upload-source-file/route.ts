import { NextResponse } from "next/server"
import { extractTextFromCareerUpload } from "@/lib/career-upload"
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
    const formData = await req.formData()
    const file = formData.get("file")
    const candidateId = normalizeString(formData.get("candidate_id"))
    const sourceType = normalizeString(formData.get("source_type"))
    const submittedTitle = normalizeString(formData.get("title"))

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 })
    }

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 })
    }

    if (!sourceType) {
      return NextResponse.json({ error: "source_type is required" }, { status: 400 })
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

    let contentText = await extractTextFromCareerUpload(file)
    let extractionWarning: string | null = null
    if (!contentText) {
      contentText = `[Uploaded file: ${file.name}]\n\nReadable text could not be extracted from this file automatically.\nAdd a short summary in the text field if needed.`
      extractionWarning = "We could not auto-read text from this file, so we saved it as a file reference. Add a short summary manually if needed."
    }

    const title = submittedTitle || file.name.replace(/\.[^.]+$/, "")

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
      .select("id, candidate_id, source_type, title, content_text, created_at")
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
        upload_file_name: file.name,
      },
    })

    return NextResponse.json({
      document,
      file_name: file.name,
      warning: extractionWarning,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
