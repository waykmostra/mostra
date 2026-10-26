import type { Metadata } from 'next'
import ClientPhaseContent from '@/components/client/ClientPhaseContent'
import { getLinkPreview, previewTitle } from '@/lib/linkPreview'

/** « Mon Miroir · Animation à valider » dans la carte d'aperçu du lien. */
export async function generateMetadata({ params }: { params: { token: string; phase: string } }): Promise<Metadata> {
  const preview = await getLinkPreview(params.token, params.phase)
  if (!preview) return { title: 'Mostra' }
  const title = previewTitle(preview)
  const description = `Suivez l’avancement de ${preview.projectName} avec Mostra.`
  return {
    title,
    description,
    openGraph: { title, description, siteName: 'Mostra', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// Lien court d'une étape : /client/<lien>/animation (slug de l'étape).
// Même contenu que /client/<lien>/phases/<id>, que le middleware redirige ici.
export const dynamic = 'force-dynamic'

interface ClientPhaseBySlugProps {
  params: { token: string; phase: string }
  searchParams: { v?: string; s?: string; sub?: string }
}

export default function ClientPhaseBySlugPage({ params, searchParams }: ClientPhaseBySlugProps) {
  return <ClientPhaseContent params={{ token: params.token, phaseId: params.phase }} searchParams={searchParams} />
}
