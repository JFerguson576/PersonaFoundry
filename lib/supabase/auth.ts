import { createClient as createBrowserClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization")

  if (!header) return null

  const [scheme, token] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) return null

  return token
}

export async function getRequestAuth(request: Request): Promise<{
  user: User | null
  accessToken: string | null
  errorMessage?: string
}> {
  const token = getBearerToken(request)

  if (token) {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { user: null, accessToken: null, errorMessage: error?.message || "Unauthorized" }
    }

    return { user, accessToken: token }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  let {
    data: { session },
  } = await supabase.auth.getSession()

  if (user && !session?.access_token) {
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.refreshSession()
    session = refreshedSession
  }

  if (error || !user || !session?.access_token) {
    return { user: null, accessToken: null, errorMessage: error?.message || "Unauthorized" }
  }

  return { user, accessToken: session.access_token }
}
