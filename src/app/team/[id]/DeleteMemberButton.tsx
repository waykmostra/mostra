'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteTeamMember } from '../actions'

interface Props {
  memberId: string
  memberName: string
  /** Si défini, redirige vers cette URL après suppression. */
  redirectTo?: string
  /** Callback après suppression (retrait optimiste d'une liste). */
  onDeleted?: () => void
}

export default function DeleteMemberButton({ memberId, memberName, redirectTo, onDeleted }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }

    startTransition(async () => {
      const result = await deleteTeamMember(memberId)
      if (result.success) {
        toast.success(`${memberName} supprimé`)
        onDeleted?.()
        if (redirectTo) router.push(redirectTo)
      } else {
        toast.error(result.error)
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="px-2 py-1.5 rounded-lg text-[11px] border border-line text-faint hover:text-ink hover:border-line-strong transition-colors"
        >
          Non
        </button>
        <button
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Confirmer la suppression
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-line text-faint hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors"
      title={`Supprimer ${memberName}`}
      aria-label={`Supprimer ${memberName}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Supprimer cet intervenant
    </button>
  )
}
