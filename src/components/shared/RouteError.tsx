'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
  /** Message par défaut quand ce n'est pas une erreur de chunk. */
  message?: string
}

/**
 * Détecte les erreurs de chargement de chunk JS/CSS — typiques juste après un
 * déploiement : le navigateur tourne encore sur l'ancien manifeste alors que le
 * nouveau build a changé les hash de fichiers. Le fichier demandé renvoie 404.
 */
function isChunkLoadError(error?: Error): boolean {
  if (!error) return false
  const msg = error.message || ''
  const name = error.name || ''
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

const RELOAD_KEY = 'mostra_chunk_reload_at'

/**
 * Boundary d'erreur partagée. Sur une erreur de chunk, recharge automatiquement
 * la page (une seule fois, anti-boucle) pour récupérer le nouveau build —
 * `reset()` ne suffit pas car le fichier manquant ne réapparaîtra pas.
 */
export default function RouteError({ error, reset, message }: Props) {
  const isChunk = isChunkLoadError(error)

  useEffect(() => {
    if (isChunk) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
        // Si on n'a pas rechargé dans les 10 dernières secondes → on recharge.
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
          window.location.reload()
          return
        }
      } catch {
        // sessionStorage indisponible : on recharge quand même une fois.
        window.location.reload()
        return
      }
    }
    console.error(error)
  }, [error, isChunk])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center">
        <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-white">
          {isChunk ? 'Mise à jour de l’application' : 'Une erreur est survenue'}
        </h2>
        <p className="text-sm text-[#666666] max-w-sm">
          {isChunk
            ? 'Une nouvelle version vient d’être déployée. Rechargement en cours…'
            : error.message || message || 'Quelque chose a mal tourné. Réessayez ou contactez le support.'}
        </p>
      </div>
      <button
        onClick={isChunk ? () => window.location.reload() : reset}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          bg-[#111111] border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#3a3a3a]
          transition-colors"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {isChunk ? 'Recharger' : 'Réessayer'}
      </button>
    </div>
  )
}
