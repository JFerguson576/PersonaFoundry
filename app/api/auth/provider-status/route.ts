import { NextResponse } from "next/server"
import { getAuthProviderStatusesFromEnv } from "@/lib/auth-provider-status"

export async function GET() {
  const providers = getAuthProviderStatusesFromEnv()
  return NextResponse.json({
    providers,
    configured_count: providers.filter((provider) => provider.enabled).length,
  })
}
