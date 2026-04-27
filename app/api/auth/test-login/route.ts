import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function isLocalRequest(request: Request) {
  const host = request.headers.get("host") || ""
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("[::1]:") ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]"
  )
}

export async function POST(request: Request) {
  const testLoginEnabled = isLocalRequest(request) || process.env.ENABLE_TEST_LOGIN === "true"

  if (!testLoginEnabled) {
    return NextResponse.json({ error: "Test login is disabled." }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  const testEmail = process.env.TEST_LOGIN_EMAIL || "local-test-user@personara.ai"

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Test login is missing Supabase environment variables." }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
    options: {
      data: {
        full_name: "Local Test User",
        test_login: true,
      },
    },
  })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) {
    return NextResponse.json({ error: "Test login could not generate a sign-in token." }, { status: 500 })
  }

  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  })

  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 400 })
  }

  if (!verified.session?.access_token || !verified.session.refresh_token) {
    return NextResponse.json({ error: "Test login did not return a session." }, { status: 500 })
  }

  return NextResponse.json({
    session: {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    },
    user: {
      id: verified.user?.id,
      email: verified.user?.email,
    },
  })
}
