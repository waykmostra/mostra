import type { TeamAvailability } from '@/lib/types'

// ── Disponibilité (pastille vert / bleu / rouge / orange) ────────────────────

export const AVAILABILITY_META: Record<
  TeamAvailability,
  { label: string; color: string; bg: string }
> = {
  active:      { label: 'Actif',    color: '#22C55E', bg: '#22C55E15' },
  occasional:  { label: 'Ponctuel', color: '#3B82F6', bg: '#3B82F615' },
  unavailable: { label: 'Indispo',  color: '#EF4444', bg: '#EF444415' },
  on_leave:    { label: 'En congé', color: '#F59E0B', bg: '#F59E0B15' },
}

export const AVAILABILITY_ORDER: TeamAvailability[] = [
  'active',
  'occasional',
  'unavailable',
  'on_leave',
]

// ── Palette pour les métiers configurables ───────────────────────────────────

export const ROLE_COLORS = [
  '#00D76B', '#3B82F6', '#A78BFA', '#F59E0B',
  '#EC4899', '#14B8A6', '#F97316', '#8B5CF6',
  '#EF4444', '#64748B',
]
