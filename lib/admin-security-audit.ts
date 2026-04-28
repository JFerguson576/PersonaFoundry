export type SecurityWriteRouteAuditItem = {
  route: string
  method: "POST" | "PATCH" | "DELETE"
  access: "superuser" | "admin"
  area: "marketing" | "operations" | "users" | "workspace"
}

export const SECURITY_WRITE_ROUTE_AUDIT: SecurityWriteRouteAuditItem[] = [
  { route: "/api/admin/marketing/policy", method: "POST", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/budget/recompute", method: "POST", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/alerts", method: "PATCH", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/campaigns", method: "POST", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/campaigns", method: "PATCH", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/coach-outreach", method: "POST", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/coach-outreach", method: "PATCH", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/recommendations", method: "POST", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/recommendations", method: "PATCH", access: "superuser", area: "marketing" },
  { route: "/api/admin/marketing/cash-ledger", method: "POST", access: "superuser", area: "marketing" },
  { route: "/api/admin/settings/openai-budget", method: "PATCH", access: "superuser", area: "operations" },
  { route: "/api/admin/teamsync-outreach", method: "POST", access: "superuser", area: "operations" },
  { route: "/api/admin/tester-notes/outreach", method: "POST", access: "superuser", area: "operations" },
  { route: "/api/admin/users/roles", method: "POST", access: "superuser", area: "users" },
  { route: "/api/admin/users/access", method: "POST", access: "superuser", area: "users" },
  { route: "/api/admin/economics", method: "PATCH", access: "superuser", area: "operations" },
  { route: "/api/admin/health-inbox", method: "PATCH", access: "admin", area: "workspace" },
  { route: "/api/admin/health-inbox", method: "DELETE", access: "admin", area: "workspace" },
  { route: "/api/admin/jobs/recover-stalled", method: "POST", access: "admin", area: "operations" },
  { route: "/api/admin/notebook", method: "POST", access: "admin", area: "operations" },
  { route: "/api/admin/notebook", method: "PATCH", access: "admin", area: "operations" },
  { route: "/api/admin/tester-notes", method: "PATCH", access: "admin", area: "operations" },
  { route: "/api/admin/tester-notes", method: "DELETE", access: "admin", area: "operations" },
]

export function summarizeSecurityWriteRouteAudit(routes: SecurityWriteRouteAuditItem[]) {
  const superuserProtected = routes.filter((item) => item.access === "superuser")
  const adminWriteRoutes = routes.filter((item) => item.access === "admin")
  const totalWriteRoutes = routes.length

  return {
    total_write_routes: totalWriteRoutes,
    superuser_protected_count: superuserProtected.length,
    admin_write_count: adminWriteRoutes.length,
    coverage_pct: Math.round((superuserProtected.length / Math.max(totalWriteRoutes, 1)) * 100),
  }
}
