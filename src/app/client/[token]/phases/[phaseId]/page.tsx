import ClientPhaseContent from '@/components/client/ClientPhaseContent'

// Lecture toujours fraîche : le client doit voir les changements admin au reload.
export const dynamic = 'force-dynamic'

interface ClientPhasePageProps {
  params: { token: string; phaseId: string }
  searchParams: { v?: string; s?: string; sub?: string }
}

export default function ClientPhasePage({ params, searchParams }: ClientPhasePageProps) {
  return <ClientPhaseContent params={params} searchParams={searchParams} />
}
