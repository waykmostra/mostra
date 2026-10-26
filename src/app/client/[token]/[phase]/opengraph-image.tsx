import { getLinkPreview } from '@/lib/linkPreview'
import { linkPreviewImage, LINK_PREVIEW_SIZE } from '@/components/client/linkPreviewImage'

// Aperçu du lien d'une étape (/client/<lien>/animation). Servi sans session.
// Edge : rendu de l'image identique en local (Windows) et sur Vercel.
export const runtime = 'edge'
export const size = LINK_PREVIEW_SIZE
export const contentType = 'image/png'
export const alt = 'Étape d’un projet Mostra'

export default async function Image({ params }: { params: { token: string; phase: string } }) {
  return linkPreviewImage(await getLinkPreview(params.token, params.phase))
}
