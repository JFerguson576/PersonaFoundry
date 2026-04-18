import { NextResponse } from "next/server"
import { normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

type RouteProps = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(req: Request, { params }: RouteProps) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const documentId = normalizeString(id)
    const body = await req.json()
    const sourceType = normalizeString(body?.source_type)
    const title = normalizeString(body?.title)
    const contentText = normalizeString(body?.content_text)

    if (!documentId) {
      return NextResponse.json({ error: "document id is required" }, { status: 400 })
    }

    if (!sourceType) {
      return NextResponse.json({ error: "source_type is required" }, { status: 400 })
    }

    if (!contentText) {
      return NextResponse.json({ error: "content_text is required" }, { status: 400 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)

    const { data: existingDocument } = await supabase
      .from("career_source_documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single()

    if (!existingDocument) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { data: document, error } = await supabase
      .from("career_source_documents")
      .update({
        source_type: sourceType,
        title: title || null,
        content_text: contentText,
      })
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("id, candidate_id, source_type, title, content_text, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: RouteProps) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const documentId = normalizeString(id)

    if (!documentId) {
      return NextResponse.json({ error: "document id is required" }, { status: 400 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)

    const { data: existingDocument, error: existingError } = await supabase
      .from("career_source_documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single()

    if (existingError || !existingDocument) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("career_source_documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, deletedId: documentId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
