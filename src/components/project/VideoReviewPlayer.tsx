'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Upload,
  ChevronDown,
  Check,
  X,
  Clock,
  Trash2,
  Loader2,
  MessageSquare,
  Film,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PhaseStatus, UserRole } from '@/lib/types'
import type { VideoFile, VideoComment } from '@/app/projects/video-actions'
import {
  getVideoData,
  createVideoUploadUrl,
  recordVideoUpload,
  addTimecodedComment,
  resolveVideoComment,
  deleteVideoComment,
} from '@/app/projects/video-actions'
import {
  startPhase,
  sendToReview,
  completePhase,
  unapprovePhase,
} from '@/app/projects/phase-actions'

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ── VideoTimeline ─────────────────────────────────────────────────

interface VideoTimelineProps {
  currentTime: number
  duration: number
  comments: VideoComment[]
  selectedVersion: number | null
  onSeek: (t: number) => void
  onMarkerClick: (commentId: string, timecode: number) => void
}

function VideoTimeline({
  currentTime,
  duration,
  comments,
  selectedVersion,
  onSeek,
  onMarkerClick,
}: VideoTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const filteredComments = comments.filter(
    (c) => c.timecode_seconds !== null && (selectedVersion === null || c.video_version === selectedVersion),
  )

  function getTimeFromEvent(e: React.MouseEvent | MouseEvent): number {
    if (!barRef.current || duration <= 0) return 0
    const rect = barRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true)
    onSeek(getTimeFromEvent(e))
  }

  useEffect(() => {
    if (!isDragging) return
    function onMouseMove(e: MouseEvent) {
      onSeek(getTimeFromEvent(e))
    }
    function onMouseUp() {
      setIsDragging(false)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-8 flex items-center group">
      {/* Track */}
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        className="relative w-full h-1 bg-[#2a2a2a] rounded-full cursor-pointer group-hover:h-1.5 transition-all"
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full"
          style={{ width: `${progress}%` }}
        />

        {/* Comment markers */}
        {filteredComments.map((c) => {
          const pos =
            duration > 0 && c.timecode_seconds !== null
              ? (c.timecode_seconds / duration) * 100
              : 0
          const color = c.is_resolved ? '#22C55E' : '#F59E0B'
          return (
            <div
              key={c.id}
              onMouseEnter={() => setHoveredMarker(c.id)}
              onMouseLeave={() => setHoveredMarker(null)}
              onClick={(e) => {
                e.stopPropagation()
                if (c.timecode_seconds !== null) onMarkerClick(c.id, c.timecode_seconds)
              }}
              style={{ left: `${pos}%`, borderColor: color }}
              className="
                absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                w-2.5 h-2.5 rounded-full border-2 bg-[#111111] cursor-pointer
                hover:scale-150 transition-transform z-10
              "
            >
              {/* Tooltip */}
              {hoveredMarker === c.id && (
                <div
                  className="
                    absolute bottom-5 left-1/2 -translate-x-1/2
                    bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1
                    text-xs text-white whitespace-nowrap z-20 pointer-events-none
                  "
                >
                  <span className="text-[#888888]">{formatTime(c.timecode_seconds ?? 0)}</span>
                  {' · '}
                  {c.author?.full_name ?? 'Inconnu'}
                </div>
              )}
            </div>
          )
        })}

        {/* Scrubber thumb */}
        <div
          className="
            absolute top-1/2 -translate-y-1/2 -translate-x-1/2
            w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity
          "
          style={{ left: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ── UploadZone ────────────────────────────────────────────────────

interface UploadZoneProps {
  phaseId: string
  projectId: string
  onUploaded: (file: VideoFile) => void
  isNewVersion?: boolean
}

function UploadZone({ phaseId, projectId, onUploaded, isNewVersion = false }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setIsUploading(true)
    setProgress('Préparation…')

    // Déterminer le MIME canonique depuis l'extension
    const VIDEO_MIME: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime',
      webm: 'video/webm', avi: 'video/x-msvideo',
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = VIDEO_MIME[ext] ?? file.type ?? 'video/mp4'

    // ── Étape 1 : obtenir la signed upload URL (Server Action légère, pas de fichier) ──
    const urlResult = await createVideoUploadUrl({
      phaseId, projectId,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    })

    if (!urlResult.success) {
      setIsUploading(false)
      setProgress(null)
      toast.error(urlResult.error)
      return
    }

    // ── Étape 2 : upload direct navigateur → Supabase Storage (bypass Vercel) ──
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setProgress(`Upload ${pct}%`)
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Erreur serveur ${xhr.status} : ${xhr.responseText}`))
        }
        xhr.onerror = () => reject(new Error('Erreur réseau — vérifiez votre connexion'))
        xhr.open('PUT', urlResult.uploadUrl)
        xhr.setRequestHeader('Content-Type', mimeType)
        xhr.send(file)
      })
    } catch (err) {
      setIsUploading(false)
      setProgress(null)
      toast.error(err instanceof Error ? err.message : 'Upload échoué')
      return
    }

    // ── Étape 3 : enregistrer les métadonnées en base (Server Action légère) ──
    setProgress('Enregistrement…')
    const recordResult = await recordVideoUpload({
      phaseId, projectId,
      storagePath: urlResult.storagePath,
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      version: urlResult.version,
    })

    setIsUploading(false)
    setProgress(null)

    if (recordResult.success) {
      toast.success('Vidéo uploadée avec succès')
      onUploaded(recordResult.file)
    } else {
      toast.error(recordResult.error)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (isNewVersion) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.webm,.avi,video/mp4,video/quicktime,video/webm,video/x-msvideo"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0]
            hover:border-[#3a3a3a] hover:text-white transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {isUploading ? 'Envoi…' : 'Nouvelle version'}
        </button>
      </>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      className={`
        flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12
        transition-colors
        ${isDragOver ? 'border-white/40 bg-white/5' : 'border-[#2a2a2a] bg-[#111111]'}
      `}
    >
      <Film className="h-12 w-12 text-[#333333]" />
      <div className="text-center">
        <p className="text-sm font-medium text-[#666666]">
          Glissez une vidéo ici ou{' '}
          <label className="text-white cursor-pointer hover:underline">
            choisissez un fichier
            <input
              type="file"
              accept=".mp4,.mov,.webm,.avi,video/mp4,video/quicktime,video/webm,video/x-msvideo"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </label>
        </p>
        <p className="text-xs text-[#444444] mt-1">MP4, MOV, WebM — max 500 MB</p>
      </div>
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-[#666666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      )}
    </div>
  )
}

// ── CommentForm ───────────────────────────────────────────────────

interface CommentFormProps {
  phaseId: string
  videoVersion: number | null
  getCurrentTime: () => number
  onPause: () => void
  onAdded: (comment: VideoComment) => void
}

function CommentForm({ phaseId, videoVersion, getCurrentTime, onPause, onAdded }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [capturedTime, setCapturedTime] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFocus() {
    onPause()
    const t = getCurrentTime()
    setCapturedTime(t > 0 ? t : null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    startTransition(async () => {
      const result = await addTimecodedComment(phaseId, content.trim(), capturedTime, videoVersion)
      if (result.success) {
        setContent('')
        setCapturedTime(null)
        toast.success('Commentaire ajouté')
        // Refresh will happen via polling
        onAdded({
          id: crypto.randomUUID(),
          user_id: '',
          content: content.trim(),
          timecode_seconds: capturedTime,
          video_version: videoVersion,
          is_resolved: false,
          created_at: new Date().toISOString(),
          author: null,
        })
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          placeholder="Ajouter un commentaire… (la vidéo se mettra en pause)"
          rows={2}
          disabled={isPending}
          className="
            w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 pr-24
            text-sm text-white placeholder-[#3a3a3a] resize-none
            focus:outline-none focus:border-[#444444] transition-colors
            disabled:opacity-50
          "
        />
        {capturedTime !== null && (
          <span className="absolute top-2 right-3 text-xs text-[#F59E0B] font-mono bg-[#F59E0B]/10 px-1.5 py-0.5 rounded">
            {formatTime(capturedTime)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        {capturedTime !== null ? (
          <p className="text-xs text-[#555555]">
            Lié à{' '}
            <span className="font-mono text-[#F59E0B]">{formatTime(capturedTime)}</span>
            {' · '}
            <button
              type="button"
              onClick={() => setCapturedTime(null)}
              className="text-[#555555] hover:text-[#888888] transition-colors"
            >
              retirer le timecode
            </button>
          </p>
        ) : (
          <p className="text-xs text-[#444444]">Focalisez le champ pour capturer le timecode</p>
        )}
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-white text-black hover:bg-white/90 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
          Commenter
        </button>
      </div>
    </form>
  )
}

// ── CommentCard ───────────────────────────────────────────────────

interface CommentCardProps {
  comment: VideoComment
  canDelete: boolean
  onSeek: (t: number) => void
  onResolved: (id: string) => void
  onDeleted: (id: string) => void
}

function CommentCard({ comment, canDelete, onSeek, onResolved, onDeleted }: CommentCardProps) {
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleResolve() {
    startTransition(async () => {
      const result = await resolveVideoComment(comment.id)
      if (result.success) {
        onResolved(comment.id)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const result = await deleteVideoComment(comment.id)
      if (result.success) {
        onDeleted(comment.id)
        toast.success('Commentaire supprimé')
      } else {
        toast.error(result.error)
        setConfirmDelete(false)
      }
    })
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className={`
        rounded-lg border p-3 transition-colors
        ${comment.is_resolved
          ? 'bg-[#22C55E]/5 border-[#22C55E]/15'
          : 'bg-[#111111] border-[#2a2a2a]'}
      `}
    >
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="h-6 w-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[9px] font-bold text-[#666666] flex-shrink-0 mt-0.5">
          {initials(comment.author?.full_name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-white">
              {comment.author?.full_name ?? 'Inconnu'}
            </span>
            {comment.timecode_seconds !== null && (
              <button
                type="button"
                onClick={() => onSeek(comment.timecode_seconds!)}
                className="
                  inline-flex items-center gap-1 text-[10px] font-mono
                  text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded
                  hover:bg-[#F59E0B]/20 transition-colors
                "
              >
                <Clock className="h-3 w-3" />
                {formatTime(comment.timecode_seconds)}
              </button>
            )}
            {comment.is_resolved && (
              <span className="text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded">
                Résolu
              </span>
            )}
          </div>
          <p className="text-xs text-[#a0a0a0] mt-1 leading-relaxed">{comment.content}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleResolve}
            disabled={isPending}
            title={comment.is_resolved ? 'Ré-ouvrir' : 'Marquer résolu'}
            className="p-1 rounded text-[#444444] hover:text-[#22C55E] transition-colors disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              title={confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}
              className={`p-1 rounded transition-colors disabled:opacity-40 ${
                confirmDelete ? 'text-[#EF4444]' : 'text-[#444444] hover:text-[#EF4444]'
              }`}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── WorkflowPanel ─────────────────────────────────────────────────

interface WorkflowPanelProps {
  phaseId: string
  status: PhaseStatus
  hasVideo: boolean
  onStatusChange: (s: PhaseStatus) => void
}

function WorkflowPanel({ phaseId, status, hasVideo, onStatusChange }: WorkflowPanelProps) {
  const [isPending, startTransition] = useTransition()

  function run(fn: () => Promise<{ success: boolean; error?: string }>, nextStatus: PhaseStatus, msg: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        toast.success(msg)
        onStatusChange(nextStatus)
      } else {
        toast.error((result as { success: false; error: string }).error)
      }
    })
  }

  const btnBase = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === 'pending' && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => startPhase(phaseId), 'in_progress', 'Phase démarrée')}
          className={`${btnBase} bg-white/10 border border-white/20 text-white hover:bg-white/15`}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Démarrer
        </button>
      )}
      {status === 'in_progress' && (
        <button
          type="button"
          disabled={isPending || !hasVideo}
          title={!hasVideo ? 'Uploadez une vidéo avant d\'envoyer en review' : undefined}
          onClick={() => run(() => sendToReview(phaseId), 'in_review', 'Phase envoyée en review')}
          className={`${btnBase} bg-[#3B82F6]/10 border border-[#3B82F6]/25 text-[#3B82F6] hover:bg-[#3B82F6]/20`}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Envoyer en review
        </button>
      )}
      {status === 'in_review' && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => completePhase(phaseId), 'completed', 'Phase approuvée')}
            className={`${btnBase} bg-[#22C55E]/10 border border-[#22C55E]/25 text-[#22C55E] hover:bg-[#22C55E]/20`}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approuver
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => unapprovePhase(phaseId), 'in_progress', 'Phase ré-ouverte')}
            className={`${btnBase} bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] hover:bg-[#F59E0B]/20`}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Ré-ouvrir
          </button>
        </>
      )}
      {(status === 'completed' || status === 'approved') && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => unapprovePhase(phaseId), 'in_progress', 'Phase ré-ouverte')}
          className={`${btnBase} bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] hover:bg-[#F59E0B]/20`}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Ré-ouvrir
        </button>
      )}
    </div>
  )
}

