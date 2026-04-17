import { createClient } from "@supabase/supabase-js"

export function isAdminEmail(email: string | null | undefined) {
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (!email) return false
  return allowed.includes(email.toLowerCase())
}

export function isSuperuserEmail(email: string | null | undefined) {
  const configured = (process.env.SUPERUSER_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (!email) return false
  return configured.includes(email.toLowerCase())
}

export type PlatformRole = "admin" | "support" | "superuser"

export type AdminCapabilities = {
  isAdmin: boolean
  isSuperuser: boolean
  roles: PlatformRole[]
}

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return null
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function getAdminCapabilities(params: {
  userId: string | null | undefined
  email: string | null | undefined
}): Promise<AdminCapabilities> {
  const emailBasedAdmin = isAdminEmail(params.email)
  const emailBasedSuperuser = isSuperuserEmail(params.email)

  const admin = createAdminClient()
  if (!admin || !params.userId) {
    return {
      isAdmin: emailBasedAdmin || emailBasedSuperuser,
      isSuperuser: emailBasedSuperuser,
      roles: emailBasedSuperuser ? ["superuser"] : emailBasedAdmin ? ["admin"] : [],
    }
  }

  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", params.userId)

  if (error) {
    return {
      isAdmin: emailBasedAdmin || emailBasedSuperuser,
      isSuperuser: emailBasedSuperuser,
      roles: emailBasedSuperuser ? ["superuser"] : emailBasedAdmin ? ["admin"] : [],
    }
  }

  const dbRoles = (data ?? [])
    .map((row) => row.role)
    .filter((role): role is PlatformRole => role === "admin" || role === "support" || role === "superuser")

  const roleSet = new Set<PlatformRole>(dbRoles)
  if (emailBasedAdmin) roleSet.add("admin")
  if (emailBasedSuperuser) roleSet.add("superuser")

  return {
    isAdmin: roleSet.has("admin") || roleSet.has("support") || roleSet.has("superuser"),
    isSuperuser: roleSet.has("superuser"),
    roles: [...roleSet],
  }
}
