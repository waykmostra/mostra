'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, X, FileIcon } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '@/app/projects/file-actions'
import { formatFileSize } from '@/lib/utils/files'

// ── Types MIME acceptés ───────────────────────────────────────────

const ACCEPTED_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'application/zip': ['.zip'],
  'application/octet-stream': ['.ai', '.psd', '.fig'],
}

const ACCEPT_ATTR = Object.keys(ACCEPTED_MIME).join(',')
const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

// ── Props ─────────────────────────────────────────────────────────

interface FileUploadProps {
  phaseId: string
  projectId: string
  phaseSlug: string
  onComplete: () => void
}

// ── State machine ─────────────────────────────────────────────────

type UploadState =
  | { status: 'idle' }
  | { status: 'selected'; file: File }
  | { status: 'uploading'; file: File; progress: number }
  | { status: 'done'; version: number }
  | { status: 'error'; message: string }

// ── Composant ─────────────────────────────────────────────────────

export default function FileUpload({ phaseId, projectId, phaseSlug, onComplete }: FileUploadProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = useCallback((file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(`Fichier trop volumineux (max 100 MB) — ${formatFileSize(file.size)}`)
      return
    }
    if (!Object.keys(ACCEPTED_MIME).includes(file.type) && file.type !== '') {
      toast.error(`Format non supporté : ${file.type || file.name.split('.').pop()}`)
      return
    }
    setState({ status: 'selected', file })
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) pickFile(file)
    },
    [pickFile],
  )

  const handleUpload = async () => {
    if (state.status !== 'selected') return
    const { file } = state

    setState({ status: 'uploading', file, progress: 0 })

    // Progression simulée — la Server Action ne streame pas de progression
    let pct = 0
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 12, 88)
      setState((s) => (s.status === 'uploading' ? { ...s, progress: Math.round(pct) } : s))
    }, 250)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('phaseId', phaseId)
      formData.append('projectId', projectId)
      formData.append('phaseSlug', phaseSlug)

      const result = await uploadFile(formData)

      clearInterval(interval)

      if (!result.success) throw new Error(result.error)

      setState({ status: 'done', version: result.file.version })
      toast.success(`${file.name} uploadé avec succès (v${result.file.version})`)
      setTimeout(onComplete, 600)
    } catch (err) {
      clearInterval(interval)
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setState({ status: 'error', message: msg })
      toast.error(`Upload échoué : ${msg}`)
    }
  }

  const reset = () => setState({ status: 'idle' })

  // ── Render ────────────────────────────────────────────────────────

  if (state.status === 'done') {
    return (
      <div className="flex items-center gap-2 text-[#22C55E] text-sm py-4">
        <UploadCloud className="h-4 w-4" />
        <span>Upload réussi ! (v{state.version})</span>
      </div>
    )
  }

  if (state.status === 'uploading') {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-3">
          <FileIcon className="h-4 w-4 text-faint flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink truncate">{state.file.name}</p>
            <p className="text-[10px] text-faint">{formatFileSize(state.file.size)}</p>
          </div>
          <span className="text-xs text-dim tabular-nums">{state.progress}%</span>
        </div>
        <div className="h-1 bg-[rgb(var(--c-border))] rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-200"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>
    )
  }

  if (state.status === 'selected') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-surface-2 border border-line rounded-lg px-3 py-2">
          <FileIcon className="h-4 w-4 text-faint flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink truncate">{state.file.name}</p>
            <p className="text-[10px] text-faint">{formatFileSize(state.file.size)}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-faint hover:text-ink transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 py-2 rounded-lg border border-line text-xs text-dim hover:text-ink hover:border-line-strong transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleUpload}
            className="flex-1 py-2 rounded-lg bg-brand/10 border border-brand/20 text-xs text-brand hover:bg-brand/20 transition-colors"
          >
            Uploader
          </button>
        </div>
      </div>
    )
  }

  // Idle + error → zone de drop
  return (
    <div className="space-y-3">
      {state.status === 'error' && <p className="text-xs text-[#EF4444]">{state.message}</p>}

      <div
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichier"
        className={`
          border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
          ${
            dragging
              ? 'border-brand bg-brand/5'
              : 'border-line hover:border-line-strong hover:bg-surface'
          }
        `}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <UploadCloud
          className={`h-8 w-8 mx-auto mb-2 ${dragging ? 'text-brand' : 'text-faint'}`}
        />
        <p className="text-xs text-faint">
          Glissez un fichier ici ou <span className="text-ink underline">parcourez</span>
        </p>
        <p className="text-[10px] text-faint mt-1">
          PDF · Image · Vidéo · AI · PSD · FIG — max 100 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) pickFile(f)
        }}
      />
    </div>
  )
}
