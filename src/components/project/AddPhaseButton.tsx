'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, X, ClipboardList, FileText, Image as ImageIcon, LayoutGrid, Music, Film, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { addProjectPhase, type StepType } from '@/app/projects/phase-actions'

const STEPS: { type: StepType; label: string; icon: LucideIcon }[] = [
  { type: 'formulaire', label: 'Formulaire', icon: ClipboardList },
  { type: 'script', label: 'Script', icon: FileText },
  { type: 'style', label: 'Choix image', icon: ImageIcon },
  { type: 'storyboard', label: 'Storyboard', icon: LayoutGrid },
  { type: 'audio', label: 'Audio', icon: Music },
  { type: 'video', label: 'Vidéo', icon: Film },
]

export default function AddPhaseButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function add(type: StepType) {
    startTransition(async () => {
      const res = await addProjectPhase(projectId, type)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Étape ajoutée ✓')
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-line text-sm text-faint hover:text-ink hover:border-line-strong transition-colors"
      >
        <Plus className="h-4 w-4" />
        Ajouter une étape
      </button>
    )
  }

  return (
    <div className="mt-2 bg-surface border border-line rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-dim">Choisis un type d&apos;étape</p>
        <button onClick={() => setOpen(false)} className="text-faint hover:text-ink transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {STEPS.map((s) => (
          <button
            key={s.type}
            type="button"
            onClick={() => add(s.type)}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-sm text-dim hover:text-ink hover:border-line-strong transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <s.icon className="h-4 w-4 flex-shrink-0 text-dim" />}
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-faint">L&apos;étape est ajoutée en fin de pipeline, en attente de démarrage.</p>
    </div>
  )
}
