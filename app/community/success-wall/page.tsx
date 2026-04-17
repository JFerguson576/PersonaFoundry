"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PlatformModuleNav } from "@/components/navigation/PlatformModuleNav"
import { supabase } from "@/lib/supabase"
import { getAuthHeaders } from "@/lib/career-client"

type SuccessPost = {
  id: string
  author_name: string | null
  title: string
  summary: string | null
  body: string
  impact_area: string | null
  created_at: string
  upvotes: number
  comments: number
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function CommunitySuccessWallPage() {
  const [posts, setPosts] = useState<SuccessPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [signedIn, setSignedIn] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [storyTitle, setStoryTitle] = useState("")
  const [storySummary, setStorySummary] = useState("")
  const [storyBody, setStoryBody] = useState("")
  const [storyArea, setStoryArea] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  const [shareError, setShareError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch("/api/community/posts?type=success_story&featured=1")
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.error || "Could not load success wall.")
        }
        setPosts(Array.isArray(json.posts) ? json.posts : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load success wall.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  useEffect(() => {
    async function loadSessionState() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSignedIn(Boolean(session?.access_token))
    }

    void loadSessionState()
  }, [])

  async function submitStory() {
    setShareMessage("")
    setShareError(false)

    if (!signedIn) {
      setShareError(true)
      setShareMessage("Please sign in first, then share your story.")
      return
    }

    if (storyTitle.trim().length < 6 || storyBody.trim().length < 20) {
      setShareError(true)
      setShareMessage("Please add a clear title and enough detail.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          post_type: "success_story",
          title: storyTitle,
          summary: storySummary,
          body: storyBody,
          impact_area: storyArea,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Could not share your story.")
      }

      setStoryTitle("")
      setStorySummary("")
      setStoryBody("")
      setStoryArea("")
      setShareError(false)
      setShareMessage("Story shared. Thank you.")
      setShowShareModal(false)

      const refreshed = await fetch("/api/community/posts?type=success_story&featured=1")
      const refreshedJson = await refreshed.json()
      if (refreshed.ok && Array.isArray(refreshedJson.posts)) {
        setPosts(refreshedJson.posts as SuccessPost[])
      }
    } catch (err) {
      setShareError(true)
      setShareMessage(err instanceof Error ? err.message : "Could not share your story.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#0f172a]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PlatformModuleNav />

        <section className="rounded-[2rem] border border-[#d9e2ec] bg-[linear-gradient(135deg,#ffffff_0%,#edf6ff_50%,#f5fbff_100%)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b7c]">Community success wall</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f172a]">Real outcomes from Personara users</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[#475569]">
            Curated stories from members who improved outcomes with Career Intelligence, Persona Foundry, and TeamSync.
          </p>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center rounded-xl border border-[#0a66c2] bg-[#e8f3ff] px-3 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#dcecff]"
              >
                Share your story
              </button>
              <Link
                href="/community"
                className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Open full community
              </Link>
            </div>
          </div>
          {shareMessage ? (
            <p
              className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                shareError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {shareMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-4 space-y-3">
          {loading ? (
            <article className="rounded-3xl border border-[#d8e4f2] bg-white p-5 text-sm text-[#64748b] shadow-sm">Loading stories...</article>
          ) : null}
          {error ? (
            <article className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">{error}</article>
          ) : null}
          {!loading && !error && posts.length === 0 ? (
            <article className="rounded-3xl border border-[#d8e4f2] bg-white p-5 text-sm text-[#64748b] shadow-sm">
              No featured stories yet.
            </article>
          ) : null}
          {!loading && !error
            ? posts.map((post) => (
                <article key={post.id} className="rounded-3xl border border-[#d8e4f2] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-[#0f172a]">{post.title}</h2>
                      {post.summary ? <p className="mt-1 text-sm font-medium text-[#334155]">{post.summary}</p> : null}
                      <p className="mt-2 text-sm leading-6 text-[#334155]">{post.body}</p>
                    </div>
                    <div className="min-w-[170px] rounded-2xl border border-[#d8e4f2] bg-[#f8fbff] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#64748b]">Author</p>
                      <p className="mt-1 text-sm font-semibold text-[#0f172a]">{post.author_name || "Community member"}</p>
                      <p className="text-xs text-[#64748b]">{formatDate(post.created_at)}</p>
                      {post.impact_area ? <p className="mt-1 text-xs text-[#64748b]">Area: {post.impact_area}</p> : null}
                      <p className="mt-2 text-xs text-[#64748b]">Upvotes: {post.upvotes} · Comments: {post.comments}</p>
                    </div>
                  </div>
                </article>
              ))
            : null}
        </section>
      </div>
      {showShareModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl border border-[#d8e4f2] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#0f172a]">Share your success story</h2>
                <p className="mt-1 text-sm text-[#475569]">Tell the community what changed and what worked.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                Title
                <input
                  value={storyTitle}
                  onChange={(event) => setStoryTitle(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  placeholder="How Personara helped you"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                Summary
                <input
                  value={storySummary}
                  onChange={(event) => setStorySummary(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  placeholder="One sentence highlight"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                What changed
                <textarea
                  value={storyBody}
                  onChange={(event) => setStoryBody(event.target.value)}
                  rows={5}
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  placeholder="Share your before, after, and what helped most."
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                Area (optional)
                <input
                  value={storyArea}
                  onChange={(event) => setStoryArea(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#d8e4f2] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  placeholder="Career, TeamSync, Persona, Platform"
                />
              </label>
              {!signedIn ? (
                <p className="text-xs text-[#64748b]">
                  Please sign in from <Link href="/platform" className="font-semibold text-[#0a66c2] hover:underline">Platform</Link> first.
                </p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void submitStory()}
                  disabled={submitting}
                  className="rounded-xl bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0958a8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Publishing..." : "Publish story"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
