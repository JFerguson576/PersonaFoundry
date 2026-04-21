import { NextResponse } from "next/server"
import { getAdminCapabilities } from "@/lib/admin"
import { SECURITY_WRITE_ROUTE_AUDIT, summarizeSecurityWriteRouteAudit } from "@/lib/admin-security-audit"
import { getRequestAuth } from "@/lib/supabase/auth"

export async function GET(request: Request) {
  try {
    const { user, errorMessage } = await getRequestAuth(request)

    if (!user) {
      return NextResponse.json({ error: errorMessage || "Unauthorized" }, { status: 401 })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })

    if (!capabilities.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    return NextResponse.json({
      routes: SECURITY_WRITE_ROUTE_AUDIT,
      summary: summarizeSecurityWriteRouteAudit(SECURITY_WRITE_ROUTE_AUDIT),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load security audit data" },
      { status: 500 }
    )
  }
}
