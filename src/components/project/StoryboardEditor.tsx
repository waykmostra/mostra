'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  Loader2,
  Play,
  Send,
  CheckCircle,
  RotateCcw,
  Maximize2,
  ImageIcon,
  Upload,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Film,
  Columns,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import {
  createStoryboardShots,
  updateStoryboardShot,
  deleteStoryboardShot,
  reorderStoryboardShots,
  type StoryboardShot,
} from '@/app/projects/storyboard-actions'
import {
  startSubPhase,
  sendSubPhaseToReview,
  approveSubPhase,
  unapproveSubPhase,
} from '@/app/projects/sub-phase-actions'
import { addComment, toggleResolveComment } from '@/app/projects/comment-actions'
import {
  useRealtimeBlockComments,
  type BlockComment,
} from '@/lib/hooks/useRealtimeBlockComments'
import type { PhaseStatus, UserRole } from '@/lib/types'

// ── Column grid classes (static for Tailwind) ─────────────────────

// Responsive : sur mobile max 2 cols, à partir de md on respecte le choix admin
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
}

// ── Props ─────────────────────────────────────────────────────────

interface StoryboardEditorProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean
  projectId: string
  phaseId: string
  initialShots: StoryboardShot[]
  initialComments?: BlockComment[]
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
        <span className="text-xs text-white/70 tabular-nums font-medium">
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

// ── ShotCard ──────────────────────────────────────────────────────

