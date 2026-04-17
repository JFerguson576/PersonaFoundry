import { NextResponse } from "next/server"
import { createAdminClient, getAdminCapabilities, type PlatformRole } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"
import { logUsageEvent } from "@/lib/telemetry"

type RoleAction = "grant" | "revoke"

function isPlatformRole(value: unknown): value is PlatformRole {
  return value === "admin" || value === "support" || value === "superuser"
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
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to manage role assignments." },
        { status: 500 }
      )
    }

    const [{ data: roleRows, error: rolesError }, usersResponse] = await Promise.all([
      admin.from("user_roles").select("user_id, role, created_at").order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 400 })
    }

    const emailByUserId = new Map<string, string | null>(
      (usersResponse.data?.users ?? []).map((entry) => [entry.id, entry.email ?? null])
    )

    const grouped = new Map<string, { user_id: string; email: string | null; roles: PlatformRole[] }>()
    for (const row of roleRows ?? []) {
      if (!isPlatformRole(row.role)) continue
      const current: { user_id: string; email: string | null; roles: PlatformRole[] } = grouped.get(row.user_id) ?? {
        user_id: row.user_id,
        email: emailByUserId.get(row.user_id) ?? null,
        roles: [],
      }
      if (!current.roles.includes(row.role)) {
        current.roles.push(row.role)
      }
      grouped.set(row.user_id, current)
    }

    return NextResponse.json({
      assignments: [...grouped.values()].sort((left, right) => {
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
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local to manage role assignments." },
        { status: 500 }
      )
    }

    const body = (await req.json()) as {
      email?: string
      role?: unknown
      action?: RoleAction
    }

    const email = body.email?.trim().toLowerCase()
    const role = body.role
    const action = body.action ?? "grant"

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    if (!isPlatformRole(role)) {
      return NextResponse.json({ error: "role must be admin, support, or superuser" }, { status: 400 })
    }

    if (action !== "grant" && action !== "revoke") {
      return NextResponse.json({ error: "action must be grant or revoke" }, { status: 400 })
    }

    const usersResponse = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const targetUser = (usersResponse.data?.users ?? []).find(
      (candidate) => candidate.email?.toLowerCase() === email
    )

    if (!targetUser) {
      return NextResponse.json({ error: "No user found for that email. Ask them to sign in once first." }, { status: 404 })
    }

    if (action === "grant") {
      const { error: upsertError } = await admin.from("user_roles").upsert(
        {
          user_id: targetUser.id,
          role,
          granted_by: user.id,
        },
        { onConflict: "user_id,role" }
      )

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }

      await logUsageEvent(admin, {
        userId: user.id,
        module: "admin",
        eventType: "role_granted",
        metadata: {
          target_user_id: targetUser.id,
          target_email: targetUser.email ?? email,
          role,
        },
      })

      return NextResponse.json({
        success: true,
        action,
        assignment: {
          user_id: targetUser.id,
          email: targetUser.email ?? email,
          role,
        },
      })
    }

    const { error: deleteError } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUser.id)
      .eq("role", role)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    await logUsageEvent(admin, {
      userId: user.id,
      module: "admin",
      eventType: "role_revoked",
      metadata: {
        target_user_id: targetUser.id,
        target_email: targetUser.email ?? email,
        role,
      },
    })

    return NextResponse.json({
      success: true,
      action,
      assignment: {
        user_id: targetUser.id,
        email: targetUser.email ?? email,
        role,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
