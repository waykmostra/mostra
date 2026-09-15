'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Archive, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteProject, archiveProject } from '@/app/projects/actions'

interface Props {
  projectId: string
  projectName: string
  isArchived: boolean
}

export default function DangerZone({ projectId, projectName, isArchived }: Props) {
  const router = useRouter()
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle')
  const [archiveStep, setArchiveStep] = useState<'idle' | 'confirm'>('idle')
  const [isPendingDelete, startDelete] = useTransition()
  const [isPendingArchive, startArchive] = useTransition()

  // ── Suppression ──────────────────────────────────────────────

  function handleDeleteClick() {
    if (deleteStep === 'idle') {
      setDeleteStep('confirm')
      setArchiveStep('idle')
      return
    }

    startDelete(async () => {
      const result = await deleteProject(projectId)
      if (result.success) {
        toast.success(`Projet "${projectName}" supprimé`)
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error(result.error)
        setDeleteStep('idle')
      }
    })
  }

  // ── Archivage ────────────────────────────────────────────────

  function handleArchiveClick() {
    if (archiveStep === 'idle') {
      setArchiveStep('confirm')
      setDeleteStep('idle')
      return
    }

    startArchive(async () => {
      const result = await archiveProject(projectId)
      if (result.success) {
        toast.success(isArchived ? 'Projet déjà archivé' : `Projet "${projectName}" archivé`)
        router.refresh()
        setArchiveStep('idle')
      } else {
        toast.error(result.error)
        setArchiveStep('idle')
      }
    })
  }

  const anyPending = isPendingDelete || isPendingArchive

  return (
    <div className="bg-surface border border-[#EF4444]/10 rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-semibold tracking-widest text-[#EF4444]/60 uppercase">
        Zone de danger
      </p>

      {/* ── Archiver ── */}
      {!isArchived && (
        <div>
          {archiveStep === 'confirm' ? (
            <div className="space-y-2">
              <p className="text-xs text-dim">
                Le projet sera archivé. Les données sont conservées.
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setArchiveStep('idle')}
                  disabled={anyPending}
                  className="flex-1 py-1.5 rounded-lg text-xs border border-line text-faint hover:text-ink hover:border-line-strong transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleArchiveClick}
                  disabled={anyPending}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium
                    bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]
                    hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50
                    flex items-center justify-center gap-1.5"
                >
                  {isPendingArchive && <Loader2 className="h-3 w-3 animate-spin" />}
                  Confirmer
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleArchiveClick}
              disabled={anyPending}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                border border-line text-faint hover:text-[#F59E0B]
                hover:border-[#F59E0B]/30 hover:bg-[#F59E0B]/5
                transition-colors disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5 flex-shrink-0" />
              Archiver le projet
            </button>
          )}
        </div>
      )}

      {/* ── Supprimer ── */}
      <div>
        {deleteStep === 'confirm' ? (
          <div className="space-y-2">
            <p className="text-xs text-dim">
              <span className="text-ink font-medium">Action irréversible.</span> Phases, fichiers
              et commentaires seront supprimés définitivement.
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setDeleteStep('idle')}
                disabled={anyPending}
                className="flex-1 py-1.5 rounded-lg text-xs border border-line text-faint hover:text-ink hover:border-line-strong transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={anyPending}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium
                  bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]
                  hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50
                  flex items-center justify-center gap-1.5"
              >
                {isPendingDelete && <Loader2 className="h-3 w-3 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleDeleteClick}
            disabled={anyPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs
              border border-line text-faint hover:text-[#EF4444]
              hover:border-[#EF4444]/30 hover:bg-[#EF4444]/5
              transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
            Supprimer le projet
          </button>
        )}
      </div>
    </div>
  )
}
