import type { PhaseStatus } from '@/lib/types'

type PhaseLike = { id: string; status: PhaseStatus; sort_order: number }

const isDone = (s: PhaseStatus) => s === 'completed' || s === 'approved'

/**
 * Le client peut-il ouvrir l'étape ? Même règle que la page d'une étape :
 * avec sous-étapes, dès qu'elle a démarré ; sans sous-étape (Animation,
 * Rendu), seulement une fois la vidéo envoyée en review.
 */
export function isPhaseViewable(phase: PhaseLike, hasSubPhases: boolean): boolean {
  return hasSubPhases ? phase.status !== 'pending' : phase.status === 'in_review' || isDone(phase.status)
}

/**
 * L'étape à mettre en avant sur la vue d'ensemble client :
 *   1. celle qui attend le client (en review) ;
 *   2. sinon celle en cours ;
 *   3. sinon la dernière validée — entre deux étapes, ou quand l'étape en cours
 *      est encore en production chez Mostra (rien à montrer au client) ;
 *   4. sinon rien : le projet n'a pas démarré, on montre le Cadrage.
 * `viewable` filtre les étapes que le client ne peut pas encore ouvrir.
 */
export function pickCurrentPhase<T extends PhaseLike>(
  phases: T[],
  viewable: (phase: T) => boolean = () => true,
): T | null {
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  return (
    sorted.find((p) => p.status === 'in_review' && viewable(p)) ??
    sorted.find((p) => p.status === 'in_progress' && viewable(p)) ??
    [...sorted].reverse().find((p) => isDone(p.status)) ??
    null
  )
}
