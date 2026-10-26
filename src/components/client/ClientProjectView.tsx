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
   * Contenu principal : la carte de l'étape en cours (aperçu flouté, cliquable),
   * ou le Cadrage tant qu'aucune étape n'a démarré.
   */
  main?: React.ReactNode
  /** Planning en escalier, pleine largeur sous la première rangée. */
  planning?: React.ReactNode
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
  planning,
}: ClientProjectViewProps) {
  const done = phases.filter((p) => p.status === 'completed' || p.status === 'approved').length
  const viewable = new Set(viewablePhaseIds)

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
        hrefForPhase={(phase) => `/client/${token}/${phase.slug}`}
        isLocked={(phase) => !viewable.has(phase.id)}
        currentPhaseId={shownPhaseId ?? undefined}
        cadrage={{ href: `/client/${token}/cadrage`, active: !shownPhaseId }}
      />

      {/* Sur mobile, le rappel de paiement passe avant le contenu. */}
      {payment && <div className="lg:hidden">{payment}</div>}

      {/* Première rangée : l'étape en cours à gauche, les repères du projet à
          droite — une seule grille, donc même ligne de départ et même hauteur. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
        <div className="min-w-0">{main}</div>

        <div className="flex min-w-0 flex-col gap-4">
          {payment && <div className="hidden lg:block">{payment}</div>}
          <div className="surface flex divide-x divide-line">
            <div className="flex-1 px-4 py-4">
              <p className="text-[13px] text-faint">Avancement</p>
              <p className="font-display tnum mt-2 text-[1.75rem] leading-none text-ink">
                {project.progress}
                <span className="text-[1rem] text-faint">%</span>
              </p>
            </div>
            <div className="flex-1 px-4 py-4">
              <p className="text-[13px] text-faint">Étapes validées</p>
              <p className="font-display tnum mt-2 text-[1.75rem] leading-none text-ink">
                {done}
                <span className="text-[1rem] text-faint"> / {phases.length}</span>
              </p>
            </div>
          </div>
          {aside}
        </div>
      </div>

      {planning}

      {/* Raccourcis du projet */}
      <nav className="grid gap-3 sm:grid-cols-3" aria-label="Raccourcis du projet">
        {[
          { href: `/client/${token}/cadrage`, label: 'Cadrage', hint: 'La vision commune du projet' },
          { href: `/client/${token}/documents`, label: 'Documents', hint: 'Devis, factures et fichiers' },
          { href: `/client/${token}/paiement`, label: 'Paiement', hint: 'Acomptes et règlements' },
        ].map((s) => (
          <Link key={s.href} href={s.href}
            className="surface group flex min-h-[44px] items-center gap-3 px-4 py-3.5 transition-colors duration-[160ms] hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ink">{s.label}</span>
              <span className="mt-0.5 block truncate text-[12.5px] text-faint">{s.hint}</span>
            </span>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
          </Link>
        ))}
      </nav>
    </div>
  )
}
