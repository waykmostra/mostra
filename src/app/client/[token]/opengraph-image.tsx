import { getLinkPreview } from '@/lib/linkPreview'
import { linkPreviewImage, LINK_PREVIEW_SIZE } from '@/components/client/linkPreviewImage'

// Aperçu du lien de la vue d'ensemble (étape en cours). Servi sans session.
// Edge : rendu de l'image identique en local (Windows) et sur Vercel.
export const runtime = 'edge'
export const size = LINK_PREVIEW_SIZE
export const contentType = 'image/png'
export const alt = 'Projet Mostra'

export default async function Image({ params }: { params: { token: string } }) {
  return linkPreviewImage(await getLinkPreview(params.token))
}
