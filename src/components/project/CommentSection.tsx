'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Trash2, CornerDownRight, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import {
  addComment,
  toggleResolveComment,
  deleteComment,
} from '@/app/projects/comment-actions'
import { useRealtimeComments } from '@/lib/hooks/useRealtimeComments'
import type { CommentWithDetails } from '@/lib/supabase/queries'
import type { UserRole } from '@/lib/types'

// ── Schémas Zod ───────────────────────────────────────────────────

const commentSchema = z.object({
  content: z
    .string()
    .min(1, 'Le commentaire ne peut pas être vide')
    .max(2000, 'Maximum 2000 caractères'),
  phaseId: z.string().optional(),
})
type CommentForm = z.infer<typeof commentSchema>

const replySchema = z.object({
  content: z
    .string()
    .min(1, 'La réponse ne peut pas être vide')
    .max(2000, 'Maximum 2000 caractères'),
})
type ReplyForm = z.infer<typeof replySchema>

// ── Arbre de commentaires ─────────────────────────────────────────

type CommentNode = CommentWithDetails & { replies: CommentNode[] }

function buildTree(flat: CommentWithDetails[]): CommentNode[] {
  const sorted = [...flat].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const byId = new Map<string, CommentNode>()
  const roots: CommentNode[] = []

  sorted.forEach((c) => byId.set(c.id, { ...c, replies: [] }))
  sorted.forEach((c) => {
    const node = byId.get(c.id)!
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

// ── Props ─────────────────────────────────────────────────────────

interface CommentSectionProps {
  comments: CommentWithDetails[]
  projectId: string
  phases: { id: string; name: string }[]
  userId: string
  userRole: UserRole
}

// ── Composant principal ───────────────────────────────────────────

export default function CommentSection({
  comments,
  projectId,
  phases,
  userId,
  userRole,
}: CommentSectionProps) {
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const liveComments = useRealtimeComments(projectId, comments, phases)

  const canComment = userRole !== null
  const roots = buildTree(liveComments)
  const activeCount = liveComments.filter((c) => !c.is_resolved && !c.parent_id).length

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '', phaseId: '' },
  })

  const charCount = watch('content').length

  async function onSubmit(data: CommentForm) {
    setSubmitting(true)
    const result = await addComment({
      projectId,
      phaseId: data.phaseId || undefined,
      content: data.content,
    })
    setSubmitting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    reset()
  }

  async function handleResolve(commentId: string) {
    setActionId(commentId)
    const result = await toggleResolveComment(commentId)
    setActionId(null)
    if (!result.success) toast.error(result.error)
  }

  async function handleDelete(commentId: string) {
    setActionId(commentId + '-del')
    const result = await deleteComment(commentId)
    setActionId(null)
    if (!result.success) toast.error(result.error)
  }

  const sharedProps = {
    projectId,
    userId,
    userRole,
    actionId,
    replyingTo,
    setReplyingTo,
    onResolve: handleResolve,
    onDelete: handleDelete,
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-white">Commentaires</h2>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#00D76B]/10 text-[#00D76B] text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <LiveBadge />
      </div>

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {/* ── Formulaire principal ──────────────────────────────── */}
        {canComment && (
          <form onSubmit={handleSubmit(onSubmit)} className="p-4 border-b border-[#1e1e1e]">
            <textarea
              {...register('content')}
              placeholder="Ajouter un commentaire…"
              rows={3}
              className="
                w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2
                text-xs text-white placeholder-[#3a3a3a] resize-none
                focus:outline-none focus:border-[#00D76B]/30 transition-colors
              "
            />
            {errors.content && (
              <p className="text-[10px] text-[#EF4444] mt-1">{errors.content.message}</p>
            )}

            <div className="flex items-center justify-between gap-2 mt-2">
              {phases.length > 0 ? (
                <select
                  {...register('phaseId')}
                  className="
                    bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2 py-1.5
                    text-[10px] text-[#666666] focus:outline-none focus:border-[#00D76B]/30
                    cursor-pointer transition-colors
                  "
                >
                  <option value="">Général</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] tabular-nums ${charCount > 1800 ? 'text-[#F59E0B]' : 'text-[#444444]'}`}
                >
                  {charCount}/2000
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B]
                    hover:bg-[#00D76B]/20 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  Commenter
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Liste ────────────────────────────────────────────── */}
        {roots.length === 0 ? (
          <p className="px-4 py-5 text-xs text-[#444444] italic">
            Aucun commentaire pour l&apos;instant.
          </p>
        ) : (
          <div>
            {roots.map((node, i) => (
              <div key={node.id} className={i > 0 ? 'border-t border-[#1a1a1a]' : ''}>
                <CommentRow comment={node} depth={0} {...sharedProps} />
                {/* Réponses */}
                {node.replies.map((reply) => (
                  <CommentRow key={reply.id} comment={reply} depth={1} {...sharedProps} />
                ))}
                {/* Formulaire de réponse inline */}
                {replyingTo === node.id && (
                  <ReplyFormInline
                    parentId={node.id}
                    projectId={projectId}
                    phaseId={node.phase_id ?? undefined}
                    onDone={() => setReplyingTo(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Ligne de commentaire ──────────────────────────────────────────

interface CommentRowProps {
  comment: CommentNode
  depth: number
  projectId: string
  userId: string
  userRole: UserRole
  actionId: string | null
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  onResolve: (id: string) => void
  onDelete: (id: string) => void
}

function CommentRow({
  comment,
  depth,
  userId,
  userRole,
  actionId,
  replyingTo,
  setReplyingTo,
  onResolve,
  onDelete,
}: CommentRowProps) {
  const isResolveBusy = actionId === comment.id
  const isDeleteBusy = actionId === comment.id + '-del'
  const isAdminRole = userRole === 'admin'
  const canDelete = comment.user_id === userId || isAdminRole
  const isReplying = replyingTo === comment.id

  return (
    <div
      className={`
        px-4 py-3 transition-colors
        ${comment.is_resolved ? 'opacity-50' : ''}
        ${depth > 0 ? 'pl-10 bg-[#0d0d0d]' : ''}
      `}
    >
      {/* Icône d'indentation */}
      {depth > 0 && <CornerDownRight className="inline-block h-3 w-3 text-[#333333] mb-1 mr-1" />}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Avatar initiale */}
          <div className="w-6 h-6 rounded-full bg-[#00D76B]/10 border border-[#00D76B]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-[#00D76B]">
              {(comment.author?.full_name ?? '?')[0].toUpperCase()}
            </span>
          </div>
          <span className="text-xs font-medium text-white truncate">
            {comment.author?.full_name ?? 'Anonyme'}
          </span>
          {comment.phase_name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#2a2a2a] text-[#a0a0a0] border border-[#333333]">
              {comment.phase_name}
            </span>
          )}
          <span className="text-[10px] text-[#444444] flex-shrink-0">
            {formatRelative(comment.created_at)}
          </span>
          {comment.is_resolved && <span className="text-[10px] text-[#22C55E]">· résolu</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Résoudre */}
          <button
            type="button"
            onClick={() => onResolve(comment.id)}
            disabled={isResolveBusy || isDeleteBusy}
            title={comment.is_resolved ? 'Rouvrir' : 'Marquer comme résolu'}
            className={`
              w-6 h-6 rounded-full border flex items-center justify-center transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              ${
                comment.is_resolved
                  ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]'
                  : 'border-[#2a2a2a] text-[#444444] hover:text-[#22C55E] hover:border-[#22C55E]/40'
              }
            `}
          >
            {isResolveBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </button>

          {/* Supprimer */}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              disabled={isResolveBusy || isDeleteBusy}
              title="Supprimer"
              aria-label="Supprimer le commentaire"
              className="
                w-6 h-6 rounded-full border border-[#2a2a2a] flex items-center justify-center
                text-[#444444] hover:text-[#EF4444] hover:border-[#EF4444]/40
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isDeleteBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Contenu */}
      <p
        className={`
        text-xs leading-relaxed mt-2
        ${comment.is_resolved ? 'text-[#555555] line-through' : 'text-[#a0a0a0]'}
      `}
      >
        {comment.content}
      </p>

      {/* Bouton Répondre (seulement sur les racines) */}
      {depth === 0 && (
        <button
          type="button"
          onClick={() => setReplyingTo(isReplying ? null : comment.id)}
          className="mt-1.5 text-[10px] text-[#444444] hover:text-[#a0a0a0] transition-colors"
        >
          {isReplying ? 'Annuler' : 'Répondre'}
        </button>
      )}
    </div>
  )
}

// ── Indicateur temps réel ─────────────────────────────────────────

function LiveBadge() {
  return (
    <div className="relative group ml-auto">
      <span className="block w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
      <div
        className="
        pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2
        hidden group-hover:block z-10
        bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1
        text-[10px] text-[#a0a0a0] whitespace-nowrap shadow-lg
      "
      >
        Mises à jour en direct
      </div>
    </div>
  )
}

// ── Formulaire de réponse inline ──────────────────────────────────

function ReplyFormInline({
  parentId,
  projectId,
  phaseId,
  onDone,
}: {
  parentId: string
  projectId: string
  phaseId?: string
  onDone: () => void
}) {
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReplyForm>({
    resolver: zodResolver(replySchema),
  })

  async function onSubmit(data: ReplyForm) {
    setSubmitting(true)
    const result = await addComment({
      projectId,
      phaseId,
      content: data.content,
      parentId,
    })
    setSubmitting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    onDone()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="pl-10 pr-4 pb-3 bg-[#0d0d0d] border-t border-[#1a1a1a]"
    >
      <textarea
        {...register('content')}
        placeholder="Votre réponse…"
        rows={2}
        autoFocus
        className="
          w-full mt-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2
          text-xs text-white placeholder-[#3a3a3a] resize-none
          focus:outline-none focus:border-[#00D76B]/30 transition-colors
        "
      />
      {errors.content && (
        <p className="text-[10px] text-[#EF4444] mt-1">{errors.content.message}</p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[10px] text-[#666666] hover:text-white hover:border-[#444444] transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium
            bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B]
            hover:bg-[#00D76B]/20 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Répondre
        </button>
      </div>
    </form>
  )
}
