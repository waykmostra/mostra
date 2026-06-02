'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  LogIn,
  MessageSquare,
  RotateCcw,
  Send,
  ThumbsUp,
  Maximize2,
  FileImage,
  File,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import {
  fetchDesignData,
  addDesignComment,
  resolveDesignComment,
  approveDesignSubPhase,
  requestDesignRevisions,
} from '@/app/client/design-actions'
import type { DesignFileContent, PhaseStatus } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

// ── Types ─────────────────────────────────────────────────────────

interface DesignFile {
  id: string
  content: DesignFileContent
  sort_order: number
}

interface DesignViewerClientProps {
  token: string
  subPhaseId: string
  phaseId: string
  status: PhaseStatus
  clientId: string | null
  initialFiles: DesignFile[]
  initialComments: BlockComment[]
  isAuthenticated: boolean
}

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

// ── Lightbox ──────────────────────────────────────────────────────

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
        {current.content.description && (
          <p className="text-sm text-white/70 text-center max-w-2xl leading-relaxed px-4">
            {current.content.description}
          </p>
        )}
        <p className="text-xs text-white/30">{current.content.file_name}</p>
      </div>
    </div>
  )
}

// ── CommentItem ───────────────────────────────────────────────────

function CommentItem({
  comment,
  canResolve,
  onResolve,
}: {
  comment: BlockComment
  canResolve: boolean
  onResolve: (id: string) => void
}) {
  const authorName = comment.author?.full_name ?? 'Client'
  const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={`flex gap-2 transition-opacity ${comment.is_resolved ? 'opacity-40' : ''}`}>
      <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[8px] text-[#666666] font-medium">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[10px] font-medium text-white">{authorName}</span>
          <span className="text-[9px] text-[#444444]">{formatRelative(comment.created_at)}</span>
          {comment.is_resolved && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-[#00D76B] bg-[#00D76B]/10 px-1 py-0.5 rounded-full border border-[#00D76B]/20">
              <CheckCircle className="h-2 w-2" />Résolu
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#999999] leading-relaxed">{comment.content}</p>
      </div>
      {canResolve && !comment.is_resolved && (
        <button
          type="button"
          onClick={() => onResolve(comment.id)}
          className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-0.5"
        >
          <CheckCircle className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── BlockComments ─────────────────────────────────────────────────

function BlockComments({
  blockId,
  comments,
  clientId,
  canComment,
  onAdd,
  onResolve,
}: {
  blockId: string
  comments: BlockComment[]
  clientId: string | null
  canComment: boolean
  onAdd: (blockId: string, content: string) => Promise<void>
  onResolve: (commentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const blockComments = comments.filter((c) => c.block_id === blockId)
  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length

  async function handleSubmit() {
    if (!text.trim()) return
    setSending(true)
    await onAdd(blockId, text.trim())
    setText('')
    setOpen(false)
    setSending(false)
  }

  return (
    <div className="px-3 pb-3 pt-2.5 border-t border-[#1e1e1e] space-y-2.5">
      {blockComments.length > 0 && (
        <div className="space-y-2">
          {blockComments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canResolve={!!clientId && c.user_id === clientId}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}

      {!canComment ? (
        blockComments.length > 0 ? (
          <p className="text-[10px] text-[#444444]">
            {blockComments.length} commentaire{blockComments.length > 1 ? 's' : ''}
          </p>
        ) : null
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[10px] text-[#444444] hover:text-[#888888] transition-colors group"
        >
          <MessageSquare className="h-3 w-3 group-hover:text-[#00D76B] transition-colors" />
          {blockComments.length === 0
            ? 'Commenter ce fichier'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : `${blockComments.length} commentaire${blockComments.length > 1 ? 's' : ''}`}`}
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="Votre retour sur ce fichier… (Ctrl+Entrée)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[10px] font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setText('') }}
              className="text-[10px] text-[#444444] hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DesignViewerClient ────────────────────────────────────────────

export default function DesignViewerClient({
  token,
  subPhaseId,
  phaseId: _phaseId,
  status,
  clientId,
  initialFiles,
  initialComments,
  isAuthenticated,
}: DesignViewerClientProps) {
  const [files, setFiles] = useState<DesignFile[]>(initialFiles)
  const [comments, setComments] = useState<BlockComment[]>(initialComments)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(status === 'completed' || status === 'approved')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionText, setRevisionText] = useState('')
  const [requestingRevision, setRequestingRevision] = useState(false)

  const isApproved = approved || status === 'completed' || status === 'approved'
  const canApprove = status === 'in_review' && !isApproved

  // Only image files go into the lightbox
  const imageFiles = files.filter((f) => isImageFile(f.content))

  // Poll for updates every 10s
  const refresh = useCallback(async () => {
    const data = await fetchDesignData(token, subPhaseId)
    setFiles(data.files)
    setComments(data.comments)
  }, [token, subPhaseId])

  useEffect(() => {
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  // ── Comments ──────────────────────────────────────────────────

  async function handleAddComment(blockId: string, content: string) {
    const result = await addDesignComment(token, blockId, content)
    if (!result.success) toast.error((result as { error: string }).error)
    else await refresh()
  }

  async function handleResolve(commentId: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
    )
    const result = await resolveDesignComment(token, commentId)
    if (!result.success) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
      )
      toast.error((result as { error: string }).error)
    }
  }

  // ── Approve ───────────────────────────────────────────────────

  async function handleApprove() {
    setApproving(true)
    const result = await approveDesignSubPhase(token, subPhaseId)
    setApproving(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success('Maquettes approuvées — merci !')
      setApproved(true)
    }
  }

  async function handleRequestRevision() {
    if (!revisionText.trim()) {
      toast.error('Précisez les modifications souhaitées')
      return
    }
    setRequestingRevision(true)
    const result = await requestDesignRevisions(token, subPhaseId, revisionText)
    setRequestingRevision(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success("Demande envoyée à l'équipe")
      setShowRevisionForm(false)
      setRevisionText('')
    }
  }

  // ── Lightbox helpers ──────────────────────────────────────────

  function handleOpenLightbox(file: DesignFile) {
    if (!isImageFile(file.content)) return
    const idx = imageFiles.findIndex((f) => f.id === file.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Approved banner ── */}
      {isApproved && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#00D76B]/10 border border-[#00D76B]/20">
          <CheckCircle className="h-4 w-4 text-[#00D76B] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#00D76B]">Maquettes approuvées</p>
            <p className="text-[11px] text-[#00D76B]/60">
              {files.length} fichier{files.length > 1 ? 's' : ''} validé{files.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Auth gate (anonymous viewer) ── */}
      {!isApproved && status === 'in_review' && !isAuthenticated && (
        <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Connectez-vous pour valider</p>
              <p className="text-xs text-[#666666] mt-0.5">Vous devez être connecté pour valider, commenter ou modifier cette phase.</p>
            </div>
          </div>
          <Link href="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors">
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>
        </div>
      )}

      {/* ── Approval panel ── */}
      {!isApproved && status === 'in_review' && isAuthenticated && (
        <div className="bg-[#111111] border border-[#F59E0B]/25 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
              <ThumbsUp className="h-4 w-4 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Validez les maquettes</p>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Consultez les fichiers ci-dessous, commentez si nécessaire, puis validez ou demandez des modifications.
              </p>
            </div>
          </div>

          {!showRevisionForm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !canApprove}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/25 text-[#00D76B] text-sm font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Valider les maquettes
              </button>
              <button
                type="button"
                onClick={() => setShowRevisionForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2a2a] text-[#888888] text-sm hover:text-white hover:border-[#444444] transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Demander des modifications
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#666666]">Décrivez les changements que vous souhaitez.</p>
              <textarea
                autoFocus
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                placeholder="Ex: Le logo est trop petit sur la maquette 2, et la palette de couleurs du fichier 1 ne correspond pas à notre charte…"
                rows={4}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestRevision}
                  disabled={requestingRevision || !revisionText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-sm font-medium hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {requestingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRevisionForm(false); setRevisionText('') }}
                  className="text-xs text-[#444444] hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── File grid ── */}
      {files.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {files.map((file) => {
            const isImage = isImageFile(file.content)
            return (
              <div
                key={file.id}
                className="group bg-[#111111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/30 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1a1a1a]">
                  <span className="text-[10px] text-[#555555] font-mono truncate max-w-[70%]" title={file.content.file_name}>
                    {file.content.file_name}
                  </span>
                  <div className="flex items-center gap-1">
                    {file.content.file_size > 0 && (
                      <span className="text-[9px] text-[#3a3a3a] tabular-nums">{formatBytes(file.content.file_size)}</span>
                    )}
                    <a
                      href={file.content.file_url}
                      download={file.content.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-6 h-6 rounded flex items-center justify-center text-[#444444] hover:text-[#00D76B] transition-colors"
                      title="Télécharger"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Preview area */}
                {isImage ? (
                  <div
                    className="relative aspect-video bg-[#0d0d0d] cursor-zoom-in overflow-hidden"
                    onClick={() => handleOpenLightbox(file)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.content.file_url}
                      alt={file.content.file_name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      draggable={false}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                      <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-[#0a0a0a] flex items-center justify-center">
                    <FileTypeIcon content={file.content} className="w-16 h-16 text-2xl" />
                  </div>
                )}

                {/* Description */}
                {file.content.description && (
                  <div className="px-3 py-2.5 flex-1">
                    <p className="text-[11px] text-[#888888] leading-relaxed">{file.content.description}</p>
                  </div>
                )}

                {/* Comments */}
                <BlockComments
                  blockId={file.id}
                  comments={comments}
                  clientId={clientId}
                  canComment={isAuthenticated}
                  onAdd={handleAddComment}
                  onResolve={handleResolve}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center">
            <FileImage className="h-7 w-7 text-[#333333]" />
          </div>
          <p className="text-sm text-[#555555]">Aucune maquette disponible pour le moment</p>
        </div>
      )}

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
