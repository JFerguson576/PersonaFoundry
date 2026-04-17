import { NextResponse } from "next/server"
import { isCareerAssetType, normalizeString } from "@/lib/career"
import { getRequestAuth } from "@/lib/supabase/auth"
import { createRouteClient } from "@/lib/supabase/route"

export async function POST(req: Request) {
  try {
    const { user, accessToken, errorMessage } = await getRequestAuth(req)
    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const supabase = createRouteClient(accessToken ?? undefined)
    const body = await req.json()
    const candidateId = normalizeString(body?.candidate_id)
    const assetType = body?.asset_type
    const title = normalizeString(body?.title)
    const content = normalizeString(body?.content)

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 })
    }

    if (!isCareerAssetType(assetType)) {
      return NextResponse.json({ error: "asset_type is invalid" }, { status: 400 })
    }

    if (!title || !content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 })
    }

    const { data: candidate } = await supabase
      .from("career_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    const { data: latestAsset } = await supabase
      .from("career_generated_assets")
      .select("version")
      .eq("candidate_id", candidateId)
      .eq("user_id", user.id)
      .eq("asset_type", assetType)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = typeof latestAsset?.version === "number" ? latestAsset.version + 1 : 1

    const { data: savedAsset, error } = await supabase
      .from("career_generated_assets")
      .insert([
        {
          candidate_id: candidateId,
          user_id: user.id,
          asset_type: assetType,
          version: nextVersion,
          title,
          content,
        },
      ])
      .select("id, asset_type, version, title, content, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ asset: savedAsset })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
