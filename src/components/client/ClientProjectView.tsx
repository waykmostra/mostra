import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ClientActionBanner from './ClientActionBanner'
import PhaseStepper from '@/components/project/PhaseStepper'
import Breadcrumb from '@/components/shared/Breadcrumb'
import StatusBadge from '@/components/shared/StatusBadge'
import type { Project, ProjectPhase, SubPhase } from '@/lib/types'

interface ClientProjectViewProps {
  project: Project
  phases: ProjectPhase[]
  subPhasesByPhase: Record<string, SubPhase[]>
  /** Sous-phases ayant des commentaires → cliquables même en révision (in_progress). */
  commentedSubPhaseIds: string[]
  token: string
  /** Colonne de droite (interlocuteur…). */
  aside?: React.ReactNode
}

export default function ClientProjectView({
  project,
  phases,
  token,
  subPhasesByPhase,
  aside,
}: ClientProjectViewProps) {
  const done = phases.filter((p) => p.status === 'completed' || p.status === 'approved').length
  const current =
    phases.find((p) => p.status === 'in_review') ??
    phases.find((p) => p.status === 'in_progress') ??
    null

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: project.name }]} />

        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] leading-tight text-ink">{project.name}</h1>
            {project.description && (
              <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-dim">
                {project.description}
              </p>
            )}
          </div>
          <StatusBadge status={project.status} className="mt-1 flex-shrink-0" />
        </div>
      </div>

      {/* Ce qui attend le client passe avant tout le reste. */}
      {phases.length > 0 && (
        <ClientActionBanner
          phases={phases}
          subPhasesByPhase={subPhasesByPhase}
          token={token}
        />
      )}

      {/* Les onglets du projet — c'est par là qu'on entre dans une étape. */}
      <PhaseStepper
        phases={phases}
        subPhasesByPhase={subPhasesByPhase}
        hrefForPhase={(phase) => `/client/${token}/phases/${phase.id}`}
        lockPending
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="surface flex flex-col divide-y divide-line sm:flex-row sm:divide-x sm:divide-y-0">
            <div className="flex-1 px-5 py-4">
              <p className="mono-label text-faint">Avancement</p>
              <p className="font-display tnum mt-2.5 text-[2rem] leading-none text-ink">
                {project.progress}
                <span className="text-[1.125rem] text-faint">%</span>
              </p>
            </div>
            <div className="flex-1 px-5 py-4">
              <p className="mono-label text-faint">Étapes validées</p>
              <p className="font-display tnum mt-2.5 text-[2rem] leading-none text-ink">
                {done}
                <span className="text-[1.125rem] text-faint"> / {phases.length}</span>
              </p>
            </div>
          </div>

          {current && (
            <Link
              href={`/client/${token}/phases/${current.id}`}
              className="surface group flex items-center gap-4 px-5 py-4 transition-colors duration-[160ms] hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="mono-label block text-faint">Étape en cours</span>
                <span className="mt-1.5 block truncate text-[15px] font-medium text-ink">
                  {current.name}
                </span>
              </span>
              <StatusBadge status={current.status} className="flex-shrink-0" />
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
            </Link>
          )}
        </div>

        {aside && <div className="space-y-4 lg:sticky lg:top-[4.5rem]">{aside}</div>}
      </div>
    </div>
  )
}
