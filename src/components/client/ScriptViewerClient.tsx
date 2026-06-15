'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ChevronRight,
  Hash,
  LogIn,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  Send,
  Loader2,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import type { ScriptSectionContent, PhaseStatus } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'
import {
  addBlockComment,
  approveScriptSubPhase,
  requestScriptRevisions,
  resolveBlockComment,
  fetchSubPhaseComments,
} from '@/app/client/script-actions'

// ── Types ─────────────────────────────────────────────────────────

interface ScriptBlock {
  id: string
  content: ScriptSectionContent
  sort_order: number
}

interface ScriptViewerClientProps {
  token: string
  projectId: string
  subPhaseId: string
  status: PhaseStatus
  blocks: ScriptBlock[]
  initialComments: BlockComment[]
  clientId: string | null
  isAuthenticated: boolean
}

// ── Helpers ───────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── ScriptSummary ─────────────────────────────────────────────────

function ScriptSummary({ blocks }: { blocks: ScriptBlock[] }) {
  const totalWords = blocks.reduce((sum, b) => sum + countWords(b.content.content), 0)

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-[#555555]" />
          <span className="text-xs text-[#666666]">Total</span>
          <span className="text-sm font-semibold text-white tabular-nums">
            {totalWords} mot{totalWords !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-[10px] text-[#333333]">
          ~{Math.round(totalWords / 130)} min de lecture
        </span>
      </div>

      {blocks.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {blocks.map((b, i) => (
            <div key={b.id} className="flex items-center gap-1">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                style={{
                  color: b.content.color,
                  backgroundColor: `${b.content.color}15`,
                  borderColor: `${b.content.color}30`,
                }}
              >
                {b.content.title || '—'}
              </span>
              {i < blocks.length - 1 && (
                <ChevronRight className="h-3 w-3 text-[#333333] flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
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
  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={`flex gap-3 transition-opacity ${comment.is_resolved ? 'opacity-40' : ''}`}
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author.avatar_url}
            alt={authorName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-[#666666] font-medium">{initials}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-white">{authorName}</span>
          <span className="text-[10px] text-[#444444]">{formatRelative(comment.created_at)}</span>
          {comment.is_resolved && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded-full border border-[#00D76B]/20">
              <CheckCircle className="h-2.5 w-2.5" />
              Résolu
            </span>
          )}
        </div>
        <p className="text-xs text-[#999999] leading-relaxed">{comment.content}</p>
      </div>

      {/* Resolve button — only for own unresolved comments */}
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

// ── BlockCommentSection ───────────────────────────────────────────

function BlockCommentSection({
  block,
  allComments,
  clientId,
  canComment,
  onAdd,
  onResolve,
}: {
  block: ScriptBlock
  allComments: BlockComment[]
  clientId: string | null
  canComment: boolean
  onAdd: (blockId: string, content: string) => Promise<void>
  onResolve: (commentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const blockComments = allComments.filter((c) => c.block_id === block.id)
  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length
  const { color } = block.content

  async function handleSubmit() {
    if (!text.trim()) return
    setSending(true)
    await onAdd(block.id, text.trim())
    setText('')
    setOpen(false)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="px-4 pb-4 pt-3 border-t space-y-3"
      style={{ borderColor: `${color}18` }}
    >
      {/* Comment list */}
      {blockComments.length > 0 && (
        <div className="space-y-3">
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

      {/* Add comment toggle / form */}
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
            ? 'Ajouter un commentaire'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : blockComments.length + ' commentaire' + (blockComments.length > 1 ? 's' : '')}`}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre commentaire… (Ctrl+Entrée pour envoyer)"
            rows={3}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-xs font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setText('')
              }}
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

// ── ScriptViewerClient ────────────────────────────────────────────

export default function ScriptViewerClient({
  token,
  projectId: _projectId,
  subPhaseId,
  status,
  blocks,
  initialComments,
  clientId,
  isAuthenticated,
}: ScriptViewerClientProps) {
  // Local state — no realtime (anon client can't subscribe to Supabase postgres_changes).
  // We use optimistic updates for own actions + polling every 10s for admin comments.
  const [comments, setComments] = useState<BlockComment[]>(initialComments)

  const refresh = useCallback(async () => {
    const fresh = await fetchSubPhaseComments(token, subPhaseId)
    setComments(fresh)
  }, [token, subPhaseId])

  // Poll every 10 seconds to pick up admin comments
  useEffect(() => {
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(
    status === 'completed' || status === 'approved',
  )
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionText, setRevisionText] = useState('')
  const [requestingRevision, setRequestingRevision] = useState(false)

  const isApproved = approved || status === 'completed' || status === 'approved'
  const unresolvedTotal = comments.filter((c) => !c.is_resolved && c.block_id !== null).length

  async function handleAddComment(blockId: string, content: string) {
    const result = await addBlockComment(token, blockId, content)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success('Commentaire ajouté')
      // Full refresh to get the new comment with its author info
      await refresh()
    }
  }

  async function handleResolve(commentId: string) {
    // Optimistic update — flip is_resolved immediately
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
    )
    const result = await resolveBlockComment(token, commentId)
    if (!result.success) {
      // Roll back on failure
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
      )
      toast.error((result as { error: string }).error)
    }
  }

  async function handleApprove() {
    if (!confirm('Approuver définitivement ce script ?')) return
    setApproving(true)
    const result = await approveScriptSubPhase(token, subPhaseId)
    setApproving(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success('Script approuvé — merci !')
      setApproved(true)
    }
  }

  async function handleRequestRevision() {
    if (!revisionText.trim()) {
      toast.error('Précisez les modifications souhaitées')
      return
    }
    setRequestingRevision(true)
    const result = await requestScriptRevisions(token, subPhaseId, revisionText)
    setRequestingRevision(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success("Demande envoyée à l'équipe")
      setShowRevisionForm(false)
      setRevisionText('')
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Auth gate (anonymous viewer with action available) ── */}
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
              <p className="text-sm font-semibold text-white">Script en attente de validation</p>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Relisez attentivement chaque section. Vous pouvez commenter directement sous
                chaque bloc ou demander des modifications globales.
              </p>
            </div>
          </div>

          {!showRevisionForm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/25 text-[#00D76B] text-sm font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approuver le script
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
                Décrivez les modifications souhaitées — l&apos;équipe en sera notifiée.
              </p>
              <textarea
                autoFocus
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                placeholder="Ex: Le hook n'est pas assez percutant, la partie CTA manque de clarté…"
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
                  {requestingRevision ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRevisionForm(false)
                    setRevisionText('')
                  }}
                  className="text-xs text-[#444444] hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Approved banner ── */}
      {isApproved && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#00D76B]/10 border border-[#00D76B]/20">
          <CheckCircle className="h-4 w-4 text-[#00D76B] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#00D76B]">Script approuvé</p>
            <p className="text-[11px] text-[#00D76B]/60">La production peut commencer.</p>
          </div>
        </div>
      )}

      {/* ── Unresolved comments counter ── */}
      {unresolvedTotal > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
          <MessageSquare className="h-3.5 w-3.5 text-[#F59E0B] flex-shrink-0" />
          <span className="text-xs text-[#F59E0B]">
            {unresolvedTotal} commentaire{unresolvedTotal > 1 ? 's' : ''} non
            résolu{unresolvedTotal > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── Summary ── */}
      <ScriptSummary blocks={blocks} />

      {/* ── Script blocks ── */}
      <div className="space-y-4">
        {blocks.map((block) => {
          const { color, title, description, content, vo } = block.content
          const blockComments = comments.filter((c) => c.block_id === block.id)
          const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length

          return (
            <div
              key={block.id}
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: `${color}08`,
                borderColor: `${color}25`,
                borderLeftWidth: '4px',
                borderLeftColor: color,
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: `${color}18` }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 text-sm font-semibold text-white">
                  {title || <span className="text-[#555555] italic">Sans titre</span>}
                </span>
                {unresolvedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full border border-[#F59E0B]/20">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {unresolvedCount}
                  </span>
                )}
                <span className="text-[10px] text-[#444444] font-mono flex-shrink-0">
                  {countWords(content)} mots
                </span>
              </div>

              {/* Description */}
              {description && (
                <div className="px-4 pt-3">
                  <p className="text-xs text-[#666666] italic leading-relaxed">{description}</p>
                </div>
              )}

              {/* Content (+ VO si renseignée) */}
              {vo ? (
                <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Texte</label>
                    <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                      {content || <span className="text-[#444444] italic">Aucun contenu</span>}
                    </p>
                  </div>
                  <div className="md:border-l md:pl-3" style={{ borderColor: `${color}18` }}>
                    <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color }}>VO · voix off</label>
                    <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">{vo}</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                    {content || <span className="text-[#444444] italic">Aucun contenu</span>}
                  </p>
                </div>
              )}

              {/* Comments */}
              <BlockCommentSection
                block={block}
                allComments={comments}
                clientId={clientId}
                canComment={isAuthenticated}
                onAdd={handleAddComment}
                onResolve={handleResolve}
              />
            </div>
          )
        })}
      </div>

      {blocks.length === 0 && (
        <div className="text-center py-10 text-[#444444] text-sm">
          Aucune section dans ce script.
        </div>
      )}
    </div>
  )
}
