import type { PhaseStatus } from '@/lib/types'

type PhaseLike = { id: string; status: PhaseStatus; sort_order: number }

/**
 * L'étape à mettre en avant sur la vue d'ensemble client :
 *   1. celle qui attend le client (en review) ;
 *   2. sinon celle en cours ;
 *   3. sinon la dernière validée — entre deux étapes (l'une finie, la suivante
 *      pas encore démarrée), le client voit ce qui vient d'être fait ;
 *   4. sinon rien : le projet n'a pas démarré, on montre le Cadrage.
 */
export function pickCurrentPhase<T extends PhaseLike>(phases: T[]): T | null {
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  return (
    sorted.find((p) => p.status === 'in_review') ??
    sorted.find((p) => p.status === 'in_progress') ??
    [...sorted].reverse().find((p) => p.status === 'completed' || p.status === 'approved') ??
    null
  )
}
