'use client'

import { useState } from 'react'
import { Play, Send, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  startSubPhase,
  sendSubPhaseToReview,
  approveSubPhase,
} from '@/app/projects/sub-phase-actions'
import type { PhaseStatus, UserRole } from '@/lib/types'

interface SubPhaseActionsProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean  // sous-phase précédente done (ou première)
}

type LoadingAction = 'start' | 'review' | 'approve' | null

export default function SubPhaseActions({
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
}: SubPhaseActionsProps) {
  const [loading, setLoading] = useState<LoadingAction>(null)

  const isAdmin = userRole === 'admin'
  const canAct = userRole === 'admin'

  async function handle(action: NonNullable<LoadingAction>) {
    setLoading(action)
    let result: { success: boolean; error?: string }
    if (action === 'start') result = await startSubPhase(subPhaseId)
    else if (action === 'review') result = await sendSubPhaseToReview(subPhaseId)
    else result = await approveSubPhase(subPhaseId)
    setLoading(null)
    if (!result.success && 'error' in result) toast.error(result.error as string)
  }

  const busy = loading !== null

  const btnBase =
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  // Pending → bouton Démarrer
  if (subPhaseStatus === 'pending') {
    if (!canAct || !canStart) return null
    return (
      <button
        type="button"
        className={`${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20`}
        disabled={busy}
        onClick={() => handle('start')}
      >
        {loading === 'start' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        Démarrer cette sous-phase
      </button>
    )
  }

  // In Progress → bouton Envoyer en review
  if (subPhaseStatus === 'in_progress') {
    if (!canAct) return null
    return (
      <button
        type="button"
        className={`${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20`}
        disabled={busy}
        onClick={() => handle('review')}
      >
        {loading === 'review' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Envoyer en review
      </button>
    )
  }

  // In Review → bouton Approuver (admin seulement)
  if (subPhaseStatus === 'in_review') {
    if (!isAdmin) {
      return (
        <p className="text-xs text-[#F59E0B]">En attente d&apos;approbation par un admin.</p>
      )
    }
    return (
      <button
        type="button"
        className={`${btnBase} bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/20`}
        disabled={busy}
        onClick={() => handle('approve')}
      >
        {loading === 'approve' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        Approuver
      </button>
    )
  }

  // Completed / Approved → rien à faire
  return null
}
