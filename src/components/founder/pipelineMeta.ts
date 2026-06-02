import type { PipelineStage } from '@/lib/types'

// ── Funnel commercial — métadonnées partagées (Prospection + Pipeline) ──────

export interface StageMeta {
  label: string
  /** Couleur d'accent (badge, point). */
  color: string
  /** Zone du funnel. */
  zone: 'prospection' | 'pipeline' | 'terminal'
}

export const STAGE_META: Record<PipelineStage, StageMeta> = {
  // Zone Prospection (froids)
  froid:       { label: 'Froid',       color: '#6B7280', zone: 'prospection' },
  contacte:    { label: 'Contacté',    color: '#3B82F6', zone: 'prospection' },
  a_relancer:  { label: 'À relancer',  color: '#F59E0B', zone: 'prospection' },
  // Zone Pipeline (chauds)
  repondu:     { label: 'Répondu',     color: '#A78BFA', zone: 'pipeline' },
  call_booke:  { label: 'Call booké',  color: '#00D76B', zone: 'pipeline' },
  proposition: { label: 'Proposition', color: '#22C55E', zone: 'pipeline' },
  // Terminal
  signe:       { label: 'Signé',       color: '#22C55E', zone: 'terminal' },
  perdu:       { label: 'Perdu',       color: '#EF4444', zone: 'terminal' },
}

/** Étapes de la zone Prospection (froids), dans l'ordre. */
export const PROSPECTION_STAGES: PipelineStage[] = ['froid', 'contacte', 'a_relancer']

/** Étapes de la zone Pipeline (chauds), dans l'ordre. */
export const PIPELINE_STAGES: PipelineStage[] = ['repondu', 'call_booke', 'proposition']

/** Options <select> pour faire évoluer un prospect (toutes les étapes). */
export const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = (
  Object.keys(STAGE_META) as PipelineStage[]
).map((value) => ({ value, label: STAGE_META[value].label }))

// ── Helpers dates ───────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** true si la date de relance est dépassée (strictement avant aujourd'hui). */
export function isOverdue(date: string | null): boolean {
  if (!date) return false
  return date < todayISO()
}

/** true si la relance est prévue aujourd'hui. */
export function isDueToday(date: string | null): boolean {
  if (!date) return false
  return date === todayISO()
}
