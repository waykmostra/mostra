import Link from 'next/link'
import {
  Brain,
  FileText,
  Palette,
  Film,
  MonitorPlay,
  Music,
  Lock,
  Eye,
  CheckCircle2,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'
import type { ProjectPhase, SubPhase } from '@/lib/types'

// ── Icônes par slug ───────────────────────────────────────────────

const PHASE_ICONS: Record<string, LucideIcon> = {
  analyse:   Brain,
  design:    Palette,
  audio:     Music,
  animation: Film,
  rendu:     MonitorPlay,
  script:    FileText,
  render:    MonitorPlay,
}

// ── Props ─────────────────────────────────────────────────────────

interface ClientPhaseCardProps {
  phase: ProjectPhase
  token: string
  isFirst?: boolean
  isLast?: boolean
  subPhases?: SubPhase[]
  /** Sous-phases ayant des commentaires → cliquables même en révision (in_progress). */
  commentedSubPhaseIds?: string[]
}

// ── Composant ─────────────────────────────────────────────────────

export default function ClientPhaseCard({
  phase,
  token,
  isFirst,
  isLast,
  subPhases = [],
  commentedSubPhaseIds = [],
}: ClientPhaseCardProps) {
  const Icon = PHASE_ICONS[phase.slug] ?? FileText
  const viewHref = `/client/${token}/phases/${phase.id}`

  const isPending    = phase.status === 'pending'
  const isInProgress = phase.status === 'in_progress'
  const isInReview   = phase.status === 'in_review'
  const isDone       = phase.status === 'completed' || phase.status === 'approved'

  // ── Style dynamique selon l'état ──────────────────────────────
  let cardClass = 'bg-[#111111] border rounded-xl px-5 py-4 flex items-center gap-4 transition-all'
  let iconBg = '#1a1a1a'
  let iconBorder = '#2a2a2a'
  let iconColor = '#444444'
  let nameClass = 'text-sm font-medium text-[#444444]'
  let borderColor = '#2a2a2a'

  if (isPending) {
    // Grisé, verrouillé
    cardClass += ' opacity-40'
    borderColor = '#2a2a2a'
  } else if (isInProgress) {
    // ACTIF — en production, pleine visibilité + bordure bleue
    borderColor = '#3B82F6'
    iconBg = '#3B82F620'
    iconBorder = '#3B82F640'
    iconColor = '#3B82F6'
    nameClass = 'text-sm font-semibold text-white'
    cardClass += ' shadow-[0_0_0_1px_#3B82F640]'
  } else if (isInReview) {
    // À valider — amber
    borderColor = '#F59E0B'
    iconBg = '#F59E0B20'
    iconBorder = '#F59E0B40'
    iconColor = '#F59E0B'
    nameClass = 'text-sm font-semibold text-white'
    cardClass += ' shadow-[0_0_0_1px_#F59E0B30] hover:shadow-[0_0_0_1px_#F59E0B60]'
  } else if (isDone) {
    // Terminé — vert, sobre
    borderColor = '#2a2a2a'
    iconBg = '#22C55E18'
    iconBorder = '#22C55E30'
    iconColor = '#22C55E'
    nameClass = 'text-sm font-medium text-[#a0a0a0]'
  }

  return (
    <div className="relative">
      {/* Connecteur vertical */}
      {!isFirst && <span className="absolute -top-2 left-7 w-px h-2 bg-[#2a2a2a]" />}
      {!isLast && !subPhases.length && (
        <span className="absolute -bottom-2 left-7 w-px h-2 bg-[#2a2a2a]" />
      )}

      {/* ── Carte principale ───────────────────────────────────── */}
      <div
        className={cardClass}
        style={{ borderColor }}
      >
        {/* Icône */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, border: `1px solid ${iconBorder}` }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <span className={nameClass}>{phase.name}</span>

          <p className="text-[11px] text-[#555555] mt-0.5">
            {isPending    && 'Cette phase débutera prochainement.'}
            {isInProgress && 'En cours de production…'}
            {isInReview   && 'Prête pour votre validation.'}
            {isDone && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#22C55E]" />
                {phase.completed_at ? `Approuvée le ${formatDate(phase.completed_at)}` : 'Approuvée'}
              </span>
            )}
          </p>
        </div>

        {/* Action droite */}
        <div className="flex-shrink-0">
          {isPending ? (
            <Lock className="h-4 w-4 text-[#2a2a2a]" />
          ) : isInReview ? (
            <Link
              href={viewHref}
              className="
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]
                hover:bg-[#F59E0B]/20 transition-colors
              "
            >
              <Eye className="h-3.5 w-3.5" />
              Valider
            </Link>
          ) : isDone ? (
            <Link
              href={viewHref}
              className="
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-[#1a1a1a] border border-[#2a2a2a] text-[#555555]
                hover:text-white hover:border-[#444444] transition-colors
              "
            >
              Voir
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Sous-phases ─────────────────────────────────────────── */}
      {subPhases.length > 0 && (
        <div className="ml-[52px] mt-1.5 space-y-1.5">
          {subPhases.map((sp) => {
            const isFormSp     = sp.slug === 'formulaire' || sp.slug === 'form'
            const isScriptSp   = sp.slug === 'script'
            const spDone       = sp.status === 'completed' || sp.status === 'approved'
            const spInReview   = sp.status === 'in_review'
            const spInProgress = sp.status === 'in_progress'
            const spHasComments = commentedSubPhaseIds.includes(sp.id)
            // « En révision » = repassée en in_progress mais déjà commentée → accessible.
            const spInRevision = spInProgress && spHasComments
            const spHref       = `/client/${token}/phases/${phase.id}/sub/${sp.id}`

            const isMoodboardSp  = sp.slug === 'style' || sp.slug === 'moodboard'
            const isStoryboardSp = sp.slug === 'storyboard'
            const isDesignSp     = sp.slug === 'design'
            const isAudioSp      = sp.slug === 'vo' || sp.slug === 'musique' || sp.slug === 'voix-off'

            const hasClientPage =
              (isFormSp && (spInProgress || spInReview || spDone)) ||
              (isScriptSp && (spInReview || spDone || spInRevision)) ||
              (isMoodboardSp && (spInReview || spDone || spInRevision)) ||
              (isStoryboardSp && (spInReview || spDone || spInRevision)) ||
              (isDesignSp && (spInReview || spDone || spInRevision)) ||
              (isAudioSp && (spInReview || spDone || spInRevision))

            // Couleur du point de statut (révision = amber, comme « à valider »)
            const dotColor = spDone ? '#22C55E' : (spInReview || spInRevision) ? '#F59E0B' : spInProgress ? '#3B82F6' : '#3a3a3a'

            // Label d'action
            let actionLabel: React.ReactNode = null
            if (isFormSp && spInProgress) {
              actionLabel = (
                <span className="text-xs font-semibold text-[#00D76B] border border-[#00D76B]/30 bg-[#00D76B]/10 rounded-md px-2.5 py-1 flex-shrink-0">
                  À remplir
                </span>
              )
            } else if (spInReview) {
              actionLabel = (
                <span className="text-xs font-semibold text-[#F59E0B] border border-[#F59E0B]/30 bg-[#F59E0B]/10 rounded-md px-2.5 py-1 flex-shrink-0">
                  À valider
                </span>
              )
            } else if (spInRevision) {
              actionLabel = (
                <span className="text-xs font-semibold text-[#F59E0B] border border-[#F59E0B]/30 bg-[#F59E0B]/10 rounded-md px-2.5 py-1 flex-shrink-0">
                  En révision
                </span>
              )
            } else if (spDone) {
              actionLabel = (
                <span className="text-xs text-[#22C55E] flex-shrink-0 font-medium">✓</span>
              )
            }

            // Sous-phase cliquable → encadré avec hover + chevron
            if (hasClientPage) {
              return (
                <Link
                  key={sp.id}
                  href={spHref}
                  className="
                    flex items-center gap-3 px-4 py-3 rounded-xl
                    bg-[#0d0d0d] border border-[#222222]
                    hover:border-[#333333] hover:bg-[#131313]
                    transition-all group cursor-pointer
                  "
                >
                  <span
                    className="flex-shrink-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="text-sm text-[#888888] group-hover:text-white transition-colors flex-1 truncate">
                    {sp.name}
                  </span>
                  {actionLabel}
                  <ChevronRight className="h-4 w-4 text-[#444444] group-hover:text-[#888888] transition-colors flex-shrink-0" />
                </Link>
              )
            }

            // Non cliquable
            return (
              <div
                key={sp.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]"
              >
                <span
                  className="flex-shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="text-sm text-[#555555] flex-1 truncate">{sp.name}</span>
                {actionLabel}
              </div>
            )
          })}

          {/* Connecteur vers phase suivante */}
          {!isLast && <span className="block ml-[5px] w-px h-2 bg-[#2a2a2a]" />}
        </div>
      )}
    </div>
  )
}
