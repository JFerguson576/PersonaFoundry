"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { supabase } from "@/lib/supabase"
import { getAuthHeaders } from "@/lib/career-client"

type CommunityTab = "all" | "idea" | "success_story"
type CommunitySortMode = "newest" | "top" | "discussed"
type CommunityAudienceFilter = "everyone" | "mine" | "featured" | "moderation"

type CommunityPost = {
  id: string
  user_id: string
  author_name: string | null
  post_type: "idea" | "success_story"
  title: string
  summary: string | null
  body: string
  impact_area: string | null
  status: "pending" | "approved" | "hidden"
  is_featured: boolean
  created_at: string
  updated_at: string
  upvotes: number
  comments: number
  viewer_has_upvoted: boolean
  viewer_is_author: boolean
}

type CommunityComment = {
  id: string
  post_id: string
  user_id: string
  author_name: string | null
  body: string
  status: "approved" | "hidden"
  created_at: string
}

type PostFormState = {
  post_type: "idea" | "success_story"
  title: string
  summary: string
  body: string
  impact_area: string
}

const emptyForm: PostFormState = {
  post_type: "idea",
  title: "",
  summary: "",
  body: "",
  impact_area: "",
}
const defaultTab: CommunityTab = "all"
const defaultSortMode: CommunitySortMode = "newest"
const defaultAudienceFilter: CommunityAudienceFilter = "everyone"

function formatCommunityDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function CommunityPage() {
  const searchParams = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [tab, setTab] = useState<CommunityTab>("all")
  const [sortMode, setSortMode] = useState<CommunitySortMode>("newest")
  const [audienceFilter, setAudienceFilter] = useState<CommunityAudienceFilter>("everyone")
  const [searchQuery, setSearchQuery] = useState("")
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [isErrorMessage, setIsErrorMessage] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [form, setForm] = useState<PostFormState>(emptyForm)
  const [isSubmittingPost, setIsSubmittingPost] = useState(false)
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null)
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, CommunityComment[]>>({})
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({})
  const [postingCommentForPostId, setPostingCommentForPostId] = useState<string | null>(null)
  const [votingPostId, setVotingPostId] = useState<string | null>(null)
  const [adminMode, setAdminMode] = useState(false)
  const [moderatingPostId, setModeratingPostId] = useState<string | null>(null)

  const signedIn = Boolean(session?.user)
  const focusedPostId = searchParams.get("post")

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession()
      setSession(activeSession)

      if (!activeSession?.access_token) {
        setAdminMode(false)
        return
      }

      const roleResponse = await fetch("/api/auth/role", {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      })
      const roleJson = await roleResponse.json()
      setAdminMode(Boolean(roleJson?.is_admin))
    }

    void loadSession()
  }, [])

  useEffect(() => {
    void loadPosts(tab)
  }, [tab])

  useEffect(() => {
    if (!focusedPostId || posts.length === 0 || typeof window === "undefined") return
    const target = document.getElementById(`community-post-${focusedPostId}`)
    if (!(target instanceof HTMLElement)) return

    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
      target.classList.add("ring-2", "ring-[#0a66c2]", "ring-offset-2", "transition-shadow")
      window.setTimeout(() => {
        target.classList.remove("ring-2", "ring-[#0a66c2]", "ring-offset-2", "transition-shadow")
      }, 1800)
    }, 200)
  }, [focusedPostId, posts])

  async function loadPosts(nextTab: CommunityTab) {
    setLoading(true)
    setMessage("")
    setIsErrorMessage(false)
    try {
      const search = nextTab === "all" ? "" : `?type=${nextTab}`
      const response = await fetch(`/api/community/posts${search}`, {
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not load community posts.")
      }
      setPosts(Array.isArray(json.posts) ? (json.posts as CommunityPost[]) : [])
    } catch (error) {
      setIsErrorMessage(true)
      setMessage(error instanceof Error ? error.message : "Could not load community posts.")
    } finally {
      setLoading(false)
    }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setIsErrorMessage(false)

    if (!signedIn) {
      setIsErrorMessage(true)
      setMessage("Please sign in first, then share your post.")
      return
    }

    setIsSubmittingPost(true)
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(form),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not publish your post.")
      }
      setForm(emptyForm)
      setShowComposer(false)
      setMessage("Your post is now live in Community.")
      setIsErrorMessage(false)
      await loadPosts(tab)
    } catch (error) {
      setIsErrorMessage(true)
      setMessage(error instanceof Error ? error.message : "Could not publish your post.")
    } finally {
      setIsSubmittingPost(false)
    }
  }

  async function toggleVote(postId: string) {
    if (!signedIn) {
      setIsErrorMessage(true)
      setMessage("Please sign in first, then upvote posts.")
      return
    }

    setVotingPostId(postId)
    try {
      const response = await fetch(`/api/community/posts/${postId}/vote`, {
        method: "POST",
        headers: await getAuthHeaders(),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not save your vote.")
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                viewer_has_upvoted: json.action === "added",
                upvotes: typeof json.upvotes === "number" ? json.upvotes : post.upvotes,
              }
            : post
        )
      )
    } catch (error) {
      setIsErrorMessage(true)
      setMessage(error instanceof Error ? error.message : "Could not save your vote.")
    } finally {
      setVotingPostId(null)
    }
  }

  async function toggleComments(postId: string) {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null)
      return
    }

    setOpenCommentsPostId(postId)
    if (commentsByPostId[postId]) {
      return
    }

    const response = await fetch(`/api/community/posts/${postId}/comments`, {
      headers: await getAuthHeaders(),
    })
    const json = await response.json()
    if (!response.ok) {
      setIsErrorMessage(true)
      setMessage(json.error || "Could not load comments.")
      return
    }
    setCommentsByPostId((current) => ({
      ...current,
      [postId]: Array.isArray(json.comments) ? (json.comments as CommunityComment[]) : [],
    }))
  }

  async function submitComment(postId: string) {
    if (!signedIn) {
      setIsErrorMessage(true)
      setMessage("Please sign in first, then comment.")
      return
    }

    const draft = (commentDraftByPostId[postId] || "").trim()
    if (!draft) return

    setPostingCommentForPostId(postId)
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ body: draft }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not post your comment.")
      }

      const created = json.comment as CommunityComment
      setCommentsByPostId((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), created],
      }))
      setCommentDraftByPostId((current) => ({ ...current, [postId]: "" }))
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments: post.comments + 1 }
            : post
        )
      )
    } catch (error) {
      setIsErrorMessage(true)
      setMessage(error instanceof Error ? error.message : "Could not post your comment.")
    } finally {
      setPostingCommentForPostId(null)
    }
  }

  async function moderatePost(postId: string, updates: { status?: "approved" | "hidden"; is_featured?: boolean }) {
    setModeratingPostId(postId)
    try {
      const response = await fetch("/api/community/admin/moderate", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ post_id: postId, ...updates }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not apply moderation update.")
      }
      await loadPosts(tab)
    } catch (error) {
      setIsErrorMessage(true)
      setMessage(error instanceof Error ? error.message : "Could not apply moderation update.")
    } finally {
      setModeratingPostId(null)
    }
  }

  const communityStats = useMemo(() => {
    const ideas = posts.filter((post) => post.post_type === "idea").length
    const stories = posts.filter((post) => post.post_type === "success_story").length
    const featured = posts.filter((post) => post.is_featured).length
    return { ideas, stories, featured }
  }, [posts])
  const hasActiveViewFilters =
    tab !== defaultTab ||
    sortMode !== defaultSortMode ||
    audienceFilter !== defaultAudienceFilter ||
    searchQuery.trim().length > 0
  const activeViewLabel =
    audienceFilter === "mine"
      ? "My posts view"
      : audienceFilter === "featured"
        ? "Featured view"
        : audienceFilter === "moderation"
          ? "Moderation view"
          : tab === "idea"
            ? "Ideas view"
            : tab === "success_story"
              ? "Success stories view"
              : "All posts view"

  function resetCommunityView() {
    setTab(defaultTab)
    setSortMode(defaultSortMode)
    setAudienceFilter(defaultAudienceFilter)
    setSearchQuery("")
  }

  const displayedPosts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    let next = posts
    if (audienceFilter === "mine") {
      next = next.filter((post) => post.viewer_is_author)
    } else if (audienceFilter === "featured") {
      next = next.filter((post) => post.is_featured)
    } else if (audienceFilter === "moderation") {
      next = next.filter((post) => post.status !== "approved")
    }

    if (normalizedSearch) {
      next = next.filter((post) =>
        [post.title, post.summary, post.body, post.impact_area]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    }

    const sorted = [...next]
    if (sortMode === "top") {
      sorted.sort((left, right) => right.upvotes - left.upvotes || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    } else if (sortMode === "discussed") {
      sorted.sort((left, right) => right.comments - left.comments || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    } else {
      sorted.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    }

    return sorted
  }, [audienceFilter, posts, searchQuery, sortMode])

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />

        <section className="rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#edf6ff_50%,#f5fbff_100%)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b7c]">Community</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a]">Build Personara together</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[#475569]">
            Share product ideas, post success stories, and learn from each other. We review this feed to guide roadmap decisions and highlight real outcomes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#d7e3f0] bg-white px-3 py-1 text-xs font-semibold text-[#334155]">
              Ideas: {communityStats.ideas}
            </span>
            <span className="rounded-full border border-[#d7e3f0] bg-white px-3 py-1 text-xs font-semibold text-[#334155]">
              Success stories: {communityStats.stories}
            </span>
            <span className="rounded-full border border-[#d7e3f0] bg-white px-3 py-1 text-xs font-semibold text-[#334155]">
              Featured: {communityStats.featured}
            </span>
            <Link
              href="/community/success-wall"
              className="rounded-full border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
            >
              Open success wall
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-[#d8e4f2] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: "all", label: "All posts" },
                { key: "idea", label: "Ideas" },
                { key: "success_story", label: "Success stories" },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    tab === item.key
                      ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowComposer((current) => !current)}
              className="rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3 py-1.5 text-xs font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
            >
              {showComposer ? "Close composer" : "Share with community"}
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search ideas and stories..."
              className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
            />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as CommunitySortMode)}
              className="rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
            >
              <option value="newest">Sort: Newest</option>
              <option value="top">Sort: Top upvoted</option>
              <option value="discussed">Sort: Most discussed</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("idea")
                setSortMode("top")
                setAudienceFilter("everyone")
                setSearchQuery("")
              }}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-50"
            >
              Quick: Top ideas
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("success_story")
                setSortMode("top")
                setAudienceFilter("everyone")
                setSearchQuery("")
              }}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-50"
            >
              Quick: Top stories
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("all")
                setSortMode("newest")
                setAudienceFilter("featured")
                setSearchQuery("")
              }}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-50"
            >
              Quick: Featured
            </button>
            {signedIn ? (
              <button
                type="button"
                onClick={() => {
                  setTab("all")
                  setSortMode("newest")
                  setAudienceFilter("mine")
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                  audienceFilter === "mine"
                    ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                My posts
              </button>
            ) : null}
            {adminMode ? (
              <button
                type="button"
                onClick={() => {
                  setTab("all")
                  setSortMode("newest")
                  setAudienceFilter("moderation")
                  setSearchQuery("")
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                  audienceFilter === "moderation"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Needs moderation
              </button>
            ) : null}
            <span className="rounded-full border border-[#d8e4f2] bg-[#f8fbff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              Showing {displayedPosts.length}
            </span>
            {hasActiveViewFilters ? (
              <button
                type="button"
                onClick={resetCommunityView}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-50"
              >
                Reset view
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#d8e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#49617c]">
              {activeViewLabel}
            </span>
            <span className="rounded-full border border-[#d8e4f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#49617c]">
              Sort: {sortMode === "newest" ? "Newest" : sortMode === "top" ? "Top upvoted" : "Most discussed"}
            </span>
          </div>

          {showComposer ? (
            <form onSubmit={submitPost} className="mt-4 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                  Post type
                  <select
                    value={form.post_type}
                    onChange={(event) => setForm((current) => ({ ...current, post_type: event.target.value as PostFormState["post_type"] }))}
                    className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  >
                    <option value="idea">Idea for improvement</option>
                    <option value="success_story">Success story</option>
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                  Impact area
                  <input
                    value={form.impact_area}
                    onChange={(event) => setForm((current) => ({ ...current, impact_area: event.target.value }))}
                    placeholder="Career, TeamSync, Persona, Platform..."
                    className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Give your post a clear title"
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                Short summary (optional)
                <input
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="One sentence summary"
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                Details
                <textarea
                  value={form.body}
                  onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                  rows={5}
                  placeholder="What happened, what worked, and what could improve?"
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {!signedIn ? (
                  <p className="text-xs text-[#64748b]">
                    Please sign in first from <Link href="/platform" className="font-semibold text-[#0a66c2] hover:underline">Platform</Link>.
                  </p>
                ) : (
                  <p className="text-xs text-[#64748b]">Your post will appear immediately and can be featured by the team.</p>
                )}
                <button
                  type="submit"
                  disabled={isSubmittingPost || !signedIn}
                  className="rounded-xl bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingPost ? "Publishing..." : "Publish post"}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {message ? (
          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              isErrorMessage
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        <section className="mt-4 space-y-3">
          {loading ? (
            <article className="rounded-3xl border border-[#d8e4f2] bg-white p-5 text-sm text-[#64748b] shadow-sm">Loading community posts...</article>
          ) : null}
          {!loading && displayedPosts.length === 0 ? (
            <article className="rounded-3xl border border-[#d8e4f2] bg-white p-5 text-sm text-[#64748b] shadow-sm">
              {searchQuery.trim().length > 0
                ? "No posts match your search yet. Try a broader term."
                : "No posts yet in this view. Be the first to share an idea or success story."}
            </article>
          ) : null}
          {!loading
            ? displayedPosts.map((post) => (
                <article id={`community-post-${post.id}`} key={post.id} className="rounded-3xl border border-[#d8e4f2] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#d7e3f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#49617c]">
                          {post.post_type === "idea" ? "Idea" : "Success story"}
                        </span>
                        {post.is_featured ? (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                            Featured
                          </span>
                        ) : null}
                        {post.status !== "approved" ? (
                          <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                            {post.status}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-[#0f172a]">{post.title}</h2>
                      {post.summary ? <p className="mt-1 text-sm font-medium text-[#334155]">{post.summary}</p> : null}
                      <p className="mt-2 text-sm leading-6 text-[#334155]">{post.body}</p>
                    </div>
                    <div className="min-w-[160px] rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#64748b]">Posted by</p>
                      <p className="mt-1 text-sm font-semibold text-[#0f172a]">{post.author_name || "Community member"}</p>
                      <p className="text-xs text-[#64748b]">{formatCommunityDate(post.created_at)}</p>
                      {post.impact_area ? <p className="mt-1 text-xs text-[#64748b]">Area: {post.impact_area}</p> : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleVote(post.id)}
                      disabled={votingPostId === post.id}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        post.viewer_has_upvoted
                          ? "border-[#0a66c2] bg-[#e8f3ff] text-[#0a66c2]"
                          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {post.viewer_has_upvoted ? "Upvoted" : "Upvote"} ({post.upvotes})
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleComments(post.id)}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Comments ({post.comments})
                    </button>
                    {adminMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void moderatePost(post.id, { is_featured: !post.is_featured })}
                          disabled={moderatingPostId === post.id}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {post.is_featured ? "Unfeature" : "Feature"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void moderatePost(post.id, { status: post.status === "hidden" ? "approved" : "hidden" })}
                          disabled={moderatingPostId === post.id}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {post.status === "hidden" ? "Unhide" : "Hide"}
                        </button>
                      </>
                    ) : null}
                  </div>

                  {openCommentsPostId === post.id ? (
                    <div className="mt-3 rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] p-3">
                      <div className="space-y-2">
                        {(commentsByPostId[post.id] || []).map((comment) => (
                          <div key={comment.id} className="rounded-xl border border-white bg-white px-3 py-2">
                            <p className="text-xs text-[#64748b]">
                              <span className="font-semibold text-[#334155]">{comment.author_name || "Community member"}</span>{" "}
                              · {formatCommunityDate(comment.created_at)}
                            </p>
                            <p className="mt-1 text-sm text-[#0f172a]">{comment.body}</p>
                          </div>
                        ))}
                        {(commentsByPostId[post.id] || []).length === 0 ? (
                          <p className="text-xs text-[#64748b]">No comments yet.</p>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          value={commentDraftByPostId[post.id] || ""}
                          onChange={(event) =>
                            setCommentDraftByPostId((current) => ({
                              ...current,
                              [post.id]: event.target.value,
                            }))
                          }
                          placeholder={signedIn ? "Add your comment..." : "Sign in to comment"}
                          disabled={!signedIn || postingCommentForPostId === post.id}
                          className="flex-1 rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a] disabled:cursor-not-allowed disabled:bg-neutral-100"
                        />
                        <button
                          type="button"
                          onClick={() => void submitComment(post.id)}
                          disabled={!signedIn || postingCommentForPostId === post.id}
                          className="rounded-xl bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {postingCommentForPostId === post.id ? "Posting..." : "Post"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            : null}
        </section>
      </div>
    </main>
  )
}