// ── VideoReviewPlayer (main) ──────────────────────────────────────

export interface VideoReviewPlayerProps {
  phaseId: string
  projectId: string
  phaseStatus: PhaseStatus
  userRole: UserRole
  initialVideo: VideoFile | null
  initialVersions: VideoFile[]
  initialComments: VideoComment[]
}

export default function VideoReviewPlayer({
  phaseId,
  projectId,
  phaseStatus,
  userRole,
  initialVideo,
  initialVersions,
  initialComments,
}: VideoReviewPlayerProps) {
  // ── State ──────────────────────────────────────────────────────
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(initialVideo)
  const [allVersions, setAllVersions] = useState<VideoFile[]>(initialVersions)
  const [comments, setComments] = useState<VideoComment[]>(initialComments)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(
    initialVideo?.version ?? null,
  )
  const [status, setStatus] = useState<PhaseStatus>(phaseStatus)

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isVersionDropOpen, setIsVersionDropOpen] = useState(false)
  const [highlightedComment, setHighlightedComment] = useState<string | null>(null)

  const isAdmin = userRole === 'admin'

  // ── Derived ────────────────────────────────────────────────────
  const displayedComments = comments.filter(
    (c) => selectedVersion === null || c.video_version === selectedVersion,
  )

  // ── Video events ───────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTimeUpdate = () => setCurrentTime(v.currentTime)
    const onDurationChange = () => setDuration(v.duration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('durationchange', onDurationChange)
    v.addEventListener('loadedmetadata', onDurationChange)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('durationchange', onDurationChange)
      v.removeEventListener('loadedmetadata', onDurationChange)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
    }
  }, [])

  // ── Fullscreen events ──────────────────────────────────────────
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ── Polling ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      const data = await getVideoData(phaseId)
      setAllVersions(data.allVersions)
      setComments(data.comments)
      if (data.currentVideo && !currentVideo) {
        setCurrentVideo(data.currentVideo)
        setSelectedVersion(data.currentVideo.version)
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [phaseId, currentVideo])

  // ── Version switch ─────────────────────────────────────────────
  function switchVersion(v: VideoFile) {
    setCurrentVideo(v)
    setSelectedVersion(v.version)
    setIsVersionDropOpen(false)
    setCurrentTime(0)
    setIsPlaying(false)
    if (videoRef.current) {
      videoRef.current.src = v.file_url
      videoRef.current.load()
    }
  }

  // ── Player controls ────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  function pause() {
    videoRef.current?.pause()
  }

  function seekTo(t: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(t, duration))
  }

  function getCurrentTime() {
    return videoRef.current?.currentTime ?? 0
  }

  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
  }

  function handleVolumeChange(val: number) {
    const v = videoRef.current
    if (!v) return
    v.volume = val
    setVolume(val)
    setIsMuted(val === 0)
    v.muted = val === 0
  }

  function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // ── Marker / comment interaction ───────────────────────────────
  function handleMarkerClick(commentId: string, timecode: number) {
    seekTo(timecode)
    setHighlightedComment(commentId)
    setTimeout(() => {
      document.getElementById(`comment-${commentId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, 100)
    setTimeout(() => setHighlightedComment(null), 2000)
  }

  function handleCommentTimecodeClick(timecode: number) {
    seekTo(timecode)
    videoRef.current?.play().catch(() => {})
  }

  // ── Comment state updates ──────────────────────────────────────
  function handleCommentAdded(c: VideoComment) {
    setComments((prev) => [...prev, c].sort((a, b) => (a.timecode_seconds ?? 0) - (b.timecode_seconds ?? 0)))
  }

  function handleCommentResolved(id: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_resolved: !c.is_resolved } : c)),
    )
  }

  function handleCommentDeleted(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  function handleVideoUploaded(file: VideoFile) {
    setCurrentVideo(file)
    setAllVersions((prev) => {
      const without = prev.map((v) => ({ ...v, is_current: false }))
      return [file, ...without].sort((a, b) => b.version - a.version)
    })
    setSelectedVersion(file.version)
    if (videoRef.current) {
      videoRef.current.src = file.file_url
      videoRef.current.load()
    }
  }

  // ── Keyboard shortcut: space to play/pause ─────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Left column: player + workflow */}
      <div className="flex flex-col gap-4 flex-1 min-w-0">
        {/* Workflow */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <WorkflowPanel
            phaseId={phaseId}
            status={status}
            hasVideo={!!currentVideo}
            onStatusChange={setStatus}
          />
          <div className="flex items-center gap-2">
            {/* Version selector */}
            {allVersions.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsVersionDropOpen((v) => !v)}
                  className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                    bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0]
                    hover:border-[#3a3a3a] hover:text-white transition-colors
                  "
                >
                  <Film className="h-3.5 w-3.5" />
                  v{selectedVersion ?? '?'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {isVersionDropOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden z-20 w-44">
                    {allVersions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => switchVersion(v)}
                        className="
                          w-full flex items-center justify-between px-3 py-2 text-xs
                          hover:bg-[#1a1a1a] transition-colors text-left
                        "
                      >
                        <span className={v.version === selectedVersion ? 'text-white font-medium' : 'text-[#a0a0a0]'}>
                          Version {v.version}
                        </span>
                        {v.is_current && (
                          <span className="text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded">
                            actuelle
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Upload new version button */}
            {isAdmin && currentVideo && (
              <UploadZone
                phaseId={phaseId}
                projectId={projectId}
                onUploaded={handleVideoUploaded}
                isNewVersion
              />
            )}
          </div>
        </div>

        {/* Video player */}
        {currentVideo ? (
          <div
            ref={containerRef}
            className="relative bg-black rounded-xl overflow-hidden"
            style={{ aspectRatio: '16/9' }}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              src={currentVideo.file_url}
              className="w-full h-full object-contain"
              onClick={togglePlay}
              preload="metadata"
            />

            {/* Play/pause overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlay}
            >
              {!isPlaying && (
                <div className="bg-black/50 rounded-full p-4">
                  <Play className="h-8 w-8 text-white fill-white" />
                </div>
              )}
            </div>

            {/* Controls bar */}
            <div
              className="
                absolute bottom-0 left-0 right-0
                bg-gradient-to-t from-black/80 to-transparent
                px-4 pb-3 pt-8
                opacity-0 hover:opacity-100 transition-opacity
              "
            >
              {/* Timeline */}
              <VideoTimeline
                currentTime={currentTime}
                duration={duration}
                comments={displayedComments}
                selectedVersion={selectedVersion}
                onSeek={seekTo}
                onMarkerClick={handleMarkerClick}
              />

              {/* Bottom controls */}
              <div className="flex items-center gap-3 mt-2">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="text-white hover:text-white/80 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-white" />
                  ) : (
                    <Play className="h-4 w-4 fill-white" />
                  )}
                </button>

                {/* Time */}
                <span className="text-xs text-white/70 font-mono tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex-1" />

                {/* Volume */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-16 h-1 accent-white cursor-pointer"
                  />
                </div>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          isAdmin && (
            <UploadZone
              phaseId={phaseId}
              projectId={projectId}
              onUploaded={handleVideoUploaded}
            />
          )
        )}

        {!currentVideo && !isAdmin && (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-12 text-center">
            <Film className="h-12 w-12 text-[#333333] mx-auto mb-4" />
            <p className="text-sm text-[#444444] italic">Aucune vidéo disponible pour cette phase.</p>
          </div>
        )}
      </div>

      {/* Right column: comment form + list */}
      <div className="flex flex-col gap-4 lg:w-80 xl:w-96 flex-shrink-0">
        {/* Comment form */}
        {isAdmin && currentVideo && (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
              Ajouter un commentaire
            </h3>
            <CommentForm
              phaseId={phaseId}
              videoVersion={selectedVersion}
              getCurrentTime={getCurrentTime}
              onPause={pause}
              onAdded={handleCommentAdded}
            />
          </div>
        )}

        {/* Comment list */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
              Commentaires
            </h3>
            <span className="text-xs text-[#444444]">
              {displayedComments.length}
            </span>
          </div>

          {displayedComments.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="h-8 w-8 text-[#2a2a2a] mx-auto mb-2" />
              <p className="text-xs text-[#444444]">Aucun commentaire</p>
            </div>
          ) : (
            <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {displayedComments.map((c) => (
                <div
                  key={c.id}
                  className={`transition-colors rounded-lg ${
                    highlightedComment === c.id ? 'ring-2 ring-[#F59E0B]/60' : ''
                  }`}
                >
                  <CommentCard
                    comment={c}
                    canDelete={isAdmin}
                    onSeek={handleCommentTimecodeClick}
                    onResolved={handleCommentResolved}
                    onDeleted={handleCommentDeleted}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Version info */}
        {currentVideo && (
          <div className="text-xs text-[#444444] px-1">
            Version {currentVideo.version} · {currentVideo.file_name}
            {currentVideo.file_size && (
              <> · {(currentVideo.file_size / 1024 / 1024).toFixed(1)} MB</>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
