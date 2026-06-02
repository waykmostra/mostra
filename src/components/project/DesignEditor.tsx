'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  Upload,
  Trash2,
  Download,
  Play,
  Send,
  CheckCircle,
  RotateCcw,
  Loader2,
  MessageSquare,
  FileImage,
  File,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Palette,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import { addComment, toggleResolveComment } from '@/app/projects/comment-actions'
import {
  startSubPhase,
  sendSubPhaseToReview,
  approveSubPhase,
  unapproveSubPhase,
} from '@/app/projects/sub-phase-actions'
import {
  uploadDesignFiles,
  updateDesignFileDescription,
  deleteDesignFile,
  type DesignFile,
} from '@/app/projects/design-actions'
import {
  useRealtimeBlockComments,
  type BlockComment,
} from '@/lib/hooks/useRealtimeBlockComments'
import type { PhaseStatus, UserRole, DesignFileContent } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function isImageFile(content: DesignFileContent): boolean {
  if (content.mime_type?.startsWith('image/')) return true
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(getExt(content.file_name))
}

// ── File type visual label ────────────────────────────────────────

const EXT_LABELS: Record<string, { label: string; color: string }> = {
  pdf: { label: 'PDF', color: '#EF4444' },
  psd: { label: 'PSD', color: '#31ABE3' },
  ai:  { label: 'AI',  color: '#FF9A00' },
  fig: { label: 'Fig', color: '#A259FF' },
  xd:  { label: 'XD',  color: '#FF61F6' },
  sketch: { label: 'SK', color: '#FDB300' },
  svg: { label: 'SVG', color: '#22C55E' },
}

function FileTypeIcon({ content, className }: { content: DesignFileContent; className?: string }) {
  const ext = getExt(content.file_name)
  const info = EXT_LABELS[ext]

  if (info) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl font-bold text-sm ${className ?? 'w-12 h-12'}`}
        style={{ backgroundColor: `${info.color}18`, border: `1px solid ${info.color}30`, color: info.color }}
      >
        {info.label}
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#444444] ${className ?? 'w-12 h-12'}`}>
      <File className="h-5 w-5" />
    </div>
  )
}

// ── Lightbox (images only) ────────────────────────────────────────

function DesignLightbox({
  files,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  files: DesignFile[]
  currentIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const current = files[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < files.length - 1

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors z-10"
      >
        <X className="h-4 w-4 text-white" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 border border-white/10">
        <span className="text-xs text-white/70 font-medium">{currentIndex + 1} / {files.length}</span>
      </div>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors z-10"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors z-10"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}

      <div
        className="flex flex-col items-center gap-4 max-w-5xl w-full mx-16 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.content.file_url}
          src={current.content.file_url}
          alt={current.content.file_name}
          className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl"
          draggable={false}
        />
        <p className="text-xs text-white/50">{current.content.file_name}</p>
      </div>
    </div>
  )
}

// ── AdminCommentPanel ─────────────────────────────────────────────

