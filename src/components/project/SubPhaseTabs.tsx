import Link from 'next/link'
import { Check } from 'lucide-react'
import type { PhaseStatus, SubPhase } from '@/lib/types'

type Tab = Pick<SubPhase, 'id' | 'name' | 'status'>

interface Props {
  subPhases: Tab[]
  activeId: string
  /** Construit le lien d'une sous-étape (change en général un paramètre d'URL). */
  hrefFor: (subPhase: Tab) => string
}

function isDone(s: PhaseStatus) {
  return s === 'completed' || s === 'approved'
}

/**
 * Barre secondaire sous les onglets d'étape. Plus petite que le stepper :
 * elle navigue à l'intérieur d'une étape, une sous-étape à la fois.
 */
export default function SubPhaseTabs({ subPhases, activeId, hrefFor }: Props) {
  if (subPhases.length < 2) return null

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Sous-étapes">
      {subPhases.map((sub) => {
        const active = sub.id === activeId
        const status = sub.status as PhaseStatus
        const done = isDone(status)
        const review = status === 'in_review'

        return (
          <Link
            key={sub.id}
            href={hrefFor(sub)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-shrink-0 items-center gap-2 rounded-sm px-3.5 py-2 text-[13px] transition-colors duration-[160ms] ${
              active
                ? 'bg-surface font-medium text-ink shadow-[var(--hairline),var(--e1)]'
                : 'text-dim hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {done ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand-text" strokeWidth={2.5} />
            ) : (
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  review ? 'bg-soon' : status === 'in_progress' ? 'bg-brand' : 'bg-line-strong'
                }`}
              />
            )}
            <span className="whitespace-nowrap">{sub.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
