import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

export async function GET(request: Request) {
  const { user, errorMessage } = await getRequestAuth(request)

  if (!user) {
    return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
  }

  const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
  if (!capabilities.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 })
  }

  const [{ data: posts, error }, { data: votes }, { data: comments }] = await Promise.all([
    admin
      .from("community_posts")
      .select("id, user_id, author_name, post_type, title, summary, body, impact_area, status, is_featured, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(250),
    admin.from("community_post_votes").select("post_id, user_id"),
    admin.from("community_comments").select("post_id, status"),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const voteCounts = (votes ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.post_id] = (acc[row.post_id] ?? 0) + 1
    return acc
  }, {})

  const commentCounts = (comments ?? []).reduce<Record<string, number>>((acc, row) => {
    if (row.status !== "approved") return acc
    acc[row.post_id] = (acc[row.post_id] ?? 0) + 1
    return acc
  }, {})

  const normalizedPosts = (posts ?? []).map((post) => ({
    ...post,
    upvotes: voteCounts[post.id] ?? 0,
    comments: commentCounts[post.id] ?? 0,
  }))

  return NextResponse.json({ posts: normalizedPosts })
}
