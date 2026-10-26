'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { addSubPhase, deleteSubPhase, renameSubPhase } from '@/app/projects/sub-phase-actions'
import { SUB_PHASE_TYPES, type SubPhaseType } from '@/lib/subPhaseTypes'
import type { SubPhase } from '@/lib/types'

interface Props {
  phaseId: string
  subPhases: Pick<SubPhase, 'id' | 'name' | 'slug'>[]
}

/**
 * Édition de la structure d'une étape : ajouter, renommer ou supprimer ses
 * sous-étapes. Visible uniquement en mode éditeur — supprimer une sous-étape
 * emporte son contenu (réponses, script, images) et ses commentaires.
 *
 * Découper une étape reste rare : tant qu'elle n'a qu'un contenu (le script de
 * l'étape Script…), on ne montre qu'un lien discret pour en ajouter un second.
 */
export default function SubPhaseManager({ phaseId, subPhases }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)

  function add(type: SubPhaseType) {
    startTransition(async () => {
      const res = await addSubPhase(phaseId, type)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Sous-étape ajoutée ✓')
      setAdding(false)
      router.refresh()
    })
  }

  const typePicker = (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-dim">Type de sous-étape</p>
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="text-faint hover:text-ink transition-colors"
          aria-label="Annuler"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {SUB_PHASE_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            disabled={isPending}
            onClick={() => add(t.type)}
            className="rounded-md bg-surface-2 px-2.5 py-2 text-[12.5px] text-dim transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )

  const addButton = (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="inline-flex items-center gap-1.5 text-[12.5px] text-dim transition-colors hover:text-ink"
    >
      <Plus className="h-3.5 w-3.5" />
      Ajouter une sous-étape
    </button>
  )

  if (subPhases.length <= 1 && !adding) {
    return <div className="mt-2">{addButton}</div>
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-line p-3 space-y-2">
      <p className="mono-label text-faint">Structure de l’étape</p>

      {subPhases.length === 0 ? (
        <p className="text-[12.5px] text-faint">Aucune sous-étape.</p>
      ) : (
        <div className="space-y-1">
          {subPhases.map((sp) => (
            <SubPhaseRow key={sp.id} subPhase={sp} disabled={isPending} />
          ))}
        </div>
      )}

      {adding ? typePicker : addButton}
    </div>
  )
}

function SubPhaseRow({
  subPhase,
  disabled,
}: {
  subPhase: Pick<SubPhase, 'id' | 'name' | 'slug'>
  disabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(subPhase.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function save() {
    const clean = draft.trim()
    if (!clean) return toast.error('Le nom est requis.')
    startTransition(async () => {
      const res = await renameSubPhase(subPhase.id, clean)
      if (!res.success) { toast.error(res.error); return }
      setRenaming(false)
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteSubPhase(subPhase.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Sous-étape supprimée')
      router.refresh()
    })
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setRenaming(false); setDraft(subPhase.name) }
          }}
          className="field h-8 flex-1 text-[13px]"
        />
        <button type="button" onClick={save} disabled={isPending} aria-label="Enregistrer" className="p-1 text-brand-text">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => { setRenaming(false); setDraft(subPhase.name) }}
          aria-label="Annuler"
          className="p-1 text-faint hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{subPhase.name}</span>
      <span className="mono-label flex-shrink-0 text-faint">{subPhase.slug}</span>

      <button
        type="button"
        onClick={() => setRenaming(true)}
        disabled={disabled || isPending}
        title="Renommer"
        aria-label="Renommer la sous-étape"
        className="p-1 text-faint transition-colors hover:text-ink disabled:opacity-40"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {confirmDelete ? (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="text-[11px] font-medium text-late hover:opacity-80"
          >
            {isPending ? '…' : 'Supprimer'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-[11px] text-dim hover:text-ink"
          >
            Non
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={disabled || isPending}
          title="Supprimer (le contenu et les commentaires partent avec)"
          aria-label="Supprimer la sous-étape"
          className="p-1 text-faint transition-colors hover:text-late disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
