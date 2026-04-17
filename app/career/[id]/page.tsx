import { CareerCandidateClient } from "@/components/career/CareerCandidateClient"

type PageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    view?: string
    owner?: string
  }>
}

export default async function CareerCandidatePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { view, owner } = await searchParams
  const previewOwnerUserId = view === "owner-preview" && owner ? owner : null
  return <CareerCandidateClient candidateId={id} previewOwnerUserId={previewOwnerUserId} />
}