function AdminCommentPanel({
  blockId,
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  blockId: string
  projectId: string
  phaseId: string
  subPhaseId: string
  allComments: BlockComment[]
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const blockComments = allComments.filter((c) => c.block_id === blockId)
  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length

  async function handleSubmit() {
    if (!text.trim()) return
    setSending(true)
    const result = await addComment({ projectId, phaseId, subPhaseId, blockId, content: text.trim() })
    setSending(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else { toast.success('Commentaire ajouté'); setText(''); setOpen(false) }
  }

  async function handleResolve(commentId: string) {
    const result = await toggleResolveComment(commentId)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  return (
    <div className="px-3 pb-3 pt-2.5 border-t border-[#1e1e1e] space-y-2.5">
      {blockComments.length > 0 && (
        <div className="space-y-2">
          {blockComments.map((c) => {
            const authorName = c.author?.full_name ?? 'Utilisateur'
            const initials = authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            return (
              <div key={c.id} className={`flex gap-2 transition-opacity ${c.is_resolved ? 'opacity-40' : ''}`}>
                <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                  {c.author?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                    : <span className="text-[8px] text-[#666666] font-medium">{initials}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-medium text-white">{authorName}</span>
                    <span className="text-[9px] text-[#444444]">{formatRelative(c.created_at)}</span>
                    {c.is_resolved && (
                      <span className="text-[9px] text-[#00D76B] bg-[#00D76B]/10 px-1 py-0.5 rounded-full border border-[#00D76B]/20">Résolu</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#999999] leading-relaxed">{c.content}</p>
                </div>
                {!c.is_resolved && (
                  <button type="button" onClick={() => handleResolve(c.id)}
                    className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[10px] text-[#444444] hover:text-[#888888] transition-colors group">
          <MessageSquare className="h-3 w-3 group-hover:text-[#00D76B] transition-colors" />
          {blockComments.length === 0
            ? 'Commenter'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : `${blockComments.length} commentaire${blockComments.length > 1 ? 's' : ''}`}`}
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="Note interne… (Ctrl+Entrée)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSubmit} disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[10px] font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40">
              {sending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
              Envoyer
            </button>
            <button type="button" onClick={() => { setOpen(false); setText('') }}
              className="text-[10px] text-[#444444] hover:text-white transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FileCard ──────────────────────────────────────────────────────

function FileCard({
  file,
  canEdit,
  onOpenLightbox,
  onDelete,
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  file: DesignFile
  canEdit: boolean
  onOpenLightbox: () => void
  onDelete: (id: string) => void
  projectId: string
  phaseId: string
  subPhaseId: string
  allComments: BlockComment[]
}) {
  const [description, setDescription] = useState(file.content.description ?? '')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const isImage = isImageFile(file.content)

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    onDelete(file.id)
    const result = await deleteDesignFile(file.id)
    if (!result.success) toast.error((result as { error: string }).error)
    setDeleting(false)
  }

  return (
    <div className="group bg-[#111111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/30 flex flex-col">

      {/* Header strip */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1a1a1a]">
        <span className="text-[10px] text-[#555555] font-mono truncate max-w-[70%]" title={file.content.file_name}>
          {file.content.file_name}
        </span>
        <div className="flex items-center gap-1">
          {file.content.file_size > 0 && (
            <span className="text-[9px] text-[#3a3a3a] tabular-nums">{formatBytes(file.content.file_size)}</span>
          )}
          {/* Download */}
          <a
            href={file.content.file_url}
            download={file.content.file_name}
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 rounded flex items-center justify-center text-[#444444] hover:text-[#00D76B] transition-colors"
            title="Télécharger"
          >
            <Download className="h-3 w-3" />
          </a>
          {/* Delete */}
          {canEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors opacity-0 group-hover:opacity-100 ${
                confirmDelete
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555555] hover:text-white hover:border-[#444444]'
              }`}
            >
              {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
              {confirmDelete ? 'Confirmer ?' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Preview area */}
      {isImage ? (
        <div
          className="relative aspect-video bg-[#0d0d0d] cursor-zoom-in overflow-hidden"
          onClick={onOpenLightbox}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <FileImage className="h-6 w-6 text-[#2a2a2a]" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.content.file_url}
            alt={file.content.file_name}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
            <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>
      ) : (
        /* Non-image file: large icon area */
        <div className="aspect-video bg-[#0a0a0a] flex items-center justify-center">
          <FileTypeIcon content={file.content} className="w-16 h-16 text-2xl" />
        </div>
      )}

      {/* Description */}
      <div className="px-3 py-2.5 flex-1">
        {canEdit ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (file.content.description ?? '')) {
                updateDesignFileDescription(file.id, description).then((r) => {
                  if (!r.success) toast.error((r as { error: string }).error)
                })
              }
            }}
            placeholder="Description, notes, commentaires…"
            rows={2}
            className="w-full bg-transparent text-[11px] text-[#888888] placeholder-[#444444] focus:outline-none resize-none leading-relaxed focus:text-[#aaaaaa] transition-colors"
          />
        ) : (
          file.content.description && (
            <p className="text-[11px] text-[#888888] leading-relaxed">{file.content.description}</p>
          )
        )}
      </div>

      {/* Comments */}
      <AdminCommentPanel
        blockId={file.id}
        projectId={projectId}
        phaseId={phaseId}
        subPhaseId={subPhaseId}
        allComments={allComments}
      />
    </div>
  )
}

// ── UploadZone ────────────────────────────────────────────────────

function UploadZone({
  subPhaseId,
  projectId,
  onFilesAdded,
}: {
  subPhaseId: string
  projectId: string
  onFilesAdded: (files: DesignFile[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function processFiles(fileList: FileList) {
    if (fileList.length === 0) return
    setUploading(true)

    const formData = new FormData()
    formData.set('subPhaseId', subPhaseId)
    formData.set('projectId', projectId)
    Array.from(fileList).forEach((f) => formData.append('files', f))

    const result = await uploadDesignFiles(formData)
    setUploading(false)

    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success(`${(result as { files: DesignFile[] }).files.length} fichier${(result as { files: DesignFile[] }).files.length > 1 ? 's' : ''} importé${(result as { files: DesignFile[] }).files.length > 1 ? 's' : ''}`)
      onFilesAdded((result as { files: DesignFile[] }).files)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        dragOver
          ? 'border-[#00D76B]/50 bg-[#00D76B]/5'
          : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#0a0a0a]'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.fig,.xd,.sketch"
        onChange={handleChange}
        className="hidden"
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-7 w-7 text-[#00D76B] animate-spin" />
          <p className="text-sm text-[#555555]">Import en cours…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-7 w-7 text-[#333333]" />
          <p className="text-sm text-[#555555]">
            Glissez vos fichiers ici ou <span className="text-[#00D76B] font-medium">parcourir</span>
          </p>
          <p className="text-[11px] text-[#3a3a3a]">
            PNG, JPG, SVG, PDF, PSD, AI, Fig, XD, Sketch — max 100 MB
          </p>
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────

interface DesignEditorProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean
  projectId: string
  phaseId: string
  initialFiles: DesignFile[]
  initialComments?: BlockComment[]
}

// ── DesignEditor ──────────────────────────────────────────────────

export default function DesignEditor({
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
  projectId,
  phaseId,
  initialFiles,
  initialComments = [],
}: DesignEditorProps) {
  const [files, setFiles] = useState<DesignFile[]>(initialFiles)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [, startTransition] = useTransition()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [confirmUnapprove, setConfirmUnapprove] = useState(false)

  const comments = useRealtimeBlockComments(projectId, subPhaseId, initialComments)

  const isAdmin = userRole === 'admin'
  const canEdit = subPhaseStatus === 'pending' || subPhaseStatus === 'in_progress'

  // Only image files go into the lightbox, in order
  const imageFiles = files.filter((f) => isImageFile(f.content))

  function handleFilesAdded(newFiles: DesignFile[]) {
    setFiles((prev) => [...prev, ...newFiles])
  }

  function handleDelete(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    startTransition(async () => {
      const result = await deleteDesignFile(fileId)
      if (!result.success) toast.error((result as { error: string }).error)
      else toast.success('Fichier supprimé')
    })
  }

  // ── Workflow ──────────────────────────────────────────────────

  async function handleAction(action: string) {
    setLoadingAction(action)
    let result: { success: boolean; error?: string } = { success: false }

    if (action === 'start') result = await startSubPhase(subPhaseId)
    else if (action === 'review') {
      if (files.length === 0) {
        toast.error("Ajoutez au moins un fichier avant d'envoyer en review")
        setLoadingAction(null)
        return
      }
      result = await sendSubPhaseToReview(subPhaseId)
    }
    else if (action === 'approve') result = await approveSubPhase(subPhaseId)
    else if (action === 'unapprove') {
      result = await unapproveSubPhase(subPhaseId)
      setConfirmUnapprove(false)
    }

    setLoadingAction(null)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  // ── Lightbox helpers (image files only) ──────────────────────

  function getLightboxIndex(fileId: string): number {
    return imageFiles.findIndex((f) => f.id === fileId)
  }

  function handleOpenLightbox(file: DesignFile) {
    if (!isImageFile(file.content)) return
    const idx = getLightboxIndex(file.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Actions panel ── */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <Palette className="h-4 w-4 text-[#555555] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#555555] uppercase tracking-widest">Maquettes Design</p>
          <p className="text-sm text-[#888888] mt-0.5">
            {files.length === 0
              ? 'Aucun fichier — importez vos maquettes'
              : `${files.length} fichier${files.length > 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {subPhaseStatus === 'pending' && canStart && (
            <button
              type="button"
              onClick={() => handleAction('start')}
              disabled={!!loadingAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] text-xs font-medium hover:bg-[#3B82F6]/20 transition-colors disabled:opacity-40"
            >
              {loadingAction === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Démarrer
            </button>
          )}

          {subPhaseStatus === 'in_progress' && (
            <button
              type="button"
              onClick={() => handleAction('review')}
              disabled={!!loadingAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-xs font-medium hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-40"
            >
              {loadingAction === 'review' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Envoyer en review
            </button>
          )}

          {subPhaseStatus === 'in_review' && isAdmin && (
            <button
              type="button"
              onClick={() => handleAction('approve')}
              disabled={!!loadingAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-xs font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
            >
              {loadingAction === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Approuver
            </button>
          )}

          {(subPhaseStatus === 'completed' || subPhaseStatus === 'approved' || subPhaseStatus === 'in_review') && isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (!confirmUnapprove) { setConfirmUnapprove(true); return }
                handleAction('unapprove')
              }}
              disabled={!!loadingAction}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-40 ${
                confirmUnapprove
                  ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444]'
              }`}
            >
              {loadingAction === 'unapprove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {confirmUnapprove ? 'Confirmer ?' : 'Désapprouver'}
            </button>
          )}
        </div>
      </div>

      {/* ── Upload zone ── */}
      {canEdit && (
        <UploadZone
          subPhaseId={subPhaseId}
          projectId={projectId}
          onFilesAdded={handleFilesAdded}
        />
      )}

      {/* ── File grid ── */}
      {files.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              canEdit={canEdit}
              onOpenLightbox={() => handleOpenLightbox(file)}
              onDelete={handleDelete}
              projectId={projectId}
              phaseId={phaseId}
              subPhaseId={subPhaseId}
              allComments={comments}
            />
          ))}
        </div>
      ) : !canEdit ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center">
            <Palette className="h-7 w-7 text-[#333333]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#555555]">Aucun fichier</p>
            <p className="text-xs text-[#444444] mt-1">Les fichiers de design apparaîtront ici une fois ajoutés</p>
          </div>
        </div>
      ) : null}

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && imageFiles.length > 0 && (
        <DesignLightbox
          files={imageFiles}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(imageFiles.length - 1, (i ?? 0) + 1))}
        />
      )}

    </div>
  )
}
