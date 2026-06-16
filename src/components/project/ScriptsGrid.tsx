'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Trash2, Loader2, Check, Star, ChevronRight, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Script } from '@/lib/types'
import { createScript, deleteScript, setSelectedScript, updateScript } from '@/app/projects/script-actions'

interface ScriptsGridProps {
  subPhaseId: string
  /** URL de la sous-phase ; les scripts s'ouvrent via ?script=<id>. */
  basePath: string
  scripts: Script[]
  /** Nb de sections par script (script_id → count). */
  sectionCounts: Record<string, number>
}

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

export default function ScriptsGrid({ subPhaseId, basePath, scripts, sectionCounts }: ScriptsGridProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#888888]">
          {scripts.length} script{scripts.length !== 1 ? 's' : ''} · le client les voit tous et en choisit un
        </p>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau script
        </button>
      </div>

      {creating && (
        <NewScriptForm
          subPhaseId={subPhaseId}
          basePath={basePath}
          onClose={() => setCreating(false)}
        />
      )}

      {scripts.length === 0 && !creating ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-10 flex flex-col items-center gap-3">
          <FileText className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666] text-center">Aucun script. Crée le premier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scripts.map((s) => (
            <ScriptCard
              key={s.id}
              script={s}
              basePath={basePath}
              sectionCount={sectionCounts[s.id] ?? 0}
              canDelete={scripts.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NewScriptForm({
  subPhaseId,
  basePath,
  onClose,
}: {
  subPhaseId: string
  basePath: string
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  function submit() {
    const clean = title.trim()
    if (!clean) return toast.error('Donne un titre au script.')
    startTransition(async () => {
      const res = await createScript(subPhaseId, clean, description)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Script créé ✓')
      router.push(`${basePath}?script=${res.scriptId}`)
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-2xl p-4 space-y-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Titre du script (ex. Version A — punchy)"
        className={field}
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Courte description (optionnel)"
        className={field}
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">Annuler</button>
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Créer
        </button>
      </div>
    </div>
  )
}

function ScriptCard({
  script,
  basePath,
  sectionCount,
  canDelete,
}: {
  script: Script
  basePath: string
  sectionCount: number
  canDelete: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [title, setTitle] = useState(script.title)
  const [description, setDescription] = useState(script.description ?? '')

  function save() {
    const clean = title.trim()
    if (!clean) return toast.error('Le titre est requis.')
    startTransition(async () => {
      const res = await updateScript(script.id, { title: clean, description })
      if (!res.success) { toast.error(res.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  function makeSelected() {
    startTransition(async () => {
      const res = await setSelectedScript(script.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Version client mise à jour')
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteScript(script.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Script supprimé')
      router.refresh()
    })
  }

  if (editing) {
    return (
      <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-2xl p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Titre" autoFocus />
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="Description" />
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => { setTitle(script.title); setDescription(script.description ?? ''); setEditing(false) }} className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">Annuler</button>
          <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D76B] text-black hover:bg-[#00c560] disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 hover:border-[#3a3a3a] transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`${basePath}?script=${script.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#666666] flex-shrink-0" />
            <p className="text-sm font-semibold text-white truncate group-hover:text-[#00D76B] transition-colors">{script.title}</p>
          </div>
          {script.description && <p className="text-xs text-[#777777] mt-1 line-clamp-2">{script.description}</p>}
          <p className="text-[10px] text-[#555555] mt-1.5">{sectionCount} section{sectionCount !== 1 ? 's' : ''}</p>
        </Link>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} aria-label="Éditer" className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {canDelete && (
            confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <button onClick={remove} disabled={isPending} className="text-[10px] font-medium text-[#EF4444] hover:opacity-80">{isPending ? '…' : 'Oui'}</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-[#888888] hover:text-white">Non</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} aria-label="Supprimer" className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1a1a1a]">
        {script.is_selected ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00D76B]">
            <Star className="h-3 w-3 fill-[#00D76B]" />
            Choisi par le client
          </span>
        ) : (
          <button onClick={makeSelected} disabled={isPending} className="inline-flex items-center gap-1 text-[11px] text-[#666666] hover:text-white transition-colors disabled:opacity-50">
            <Star className="h-3 w-3" />
            Marquer comme choisi
          </button>
        )}
        <Link href={`${basePath}?script=${script.id}`} className="inline-flex items-center gap-1 text-[11px] text-[#888888] hover:text-white transition-colors">
          Ouvrir <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
