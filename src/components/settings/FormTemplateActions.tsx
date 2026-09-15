'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Trash2, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  duplicateFormTemplate,
  deleteFormTemplate,
  setDefaultFormTemplate,
} from '@/app/settings/forms/actions'

interface FormTemplateActionsProps {
  templateId: string
  isDefault: boolean
}

export default function FormTemplateActions({ templateId, isDefault }: FormTemplateActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<'duplicate' | 'delete' | 'default' | null>(null)

  async function handle(action: NonNullable<typeof busy>) {
    setBusy(action)
    let result: { success: boolean; error?: string; id?: string }

    if (action === 'duplicate') result = await duplicateFormTemplate(templateId)
    else if (action === 'delete') result = await deleteFormTemplate(templateId)
    else result = await setDefaultFormTemplate(templateId)

    setBusy(null)

    if (!result.success) {
      toast.error((result as { error: string }).error)
      return
    }

    if (action === 'duplicate' && result.id) {
      toast.success('Template dupliqué')
      router.push(`/settings/forms/${result.id}`)
    } else if (action === 'delete') {
      toast.success('Template supprimé')
    } else {
      toast.success('Template défini par défaut')
    }
  }

  const isBusy = busy !== null

  return (
    <>
      {!isDefault && (
        <button
          type="button"
          onClick={() => handle('default')}
          disabled={isBusy}
          className="p-1.5 rounded-lg text-faint hover:text-[#F59E0B] hover:bg-surface-2 transition-colors disabled:opacity-40"
          title="Définir par défaut"
        >
          {busy === 'default' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Star className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => handle('duplicate')}
        disabled={isBusy}
        className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40"
        title="Dupliquer"
      >
        {busy === 'duplicate' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          if (!confirm('Supprimer ce template ? Cette action est irréversible.')) return
          handle('delete')
        }}
        disabled={isBusy}
        className="p-1.5 rounded-lg text-faint hover:text-red-400 hover:bg-surface-2 transition-colors disabled:opacity-40"
        title="Supprimer"
      >
        {busy === 'delete' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </>
  )
}
