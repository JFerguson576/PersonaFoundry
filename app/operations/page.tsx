import { OperationsJobsClient } from "@/components/admin/OperationsJobsClient"
import { OperationsErrorBoundary } from "@/components/admin/OperationsErrorBoundary"

export default function OperationsPage() {
  return (
    <OperationsErrorBoundary>
      <OperationsJobsClient />
    </OperationsErrorBoundary>
  )
}
