'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, FolderPlus, Bell, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateClient, updateClientStatus } from '../actions'
import type { Client, ClientStatus } from '@/lib/types'

const STATUSES: { id: ClientStatus; label: string; color: string; bg: string }[] = [
  { id: 'cold',     label: 'Froid',    color: '#94A3B8', bg: '#94A3B815' },
  { id: 'interest', label: 'Intérêt',  color: '#A78BFA', bg: '#A78BFA15' },
  { id: 'warm',     label: 'Chaud',    color: '#F59E0B', bg: '#F59E0B15' },
  { id: 'active',   label: 'Actif',    color: '#22C55E', bg: '#22C55E15' },
  { id: 'former',   label: 'Ancien',   color: '#64748B', bg: '#64748B15' },
  { id: 'lost',     label: 'Perdu',    color: '#EF4444', bg: '#EF444415' },
]

interface ClientHeaderProps {
  client: Pick<Client, 'id' | 'company_name' | 'contact_name' | 'status' | 'follow_up_pending'>
}

export default function ClientHeader({ client }: ClientHeaderProps) {
  const [status, setStatus] = useState<ClientStatus>(client.status)
  const [followUp, setFollowUp] = useState(client.follow_up_pending)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [isPending, setPending] = useState(false)

  const current = STATUSES.find((s) => s.id === status)!
  const displayName = client.company_name || client.contact_name

  function changeStatus(newStatus: ClientStatus) {
    if (newStatus === status) {
      setOpen(false)
      return
    }
    setStatus(newStatus)
    setOpen(false)
    setPending(true)
    startTransition(async () => {
      const result = await updateClientStatus(client.id, newStatus)
      setPending(false)
      if (!result.success) {
        setStatus(client.status)
        toast.error(result.error)
      } else {
        const label = STATUSES.find((s) => s.id === newStatus)!.label
        toast.success(`Statut → ${label}`)
      }
    })
  }

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
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-[#00D76B]/10 border border-[#00D76B]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-[#00D76B]">
              {displayName[0]?.toUpperCase() ?? '?'}
            </span>
          </div>

          {/* Identité + statut */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
            {client.company_name && (
              <p className="text-sm text-[#a0a0a0] mt-0.5">{client.contact_name}</p>
            )}

            {/* Édit inline du statut */}
            <div className="relative inline-block mt-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={isPending}
                className="
                  inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                  hover:brightness-110 transition-all disabled:opacity-50
                "
                style={{
                  color: current.color,
                  backgroundColor: current.bg,
                  borderColor: `${current.color}40`,
                }}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {current.label}
                <ChevronDown className="h-3 w-3" />
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden min-w-[160px] shadow-xl">
                    {STATUSES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => changeStatus(s.id)}
                        className={`
                          flex items-center gap-2 w-full px-3 py-2 text-xs text-left
                          hover:bg-[#222222] transition-colors
                          ${s.id === status ? 'bg-[#181818]' : ''}
                        `}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-white">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] hover:text-white'}
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
              bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors
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
