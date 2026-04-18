import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities, type UserAccessLevel } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type AccessAction = "assign" | "revoke"

function isAccessLevel(value: unknown): value is UserAccessLevel {
  return value === "viewer" || value === "editor" || value === "manager"
}

export async function GET(req: Request) {
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
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to manage access levels." },
        { status: 500 }
      )
    }

    const [{ data: rows, error }, usersResponse] = await Promise.all([
      admin.from("user_access_levels").select("user_id, access_level, created_at").order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const emailByUserId = new Map<string, string | null>(
      (usersResponse.data?.users ?? []).map((entry) => [entry.id, entry.email ?? null])
    )

    const assignments = (rows ?? []).map((row) => ({
      user_id: row.user_id,
      email: emailByUserId.get(row.user_id) ?? null,
      access_level: isAccessLevel(row.access_level) ? row.access_level : "viewer",
    }))

    return NextResponse.json({
      assignments: assignments.sort((left, right) => {
        const leftEmail = left.email?.toLowerCase() ?? ""
        const rightEmail = right.email?.toLowerCase() ?? ""
        return leftEmail.localeCompare(rightEmail)
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
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
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to manage access levels." },
        { status: 500 }
      )
    }

    const body = (await req.json()) as {
      email?: string
      access_level?: unknown
      action?: AccessAction
    }

    const email = body.email?.trim().toLowerCase()
    const accessLevel = body.access_level
    const action = body.action ?? "assign"

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    if (!isAccessLevel(accessLevel)) {
      return NextResponse.json({ error: "access_level must be viewer, editor, or manager" }, { status: 400 })
    }

    if (action !== "assign" && action !== "revoke") {
      return NextResponse.json({ error: "action must be assign or revoke" }, { status: 400 })
    }

    const usersResponse = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const targetUser = (usersResponse.data?.users ?? []).find(
      (candidate) => candidate.email?.toLowerCase() === email
    )

    if (!targetUser) {
      return NextResponse.json({ error: "No user found for that email. Ask them to sign in once first." }, { status: 404 })
    }

    if (action === "assign") {
      const { error: upsertError } = await admin.from("user_access_levels").upsert(
        {
          user_id: targetUser.id,
          access_level: accessLevel,
          granted_by: user.id,
        },
        { onConflict: "user_id" }
      )

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }

      await logUsageEvent(admin, {
        userId: user.id,
        module: "admin",
        eventType: "access_level_assigned",
        metadata: {
          target_user_id: targetUser.id,
          target_email: targetUser.email ?? email,
          access_level: accessLevel,
        },
      })

      return NextResponse.json({
        success: true,
        action,
        assignment: {
          user_id: targetUser.id,
          email: targetUser.email ?? email,
          access_level: accessLevel,
        },
      })
    }

    const { error: deleteError } = await admin
      .from("user_access_levels")
      .delete()
      .eq("user_id", targetUser.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    await logUsageEvent(admin, {
      userId: user.id,
      module: "admin",
      eventType: "access_level_revoked",
      metadata: {
        target_user_id: targetUser.id,
        target_email: targetUser.email ?? email,
        access_level: accessLevel,
      },
    })

    return NextResponse.json({
      success: true,
      action,
      assignment: {
        user_id: targetUser.id,
        email: targetUser.email ?? email,
        access_level: accessLevel,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

