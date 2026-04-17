import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, errorMessage } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })

    if (!capabilities.isSuperuser) {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to enable superuser actions." },
        { status: 500 }
      )
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 })
    }

    const { data: candidate } = await admin
      .from("career_candidates")
      .select("id, full_name, user_id, deleted_at")
      .eq("id", id)
      .maybeSingle()

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    }

    if (candidate.deleted_at) {
      return NextResponse.json({ error: "Candidate is already archived." }, { status: 400 })
    }

    const deletedAt = new Date()
    const purgeAfter = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { error } = await admin
      .from("career_candidates")
      .update({
        deleted_at: deletedAt.toISOString(),
        deleted_by: user.id,
        purge_after: purgeAfter.toISOString(),
      })
      .eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logUsageEvent(admin, {
      userId: user.id,
      module: "admin",
      eventType: "candidate_soft_deleted",
      candidateId: candidate.id,
      metadata: {
        candidate_name: candidate.full_name,
        candidate_user_id: candidate.user_id,
        purge_after: purgeAfter.toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      archived: true,
      deleted_candidate: {
        id: candidate.id,
        full_name: candidate.full_name,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
