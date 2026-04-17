import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"
import { logUsageEvent } from "@/lib/telemetry"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Please sign in to vote." }, { status: 401 })
  }

  const { id } = await context.params
  const postId = id

  if (!postId) {
    return NextResponse.json({ error: "Missing post id." }, { status: 400 })
  }

  const supabase = createRouteClient(accessToken)

  const { data: existingVote } = await supabase
    .from("community_post_votes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle()

  let action: "added" | "removed" = "added"
  if (existingVote?.id) {
    action = "removed"
    const { error } = await supabase.from("community_post_votes").delete().eq("id", existingVote.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  } else {
    const { error } = await supabase.from("community_post_votes").insert([{ post_id: postId, user_id: user.id }])
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  const { count } = await supabase
    .from("community_post_votes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "platform",
    eventType: action === "added" ? "community_post_upvoted" : "community_post_upvote_removed",
    metadata: { post_id: postId },
  })

  return NextResponse.json({
    action,
    upvotes: count ?? 0,
  })
}
