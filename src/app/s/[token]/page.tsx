import type { Metadata } from 'next'
import { readShare, isExpired, deleteShare } from '@/lib/content-share'
import ScriptDoc, { isEmptyDoc } from '@/components/content-share/ScriptDoc'
import ShareReader from '@/components/content-share/ShareReader'
import './share.css'

// Script d'un contenu partagé depuis Mostra Compagnon : lecture seule, sans
// compte, le temps choisi au partage. Jamais indexé, jamais mis en cache.
export const dynamic = 'force-dynamic'

type Props = { params: { token: string } }

const frDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', ...opts })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await readShare(params.token)
  const live = share && !isExpired(share)
  return {
    title: live ? `${share.title || 'Sans titre'} · Script` : 'Lien de script',
    robots: { index: false, follow: false },
  }
}

export default async function SharedScriptPage({ params }: Props) {
  const share = await readShare(params.token)

  if (!share || isExpired(share)) {
    // Un lien expiré n'a plus rien à garder.
    if (share) await deleteShare(share.token).catch(() => {})
    return (
      <main className="share-page min-h-dvh grid place-items-center px-6 text-center">
        <div>
          <p className="sora text-[22px] font-semibold tracking-tight">{share ? 'Ce lien a expiré' : 'Ce lien n’existe pas'}</p>
          <p className="mt-2 text-[15px] text-[rgb(var(--c-text-dim))]">
            Demande un nouveau lien depuis Mostra Compagnon.
          </p>
        </div>
      </main>
    )
  }

  const meta = [
    share.platform,
    share.plannedDate ? `prévu le ${frDay(`${share.plannedDate}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <main className="share-page min-h-dvh">
      <article className="mx-auto max-w-[720px] px-5 sm:px-8 pt-8 sm:pt-14 pb-36">
        {meta && <p className="text-[13px] text-[rgb(var(--c-text-faint))] first-letter:uppercase">{meta}</p>}
        <h1 className="sora mt-2 text-[30px] sm:text-[38px] font-semibold leading-[1.12] tracking-tight break-words">
          {share.title || 'Sans titre'}
        </h1>
        <ShareReader>
          <div className="mt-8">
            {share.doc && !isEmptyDoc(share.doc)
              ? <ScriptDoc doc={share.doc} />
              : <p className="text-[rgb(var(--c-text-faint))]">Le script est encore vide.</p>}
          </div>
        </ShareReader>
        <p className="mt-14 text-[12.5px] text-[rgb(var(--c-text-faint))]">
          Mis à jour le {frDay(share.updatedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          {' · '}lien valable jusqu’au {frDay(share.expiresAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
      </article>
    </main>
  )
}
