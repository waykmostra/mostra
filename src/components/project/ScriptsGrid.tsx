'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Trash2, Loader2, Check, Star, ChevronRight, Pencil, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { Script } from '@/lib/types'
import {
  createScript,
  deleteScript,
  saveScript,
  setSelectedScript,
  updateScript,
} from '@/app/projects/script-actions'
import { parseScriptFile, SCRIPT_FILE_EXT, withParam } from '@/lib/scriptFile'

interface ScriptsGridProps {
  subPhaseId: string
  /** URL de la sous-phase ; les scripts s'ouvrent via ?script=<id>. */
  basePath: string
  scripts: Script[]
  /** Nb de sections par script (script_id → count). */
  sectionCounts: Record<string, number>
}

const field =
  'w-full bg-surface-2 border border-line-strong rounded-md px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-[rgb(var(--c-text-faint))]'

export default function ScriptsGrid({ subPhaseId, basePath, scripts, sectionCounts }: ScriptsGridProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [importing, startImport] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  /**
   * Import d'un `.mostrascript` exporté depuis Mostra Compagnon : on crée un
   * script neuf puis on y écrit le tableau du fichier. Rien n'est écrasé —
   * l'import arrive toujours à côté des scripts existants.
   */
  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // pour pouvoir réimporter le même fichier
    if (!file) return

    startImport(async () => {
      let parsed
      try {
        parsed = parseScriptFile(await file.text())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Fichier illisible.')
        return
      }

      const created = await createScript(subPhaseId, parsed.name)
      if (!created.success) { toast.error(created.error); return }

      const saved = await saveScript(created.scriptId, {
        columns: parsed.columns,
        categories: parsed.categories,
        beats: parsed.beats,
        rows: parsed.rows.map((r, i) => ({ _key: `import_${i}`, id: null, ...r })),
      })
      if (!saved.success) {
        // Le script vide créé juste avant ne doit pas rester en plan.
        await deleteScript(created.scriptId)
        toast.error(`Import impossible : ${saved.error}`)
        return
      }

      toast.success(`« ${parsed.name} » importé ✓`)
      router.push(withParam(basePath, 'script', created.scriptId))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-dim">
          {scripts.length} script{scripts.length !== 1 ? 's' : ''} · le client les voit tous et en choisit un
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={`.${SCRIPT_FILE_EXT},application/json,.json`}
            onChange={onFileChosen}
            className="hidden"
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            title="Importer un script exporté depuis Mostra Compagnon (.mostrascript)"
            className="btn-secondary disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer
          </button>
          <button
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand text-black hover:bg-brand transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouveau script
          </button>
        </div>
      </div>

      {creating && (
        <NewScriptForm
          subPhaseId={subPhaseId}
          basePath={basePath}
          onClose={() => setCreating(false)}
        />
      )}

      {scripts.length === 0 && !creating ? (
        <div className="bg-surface border border-line rounded-2xl p-10 flex flex-col items-center gap-3">
          <FileText className="h-8 w-8 text-[rgb(var(--c-border))]" />
          <p className="text-sm text-faint text-center">Aucun script. Crée le premier.</p>
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
      router.push(withParam(basePath, 'script', res.scriptId))
    })
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
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
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-dim hover:text-ink transition-colors">Annuler</button>
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand text-black hover:bg-brand transition-colors disabled:opacity-50"
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
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Titre" autoFocus />
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="Description" />
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => { setTitle(script.title); setDescription(script.description ?? ''); setEditing(false) }} className="px-3 py-1.5 rounded-lg text-xs text-dim hover:text-ink transition-colors">Annuler</button>
          <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-black hover:bg-brand disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group bg-surface border border-line rounded-2xl p-4 hover:border-line-strong transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={withParam(basePath, 'script', script.id)} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-faint flex-shrink-0" />
            <p className="text-sm font-semibold text-ink truncate group-hover:text-brand transition-colors">{script.title}</p>
          </div>
          {script.description && <p className="text-xs text-faint mt-1 line-clamp-2">{script.description}</p>}
          <p className="text-[10px] text-faint mt-1.5">{sectionCount} section{sectionCount !== 1 ? 's' : ''}</p>
        </Link>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} aria-label="Éditer" className="w-7 h-7 flex items-center justify-center rounded-md text-faint hover:text-ink hover:bg-surface-2 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {canDelete && (
            confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <button onClick={remove} disabled={isPending} className="text-[10px] font-medium text-[#EF4444] hover:opacity-80">{isPending ? '…' : 'Oui'}</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-dim hover:text-ink">Non</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} aria-label="Supprimer" className="w-7 h-7 flex items-center justify-center rounded-md text-faint hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
        {script.is_selected ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
            <Star className="h-3 w-3 fill-brand" />
            Choisi par le client
          </span>
        ) : (
          <button onClick={makeSelected} disabled={isPending} className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-ink transition-colors disabled:opacity-50">
            <Star className="h-3 w-3" />
            Marquer comme choisi
          </button>
        )}
        <Link href={withParam(basePath, 'script', script.id)} className="inline-flex items-center gap-1 text-[11px] text-dim hover:text-ink transition-colors">
          Ouvrir <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
