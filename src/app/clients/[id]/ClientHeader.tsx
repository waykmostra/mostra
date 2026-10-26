'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { FolderPlus, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { updateClient } from '../actions'
import type { Client } from '@/lib/types'

interface ClientHeaderProps {
  client: Pick<Client, 'id' | 'company_name' | 'contact_name' | 'follow_up_pending'>
  /** Le statut ne se règle plus à la main : il se lit aux projets en cours. */
  activeProjects: number
}

export default function ClientHeader({ client, activeProjects }: ClientHeaderProps) {
  const [followUp, setFollowUp] = useState(client.follow_up_pending)
  const [, startTransition] = useTransition()

  const displayName = client.company_name || client.contact_name
  const busy = activeProjects > 0

  function toggleFollowUp() {
    const next = !followUp
    setFollowUp(next)
    startTransition(async () => {
      const result = await updateClient(client.id, { followUpPending: next })
      if (!result.success) {
        setFollowUp(!next)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-brand">
              {displayName[0]?.toUpperCase() ?? '?'}
            </span>
          </div>

          {/* Identité + statut */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink truncate">{displayName}</h1>
            {client.company_name && (
              <p className="text-sm text-dim mt-0.5">{client.contact_name}</p>
            )}

            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                busy
                  ? 'border-[#22C55E]/25 bg-[#22C55E]/10 text-[#22C55E]'
                  : 'border-line bg-surface-2 text-faint'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${busy ? 'bg-[#22C55E]' : 'bg-line-strong'}`} />
              {busy
                ? `${activeProjects} projet${activeProjects > 1 ? 's' : ''} en cours`
                : 'Aucun projet en cours'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle follow-up */}
          <button
            type="button"
            onClick={toggleFollowUp}
            className={`
              inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
              ${followUp
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                : 'bg-surface-2 border-line text-faint hover:text-ink'}
            `}
            title={followUp ? 'Marquer comme relancé' : 'Marquer comme en attente de relance'}
          >
            <Bell className="h-3.5 w-3.5" />
            {followUp ? 'Relance en cours' : 'Pas de relance'}
          </button>

          {/* Créer un projet */}
          <Link
            href={`/projects/new?clientId=${client.id}`}
            className="
              inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
              bg-brand text-ink hover:bg-brand transition-colors
            "
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Nouveau projet
          </Link>
        </div>
      </div>
    </div>
  )
}
