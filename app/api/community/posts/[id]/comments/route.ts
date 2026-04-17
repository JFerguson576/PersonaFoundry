import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { getAuthorName, normalizeText } from "@/lib/community"
import { logUsageEvent } from "@/lib/telemetry"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const postId = id

  if (!postId) {
    return NextResponse.json({ error: "Missing post id." }, { status: 400 })
  }

  const auth = await getRequestAuth(request)
  const supabase = createRouteClient(auth.accessToken ?? undefined)

  let query = supabase
    .from("community_comments")
    .select("id, post_id, user_id, author_name, body, status, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (!auth.user) {
    query = query.eq("status", "approved")
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Please sign in to comment." }, { status: 401 })
  }

  const { id } = await context.params
  const postId = id

  if (!postId) {
    return NextResponse.json({ error: "Missing post id." }, { status: 400 })
  }

  const supabase = createRouteClient(accessToken)

  let payload: Record<string, unknown> = {}
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const commentBody = normalizeText(payload.body)
  if (commentBody.length < 4) {
    return NextResponse.json({ error: "Please add a meaningful comment." }, { status: 400 })
  }

  const authorName = getAuthorName({
    metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    email: user.email,
  })

  const { data, error } = await supabase
    .from("community_comments")
    .insert([
      {
        post_id: postId,
        user_id: user.id,
        author_name: authorName,
        body: commentBody,
        status: "approved",
      },
    ])
    .select("id, post_id, user_id, author_name, body, status, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "platform",
    eventType: "community_comment_created",
    metadata: {
      post_id: postId,
      comment_id: data.id,
    },
  })

  return NextResponse.json({ comment: data })
}
