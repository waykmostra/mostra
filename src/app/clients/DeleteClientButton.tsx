'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteClient } from './actions'

interface Props {
  clientId: string
  clientName: string
  /** Si défini, redirige vers cette URL après suppression (ex. depuis la fiche). */
  redirectTo?: string
  /** Callback après suppression (ex. retrait optimiste d'une liste). */
  onDeleted?: () => void
}

export default function DeleteClientButton({ clientId, clientName, redirectTo, onDeleted }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }

    startTransition(async () => {
      const result = await deleteClient(clientId)
      if (result.success) {
        toast.success(`${clientName} supprimé`)
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
          className="px-2 py-1.5 rounded-lg text-[11px] border border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444] transition-colors"
        >
          Non
        </button>
        <button
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Oui
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border border-[#2a2a2a] text-[#555555] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors"
      title={`Supprimer ${clientName}`}
      aria-label={`Supprimer ${clientName}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
