'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload,
  Trash2,
  Play,
  Pause,
  Send,
  CheckCircle,
  RotateCcw,
  Loader2,
  MessageSquare,
  Music,
  Mic,
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
  createAudioUploadUrl,
  recordAudioUpload,
  updateAudioTrack,
  deleteAudioTrack,
  type AudioTrack,
} from '@/app/projects/audio-actions'
import {
  useRealtimeBlockComments,
  type BlockComment,
} from '@/lib/hooks/useRealtimeBlockComments'
import type { PhaseStatus, UserRole } from '@/lib/types'

// ── Time helper ───────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── AudioPlayer ───────────────────────────────────────────────────

function AudioPlayer({ src, trackId }: { src: string; trackId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(false)
  const progressRef = useRef<HTMLInputElement>(null)

  // Stop playback when src changes
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.load()
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src, trackId])

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      // Pause all other audios on the page
      document.querySelectorAll<HTMLAudioElement>('audio').forEach((a) => {
        if (a !== el) a.pause()
      })
      el.play().catch(() => {})
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Number(e.target.value)
    setCurrentTime(Number(e.target.value))
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-canvas rounded-xl border border-line">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        preload="metadata"
      />

      {/* Play/Pause */}
      <button
        type="button"
        onClick={toggle}
        disabled={!src || buffering}
        className="w-8 h-8 rounded-full bg-surface-2 border border-line flex items-center justify-center text-dim hover:text-ink hover:border-line-strong transition-colors disabled:opacity-30 flex-shrink-0"
      >
        {buffering
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : playing
            ? <Pause className="h-3.5 w-3.5" />
            : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      {/* Progress bar */}
      <div className="flex-1 relative h-1.5 bg-surface-3 rounded-full overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          const newTime = ratio * duration
          if (audioRef.current) audioRef.current.currentTime = newTime
          setCurrentTime(newTime)
        }}
      >
        <input
          ref={progressRef}
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="h-full bg-brand rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time */}
      <span className="text-[10px] text-faint tabular-nums whitespace-nowrap flex-shrink-0">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
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
    <div className="px-3 pb-3 pt-2.5 border-t border-line space-y-2.5">
      {blockComments.length > 0 && (
        <div className="space-y-2">
          {blockComments.map((c) => {
            const authorName = c.author?.full_name ?? 'Utilisateur'
            const initials = authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            return (
              <div key={c.id} className={`flex gap-2 transition-opacity ${c.is_resolved ? 'opacity-40' : ''}`}>
                <div className="w-5 h-5 rounded-full bg-surface-3 border border-line flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                  {c.author?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                    : <span className="text-[8px] text-faint font-medium">{initials}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-medium text-ink">{authorName}</span>
                    <span className="text-[9px] text-faint">{formatRelative(c.created_at)}</span>
                    {c.is_resolved && (
                      <span className="text-[9px] text-brand bg-brand/10 px-1 py-0.5 rounded-full border border-brand/20">Résolu</span>
                    )}
                  </div>
                  <p className="text-[11px] text-dim leading-relaxed">{c.content}</p>
                </div>
                {!c.is_resolved && (
                  <button type="button" onClick={() => handleResolve(c.id)}
                    className="text-faint hover:text-brand transition-colors flex-shrink-0 mt-0.5">
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
          className="flex items-center gap-1.5 text-[10px] text-faint hover:text-dim transition-colors group">
          <MessageSquare className="h-3 w-3 group-hover:text-brand transition-colors" />
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
            className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-[11px] text-ink placeholder-faint focus:outline-none focus:border-line-strong resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSubmit} disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand/10 border border-brand/20 text-brand text-[10px] font-medium hover:bg-brand/20 transition-colors disabled:opacity-40">
              {sending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
              Envoyer
            </button>
            <button type="button" onClick={() => { setOpen(false); setText('') }}
              className="text-[10px] text-faint hover:text-ink transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TrackCard ─────────────────────────────────────────────────────

function TrackCard({
  track,
  canEdit,
  onDelete,
  projectId,
  phaseId,
  subPhaseId,
  allComments,
}: {
  track: AudioTrack
  canEdit: boolean
  onDelete: (id: string) => void
  projectId: string
  phaseId: string
  subPhaseId: string
  allComments: BlockComment[]
}) {
  const [title, setTitle] = useState(track.content.title)
  const [description, setDescription] = useState(track.content.description ?? '')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isSelected = track.content.is_selected

  async function handleTitleBlur() {
    if (title.trim() === track.content.title) return
    if (!title.trim()) { setTitle(track.content.title); return }
    const result = await updateAudioTrack(track.id, { title: title.trim() })
    if (!result.success) {
      toast.error((result as { error: string }).error)
      setTitle(track.content.title)
    }
  }

  async function handleDescriptionBlur() {
    if (description === (track.content.description ?? '')) return
    const result = await updateAudioTrack(track.id, { description })
    if (!result.success) toast.error((result as { error: string }).error)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    onDelete(track.id)
    const result = await deleteAudioTrack(track.id)
    if (!result.success) toast.error((result as { error: string }).error)
    setDeleting(false)
  }

  const kindLabel = track.content.kind === 'vo' ? 'VO' : 'Musique'
  const KindIcon = track.content.kind === 'vo' ? Mic : Music

  return (
    <div className="group bg-surface border border-line hover:border-line rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/30">

      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-line">
        {/* Kind badge */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium flex-shrink-0 ${
          track.content.kind === 'vo'
            ? 'bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]'
            : 'bg-[#A259FF]/10 border-[#A259FF]/20 text-[#A259FF]'
        }`}>
          <KindIcon className="h-2.5 w-2.5" />
          {kindLabel}
        </div>

        {/* Title */}
        {canEdit ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="flex-1 min-w-0 bg-transparent text-sm font-medium text-ink placeholder-faint focus:outline-none border-b border-transparent hover:border-line focus:border-line-strong transition-colors py-0.5"
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{title}</span>
        )}

        {/* Selected badge */}
        {isSelected && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-medium flex-shrink-0">
            <CheckCircle className="h-2.5 w-2.5" />
            Sélectionné
          </div>
        )}

        {/* Delete */}
        {canEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ${
              confirmDelete
                ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-surface-2 border-line text-faint hover:text-ink hover:border-line-strong'
            }`}
          >
            {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
            {confirmDelete ? 'Confirmer ?' : ''}
          </button>
        )}
      </div>

      {/* Player */}
      <div className="px-3 py-2.5">
        <AudioPlayer src={track.content.audio_url} trackId={track.id} />
      </div>

      {/* Description */}
      <div className="px-3 pb-2.5">
        {canEdit ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Description, notes, retours…"
            rows={2}
            className="w-full bg-transparent text-[11px] text-dim placeholder-faint focus:outline-none resize-none leading-relaxed focus:text-dim transition-colors"
          />
        ) : (
          description && (
            <p className="text-[11px] text-dim leading-relaxed">{description}</p>
          )
        )}
      </div>

      {/* Comments */}
      <AdminCommentPanel
        blockId={track.id}
        projectId={projectId}
        phaseId={phaseId}
        subPhaseId={subPhaseId}
        allComments={allComments}
      />
    </div>
  )
}

// ── AddTrackForm ──────────────────────────────────────────────────

function AddTrackForm({
  subPhaseId,
  projectId,
  kind,
  onTrackAdded,
}: {
  subPhaseId: string
  projectId: string
  kind: 'vo' | 'music'
  onTrackAdded: (track: AudioTrack) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const AUDIO_MIME: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelect(f)
  }

  async function handleSubmit() {
    if (!selectedFile || !title.trim()) return
    setUploading(true)
    setProgress('Préparation…')

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() ?? ''
      const canonicalMime = AUDIO_MIME[ext] ?? selectedFile.type

      // Étape 1 : obtenir l'URL d'upload signée (aucun byte de fichier via Vercel)
      const urlResult = await createAudioUploadUrl({
        subPhaseId,
        projectId,
        title: title.trim(),
        description: description.trim(),
        kind,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: canonicalMime,
      })

      if (!urlResult.success) {
        toast.error(urlResult.error)
        setUploading(false)
        setProgress(null)
        return
      }

      const { uploadUrl, storagePath, blockId } = urlResult

      // Étape 2 : upload direct navigateur → Supabase Storage (bypass Vercel)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setProgress(`Upload ${pct}%`)
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Erreur upload : HTTP ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error('Erreur réseau'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', canonicalMime)
        xhr.send(selectedFile)
      })

      setProgress('Enregistrement…')

      // Étape 3 : enregistrer les métadonnées (aucun byte de fichier via Vercel)
      const recordResult = await recordAudioUpload({ blockId, subPhaseId, storagePath, canonicalMime })

      if (!recordResult.success) {
        toast.error(recordResult.error)
        setUploading(false)
        setProgress(null)
        return
      }

      toast.success('Piste ajoutée')
      onTrackAdded(recordResult.track)
      setTitle('')
      setDescription('')
      setSelectedFile(null)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-line hover:border-line-strong text-faint hover:text-dim transition-colors text-sm"
      >
        <Upload className="h-4 w-4" />
        Ajouter une piste
      </button>
    )
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
      <p className="text-xs font-medium text-dim uppercase tracking-widest">Nouvelle piste</p>

      {/* File drop zone */}
      {!selectedFile ? (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-brand/50 bg-brand/5'
              : 'border-line hover:border-line-strong'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.aac,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/x-aac"
            onChange={handleInputChange}
            className="hidden"
          />
          <Upload className="h-6 w-6 text-faint mx-auto mb-2" />
          <p className="text-sm text-faint">
            Glissez un fichier ou <span className="text-brand">parcourir</span>
          </p>
          <p className="text-[10px] text-faint mt-1">MP3, WAV, OGG, M4A, AAC — max 50 MB</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-canvas rounded-xl border border-line">
          <Music className="h-4 w-4 text-faint flex-shrink-0" />
          <span className="flex-1 min-w-0 text-xs text-dim truncate">{selectedFile.name}</span>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="text-faint hover:text-ink transition-colors flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la piste *"
        className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-line-strong transition-colors"
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description ou notes (optionnel)"
        rows={2}
        className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-dim placeholder-faint focus:outline-none focus:border-line-strong resize-none transition-colors leading-relaxed"
      />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading || !selectedFile || !title.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/20 text-brand text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? (progress ?? 'Import…') : 'Importer'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); setDescription(''); setSelectedFile(null) }}
          className="text-xs text-faint hover:text-ink transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────

interface AudioEditorProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean
  projectId: string
  phaseId: string
  kind: 'vo' | 'music'
  initialTracks: AudioTrack[]
  initialComments?: BlockComment[]
}

// ── AudioEditor ───────────────────────────────────────────────────

export default function AudioEditor({
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
  projectId,
  phaseId,
  kind,
  initialTracks,
  initialComments = [],
}: AudioEditorProps) {
  const [tracks, setTracks] = useState<AudioTrack[]>(initialTracks)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [confirmUnapprove, setConfirmUnapprove] = useState(false)

  const comments = useRealtimeBlockComments(projectId, subPhaseId, initialComments)

  const isAdmin = userRole === 'admin'
  const canEdit = subPhaseStatus === 'pending' || subPhaseStatus === 'in_progress'

  const kindLabel = kind === 'vo' ? 'Voix Off' : 'Musique'
  const KindIcon = kind === 'vo' ? Mic : Music

  const handleTrackAdded = useCallback((track: AudioTrack) => {
    setTracks((prev) => [...prev, track])
  }, [])

  const handleDelete = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId))
  }, [])

  // ── Workflow ──────────────────────────────────────────────────

  async function handleAction(action: string) {
    setLoadingAction(action)
    let result: { success: boolean; error?: string } = { success: false }

    if (action === 'start') {
      result = await startSubPhase(subPhaseId)
    } else if (action === 'review') {
      if (tracks.length === 0) {
        toast.error("Ajoutez au moins une piste avant d'envoyer en review")
        setLoadingAction(null)
        return
      }
      result = await sendSubPhaseToReview(subPhaseId)
    } else if (action === 'approve') {
      result = await approveSubPhase(subPhaseId)
    } else if (action === 'unapprove') {
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
      <div className="bg-surface border border-line rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <KindIcon className="h-4 w-4 text-faint flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-faint uppercase tracking-widest">{kindLabel}</p>
          <p className="text-sm text-dim mt-0.5">
            {tracks.length === 0
              ? 'Aucune piste — importez vos fichiers audio'
              : `${tracks.length} piste${tracks.length > 1 ? 's' : ''}`}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/20 text-brand text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-40"
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
                  : 'bg-surface-2 border-line text-faint hover:text-ink hover:border-line-strong'
              }`}
            >
              {loadingAction === 'unapprove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {confirmUnapprove ? 'Confirmer ?' : 'Désapprouver'}
            </button>
          )}
        </div>
      </div>

      {/* ── Track list ── */}
      {tracks.length > 0 && (
        <div className="space-y-3">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              canEdit={canEdit}
              onDelete={handleDelete}
              projectId={projectId}
              phaseId={phaseId}
              subPhaseId={subPhaseId}
              allComments={comments}
            />
          ))}
        </div>
      )}

      {/* ── Add track form ── */}
      {canEdit && (
        <AddTrackForm
          subPhaseId={subPhaseId}
          projectId={projectId}
          kind={kind}
          onTrackAdded={handleTrackAdded}
        />
      )}

      {/* ── Empty state (read-only, no tracks) ── */}
      {tracks.length === 0 && !canEdit && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-line flex items-center justify-center">
            <KindIcon className="h-7 w-7 text-faint" />
          </div>
          <div>
            <p className="text-sm font-medium text-faint">Aucune piste audio</p>
            <p className="text-xs text-faint mt-1">Les pistes apparaîtront ici une fois ajoutées</p>
          </div>
        </div>
      )}

    </div>
  )
}
