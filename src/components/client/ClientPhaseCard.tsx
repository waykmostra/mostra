import Link from 'next/link'
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Film,
  Lock,
  MonitorPlay,
  Music,
  Palette,
  type LucideIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'
import type { ProjectPhase, SubPhase } from '@/lib/types'

const PHASE_ICONS: Record<string, LucideIcon> = {
  analyse: Brain,
  design: Palette,
  audio: Music,
  animation: Film,
  rendu: MonitorPlay,
  script: FileText,
  render: MonitorPlay,
}

interface ClientPhaseCardProps {
  phase: ProjectPhase
  token: string
  subPhases?: SubPhase[]
  /** Sous-phases ayant des commentaires → cliquables même en révision (in_progress). */
  commentedSubPhaseIds?: string[]
}

export default function ClientPhaseCard({
  phase,
  token,
  subPhases = [],
  commentedSubPhaseIds = [],
}: ClientPhaseCardProps) {
  const Icon = PHASE_ICONS[phase.slug] ?? FileText
  const viewHref = `/client/${token}/phases/${phase.id}`

  const isPending = phase.status === 'pending'
  const isInReview = phase.status === 'in_review'
  const isDone = phase.status === 'completed' || phase.status === 'approved'

  // L'anneau porte l'état. Une étape à valider est la seule qui attire l'œil.
  const badge = isDone
    ? 'bg-brand/15 text-brand-text'
    : isInReview
      ? 'bg-soon/15 text-soon'
      : isPending
        ? 'bg-surface-2 text-faint'
        : 'bg-surface-3 text-dim'

  return (
    <div className="space-y-1.5">
      <div
        className={`surface flex items-center gap-4 px-5 py-4 ${
          isInReview ? 'shadow-[var(--hairline),var(--e2)] ring-1 ring-soon/40' : ''
        }`}
      >
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${badge}`}
        >
          {isDone ? (
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
          ) : isPending ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[14.5px] ${
              isPending ? 'text-faint' : 'font-medium text-ink'
            }`}
          >
            {phase.name}
          </p>
          <p className="mt-1 text-[12.5px] text-faint">
            {isPending && 'Débutera après validation de l’étape précédente.'}
            {phase.status === 'in_progress' && 'En cours de production.'}
            {isInReview && 'Prête pour votre validation.'}
            {isDone && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-text" />
                {phase.completed_at
                  ? `Validée le ${formatDate(phase.completed_at)}`
                  : 'Validée'}
              </span>
            )}
          </p>
        </div>

        {!isPending && (
          <Link
            href={viewHref}
            className={`flex-shrink-0 ${isInReview ? 'btn-brand' : 'btn-secondary'}`}
          >
            {isInReview && <Eye className="h-4 w-4" />}
            {isInReview ? 'Valider' : 'Voir'}
          </Link>
        )}
      </div>

      {subPhases.length > 0 && (
        <div className="ml-4 space-y-1.5 sm:ml-[56px]">
          {subPhases.map((sp) => {
            const isFormSp = sp.slug === 'formulaire' || sp.slug === 'form'
            const isScriptSp = sp.slug === 'script'
            const spDone = sp.status === 'completed' || sp.status === 'approved'
            const spInReview = sp.status === 'in_review'
            const spInProgress = sp.status === 'in_progress'
            const spInRevision = spInProgress && commentedSubPhaseIds.includes(sp.id)
            const spHref = `/client/${token}/phases/${phase.id}/sub/${sp.id}`

            const isMoodboardSp = sp.slug === 'style' || sp.slug === 'moodboard'
            const isStoryboardSp = sp.slug === 'storyboard'
            const isDesignSp = sp.slug === 'design'
            const isAudioSp = sp.slug === 'vo' || sp.slug === 'musique' || sp.slug === 'voix-off'

            const hasClientPage =
              (isFormSp && (spInProgress || spInReview || spDone)) ||
              ((isScriptSp || isMoodboardSp || isStoryboardSp || isDesignSp || isAudioSp) &&
                (spInReview || spDone || spInRevision))

            const dot = spDone
              ? 'bg-brand'
              : spInReview || spInRevision
                ? 'bg-soon'
                : spInProgress
                  ? 'bg-brand/50'
                  : 'bg-line-strong'

            let action: React.ReactNode = null
            if (isFormSp && spInProgress) {
              action = (
                <span className="mono-label flex-shrink-0 rounded-full bg-brand/15 px-2.5 py-1 text-brand-text">
                  À remplir
                </span>
              )
            } else if (spInReview) {
              action = (
                <span className="mono-label flex-shrink-0 rounded-full bg-soon/15 px-2.5 py-1 text-soon">
                  À valider
                </span>
              )
            } else if (spInRevision) {
              action = (
                <span className="mono-label flex-shrink-0 rounded-full bg-soon/15 px-2.5 py-1 text-soon">
                  En révision
                </span>
              )
            } else if (spDone) {
              action = <Check className="h-4 w-4 flex-shrink-0 text-brand-text" strokeWidth={2.5} />
            }

            const body = (
              <>
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
                <span className="flex-1 truncate text-[13.5px]">{sp.name}</span>
                {action}
              </>
            )

            return hasClientPage ? (
              <Link
                key={sp.id}
                href={spHref}
                className="surface group flex items-center gap-3 px-4 py-3 text-dim transition-colors duration-[160ms] hover:bg-surface-2 hover:text-ink"
              >
                {body}
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-dim" />
              </Link>
            ) : (
              <div
                key={sp.id}
                className="surface flex items-center gap-3 px-4 py-3 text-faint"
              >
                {body}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
