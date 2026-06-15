'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Trash2,
  Loader2,
  Save,
  Play,
  Send,
  CheckCircle,
  FileText,
  Hash,
  ChevronRight,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import ColorPicker from '@/components/project/ColorPicker'
import { saveScriptBlocks } from '@/app/projects/script-actions'
import { addComment, toggleResolveComment } from '@/app/projects/comment-actions'
import {
  startSubPhase,
  sendSubPhaseToReview,
  approveSubPhase,
} from '@/app/projects/sub-phase-actions'
import {
  useRealtimeBlockComments,
  type BlockComment,
} from '@/lib/hooks/useRealtimeBlockComments'
import type { PhaseStatus, ScriptSectionContent, UserRole } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────

interface ScriptBlock {
  _key: string
  content: ScriptSectionContent
}

interface ScriptEditorProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean
  initialBlocks: { id: string; content: ScriptSectionContent; sort_order: number }[]
  // Comment props (admin only)
  projectId?: string
  phaseId?: string
  initialComments?: BlockComment[]
}

// ── Helpers ───────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

let _uid = 0
function uid() {
  return `blk_${Date.now()}_${++_uid}`
}

const DEFAULT_COLOR = '#F97316'

function makeBlock(): ScriptBlock {
  return {
    _key: uid(),
    content: { title: '', color: DEFAULT_COLOR, content: '', description: '', vo: '' },
  }
}

// ── AdminBlockCommentPanel ────────────────────────────────────────

