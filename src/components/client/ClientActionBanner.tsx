import Link from 'next/link'
import {
  CheckCircle2,
  AlertCircle,
  Hourglass,
  ClipboardEdit,
  Eye,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ProjectPhase, SubPhase } from '@/lib/types'

interface ClientActionBannerProps {
  phases: ProjectPhase[]
  subPhasesByPhase: Record<string, SubPhase[]>
  token: string
}

type Action = {
  variant: 'urgent' | 'progress' | 'pending' | 'done'
  icon: LucideIcon
  eyebrow: string
  title: string
  description?: string
  cta?: { label: string; href: string }
}

const FORM_SLUGS = ['formulaire', 'form']

function computeAction(
  phases: ProjectPhase[],
  subPhasesByPhase: Record<string, SubPhase[]>,
  token: string,
): Action {
  // 1. Form à remplir (la priorité absolue)
  for (const phase of phases) {
    const subs = subPhasesByPhase[phase.id] ?? []
    const formInProgress = subs.find(
      (sp) => FORM_SLUGS.includes(sp.slug) && sp.status === 'in_progress',
    )
    if (formInProgress) {
      return {
        variant: 'urgent',
        icon: ClipboardEdit,
        eyebrow: 'À faire de votre côté',
        title: 'Remplissez le brief de production',
        description:
          'Avant de démarrer, on a besoin de votre brief pour cadrer le projet.',
        cta: {
          label: 'Remplir le brief',
          href: `/client/${token}/phases/${phase.id}/sub/${formInProgress.id}`,
        },
      }
    }
  }

  // 2. Sub-phase en review (script, moodboard, storyboard, design, audio…)
  for (const phase of phases) {
    const subs = subPhasesByPhase[phase.id] ?? []
    const inReview = subs.find((sp) => sp.status === 'in_review')
    if (inReview) {
      return {
        variant: 'urgent',
        icon: AlertCircle,
        eyebrow: 'En attente de votre validation',
        title: `${inReview.name} à valider`,
        description: `Votre retour est nécessaire pour avancer sur la phase ${phase.name}.`,
        cta: {
          label: 'Voir et valider',
          href: `/client/${token}/phases/${phase.id}/sub/${inReview.id}`,
        },
      }
    }
  }

  // 3. Phase entière en review (animation, rendu…)
  const phaseInReview = phases.find((p) => p.status === 'in_review')
  if (phaseInReview) {
    return {
      variant: 'urgent',
      icon: AlertCircle,
      eyebrow: 'En attente de votre validation',
      title: `${phaseInReview.name} à valider`,
      description: 'Visionnez la livraison et donnez votre feu vert ou vos retours.',
      cta: {
        label: 'Voir et valider',
        href: `/client/${token}/phases/${phaseInReview.id}`,
      },
    }
  }

  // 4. Phase in_progress côté agence
  const phaseInProgress = phases.find((p) => p.status === 'in_progress')
  if (phaseInProgress) {
    return {
      variant: 'progress',
      icon: Hourglass,
      eyebrow: 'En cours chez Mostra',
      title: `Production : ${phaseInProgress.name}`,
      description:
        'Votre agence travaille sur cette phase. Vous serez notifié dès qu\'elle sera prête.',
    }
  }

  // 5. Tout est terminé
  const allDone = phases.length > 0 && phases.every(
    (p) => p.status === 'completed' || p.status === 'approved',
  )
  if (allDone) {
    return {
      variant: 'done',
      icon: Sparkles,
      eyebrow: 'Projet terminé',
      title: 'Toutes les phases sont approuvées',
      description: 'Bravo, votre projet est livré.',
    }
  }

  // 6. Rien démarré
  return {
    variant: 'pending',
    icon: Eye,
    eyebrow: 'En attente',
    title: 'Démarrage prochain',
    description: 'Votre projet est en file de production, démarrage imminent.',
  }
}

const VARIANTS: Record<Action['variant'], { bg: string; border: string; accent: string; pillBg: string }> = {
  urgent:   { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/30', accent: 'text-[#F59E0B]', pillBg: 'bg-[#F59E0B]/15' },
  progress: { bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/30', accent: 'text-[#3B82F6]', pillBg: 'bg-[#3B82F6]/15' },
  pending:  { bg: 'bg-[#1a1a1a]',    border: 'border-[#2a2a2a]',    accent: 'text-[#a0a0a0]', pillBg: 'bg-[#222222]'    },
  done:     { bg: 'bg-[#22C55E]/10', border: 'border-[#22C55E]/30', accent: 'text-[#22C55E]', pillBg: 'bg-[#22C55E]/15' },
}

export default function ClientActionBanner({
  phases,
  subPhasesByPhase,
  token,
}: ClientActionBannerProps) {
  const action = computeAction(phases, subPhasesByPhase, token)
  const Icon = action.icon
  const v = VARIANTS[action.variant]

  return (
    <div
      className={`relative ${v.bg} border ${v.border} rounded-2xl p-6 sm:p-7 overflow-hidden`}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <div
          className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${v.pillBg} ${v.accent} flex items-center justify-center`}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <p className={`text-[10px] sm:text-xs font-semibold ${v.accent} uppercase tracking-widest`}>
            {action.eyebrow}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
            {action.title}
          </h2>
          {action.description && (
            <p className="text-sm text-[#a0a0a0] leading-relaxed">
              {action.description}
            </p>
          )}

          {action.cta && (
            <div className="pt-2">
              <Link
                href={action.cta.href}
                className="
                  inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                  bg-white text-black hover:bg-white/90 transition-colors
                "
              >
                {action.cta.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
