'use client'

import { useState, useRef, useTransition } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  Play,
  Send,
  CheckCircle,
  RotateCcw,
  Maximize2,
  ImageIcon,
  Upload,
  Star,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import ImageLightbox from '@/components/shared/ImageLightbox'
import {
  createMoodboardBlock,
  updateMoodboardBlock,
  deleteMoodboardBlock,
  type MoodboardBlock,
} from '@/app/projects/moodboard-actions'
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
import type { MoodboardImageContent, PhaseStatus, UserRole } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────

interface MoodboardEditorProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean
  projectId: string
  phaseId: string
  initialBlocks: MoodboardBlock[]
  initialComments?: BlockComment[]
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
    <div className="px-4 pb-4 pt-3 border-t border-[#1e1e1e] space-y-3">
      {blockComments.length > 0 && (
        <div className="space-y-2.5">
          {blockComments.map((c) => {
            const authorName = c.author?.full_name ?? 'Utilisateur'
            const initials = authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            return (
              <div key={c.id} className={`flex gap-2.5 transition-opacity ${c.is_resolved ? 'opacity-40' : ''}`}>
                <div className="w-6 h-6 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                  {c.author?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                    : <span className="text-[9px] text-[#666666] font-medium">{initials}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px] font-medium text-white">{authorName}</span>
                    <span className="text-[10px] text-[#444444]">{formatRelative(c.created_at)}</span>
                    {c.is_resolved && (
                      <span className="text-[10px] text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded-full border border-[#00D76B]/20">Résolu</span>
                    )}
                  </div>
                  <p className="text-xs text-[#999999] leading-relaxed">{c.content}</p>
                </div>
                {!c.is_resolved && (
                  <button type="button" onClick={() => handleResolve(c.id)}
                    className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-0.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[11px] text-[#444444] hover:text-[#888888] transition-colors group">
          <MessageSquare className="h-3.5 w-3.5 group-hover:text-[#00D76B] transition-colors" />
          {blockComments.length === 0
            ? 'Ajouter un commentaire'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : `${blockComments.length} commentaire${blockComments.length > 1 ? 's' : ''}`}`}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="Commentaire interne… (Ctrl+Entrée)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSubmit} disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[11px] font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40">
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Envoyer
            </button>
            <button type="button" onClick={() => { setOpen(false); setText('') }}
              className="text-[11px] text-[#444444] hover:text-white transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddMoodboardForm ──────────────────────────────────────────────

function AddMoodboardForm({
  subPhaseId,
  projectId,
  onAdded,
  onCancel,
}: {
  subPhaseId: string
  projectId: string
  onAdded: (block: MoodboardBlock) => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!validTypes.includes(f.type)) {
      toast.error('Format invalide — PNG, JPG ou WEBP uniquement')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Image trop lourde — maximum 10 MB')
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleSubmit() {
    if (!file) { toast.error('Sélectionnez une image'); return }
    setUploading(true)
    const formData = new FormData()
    formData.set('subPhaseId', subPhaseId)
    formData.set('projectId', projectId)
    formData.set('title', title)
    formData.set('description', description)
    formData.set('file', file)

    const result = await createMoodboardBlock(formData)
    setUploading(false)

    if (!result.success) {
      toast.error((result as { error: string }).error)
      return
    }
    toast.success('Moodboard ajouté')
    onAdded((result as { success: true; block: MoodboardBlock }).block)
  }

  return (
    <div className="bg-[#111111] border-2 border-dashed border-[#2a2a2a] rounded-2xl p-5 space-y-4">
      {/* Drop zone / preview */}
      {!preview ? (
        <div
          className={`
            relative aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3
            cursor-pointer transition-colors
            ${dragging ? 'border-[#00D76B] bg-[#00D76B]/5' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
            <Upload className="h-5 w-5 text-[#555555]" />
          </div>
          <div className="text-center">
            <p className="text-sm text-[#666666]">Glissez une image ici</p>
            <p className="text-xs text-[#444444] mt-0.5">ou cliquez pour parcourir</p>
            <p className="text-[10px] text-[#333333] mt-2">PNG, JPG, WEBP — max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { setFile(null); setPreview(null) }}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Fields */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du style (ex: Minimaliste japonais)"
        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#444444]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Pourquoi ce style ? Références, ambiance, palette…"
        rows={3}
        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!file || uploading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-sm font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {uploading ? 'Upload en cours…' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[#444444] hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── MoodboardCard ─────────────────────────────────────────────────

function MoodboardCard({
  block,
  index,
  onOpenLightbox,
  onUpdate,
  onDelete,
  // Comment props (admin only)
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  block: MoodboardBlock
  index: number
  onOpenLightbox: (index: number) => void
  onUpdate: (id: string, patch: Partial<Pick<MoodboardImageContent, 'title' | 'description'>>) => void
  onDelete: (id: string) => void
  projectId?: string
  phaseId?: string
  subPhaseId?: string
  allComments?: BlockComment[]
}) {
  const [title, setTitle] = useState(block.content.title)
  const [description, setDescription] = useState(block.content.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    onDelete(block.id)
  }

  return (
    <div className="group bg-[#111111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-black/40">

      {/* Image */}
      <div
        className="relative aspect-[4/3] bg-[#0d0d0d] cursor-zoom-in overflow-hidden"
        onClick={() => onOpenLightbox(index)}
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-[#2a2a2a]" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.content.image_url}
          alt={block.content.title}
          className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          draggable={false}
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Delete button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete() }}
            disabled={deleting}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors
              ${confirmDelete
                ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80'}
            `}
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            {confirmDelete ? 'Confirmer ?' : ''}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== block.content.title) onUpdate(block.id, { title }) }}
          placeholder="Titre du style"
          className="w-full bg-transparent text-sm font-semibold text-white placeholder-[#444444] focus:outline-none border-b border-transparent focus:border-[#2a2a2a] pb-0.5 transition-colors"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => { if (description !== (block.content.description ?? '')) onUpdate(block.id, { description }) }}
          placeholder="Description, ambiance, références…"
          rows={2}
          className="w-full bg-transparent text-xs text-[#888888] placeholder-[#444444] focus:outline-none resize-none leading-relaxed focus:text-[#aaaaaa] transition-colors"
        />
      </div>

      {/* Admin comment panel */}
      {projectId && phaseId && subPhaseId && allComments !== undefined && (
        <AdminCommentPanel
          blockId={block.id}
          projectId={projectId}
          phaseId={phaseId}
          subPhaseId={subPhaseId}
          allComments={allComments}
        />
      )}
    </div>
  )
}

// ── MoodboardEditor ───────────────────────────────────────────────

export default function MoodboardEditor({
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
  projectId,
  phaseId,
  initialBlocks,
  initialComments = [],
}: MoodboardEditorProps) {
  const [blocks, setBlocks] = useState<MoodboardBlock[]>(initialBlocks)
  const [showAddForm, setShowAddForm] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [confirmUnapprove, setConfirmUnapprove] = useState(false)

  // Realtime comments (works for authenticated admin sessions)
  const comments = useRealtimeBlockComments(projectId, subPhaseId, initialComments)

  const isAdmin = userRole === 'admin'
  const canEdit =
    subPhaseStatus === 'pending' || subPhaseStatus === 'in_progress'

  const lightboxImages = blocks.map((b) => ({
    src: b.content.image_url,
    title: b.content.title,
  }))

  // ── Block mutations ───────────────────────────────────────────

  function handleAdded(block: MoodboardBlock) {
    setBlocks((prev) => [...prev, block])
    setShowAddForm(false)
  }

  function handleDelete(blockId: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    startTransition(async () => {
      const result = await deleteMoodboardBlock(blockId)
      if (!result.success) {
        toast.error((result as { error: string }).error)
        // Re-fetch would be ideal here; for now just show error
      } else {
        toast.success('Image supprimée')
      }
    })
  }

  function handleUpdate(
    blockId: string,
    patch: Partial<Pick<MoodboardImageContent, 'title' | 'description'>>,
  ) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, ...patch } } : b)),
    )
    startTransition(async () => {
      const result = await updateMoodboardBlock(blockId, patch)
      if (!result.success) toast.error((result as { error: string }).error)
    })
  }

  // ── Workflow actions ──────────────────────────────────────────

  async function handleAction(action: string) {
    setLoadingAction(action)
    let result: { success: boolean; error?: string } = { success: false }

    if (action === 'start') result = await startSubPhase(subPhaseId)
    else if (action === 'review') {
      if (blocks.length === 0) {
        toast.error("Ajoutez au moins un moodboard avant d'envoyer en review")
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
    if (!result.success) {
      toast.error((result as { error: string }).error)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Actions panel ── */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#555555] uppercase tracking-widest">Moodboard / Style</p>
          <p className="text-sm text-[#888888] mt-0.5">
            {blocks.length === 0
              ? 'Aucune image — ajoutez des références visuelles'
              : `${blocks.length} image${blocks.length > 1 ? 's' : ''}`}
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

      {/* ── Selection indicator ── */}
      {(() => {
        const selected = blocks.find((b) => b.content.is_selected)
        if (!selected) return null
        return (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D76B]/8 border border-[#00D76B]/20">
            <Star className="h-3.5 w-3.5 text-[#00D76B] flex-shrink-0" />
            <span className="text-xs text-[#00D76B]">
              Style sélectionné par le client : <strong>{selected.content.title}</strong>
            </span>
          </div>
        )
      })()}

      {/* ── Add form ── */}
      {showAddForm && (
        <AddMoodboardForm
          subPhaseId={subPhaseId}
          projectId={projectId}
          onAdded={handleAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ── Add button ── */}
      {canEdit && !showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#2a2a2a] hover:border-[#00D76B]/40 hover:bg-[#00D76B]/5 text-[#555555] hover:text-[#00D76B] text-sm transition-all duration-200 group"
        >
          <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
          Ajouter une image
        </button>
      )}

      {/* ── Grid ── */}
      {blocks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {blocks.map((block, i) => (
            <MoodboardCard
              key={block.id}
              block={block}
              index={i}
              onOpenLightbox={setLightboxIndex}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              projectId={projectId}
              phaseId={phaseId}
              subPhaseId={subPhaseId}
              allComments={comments}
            />
          ))}
        </div>
      ) : !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center">
            <ImageIcon className="h-7 w-7 text-[#333333]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#555555]">Aucun moodboard</p>
            <p className="text-xs text-[#444444] mt-1">
              {canEdit
                ? 'Cliquez sur "Ajouter une image" pour commencer'
                : 'Les images apparaîtront ici une fois ajoutées'}
            </p>
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
