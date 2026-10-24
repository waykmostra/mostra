import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ClientActionBanner from './ClientActionBanner'
import PhaseStepper from '@/components/project/PhaseStepper'
import Breadcrumb from '@/components/shared/Breadcrumb'
import StatusBadge from '@/components/shared/StatusBadge'
import { activePhase } from '@/lib/currentPhase'
import type { Project, ProjectPhase, SubPhase } from '@/lib/types'

interface ClientProjectViewProps {
  project: Project
  phases: ProjectPhase[]
  /** Étapes que le client peut ouvrir (les autres ne sont jamais des liens). */
  viewablePhaseIds: string[]
  /** Étape affichée dans le bloc principal (null = Cadrage). */
  shownPhaseId: string | null
  subPhasesByPhase: Record<string, SubPhase[]>
  /** Sous-phases ayant des commentaires → cliquables même en révision (in_progress). */
  commentedSubPhaseIds: string[]
  token: string
  /** Colonne de droite (interlocuteur…). */
  aside?: React.ReactNode
  /** Rappel de paiement, en tête de la colonne de droite. */
  payment?: React.ReactNode
  /**
   * Contenu principal (75 %) : l'étape en cours, ou le Cadrage tant qu'aucune
   * étape n'a démarré.
   */
  main?: React.ReactNode
}

export default function ClientProjectView({
  project,
  phases,
  viewablePhaseIds,
  shownPhaseId,
  token,
  subPhasesByPhase,
  aside,
  payment,
  main,
}: ClientProjectViewProps) {
  const done = phases.filter((p) => p.status === 'completed' || p.status === 'approved').length
  const viewable = new Set(viewablePhaseIds)
  // Position réelle du projet (en review, sinon en cours) — même règle que la bannière.
  const active = activePhase(phases)
  const activeViewable = !!active && viewable.has(active.id)

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
        isLocked={(phase) => !viewable.has(phase.id)}
        currentPhaseId={shownPhaseId ?? undefined}
        cadrage={{ href: `/client/${token}/cadrage`, active: !shownPhaseId }}
      />

      {/* Sur mobile, le rappel de paiement passe avant le contenu. */}
      {payment && <div className="lg:hidden">{payment}</div>}

      {/* L'étape en cours occupe la page (75 %) ; les repères du projet à droite. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
        <div className="min-w-0">{main}</div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-[4.5rem]">
          {payment && <div className="hidden lg:block">{payment}</div>}
          <div className="surface flex divide-x divide-line">
            <div className="flex-1 px-4 py-4">
              <p className="mono-label text-faint">Avancement</p>
              <p className="font-display tnum mt-2.5 text-[1.75rem] leading-none text-ink">
                {project.progress}
                <span className="text-[1rem] text-faint">%</span>
              </p>
            </div>
            <div className="flex-1 px-4 py-4">
              <p className="mono-label text-faint">Étapes validées</p>
              <p className="font-display tnum mt-2.5 text-[1.75rem] leading-none text-ink">
                {done}
                <span className="text-[1rem] text-faint"> / {phases.length}</span>
              </p>
            </div>
          </div>

          {active &&
            (activeViewable ? (
              <Link
                href={`/client/${token}/phases/${active.id}`}
                className="surface group flex items-center gap-3 px-4 py-3.5 transition-colors duration-[160ms] hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="mono-label block text-faint">Étape en cours</span>
                  <span className="mt-1.5 block truncate text-[14px] font-medium text-ink">{active.name}</span>
                </span>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
              </Link>
            ) : (
              // En production chez Mostra : rien à ouvrir pour le client.
              <div className="surface flex items-center gap-3 px-4 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="mono-label block text-faint">Étape en cours</span>
                  <span className="mt-1.5 block truncate text-[14px] font-medium text-ink">{active.name}</span>
                  <span className="mt-0.5 block text-[12px] text-faint">En production chez Mostra</span>
                </span>
              </div>
            ))}

          <Link
            href={`/client/${token}/cadrage`}
            className="surface group flex items-center gap-3 px-4 py-3.5 transition-colors duration-[160ms] hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="mono-label block text-faint">Cadrage</span>
              <span className="mt-1.5 block truncate text-[14px] font-medium text-ink">Vision commune du projet</span>
            </span>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
          </Link>

          {aside}
        </div>
      </div>
    </div>
  )
}
