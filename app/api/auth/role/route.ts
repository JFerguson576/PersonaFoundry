import { NextResponse } from "next/server"
import { getAdminCapabilities } from "@/lib/admin"
import { getRequestAuth } from "@/lib/supabase/auth"

export async function GET(req: Request) {
  try {
    const { user } = await getRequestAuth(req)

    if (!user) {
      return NextResponse.json({
        signed_in: false,
        is_admin: false,
        is_superuser: false,
        roles: [],
      })
    }

    const capabilities = await getAdminCapabilities({ userId: user.id, email: user.email })
    return NextResponse.json({
      signed_in: true,
      is_admin: capabilities.isAdmin,
      is_superuser: capabilities.isSuperuser,
      roles: capabilities.roles,
    })
  } catch {
    return NextResponse.json({
      signed_in: false,
      is_admin: false,
      is_superuser: false,
      roles: [],
    })
  }
}
