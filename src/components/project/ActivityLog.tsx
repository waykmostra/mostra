'use client'

import { formatRelative } from '@/lib/utils/dates'
import { useRealtimeActivity } from '@/lib/hooks/useRealtimeActivity'
import type { ActivityAction } from '@/lib/types'
import type { ActivityWithUser } from '@/lib/supabase/queries'

// ── Libellés français ─────────────────────────────────────────────

const ACTION_LABELS: Record<ActivityAction, string> = {
  file_uploaded: 'a uploadé un fichier',
  file_deleted: 'a supprimé un fichier',
  phase_started: 'a démarré la phase',
  phase_completed: 'a terminé la phase',
  phase_review: 'a mis en review',
  phase_approved: 'a approuvé la phase',
  comment_added: 'a ajouté un commentaire',
  status_changed: 'a changé le statut',
  project_created: 'a créé le projet',
  project_archived: 'a archivé le projet',
  pm_assigned: 'a assigné un PM',
}

// ── Dot d'activité ────────────────────────────────────────────────

const ACTION_COLORS: Partial<Record<ActivityAction, string>> = {
  file_uploaded: 'bg-[#3B82F6]',
  phase_completed: 'bg-[#22C55E]',
  phase_approved: 'bg-[#22C55E]',
  phase_review: 'bg-[#F59E0B]',
  project_created: 'bg-[#00D76B]',
  comment_added: 'bg-[#6B7280]',
}

function getDetail(entry: ActivityWithUser): string | null {
  if (!entry.details || typeof entry.details !== 'object') return null
  const d = entry.details as Record<string, unknown>
  if (d.file_name) return String(d.file_name)
  if (d.phase_name) return String(d.phase_name)
  if (d.project_name) return String(d.project_name)
  return null
}

// ── Composant ─────────────────────────────────────────────────────

interface ActivityLogProps {
  activity: ActivityWithUser[]
  projectId: string
}

export default function ActivityLog({ activity: initial, projectId }: ActivityLogProps) {
  const { activity, newIds } = useRealtimeActivity(projectId, initial)

  if (activity.length === 0) {
    return (
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-white">Activité récente</h2>
          <LiveBadge />
        </div>
        <p className="text-xs text-[#444444] italic">Aucune activité enregistrée.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-white">Activité récente</h2>
        <LiveBadge />
      </div>

      <div className="space-y-4">
        {activity.map((entry, i) => {
          const label = ACTION_LABELS[entry.action] ?? entry.action
          const detail = getDetail(entry)
          const dotColor = ACTION_COLORS[entry.action] ?? 'bg-[#00D76B]'
          const isLast = i === activity.length - 1
          const isNew = newIds.has(entry.id)

          return (
            <div
              key={entry.id}
              className={`relative flex gap-3 ${isNew ? 'animate-fade-in-down' : ''}`}
            >
              {/* Ligne verticale */}
              {!isLast && (
                <div className="absolute left-[5px] top-[14px] bottom-[-16px] w-px bg-[#1a1a1a]" />
              )}

              {/* Dot */}
              <div
                className={`relative z-10 mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
              />

              {/* Texte */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  <span className="text-white font-medium">
                    {entry.user?.full_name ?? 'Système'}
                  </span>{' '}
                  {label}
                  {detail && <span className="text-[#666666]"> · {detail}</span>}
                </p>
                <p className="text-[10px] text-[#444444] mt-0.5" suppressHydrationWarning>
                  {formatRelative(entry.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Indicateur temps réel ─────────────────────────────────────────

function LiveBadge() {
  return (
    <div className="relative group ml-auto">
      <span className="block w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
      <div
        className="
        pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2
        hidden group-hover:block z-10
        bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1
        text-[10px] text-[#a0a0a0] whitespace-nowrap shadow-lg
      "
      >
        Mises à jour en direct
      </div>
    </div>
  )
}
