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
  /** Rappel de paiement (absent quand rien n'est à régler), à droite du contenu. */
  payment?: React.ReactNode
  /**
   * Contenu principal : la carte de l'étape en cours (aperçu flouté, cliquable),
   * ou le Cadrage tant qu'aucune étape n'a démarré.
   */
  main?: React.ReactNode
  /** Planning en escalier, pleine largeur sous le contenu. */
  planning?: React.ReactNode
}

/** Mini cadran d'avancement, à côté du titre : il ne doit pas prendre de place. */
function ProgressDial({ progress, done, total }: { progress: number; done: number; total: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, progress))

  return (
    <div className="flex items-center gap-2.5" aria-label={`Avancement ${pct} %, ${done} étapes validées sur ${total}`}>
      <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-line" />
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          className="stroke-brand transition-[stroke-dashoffset] duration-500" />
      </svg>
      <div className="leading-tight">
        <p className="font-display tnum text-[15px] text-ink">{pct}<span className="text-faint"> %</span></p>
        <p className="tnum text-[12px] text-faint">{done}/{total} étapes validées</p>
      </div>
    </div>
  )
}

export default function ClientProjectView({
  project,
  phases,
  viewablePhaseIds,
  shownPhaseId,
  token,
  subPhasesByPhase,
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
          <div className="flex flex-shrink-0 items-center gap-4">
            {phases.length > 0 && (
              <ProgressDial progress={project.progress} done={done} total={phases.length} />
            )}
            <StatusBadge status={project.status} />
          </div>
        </div>
      </div>

      {/* Les onglets du projet — c'est par là qu'on entre dans une étape. */}
      <PhaseStepper
        phases={phases}
        subPhasesByPhase={subPhasesByPhase}
        hrefForPhase={(phase) => `/client/${token}/${phase.slug}`}
        isLocked={(phase) => !viewable.has(phase.id)}
        currentPhaseId={shownPhaseId ?? undefined}
        cadrage={{ href: `/client/${token}/cadrage`, active: !shownPhaseId }}
      />

      {payment ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
          {/* Sur mobile, le rappel de paiement passe avant le contenu. */}
          <div className="min-w-0 lg:order-2">{payment}</div>
          <div className="min-w-0 lg:order-1">{main}</div>
        </div>
      ) : (
        main
      )}

      {planning}
    </div>
  )
}
