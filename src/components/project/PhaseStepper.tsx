import Link from 'next/link'
import {
  Box,
  Check,
  ClipboardList,
  Clapperboard,
  FileText,
  Film,
  Image as ImageIcon,
  Lock,
  Mic,
  Palette,
  Sparkles,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PhaseStatus, ProjectPhase, SubPhase } from '@/lib/types'

type Phase = Pick<ProjectPhase, 'id' | 'name' | 'slug' | 'status' | 'sort_order'>

interface Props {
  phases: Phase[]
  subPhasesByPhase?: Record<string, Pick<SubPhase, 'id' | 'status'>[]>
  /** Construit le lien d'une étape. Omis → le stepper n'est pas navigable. */
  hrefForPhase?: (phase: Phase) => string
  /** Étape actuellement ouverte, mise en avant même si elle n'est pas « en cours ». */
  currentPhaseId?: string
  /** Les étapes verrouillées ne sont pas cliquables (vue client). */
  lockPending?: boolean
}

/** L'icône dit le métier de l'étape, pas son état. */
function iconFor(phase: Phase): LucideIcon {
  const key = `${phase.slug} ${phase.name}`.toLowerCase()
  if (/brief|analyse|cadrage|question/.test(key)) return ClipboardList
  if (/script|texte|rédac/.test(key)) return FileText
  if (/mood/.test(key)) return ImageIcon
  if (/story/.test(key)) return Clapperboard
  if (/audio|voix|voice|son|musique/.test(key)) return Mic
  if (/design|direction|da\b|charte/.test(key)) return Palette
  if (/anim|motion/.test(key)) return Sparkles
  if (/rendu|livr|export|final/.test(key)) return Box
  if (/vid[ée]o|montage/.test(key)) return Video
  return Film
}

const STATUS_LABEL: Record<PhaseStatus, string> = {
  pending: 'À venir',
  in_progress: 'En cours',
  in_review: 'En review',
  completed: 'Terminé',
  approved: 'Approuvé',
}

function isDone(s: PhaseStatus) {
  return s === 'completed' || s === 'approved'
}

/**
 * La ligne d'étapes en tête de projet. C'est la carte du projet : d'un coup
 * d'œil, ce qui est fait, où on en est, ce qui reste. Chaque étape est un
 * lien — c'est aussi la navigation principale du projet.
 */
export default function PhaseStepper({
  phases,
  subPhasesByPhase = {},
  hrefForPhase,
  currentPhaseId,
  lockPending = false,
}: Props) {
  if (phases.length === 0) return null
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <ol className="surface flex w-full items-stretch overflow-x-auto">
      {sorted.map((phase, i) => {
        const status = phase.status as PhaseStatus
        const done = isDone(status)
        const active = currentPhaseId ? phase.id === currentPhaseId : status === 'in_progress'
        const review = status === 'in_review'
        const locked = lockPending && status === 'pending'
        const Icon = iconFor(phase)
        const subs = subPhasesByPhase[phase.id] ?? []
        const subsDone = subs.filter((s) => isDone(s.status as PhaseStatus)).length

        // L'anneau porte l'état, le remplissage porte l'achèvement.
        const ring = done
          ? 'bg-brand text-[#020302]'
          : active
            ? 'bg-brand/10 text-brand-text ring-[1.5px] ring-brand'
            : review
              ? 'bg-soon/10 text-soon ring-[1.5px] ring-soon/50'
              : 'bg-surface-2 text-faint ring-1 ring-line'

        const label = done
          ? 'text-dim'
          : active
            ? 'text-brand-text'
            : review
              ? 'text-soon'
              : 'text-faint'

        const inner = (
          <>
            <span
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-[160ms] ${ring}`}
            >
              {done ? (
                <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
              ) : locked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              )}
            </span>
            <span className="min-w-0">
              <span
                className={`block truncate font-display text-[14px] leading-tight ${
                  active || done ? 'text-ink' : 'text-dim'
                }`}
              >
                {phase.name}
              </span>
              <span className={`mono-label mt-1 block truncate ${label}`}>
                {STATUS_LABEL[status]}
                {subs.length > 0 && !done && ` · ${subsDone}/${subs.length}`}
              </span>
            </span>
          </>
        )

        const cellBase =
          'flex min-w-[168px] flex-1 items-center gap-3 px-4 py-4 text-left transition-colors duration-[160ms]'

        return (
          <li key={phase.id} className="flex flex-1 items-stretch">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="my-auto h-px w-6 flex-shrink-0 border-t border-dashed border-line-strong"
              />
            )}
            {hrefForPhase && !locked ? (
              <Link
                href={hrefForPhase(phase)}
                aria-current={active ? 'step' : undefined}
                className={`${cellBase} rounded-md hover:bg-surface-2`}
              >
                {inner}
              </Link>
            ) : (
              <div className={cellBase} aria-current={active ? 'step' : undefined}>
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
