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
  Star,
  ThumbsUp,
  Maximize2,
  ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import ImageLightbox from '@/components/shared/ImageLightbox'
import {
  fetchMoodboardData,
  selectMoodboard,
  approveMoodboardSubPhase,
  requestMoodboardRevisions,
  addMoodboardComment,
  resolveMoodboardComment,
} from '@/app/client/moodboard-actions'
import type { MoodboardImageContent, PhaseStatus } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

// ── Types ─────────────────────────────────────────────────────────

interface MoodboardBlock {
  id: string
  content: MoodboardImageContent
  sort_order: number
}

interface MoodboardViewerClientProps {
  token: string
  subPhaseId: string
  phaseId: string
  status: PhaseStatus
  clientId: string | null
  initialBlocks: MoodboardBlock[]
  initialComments: BlockComment[]
  isAuthenticated: boolean
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
  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={`flex gap-2.5 transition-opacity ${comment.is_resolved ? 'opacity-40' : ''}`}>
      <div className="w-6 h-6 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] text-[#666666] font-medium">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-medium text-white">{authorName}</span>
          <span className="text-[10px] text-[#444444]">{formatRelative(comment.created_at)}</span>
          {comment.is_resolved && (
            <span className="inline-flex items-center gap-1 text-[9px] text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded-full border border-[#00D76B]/20">
              <CheckCircle className="h-2 w-2" />
              Résolu
            </span>
          )}
        </div>
        <p className="text-xs text-[#999999] leading-relaxed">{comment.content}</p>
      </div>
      {canResolve && !comment.is_resolved && (
        <button
          type="button"
          onClick={() => onResolve(comment.id)}
          className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-1"
          title="Marquer comme résolu"
        >
          <CheckCircle className="h-3.5 w-3.5" />
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
  token,
  canComment,
  onAdd,
  onResolve,
}: {
  blockId: string
  comments: BlockComment[]
  clientId: string | null
  token: string
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
    <div className="px-4 pb-4 pt-3 border-t border-[#1e1e1e] space-y-3">
      {blockComments.length > 0 && (
        <div className="space-y-2.5">
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
          <p className="text-[11px] text-[#444444]">
            {blockComments.length} commentaire{blockComments.length > 1 ? 's' : ''}
          </p>
        ) : null
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[11px] text-[#444444] hover:text-[#888888] transition-colors group"
        >
          <MessageSquare className="h-3.5 w-3.5 group-hover:text-[#00D76B] transition-colors" />
          {blockComments.length === 0
            ? 'Commenter'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : `${blockComments.length} commentaire${blockComments.length > 1 ? 's' : ''}`}`}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="Votre avis sur ce style… (Ctrl+Entrée pour envoyer)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-xs font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setText('') }}
              className="text-[11px] text-[#444444] hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MoodboardViewerClient ─────────────────────────────────────────

export default function MoodboardViewerClient({
  token,
  subPhaseId,
  phaseId: _phaseId,
  status,
  clientId,
  initialBlocks,
  initialComments,
  isAuthenticated,
}: MoodboardViewerClientProps) {
  const [blocks, setBlocks] = useState<MoodboardBlock[]>(initialBlocks)
  const [comments, setComments] = useState<BlockComment[]>(initialComments)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(status === 'completed' || status === 'approved')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionText, setRevisionText] = useState('')
  const [requestingRevision, setRequestingRevision] = useState(false)

  const isApproved = approved || status === 'completed' || status === 'approved'
  const selectedBlock = blocks.find((b) => b.content.is_selected)
  const canApprove = status === 'in_review' && !!selectedBlock && !isApproved

  // Poll for updates every 10s
  const refresh = useCallback(async () => {
    const data = await fetchMoodboardData(token, subPhaseId)
    setBlocks(data.blocks)
    setComments(data.comments)
  }, [token, subPhaseId])

  useEffect(() => {
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const lightboxImages = blocks.map((b) => ({
    src: b.content.image_url,
    title: b.content.title,
  }))

  // ── Select style ────────────────────────────────────────────

  async function handleSelect(blockId: string) {
    if (isApproved || status !== 'in_review') return
    setSelecting(blockId)
    // Optimistic
    setBlocks((prev) =>
      prev.map((b) => ({ ...b, content: { ...b.content, is_selected: b.id === blockId } })),
    )
    const result = await selectMoodboard(token, blockId)
    setSelecting(null)
    if (!result.success) {
      toast.error((result as { error: string }).error)
      await refresh()
    } else {
      toast.success('Style sélectionné')
    }
  }

  // ── Comments ────────────────────────────────────────────────

  async function handleAddComment(blockId: string, content: string) {
    const result = await addMoodboardComment(token, blockId, content)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      await refresh()
    }
  }

  async function handleResolve(commentId: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
    )
    const result = await resolveMoodboardComment(token, commentId)
    if (!result.success) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
      )
      toast.error((result as { error: string }).error)
    }
  }

  // ── Approve ─────────────────────────────────────────────────

  async function handleApprove() {
    if (!selectedBlock) {
      toast.error("Sélectionnez un style avant d'approuver")
      return
    }
    setApproving(true)
    const result = await approveMoodboardSubPhase(token, subPhaseId)
    setApproving(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success('Direction artistique approuvée — merci !')
      setApproved(true)
    }
  }

  async function handleRequestRevision() {
    if (!revisionText.trim()) {
      toast.error('Précisez les modifications souhaitées')
      return
    }
    setRequestingRevision(true)
    const result = await requestMoodboardRevisions(token, subPhaseId, revisionText)
    setRequestingRevision(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
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
            <p className="text-sm font-semibold text-[#00D76B]">Direction artistique approuvée</p>
            {selectedBlock && (
              <p className="text-[11px] text-[#00D76B]/60">
                Style retenu : {selectedBlock.content.title}
              </p>
            )}
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
              <p className="text-sm font-semibold text-white">Choisissez votre direction artistique</p>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Cliquez sur <strong className="text-white">«&nbsp;Sélectionner ce style&nbsp;»</strong> sur
                le moodboard qui correspond à votre vision, puis validez.
              </p>
            </div>
          </div>

          {/* Selection status */}
          {selectedBlock ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00D76B]/8 border border-[#00D76B]/20">
              <Star className="h-3.5 w-3.5 text-[#00D76B]" />
              <span className="text-xs text-[#00D76B]">
                Style sélectionné : <strong>{selectedBlock.content.title}</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]">
              <Star className="h-3.5 w-3.5 text-[#444444]" />
              <span className="text-xs text-[#555555]">Aucun style sélectionné</span>
            </div>
          )}

          {!showRevisionForm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !selectedBlock}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/25 text-[#00D76B] text-sm font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={!selectedBlock ? "Sélectionnez un style d'abord" : undefined}
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Valider ce style
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
              <p className="text-xs text-[#666666]">
                Décrivez les directions que vous souhaiteriez explorer.
              </p>
              <textarea
                autoFocus
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                placeholder="Ex: J'aimerais quelque chose de plus chaud, avec des teintes ambrées…"
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

      {/* ── Moodboard grid ── */}
      {blocks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {blocks.map((block, i) => {
            const isSelected = block.content.is_selected
            const isSelectingThis = selecting === block.id
            const canSelect = status === 'in_review' && !isApproved && isAuthenticated

            return (
              <div
                key={block.id}
                className={`
                  group bg-[#111111] rounded-2xl overflow-hidden border transition-all duration-200
                  ${isSelected
                    ? 'border-[#00D76B]/50 shadow-lg shadow-[#00D76B]/10 ring-1 ring-[#00D76B]/20'
                    : 'border-[#1e1e1e] hover:border-[#2a2a2a]'}
                `}
              >
                {/* Image */}
                <div
                  className="relative aspect-[4/3] bg-[#0d0d0d] cursor-zoom-in overflow-hidden"
                  onClick={() => setLightboxIndex(i)}
                >
                  {block.content.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.content.image_url}
                      alt={block.content.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      draggable={false}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-[#2a2a2a]" />
                    </div>
                  )}

                  {/* Expand overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="h-4 w-4 text-white" />
                    </div>
                  </div>

                  {/* Selected badge */}
                  {isSelected && (
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00D76B] text-black text-[10px] font-bold shadow-lg">
                        <Star className="h-2.5 w-2.5" />
                        Sélectionné
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white leading-tight">
                    {block.content.title || <span className="text-[#555555] italic">Sans titre</span>}
                  </h3>
                  {block.content.description && (
                    <p className="text-xs text-[#777777] leading-relaxed">
                      {block.content.description}
                    </p>
                  )}

                  {/* Select button */}
                  {canSelect && (
                    <button
                      type="button"
                      onClick={() => handleSelect(block.id)}
                      disabled={!!selecting}
                      className={`
                        w-full mt-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all duration-200
                        ${isSelected
                          ? 'bg-[#00D76B]/15 border-[#00D76B]/30 text-[#00D76B] hover:bg-[#00D76B]/25'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444]'}
                        disabled:opacity-40 disabled:cursor-not-allowed
                      `}
                    >
                      {isSelectingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star className={`h-3.5 w-3.5 ${isSelected ? 'fill-current' : ''}`} />
                      )}
                      {isSelected ? 'Style sélectionné' : 'Sélectionner ce style'}
                    </button>
                  )}
                </div>

                {/* Comments */}
                <BlockComments
                  blockId={block.id}
                  comments={comments}
                  clientId={clientId}
                  token={token}
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
            <ImageIcon className="h-7 w-7 text-[#333333]" />
          </div>
          <p className="text-sm text-[#555555]">Les moodboards apparaîtront ici</p>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(lightboxImages.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  )
}
