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
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Columns,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import {
  fetchStoryboardData,
  addStoryboardComment,
  resolveStoryboardComment,
  approveStoryboardSubPhase,
  requestStoryboardRevisions,
} from '@/app/client/storyboard-actions'
import type { StoryboardShotContent, PhaseStatus } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

// ── Types ─────────────────────────────────────────────────────────

interface StoryboardShot {
  id: string
  content: StoryboardShotContent
  sort_order: number
}

interface StoryboardViewerClientProps {
  token: string
  subPhaseId: string
  phaseId: string
  status: PhaseStatus
  clientId: string | null
  initialShots: StoryboardShot[]
  initialComments: BlockComment[]
  isAuthenticated: boolean
}

// ── Column grid classes ───────────────────────────────────────────

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
}

// ── StoryboardLightbox ────────────────────────────────────────────

function StoryboardLightbox({
  shots,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  shots: StoryboardShot[]
  currentIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const current = shots[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < shots.length - 1

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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors z-10"
      >
        <X className="h-4 w-4 text-white" />
      </button>

      {/* Shot counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 border border-white/10">
        <span className="text-xs text-white/70 font-medium tabular-nums">
          Shot {currentIndex + 1} / {shots.length}
        </span>
      </div>

      {/* Prev */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors z-10"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors z-10"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Content */}
      <div
        className="flex flex-col items-center gap-4 max-w-5xl w-full mx-16 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.content.image_url}
          src={current.content.image_url}
          alt={`Shot ${current.content.shot_number}`}
          className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-2xl"
          draggable={false}
        />
        {current.content.description && (
          <p className="text-sm text-white/70 text-center max-w-2xl leading-relaxed px-4">
            {current.content.description}
          </p>
        )}
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
            ? 'Commenter ce shot'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : `${blockComments.length} commentaire${blockComments.length > 1 ? 's' : ''}`}`}
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="Votre retour sur ce shot… (Ctrl+Entrée)"
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

// ── StoryboardViewerClient ────────────────────────────────────────

export default function StoryboardViewerClient({
  token,
  subPhaseId,
  phaseId: _phaseId,
  status,
  clientId,
  initialShots,
  initialComments,
  isAuthenticated,
}: StoryboardViewerClientProps) {
  const [shots, setShots] = useState<StoryboardShot[]>(initialShots)
  const [comments, setComments] = useState<BlockComment[]>(initialComments)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [cols, setCols] = useState(3)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(status === 'completed' || status === 'approved')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionText, setRevisionText] = useState('')
  const [requestingRevision, setRequestingRevision] = useState(false)

  const isApproved = approved || status === 'completed' || status === 'approved'
  const canApprove = status === 'in_review' && !isApproved

  // Poll for updates every 10s
  const refresh = useCallback(async () => {
    const data = await fetchStoryboardData(token, subPhaseId)
    setShots(data.shots)
    setComments(data.comments)
  }, [token, subPhaseId])

  useEffect(() => {
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  // ── Comments ────────────────────────────────────────────────

  async function handleAddComment(blockId: string, content: string) {
    const result = await addStoryboardComment(token, blockId, content)
    if (!result.success) toast.error((result as { error: string }).error)
    else await refresh()
  }

  async function handleResolve(commentId: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
    )
    const result = await resolveStoryboardComment(token, commentId)
    if (!result.success) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
      )
      toast.error((result as { error: string }).error)
    }
  }

  // ── Approve ─────────────────────────────────────────────────

  async function handleApprove() {
    setApproving(true)
    const result = await approveStoryboardSubPhase(token, subPhaseId)
    setApproving(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success('Storyboard approuvé — merci !')
      setApproved(true)
    }
  }

  async function handleRequestRevision() {
    if (!revisionText.trim()) {
      toast.error('Précisez les modifications souhaitées')
      return
    }
    setRequestingRevision(true)
    const result = await requestStoryboardRevisions(token, subPhaseId, revisionText)
    setRequestingRevision(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success("Demande envoyée à l'équipe")
      setShowRevisionForm(false)
      setRevisionText('')
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Approved banner ── */}
      {isApproved && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#00D76B]/10 border border-[#00D76B]/20">
          <CheckCircle className="h-4 w-4 text-[#00D76B] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#00D76B]">Storyboard approuvé</p>
            <p className="text-[11px] text-[#00D76B]/60">{shots.length} shot{shots.length > 1 ? 's' : ''} validé{shots.length > 1 ? 's' : ''}</p>
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
              <p className="text-sm font-semibold text-white">Validez le storyboard</p>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Parcourez les shots ci-dessous, commentez si nécessaire, puis validez ou demandez des modifications.
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
                Valider le storyboard
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
                placeholder="Ex: Le shot 3 devrait montrer un plan plus large, et le shot 7 manque de contexte…"
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

      {/* ── Column selector ── */}
      {shots.length > 0 && (
        <div className="flex items-center gap-3">
          <Columns className="h-3.5 w-3.5 text-[#444444] flex-shrink-0" />
          <span className="text-xs text-[#555555]">Colonnes</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCols(n)}
                className={`w-7 h-7 rounded-lg text-xs font-medium border transition-colors ${
                  cols === n
                    ? 'bg-[#00D76B]/15 border-[#00D76B]/30 text-[#00D76B]'
                    : 'bg-[#111111] border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#3a3a3a]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Shot grid ── */}
      {shots.length > 0 ? (
        <div className={`grid gap-4 ${GRID_COLS[cols] ?? 'grid-cols-3'}`}>
          {shots.map((shot, i) => (
            <div
              key={shot.id}
              className="group bg-[#111111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/30 flex flex-col"
            >
              {/* Image */}
              <div
                className="relative aspect-video bg-[#0d0d0d] cursor-zoom-in overflow-hidden"
                onClick={() => setLightboxIndex(i)}
              >
                {/* Shot badge */}
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/70 border border-white/10">
                  <span className="text-[10px] text-white/70 font-mono tabular-nums">
                    Shot {shot.content.shot_number}
                    {shots.length > 1 && <span className="text-white/30"> / {shots.length}</span>}
                  </span>
                </div>

                {shot.content.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shot.content.image_url}
                    alt={`Shot ${shot.content.shot_number}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-[#2a2a2a]" />
                  </div>
                )}

                {/* Expand overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                  <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              </div>

              {/* Description */}
              {shot.content.description && (
                <div className="px-3 py-2.5 flex-1">
                  <p className="text-[11px] text-[#888888] leading-relaxed">{shot.content.description}</p>
                </div>
              )}

              {/* Comments */}
              <BlockComments
                blockId={shot.id}
                comments={comments}
                clientId={clientId}
                canComment={isAuthenticated}
                onAdd={handleAddComment}
                onResolve={handleResolve}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center">
            <ImageIcon className="h-7 w-7 text-[#333333]" />
          </div>
          <p className="text-sm text-[#555555]">Le storyboard apparaîtra ici</p>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && shots.length > 0 && (
        <StoryboardLightbox
          shots={shots}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(shots.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  )
}
