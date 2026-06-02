'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, RotateCcw, Loader2, AlertCircle, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { approveAsClient, requestRevisionAsClient } from '@/app/client/actions'
import type { PhaseStatus } from '@/lib/types'

interface ApprovalPanelProps {
  projectId: string
  phaseId: string
  phaseName: string
  status: PhaseStatus
  completedAt: string | null
  isAuthenticated: boolean
  loginHref?: string
}

export default function ApprovalPanel({
  projectId,
  phaseId,
  phaseName,
  status,
  completedAt,
  isAuthenticated,
  loginHref = '/login',
}: ApprovalPanelProps) {
  // ── Phase approuvée / terminée : badge simple ─────────────────
  if (status === 'approved' || status === 'completed') {
    return (
      <div className="flex items-center gap-3 bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl px-5 py-3">
        <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#22C55E]">Phase approuvée</p>
          {completedAt && (
            <p className="text-xs text-[#22C55E]/60 mt-0.5">Le {formatDate(completedAt)}</p>
          )}
        </div>
      </div>
    )
  }

  // ── Phase en attente de validation ────────────────────────────
  if (status !== 'in_review') return null

  // ── Non connecté : CTA de connexion ───────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">
              Cette phase est en attente de votre approbation
            </p>
            <p className="text-xs text-[#666666] mt-0.5">
              Connectez-vous pour approuver ou demander des modifications.
            </p>
          </div>
        </div>
        <Link
          href={loginHref}
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            bg-white text-black hover:bg-white/90 transition-colors
          "
        >
          <LogIn className="h-4 w-4" />
          Se connecter
        </Link>
      </div>
    )
  }

  return <ApprovalForm projectId={projectId} phaseId={phaseId} phaseName={phaseName} />
}

// ── Formulaire d'approbation / révision ──────────────────────────

function ApprovalForm({
  projectId,
  phaseId,
  phaseName,
}: {
  projectId: string
  phaseId: string
  phaseName: string
}) {
  const [mode, setMode] = useState<'idle' | 'revision'>('idle')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      const result = await approveAsClient(projectId, phaseId)
      if (result.success) {
        toast.success(`Phase "${phaseName}" approuvée !`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRevision() {
    if (!message.trim()) {
      toast.error('Décrivez les modifications souhaitées.')
      return
    }
    startTransition(async () => {
      const result = await requestRevisionAsClient(projectId, phaseId, message)
      if (result.success) {
        toast.success('Demande de modifications envoyée.')
        setMode('idle')
        setMessage('')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 space-y-4">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">
            Cette phase est en attente de votre approbation
          </p>
          <p className="text-xs text-[#666666] mt-0.5">
            Consultez le fichier ci-dessous, puis approuvez ou demandez des modifications.
          </p>
        </div>
      </div>

      {/* Zone de révision (dépliable) */}
      {mode === 'revision' && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#a0a0a0]">
            Décrivez les modifications souhaitées
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex : Modifier la couleur de fond, changer la typographie du titre…"
            rows={3}
            disabled={isPending}
            className="
              w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2
              text-xs text-white placeholder-[#3a3a3a] resize-none
              focus:outline-none focus:border-[#F59E0B]/40 transition-colors
              disabled:opacity-50
            "
          />
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap">
        {/* Approuver */}
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending || mode === 'revision'}
          className="
            inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
            bg-[#22C55E]/10 border border-[#22C55E]/25 text-[#22C55E]
            hover:bg-[#22C55E]/20 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            w-full sm:w-auto
          "
        >
          {isPending && mode === 'idle' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Approuver
        </button>

        {/* Demander des modifications */}
        {mode === 'idle' ? (
          <button
            type="button"
            onClick={() => setMode('revision')}
            disabled={isPending}
            className="
              inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
              bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B]
              hover:bg-[#F59E0B]/20 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              w-full sm:w-auto
            "
          >
            <RotateCcw className="h-4 w-4" />
            Demander des modifications
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRevision}
              disabled={isPending || !message.trim()}
              className="
                inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B]
                hover:bg-[#F59E0B]/20 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                w-full sm:w-auto
              "
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('idle')
                setMessage('')
              }}
              disabled={isPending}
              className="text-xs text-[#555555] hover:text-white transition-colors w-full sm:w-auto text-center sm:text-left"
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  )
}
