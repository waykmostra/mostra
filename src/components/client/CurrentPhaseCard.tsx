import Link from 'next/link'
import { AlertCircle, ArrowRight } from 'lucide-react'
import type { PhaseStatus } from '@/lib/types'

// L'étape en cours sur la vue d'ensemble : un aperçu flouté (dernière version :
// vidéo ou image), le nom de l'étape et son statut par-dessus, et un appel
// clair. Toute la carte est cliquable ; au survol le flou se lève un peu et la
// carte monte d'1 px. On comprend sans lire qu'il faut cliquer.

const STATUS: Record<PhaseStatus, string> = {
  pending: 'À venir',
  in_progress: 'En production',
  in_review: 'À valider',
  approved: 'Validée',
  completed: 'Validée',
}

export interface PhasePreview {
  url: string
  kind: 'video' | 'image'
}

export default function CurrentPhaseCard({ href, name, status, preview, viewable, awaiting }: {
  href: string
  name: string
  status: PhaseStatus
  preview: PhasePreview | null
  /** Faux : étape encore en production chez Mostra, rien à ouvrir. */
  viewable: boolean
  /** Ce que le client doit faire sur cette étape (« En attente de votre validation »…). */
  awaiting?: string | null
}) {
  const media = preview ? (
    preview.kind === 'video' ? (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={`${preview.url}#t=1`} muted playsInline preload="metadata" aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-[12px] transition-[filter] duration-300 group-hover:blur-[8px]" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={preview.url} alt="" aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-[12px] transition-[filter] duration-300 group-hover:blur-[8px]" />
    )
  ) : (
    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,rgb(0_217_107/0.28),transparent_60%),radial-gradient(90%_80%_at_90%_100%,rgb(0_217_107/0.12),transparent_60%)]" />
  )

  const body = (
    <>
      {media}
      <div aria-hidden className="absolute inset-0 bg-[#020302]/55" />
      <div className="relative flex h-full flex-col justify-end gap-3 p-5 sm:p-7">
        <p className="text-[13px] font-medium text-white/70">Étape en cours</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-[1.75rem] leading-tight text-white sm:text-[2rem]">{name}</h2>
              {awaiting && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-soon/20 px-3 py-1.5 text-[14px] font-semibold text-soon ring-1 ring-soon/40">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  {awaiting}
                </span>
              )}
            </div>
            {!awaiting && (
              <p className="mt-1 text-[14px] font-medium text-white/75">
                {viewable ? STATUS[status] : 'En production chez Mostra'}
              </p>
            )}
          </div>
          {viewable && (
            <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-[14px] font-semibold text-[#020302]">
              Ouvrir l’étape <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </>
  )

  const shell = 'group relative block h-full min-h-[240px] overflow-hidden rounded-xl bg-[#020302] sm:min-h-[300px]'
  return viewable ? (
    <Link href={href} className={`${shell} transition-transform duration-200 hover:-translate-y-px`}>{body}</Link>
  ) : (
    <div className={shell}>{body}</div>
  )
}
