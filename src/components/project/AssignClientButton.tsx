'use client'

import { useState, useRef, useEffect } from 'react'
import { UserPlus, ChevronDown, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { assignClient } from '@/app/projects/actions'

interface ClientOption {
  /** clients.id (CRM) */
  id: string
  contactName: string
  companyName: string | null
  email: string | null
}

interface AssignClientButtonProps {
  projectId: string
  /** clients.id (CRM) actuellement assigné */
  currentClientId: string | null
  clients: ClientOption[]
}

export default function AssignClientButton({
  projectId,
  currentClientId,
  clients,
}: AssignClientButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  // Fermer si clic en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSelect(clientId: string | null) {
    setOpen(false)
    if (clientId === currentClientId) return
    setLoading(true)
    const result = await assignClient(projectId, clientId)
    setLoading(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success(clientId ? 'Client assigné' : 'Client retiré')
      router.refresh()
    }
  }

  return (
    <div ref={ref} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-[11px] text-[#555555] hover:text-[#00D76B] transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <UserPlus className="h-3 w-3" />
        )}
        {currentClientId ? 'Modifier' : 'Assigner un client'}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/50 py-1 overflow-hidden">
          {clients.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-[#555555] italic">
              Aucun client dans le CRM
            </p>
          ) : (
            <>
              {clients.map((c) => {
                const displayName = c.companyName || c.contactName
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a1a] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{displayName}</p>
                      <p className="text-[10px] text-[#555555] truncate">
                        {c.companyName ? c.contactName : c.email ?? '—'}
                      </p>
                    </div>
                    {c.id === currentClientId && (
                      <Check className="h-3.5 w-3.5 text-[#00D76B] flex-shrink-0" />
                    )}
                  </button>
                )
              })}
              {/* Option "Aucun" pour retirer le client */}
              {currentClientId && (
                <>
                  <div className="h-px bg-[#1a1a1a] my-1" />
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a1a] transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-[#555555]" />
                    <span className="text-xs text-[#555555]">Retirer le client</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
