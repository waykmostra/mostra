'use client'

import { useState } from 'react'
import { Download, Eye, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getSignedUrl } from '@/app/projects/file-actions'
import { formatFileSize } from '@/lib/utils/files'
import { formatDate } from '@/lib/utils/dates'
import type { PhaseFile } from '@/lib/types'

interface FileVersionHistoryProps {
  files: PhaseFile[]
}

export default function FileVersionHistory({ files }: FileVersionHistoryProps) {
  if (files.length === 0) return null

  // Plus récent en premier (version décroissante, puis date)
  const sorted = [...files].sort(
    (a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at),
  )

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-faint uppercase tracking-widest mb-2">
        Fichiers
      </p>
      {sorted.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </div>
  )
}

// ── Ligne d'un fichier ────────────────────────────────────────────

function FileRow({ file }: { file: PhaseFile }) {
  const [loadingAction, setLoadingAction] = useState<'view' | 'download' | null>(null)

  async function openUrl(action: 'view' | 'download') {
    setLoadingAction(action)
    const result = await getSignedUrl(file.file_url)
    setLoadingAction(null)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    if (action === 'view') {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else {
      // Déclenche le téléchargement via un lien temporaire
      const a = document.createElement('a')
      a.href = result.url
      a.download = file.file_name
      a.click()
    }
  }

  const busy = loadingAction !== null
  const btnClass =
    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border border-line text-faint hover:text-ink hover:border-line-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2">
      {/* Icône */}
      <FileText className="h-3.5 w-3.5 text-faint flex-shrink-0" />

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-ink truncate max-w-[180px]">{file.file_name}</span>
          {file.is_current && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand/10 text-brand border border-brand/20">
              Current
            </span>
          )}
          <span className="text-[10px] text-faint">v{file.version}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {file.file_size && (
            <span className="text-[10px] text-faint">{formatFileSize(file.file_size)}</span>
          )}
          <span className="text-[10px] text-faint">{formatDate(file.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          className={btnClass}
          disabled={busy}
          onClick={() => openUrl('view')}
          title="Voir"
          aria-label="Voir le fichier"
        >
          {loadingAction === 'view' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={busy}
          onClick={() => openUrl('download')}
          title="Télécharger"
          aria-label="Télécharger le fichier"
        >
          {loadingAction === 'download' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  )
}
