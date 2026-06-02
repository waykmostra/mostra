'use client'

import { useState, useRef, useEffect } from 'react'
import { UserPlus, ChevronDown, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { assignProjectManager } from '@/app/projects/actions'
import type { UserRole } from '@/lib/types'

interface PMOption {
  userId: string
  fullName: string
  email: string
  role: UserRole
}

interface AssignPMButtonProps {
  projectId: string
  currentPMId: string | null
  members: PMOption[]
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  client: 'Client',
}

export default function AssignPMButton({
  projectId,
  currentPMId,
  members,
}: AssignPMButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSelect(userId: string | null) {
    setOpen(false)
    if (userId === currentPMId) return
    setLoading(true)
    const result = await assignProjectManager(projectId, userId)
    setLoading(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success(userId ? 'PM assigné' : 'PM retiré')
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
        {currentPMId ? 'Modifier' : 'Assigner un PM'}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/50 py-1 overflow-hidden">
          {members.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-[#555555] italic">
              Aucun membre éligible dans l&apos;agence
            </p>
          ) : (
            <>
              {members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => handleSelect(m.userId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-white truncate">{m.fullName}</p>
                      <span className="text-[9px] uppercase tracking-wider text-[#555555] bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1 py-px flex-shrink-0">
                        {ROLE_LABEL[m.role]}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#555555] truncate">{m.email}</p>
                  </div>
                  {m.userId === currentPMId && (
                    <Check className="h-3.5 w-3.5 text-[#00D76B] flex-shrink-0" />
                  )}
                </button>
              ))}
              {currentPMId && (
                <>
                  <div className="h-px bg-[#1a1a1a] my-1" />
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a1a] transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-[#555555]" />
                    <span className="text-xs text-[#555555]">Retirer le PM</span>
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