function ShotCard({
  shot,
  totalShots,
  onOpenLightbox,
  onUpdate,
  onDelete,
  canEdit,
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  shot: StoryboardShot
  totalShots: number
  onOpenLightbox: () => void
  onUpdate: (id: string, patch: { description: string }) => void
  onDelete: (id: string) => void
  canEdit: boolean
  projectId: string
  phaseId: string
  subPhaseId: string
  allComments: BlockComment[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shot.id,
    disabled: !canEdit,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const [description, setDescription] = useState(shot.content.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    onDelete(shot.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-[#111111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl overflow-hidden hover:shadow-lg hover:shadow-black/30 flex flex-col"
    >
      {/* Header strip: shot number + drag handle + delete */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1a1a1a]">
        <span className="text-[10px] text-[#555555] font-mono tabular-nums">
          Shot {shot.content.shot_number}
          {totalShots > 1 && <span className="text-[#333333]"> / {totalShots}</span>}
        </span>
        {canEdit && (
          <div className="flex items-center gap-1">
            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`
                inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors opacity-0 group-hover:opacity-100
                ${confirmDelete
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555555] hover:text-white hover:border-[#444444]'}
              `}
            >
              {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
              {confirmDelete ? 'Confirmer ?' : ''}
            </button>
            {/* Drag handle — attributes + listeners both here, matching DraggablePhaseList pattern */}
            <button
              type="button"
              className="w-6 h-6 rounded flex items-center justify-center cursor-grab active:cursor-grabbing text-[#666666] hover:text-white hover:bg-[#2a2a2a] transition-colors touch-none"
              {...attributes}
              {...listeners}
              title="Réorganiser"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Image */}
      <div
        className="relative aspect-video bg-[#0d0d0d] cursor-zoom-in overflow-hidden"
        onClick={onOpenLightbox}
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-[#2a2a2a]" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.content.image_url}
          alt={`Shot ${shot.content.shot_number}`}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          draggable={false}
        />

        {/* Expand overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
          <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-3 py-2.5 flex-1">
        {canEdit ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (shot.content.description ?? ''))
                onUpdate(shot.id, { description })
            }}
            placeholder="Description, composition, durée…"
            rows={2}
            className="w-full bg-transparent text-[11px] text-[#888888] placeholder-[#444444] focus:outline-none resize-none leading-relaxed focus:text-[#aaaaaa] transition-colors"
          />
        ) : (
          shot.content.description && (
            <p className="text-[11px] text-[#888888] leading-relaxed">{shot.content.description}</p>
          )
        )}
      </div>

      {/* Comment panel */}
      <AdminCommentPanel
        blockId={shot.id}
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
  onShotsAdded,
}: {
  subPhaseId: string
  projectId: string
  onShotsAdded: (shots: StoryboardShot[]) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateFiles(files: File[]): File[] {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    const valid: File[] = []
    for (const f of files) {
      if (!validTypes.includes(f.type)) {
        toast.error(`Format invalide : ${f.name}`)
        continue
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`Trop lourd : ${f.name} (max 10 MB)`)
        continue
      }
      valid.push(f)
    }
    return valid
  }

  async function uploadFiles(files: File[]) {
    const valid = validateFiles(files)
    if (valid.length === 0) return

    setUploading(true)
    setUploadCount(valid.length)

    const formData = new FormData()
    formData.set('subPhaseId', subPhaseId)
    formData.set('projectId', projectId)
    for (const f of valid) formData.append('files', f)

    const result = await createStoryboardShots(formData)
    setUploading(false)
    setUploadCount(0)

    if (!result.success) {
      toast.error((result as { error: string }).error)
      return
    }

    const { shots } = result as { success: true; shots: StoryboardShot[] }
    toast.success(`${shots.length} shot${shots.length > 1 ? 's' : ''} ajouté${shots.length > 1 ? 's' : ''}`)
    onShotsAdded(shots)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    uploadFiles(files)
  }

  return (
    <div
      className={`
        relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10 px-6 cursor-pointer transition-all duration-200
        ${dragging ? 'border-[#00D76B] bg-[#00D76B]/5 scale-[1.01]' : 'border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#111111]/50'}
        ${uploading ? 'pointer-events-none' : ''}
      `}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 text-[#00D76B] animate-spin" />
          <div className="text-center">
            <p className="text-sm text-white font-medium">Upload en cours…</p>
            <p className="text-xs text-[#666666] mt-0.5">
              {uploadCount} image{uploadCount > 1 ? 's' : ''} en traitement
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
            <Upload className={`h-6 w-6 transition-colors ${dragging ? 'text-[#00D76B]' : 'text-[#555555]'}`} />
          </div>
          <div className="text-center">
            <p className="text-sm text-[#888888]">
              {dragging ? 'Relâchez pour importer' : 'Glissez vos images ici'}
            </p>
            <p className="text-xs text-[#555555] mt-0.5">ou cliquez pour parcourir — sélection multiple</p>
            <p className="text-[11px] text-[#444444] mt-2">PNG, JPG, WEBP — max 10 MB par image</p>
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) uploadFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── StoryboardEditor ──────────────────────────────────────────────

export default function StoryboardEditor({
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
  projectId,
  phaseId,
  initialShots,
  initialComments = [],
}: StoryboardEditorProps) {
  const [shots, setShots] = useState<StoryboardShot[]>(initialShots)
  const [cols, setCols] = useState(3)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [confirmUnapprove, setConfirmUnapprove] = useState(false)

  const comments = useRealtimeBlockComments(projectId, subPhaseId, initialComments)

  const isAdmin = userRole === 'admin'
  const canEdit = subPhaseStatus === 'pending' || subPhaseStatus === 'in_progress'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // ── DnD ──────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Functional updater guarantees we work on the latest state (no stale closure)
    let newOrderIds: string[] = []
    setShots((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id)
      const newIndex = prev.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev

      const reordered = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({
        ...s,
        sort_order: i + 1,
        content: { ...s.content, shot_number: i + 1 },
      }))
      newOrderIds = reordered.map((s) => s.id)
      return reordered
    })

    // Persist asynchronously — compute IDs again from current shots to avoid closure dependency
    const oldIndex = shots.findIndex((s) => s.id === active.id)
    const newIndex = shots.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const persistIds = arrayMove(shots, oldIndex, newIndex).map((s) => s.id)

    startTransition(async () => {
      const result = await reorderStoryboardShots(subPhaseId, persistIds)
      if (!result.success) toast.error((result as { error: string }).error)
    })
  }

  // ── Block mutations ───────────────────────────────────────────

  function handleShotsAdded(newShots: StoryboardShot[]) {
    setShots((prev) => [...prev, ...newShots])
  }

  function handleDelete(shotId: string) {
    setShots((prev) => {
      const filtered = prev.filter((s) => s.id !== shotId)
      return filtered.map((s, i) => ({
        ...s,
        sort_order: i + 1,
        content: { ...s.content, shot_number: i + 1 },
      }))
    })
    startTransition(async () => {
      const result = await deleteStoryboardShot(shotId)
      if (!result.success) toast.error((result as { error: string }).error)
      else toast.success('Shot supprimé')
    })
  }

  function handleUpdate(shotId: string, patch: { description: string }) {
    setShots((prev) =>
      prev.map((s) => (s.id === shotId ? { ...s, content: { ...s.content, ...patch } } : s)),
    )
    startTransition(async () => {
      const result = await updateStoryboardShot(shotId, patch)
      if (!result.success) toast.error((result as { error: string }).error)
    })
  }

  // ── Workflow ──────────────────────────────────────────────────

  async function handleAction(action: string) {
    setLoadingAction(action)
    let result: { success: boolean; error?: string } = { success: false }

    if (action === 'start') result = await startSubPhase(subPhaseId)
    else if (action === 'review') {
      if (shots.length === 0) {
        toast.error("Ajoutez au moins un shot avant d'envoyer en review")
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

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Actions panel ── */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <Film className="h-4 w-4 text-[#555555] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#555555] uppercase tracking-widest">Storyboard</p>
          <p className="text-sm text-[#888888] mt-0.5">
            {shots.length === 0
              ? 'Aucun shot — importez des images'
              : `${shots.length} shot${shots.length > 1 ? 's' : ''}`}
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

      {/* ── Upload zone ── */}
      {canEdit && (
        <UploadZone
          subPhaseId={subPhaseId}
          projectId={projectId}
          onShotsAdded={handleShotsAdded}
        />
      )}

      {/* ── Shot grid ── */}
      {shots.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shots.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className={`grid gap-4 ${GRID_COLS[cols] ?? 'grid-cols-3'}`}>
              {shots.map((shot, i) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  totalShots={shots.length}
                  onOpenLightbox={() => setLightboxIndex(i)}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  canEdit={canEdit}
                  projectId={projectId}
                  phaseId={phaseId}
                  subPhaseId={subPhaseId}
                  allComments={comments}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : !canEdit ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center">
            <Film className="h-7 w-7 text-[#333333]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#555555]">Aucun shot</p>
            <p className="text-xs text-[#444444] mt-1">Les shots apparaîtront ici une fois ajoutés</p>
          </div>
        </div>
      ) : null}

      {/* ── Pending indicator ── */}
      {isPending && (
        <p className="text-[10px] text-[#555555] flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sauvegarde…
        </p>
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
