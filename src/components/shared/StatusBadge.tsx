import type { PhaseStatus, ProjectStatus } from '@/lib/types'

type Status = ProjectStatus | PhaseStatus

/**
 * Les quatre états du pipeline ne pèsent pas pareil : « en review » attend
 * quelqu'un, « en attente » n'attend personne. Chacun a donc son propre poids
 * visuel plutôt qu'une pastille de couleur interchangeable.
 */
const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  // Projets
  active: { label: 'En cours', className: 'bg-brand/15 text-brand-text' },
  completed: { label: 'Terminé', className: 'bg-brand/15 text-brand-text' },
  on_hold: { label: 'En pause', className: 'bg-soon/15 text-soon' },
  archived: { label: 'Archivé', className: 'bg-surface-3 text-faint' },
  // Phases
  pending: { label: 'En attente', className: 'bg-surface-3 text-faint' },
  in_progress: { label: 'En cours', className: 'bg-surface-3 text-dim' },
  in_review: { label: 'En review', className: 'bg-soon/15 text-soon' },
  approved: { label: 'Approuvé', className: 'bg-brand/15 text-brand-text' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={`mono-label inline-flex items-center rounded-full px-2.5 py-1 ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}
