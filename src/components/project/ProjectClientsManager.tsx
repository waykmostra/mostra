'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Star, X, ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { addProjectClient, removeProjectClient, assignClient } from '@/app/projects/actions'

export interface ProjectClientRow {
  /** clients.id (CRM) */
  id: string
  displayName: string
  subtitle: string | null
  isPrimary: boolean
  /** A un compte auth → peut se connecter pour commenter/valider. */
  hasAccount: boolean
}

export interface AvailableClient {
  id: string
  contactName: string
  companyName: string | null
  email: string | null
}

interface Props {
  projectId: string
  clients: ProjectClientRow[]
  availableClients: AvailableClient[]
}

export default function ProjectClientsManager({ projectId, clients, availableClients }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAddOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const addedIds = new Set(clients.map((c) => c.id))
  const addable = availableClients.filter((c) => !addedIds.has(c.id))

  async function handleAdd(clientId: string) {
    setAddOpen(false)
    setPendingId(clientId)
    const r = await addProjectClient(projectId, clientId)
    setPendingId(null)
    if (!r.success) toast.error(r.error)
    else {
      toast.success('Client ajouté au projet')
      router.refresh()
    }
  }

  async function handleRemove(clientId: string) {
    setPendingId(clientId)
    const r = await removeProjectClient(projectId, clientId)
    setPendingId(null)
    if (!r.success) toast.error(r.error)
    else {
      toast.success('Client retiré')
      router.refresh()
    }
  }

  async function handleSetPrimary(clientId: string) {
    setPendingId(clientId)
    const r = await assignClient(projectId, clientId)
    setPendingId(null)
    if (!r.success) toast.error((r as { error: string }).error)
    else {
      toast.success('Client principal mis à jour')
      router.refresh()
    }
  }

  return (
    <div className="space-y-2">
      {/* Liste des clients du projet */}
      {clients.length === 0 ? (
        <p className="text-sm text-faint italic">Aucun client assigné</p>
      ) : (
        <div className="space-y-1.5">
          {clients.map((c) => {
            const busy = pendingId === c.id
            return (
              <div
                key={c.id}
                className="group flex items-center gap-2 bg-surface border border-line rounded-lg px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-ink truncate">{c.displayName}</p>
                    {c.isPrimary && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold text-brand bg-brand/10 flex-shrink-0">
                        <Star className="h-2.5 w-2.5 fill-brand" />
                        Principal
                      </span>
                    )}
                  </div>
                  {c.subtitle && (
                    <p className="text-[11px] text-faint truncate">{c.subtitle}</p>
                  )}
                  {!c.hasAccount && (
                    <p className="text-[10px] text-[#F59E0B] flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
                      Pas de compte — génère le lien depuis sa fiche
                    </p>
                  )}
                </div>

                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-faint flex-shrink-0" />
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!c.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(c.id)}
                        title="Définir comme client principal"
                        className="p-1 rounded text-faint hover:text-brand hover:bg-brand/10 transition-colors"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(c.id)}
                      title="Retirer du projet"
                      className="p-1 rounded text-faint hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ajouter un client */}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-[11px] text-faint hover:text-brand transition-colors mt-1"
        >
          <UserPlus className="h-3 w-3" />
          Ajouter un client
          <ChevronDown className="h-3 w-3" />
        </button>

        {addOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 w-60 bg-surface border border-line rounded-xl shadow-2xl shadow-black/50 py-1 overflow-hidden max-h-72 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-faint italic">
                {availableClients.length === 0
                  ? 'Aucun client dans le CRM'
                  : 'Tous les clients sont déjà sur ce projet'}
              </p>
            ) : (
              addable.map((c) => {
                const displayName = c.companyName || c.contactName
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleAdd(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink truncate">{displayName}</p>
                      <p className="text-[10px] text-faint truncate">
                        {c.companyName ? c.contactName : c.email ?? '—'}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