function AdminBlockCommentPanel({
  blockKey,
  blockColor,
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  blockKey: string
  blockColor: string
  projectId: string
  phaseId: string
  subPhaseId: string
  allComments: BlockComment[]
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const blockComments = allComments.filter((c) => c.block_id === blockKey)
  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length

  async function handleSubmit() {
    if (!text.trim()) return
    setSending(true)
    const result = await addComment({
      projectId,
      phaseId,
      subPhaseId,
      blockId: blockKey,
      content: text.trim(),
    })
    setSending(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success('Commentaire ajouté')
      setText('')
      setOpen(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  async function handleResolve(commentId: string) {
    const result = await toggleResolveComment(commentId)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  return (
    <div
      className="px-4 pb-4 pt-3 border-t space-y-3"
      style={{ borderColor: `${blockColor}18` }}
    >
      {/* Existing comments */}
      {blockComments.length > 0 && (
        <div className="space-y-3">
          {blockComments.map((c) => {
            const authorName = c.author?.full_name ?? 'Utilisateur'
            const initials = authorName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            return (
              <div
                key={c.id}
                className={`flex gap-3 transition-opacity ${c.is_resolved ? 'opacity-40' : ''}`}
              >
                <div className="w-6 h-6 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                  {c.author?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px] text-[#666666] font-medium">{initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px] font-medium text-white">{authorName}</span>
                    <span className="text-[10px] text-[#444444]">{formatRelative(c.created_at)}</span>
                    {c.is_resolved && (
                      <span className="text-[10px] text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded-full border border-[#00D76B]/20">
                        Résolu
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#999999] leading-relaxed">{c.content}</p>
                </div>
                {!c.is_resolved && (
                  <button
                    type="button"
                    onClick={() => handleResolve(c.id)}
                    className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-0.5"
                    title="Marquer comme résolu"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add comment */}
      {!open ? (
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
            placeholder="Commentaire interne… (Ctrl+Entrée pour envoyer)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[11px] font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
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

// ── SortableBlock ─────────────────────────────────────────────────

function SortableBlock({
  block,
  readOnly,
  onUpdate,
  onRemove,
  // Comment props
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  block: ScriptBlock
  index: number
  readOnly: boolean
  onUpdate: (key: string, patch: Partial<ScriptSectionContent>) => void
  onRemove: (key: string) => void
  projectId?: string
  phaseId?: string
  subPhaseId?: string
  allComments?: BlockComment[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block._key,
    disabled: readOnly,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const { color, title, content, description, vo } = block.content
  const wordCount = countWords(content)
  const blockComments = allComments?.filter((c) => c.block_id === block._key) ?? []
  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="rounded-2xl border overflow-hidden transition-shadow"
        style={{
          backgroundColor: `${color}12`,
          borderColor: `${color}30`,
          borderLeftWidth: '4px',
          borderLeftColor: color,
        }}
      >
        {/* Block header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: `${color}20` }}>
          {/* Drag handle */}
          {!readOnly && (
            <button
              type="button"
              className="text-[#444444] hover:text-[#666666] cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* Color picker */}
          {!readOnly && (
            <ColorPicker
              value={color}
              onChange={(c) => onUpdate(block._key, { color: c })}
            />
          )}
          {readOnly && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          )}

          {/* Title */}
          {readOnly ? (
            <span className="flex-1 text-sm font-semibold text-white">
              {title || <span className="text-[#555555] italic">Sans titre</span>}
            </span>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => onUpdate(block._key, { title: e.target.value })}
              placeholder="Titre de la section (ex: Hook, Pain Point…)"
              className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-[#555555] focus:outline-none"
            />
          )}

          {/* Unresolved comment badge */}
          {unresolvedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full border border-[#F59E0B]/20 flex-shrink-0">
              <MessageSquare className="h-2.5 w-2.5" />
              {unresolvedCount}
            </span>
          )}

          {/* Word count */}
          <span className="text-[10px] text-[#444444] font-mono flex-shrink-0">
            {wordCount} mot{wordCount !== 1 ? 's' : ''}
          </span>

          {/* Delete */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                if (!confirm('Supprimer cette section ?')) return
                onRemove(block._key)
              }}
              className="p-1 text-[#444444] hover:text-red-400 transition-colors flex-shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Description */}
        <div className="px-4 pt-3">
          {readOnly ? (
            description ? (
              <p className="text-xs text-[#666666] italic mb-2">{description}</p>
            ) : null
          ) : (
            <textarea
              rows={1}
              value={description ?? ''}
              onChange={(e) => onUpdate(block._key, { description: e.target.value })}
              placeholder="Note d'intention : pourquoi cette section ? (optionnel)"
              className="w-full bg-transparent text-xs text-[#666666] placeholder-[#333333] italic focus:outline-none resize-none leading-relaxed"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          )}
        </div>

        {/* Content (texte) + VO (voix off) */}
        <div className="px-4 pb-4 mt-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Texte du script */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Texte</label>
            {readOnly ? (
              <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                {content || <span className="text-[#444444] italic">Aucun contenu</span>}
              </p>
            ) : (
              <textarea
                rows={4}
                value={content}
                onChange={(e) => onUpdate(block._key, { content: e.target.value })}
                placeholder="Écrivez le texte de cette section du script…"
                className="w-full bg-transparent text-sm text-white placeholder-[#444444] focus:outline-none resize-none leading-relaxed"
                style={{ fieldSizing: 'content', minHeight: '80px' } as React.CSSProperties}
              />
            )}
          </div>

          {/* VO — voix off */}
          <div className="md:border-l md:pl-3" style={{ borderColor: `${color}20` }}>
            <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color }}>
              VO · voix off
            </label>
            {readOnly ? (
              <p className="text-sm text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                {vo || <span className="text-[#444444] italic">—</span>}
              </p>
            ) : (
              <textarea
                rows={4}
                value={vo ?? ''}
                onChange={(e) => onUpdate(block._key, { vo: e.target.value })}
                placeholder="Texte exact de la voix off…"
                className="w-full bg-transparent text-sm text-white placeholder-[#444444] focus:outline-none resize-none leading-relaxed"
                style={{ fieldSizing: 'content', minHeight: '80px' } as React.CSSProperties}
              />
            )}
          </div>
        </div>

        {/* Admin comment panel (when projectId is provided) */}
        {projectId && phaseId && subPhaseId && allComments !== undefined && (
          <AdminBlockCommentPanel
            blockKey={block._key}
            blockColor={color}
            projectId={projectId}
            phaseId={phaseId}
            subPhaseId={subPhaseId}
            allComments={allComments}
          />
        )}
      </div>
    </div>
  )
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
            <div key={b._key} className="flex items-center gap-1">
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

      {blocks.length === 0 && (
        <p className="text-xs text-[#333333] italic">Aucune section — ajoutez-en une ci-dessous.</p>
      )}
    </div>
  )
}

// ── ScriptEditor ──────────────────────────────────────────────────

export default function ScriptEditor({
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
  initialBlocks,
  projectId,
  phaseId,
  initialComments = [],
}: ScriptEditorProps) {
  const isAdmin = userRole === 'admin'
  const canAct = isAdmin
  const readOnly = subPhaseStatus === 'in_review' || subPhaseStatus === 'completed' || subPhaseStatus === 'approved'

  const [blocks, setBlocks] = useState<ScriptBlock[]>(() =>
    initialBlocks.map((b) => ({ _key: b.id, content: b.content })),
  )
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<'start' | 'review' | 'approve' | null>(null)

  // Realtime block comments (only if projectId is provided)
  const allComments = useRealtimeBlockComments(
    projectId ?? '',
    subPhaseId,
    initialComments,
  )

  const unresolvedTotal = projectId
    ? allComments.filter((c) => !c.is_resolved && c.block_id !== null).length
    : 0

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b._key === active.id)
      const newIdx = prev.findIndex((b) => b._key === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const updateBlock = useCallback((key: string, patch: Partial<ScriptSectionContent>) => {
    setBlocks((prev) =>
      prev.map((b) => (b._key === key ? { ...b, content: { ...b.content, ...patch } } : b)),
    )
  }, [])

  const removeBlock = useCallback((key: string) => {
    setBlocks((prev) => prev.filter((b) => b._key !== key))
  }, [])

  function addBlock() {
    setBlocks((prev) => [...prev, makeBlock()])
  }

  async function handleSave() {
    setSaving(true)
    const payload = blocks.map((b, i) => ({ content: b.content, sort_order: i + 1 }))
    const result = await saveScriptBlocks(subPhaseId, payload)
    setSaving(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else toast.success('Script sauvegardé')
  }

  async function handleTransition(action: 'start' | 'review' | 'approve') {
    setTransitioning(action)
    const result =
      action === 'start'
        ? await startSubPhase(subPhaseId)
        : action === 'review'
          ? await sendSubPhaseToReview(subPhaseId)
          : await approveSubPhase(subPhaseId)
    setTransitioning(null)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  const btnBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const busy = saving || transitioning !== null

  // ── Pending state ───────────────────────────────────────────────
  if (subPhaseStatus === 'pending') {
    return (
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto">
          <FileText className="h-5 w-5 text-[#333333]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Éditeur de script</p>
          <p className="text-xs text-[#555555] mt-1 max-w-xs mx-auto">
            Démarrez cette sous-phase pour commencer à rédiger le script de la vidéo.
          </p>
        </div>
        {canAct && canStart && (
          <button
            type="button"
            onClick={() => handleTransition('start')}
            disabled={busy}
            className={`${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20 mx-auto`}
          >
            {transitioning === 'start' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Démarrer le script
          </button>
        )}
      </div>
    )
  }

  // ── Editor ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {subPhaseStatus === 'in_review' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-[#F59E0B]">En attente de validation client</span>
            </div>
          )}
          {(subPhaseStatus === 'completed' || subPhaseStatus === 'approved') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20">
              <CheckCircle className="h-3.5 w-3.5 text-[#00D76B]" />
              <span className="text-xs text-[#00D76B]">Script approuvé</span>
            </div>
          )}
          {/* Unresolved comments badge */}
          {unresolvedTotal > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
              <MessageSquare className="h-3 w-3 text-[#F59E0B]" />
              <span className="text-xs text-[#F59E0B]">
                {unresolvedTotal} commentaire{unresolvedTotal > 1 ? 's' : ''} client
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Save draft — only in_progress */}
          {subPhaseStatus === 'in_progress' && canAct && (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className={`${btnBase} border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444]`}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Sauvegarder le brouillon
            </button>
          )}

          {/* Send to review */}
          {subPhaseStatus === 'in_progress' && canAct && (
            <button
              type="button"
              onClick={() => handleTransition('review')}
              disabled={busy || blocks.length === 0}
              title={blocks.length === 0 ? 'Ajoutez au moins une section' : undefined}
              className={`${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20`}
            >
              {transitioning === 'review' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Envoyer en review
            </button>
          )}

          {/* Approve */}
          {subPhaseStatus === 'in_review' && isAdmin && (
            <button
              type="button"
              onClick={() => handleTransition('approve')}
              disabled={busy}
              className={`${btnBase} bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/20`}
            >
              {transitioning === 'approve' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approuver
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <ScriptSummary blocks={blocks} />

      {/* Block list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b._key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {blocks.map((block, i) => (
              <SortableBlock
                key={block._key}
                block={block}
                index={i}
                readOnly={readOnly}
                onUpdate={updateBlock}
                onRemove={removeBlock}
                projectId={projectId}
                phaseId={phaseId}
                subPhaseId={subPhaseId}
                allComments={projectId ? allComments : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add section */}
      {!readOnly && (
        <button
          type="button"
          onClick={addBlock}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-[#2a2a2a] text-sm text-[#555555] hover:text-white hover:border-[#444444] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter une section
        </button>
      )}

      {/* Unsaved changes notice */}
      {subPhaseStatus === 'in_progress' && !readOnly && (
        <p className="text-[11px] text-[#333333] text-center">
          Les modifications ne sont pas sauvegardées automatiquement — cliquez sur{' '}
          <span className="text-[#555555]">Sauvegarder le brouillon</span>.
        </p>
      )}
    </div>
  )
}
