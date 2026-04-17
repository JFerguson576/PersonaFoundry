import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { getRequestAuth } from "@/lib/supabase/auth"
import { getAdminCapabilities } from "@/lib/admin"
import { getAuthorName, normalizeCommunityType, normalizeText, toNullableText, type CommunityPostType } from "@/lib/community"
import { logUsageEvent } from "@/lib/telemetry"

type PostRow = {
  id: string
  user_id: string
  author_name: string | null
  post_type: CommunityPostType
  title: string
  summary: string | null
  body: string
  impact_area: string | null
  status: "pending" | "approved" | "hidden"
  is_featured: boolean
  created_at: string
  updated_at: string
}

type CommentRow = {
  post_id: string
}

type VoteRow = {
  post_id: string
  user_id: string
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request)
  const user = auth.user
  const accessToken = auth.accessToken ?? undefined
  const supabase = createRouteClient(accessToken)

  const capabilities = user
    ? await getAdminCapabilities({ userId: user.id, email: user.email })
    : { isAdmin: false, isSuperuser: false, roles: [] }

  const searchParams = new URL(request.url).searchParams
  const requestedType = searchParams.get("type")
  const featuredOnly = searchParams.get("featured") === "1"

  let query = supabase
    .from("community_posts")
    .select("id, user_id, author_name, post_type, title, summary, body, impact_area, status, is_featured, created_at, updated_at")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80)

  if (requestedType === "idea" || requestedType === "success_story") {
    query = query.eq("post_type", requestedType)
  }

  if (featuredOnly) {
    query = query.eq("is_featured", true).eq("status", "approved")
  }

  if (!capabilities.isAdmin && !featuredOnly) {
    if (user) {
      query = query.or(`status.eq.approved,user_id.eq.${user.id}`)
    } else {
      query = query.eq("status", "approved")
    }
  }

  const { data: posts, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const postRows = (posts ?? []) as PostRow[]
  const postIds = postRows.map((row) => row.id)

  if (postIds.length === 0) {
    return NextResponse.json({ posts: [] })
  }

  const [{ data: commentsData }, { data: votesData }] = await Promise.all([
    supabase.from("community_comments").select("post_id").in("post_id", postIds).eq("status", "approved"),
    supabase.from("community_post_votes").select("post_id, user_id").in("post_id", postIds),
  ])

  const comments = (commentsData ?? []) as CommentRow[]
  const votes = (votesData ?? []) as VoteRow[]

  const commentCounts = comments.reduce<Record<string, number>>((accumulator, comment) => {
    accumulator[comment.post_id] = (accumulator[comment.post_id] ?? 0) + 1
    return accumulator
  }, {})

  const voteCounts = votes.reduce<Record<string, number>>((accumulator, vote) => {
    accumulator[vote.post_id] = (accumulator[vote.post_id] ?? 0) + 1
    return accumulator
  }, {})

  const votedPostIds = user
    ? new Set(votes.filter((vote) => vote.user_id === user.id).map((vote) => vote.post_id))
    : new Set<string>()

  return NextResponse.json({
    posts: postRows.map((post) => ({
      ...post,
      upvotes: voteCounts[post.id] ?? 0,
      comments: commentCounts[post.id] ?? 0,
      viewer_has_upvoted: votedPostIds.has(post.id),
      viewer_is_author: Boolean(user && post.user_id === user.id),
    })),
  })
}

export async function POST(request: Request) {
  const { user, accessToken, errorMessage } = await getRequestAuth(request)

  if (!user || !accessToken) {
    return NextResponse.json({ error: errorMessage || "Please sign in to post." }, { status: 401 })
  }

  const supabase = createRouteClient(accessToken)

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const postType = normalizeCommunityType(body.post_type)
  const title = normalizeText(body.title)
  const summary = toNullableText(body.summary)
  const postBody = normalizeText(body.body)
  const impactArea = toNullableText(body.impact_area)

  if (title.length < 6) {
    return NextResponse.json({ error: "Please add a clear title (at least 6 characters)." }, { status: 400 })
  }

  if (postBody.length < 20) {
    return NextResponse.json({ error: "Please add more detail (at least 20 characters)." }, { status: 400 })
  }

  const authorName = getAuthorName({
    metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    email: user.email,
  })

  const insertPayload = {
    user_id: user.id,
    author_name: authorName,
    post_type: postType,
    title,
    summary,
    body: postBody,
    impact_area: impactArea,
    status: "approved" as const,
  }

  const { data, error } = await supabase
    .from("community_posts")
    .insert([insertPayload])
    .select("id, user_id, author_name, post_type, title, summary, body, impact_area, status, is_featured, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logUsageEvent(supabase, {
    userId: user.id,
    module: "platform",
    eventType: "community_post_created",
    metadata: {
      post_type: postType,
      post_id: data.id,
    },
  })

  return NextResponse.json({ post: data })
}
