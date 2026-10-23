import type { PhaseStatus } from '@/lib/types'

/**
 * Règles uniques de « où en est le projet » côté client. Bannière, bloc
 * principal, carte « Étape en cours », stepper, menu et tableau de bord
 * passent tous par ici : une seule vérité, plus d'étapes qui se contredisent.
 */

type PhaseLike = { id: string; status: PhaseStatus; sort_order: number }

const isDone = (s: PhaseStatus) => s === 'completed' || s === 'approved'

const bySortOrder = <T extends PhaseLike>(phases: T[]) => [...phases].sort((a, b) => a.sort_order - b.sort_order)

/**
 * Le client peut-il ouvrir l'étape ? Avec sous-étapes, dès qu'elle a démarré ;
 * sans sous-étape (Animation, Rendu), seulement une fois la vidéo envoyée en
 * review. Une étape non ouvrable ne doit jamais être un lien : le clic
 * renverrait sur la vue d'ensemble.
 */
export function isPhaseViewable(phase: PhaseLike, hasSubPhases: boolean): boolean {
  return hasSubPhases ? phase.status !== 'pending' : phase.status === 'in_review' || isDone(phase.status)
}

/** Position réelle du projet dans le pipeline : l'étape en review, sinon celle en cours. */
export function activePhase<T extends PhaseLike>(phases: T[]): T | null {
  const sorted = bySortOrder(phases)
  return sorted.find((p) => p.status === 'in_review') ?? sorted.find((p) => p.status === 'in_progress') ?? null
}

/**
 * L'étape dont on affiche le contenu sur la vue d'ensemble client :
 *   1. celle qui attend le client (en review) ;
 *   2. sinon celle en cours ;
 *   3. sinon la dernière validée — entre deux étapes, ou quand l'étape en cours
 *      est encore en production chez Mostra (rien à montrer au client) ;
 *   4. sinon rien : le projet n'a pas démarré, on montre le Cadrage.
 * `viewable` écarte les étapes que le client ne peut pas encore ouvrir.
 */
export function pickCurrentPhase<T extends PhaseLike>(
  phases: T[],
  viewable: (phase: T) => boolean = () => true,
): T | null {
  const sorted = bySortOrder(phases)
  return (
    sorted.find((p) => p.status === 'in_review' && viewable(p)) ??
    sorted.find((p) => p.status === 'in_progress' && viewable(p)) ??
    [...sorted].reverse().find((p) => isDone(p.status)) ??
    null
  )
}
