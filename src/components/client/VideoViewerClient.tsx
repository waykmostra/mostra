'use client'

import {
  useState,
  useRef,
  useEffect,
  useTransition,
} from 'react'
import Link from 'next/link'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Clock,
  Check,
  RotateCcw,
  Loader2,
  MessageSquare,
  Film,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  LogIn,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PhaseStatus } from '@/lib/types'
import type { VideoFile, VideoComment } from '@/app/projects/video-actions'
import {
  fetchVideoData,
  addClientVideoComment,
  resolveClientVideoComment,
  approveAnimationPhase,
  requestAnimationRevisions,
} from '@/app/client/video-actions'

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
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
    (c) =>
      c.timecode_seconds !== null &&
      (selectedVersion === null || c.video_version === selectedVersion),
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
    function onMouseMove(e: MouseEvent) { onSeek(getTimeFromEvent(e)) }
    function onMouseUp() { setIsDragging(false) }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-8 flex items-center group">
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        className="relative w-full h-1 bg-[#2a2a2a] rounded-full cursor-pointer group-hover:h-1.5 transition-all"
      >
        <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${progress}%` }} />

        {filteredComments.map((c) => {
          const pos = duration > 0 && c.timecode_seconds !== null ? (c.timecode_seconds / duration) * 100 : 0
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
              {hoveredMarker === c.id && (
                <div className="
                  absolute bottom-5 left-1/2 -translate-x-1/2
                  bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1
                  text-xs text-white whitespace-nowrap z-20 pointer-events-none
                ">
                  <span className="text-[#888888]">{formatTime(c.timecode_seconds ?? 0)}</span>
                  {' · '}
                  {c.author?.full_name ?? 'Inconnu'}
                </div>
              )}
            </div>
          )
        })}

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ── ApprovalPanel (video) ─────────────────────────────────────────

interface VideoApprovalPanelProps {
  projectId: string
  phaseId: string
  status: PhaseStatus
  isAuthenticated: boolean
  loginHref?: string
  onStatusChange: (s: PhaseStatus) => void
}

function VideoApprovalPanel({
  projectId,
  phaseId,
  status,
  isAuthenticated,
  loginHref = '/login',
  onStatusChange,
}: VideoApprovalPanelProps) {
  const [mode, setMode] = useState<'idle' | 'revision'>('idle')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  if (status === 'approved' || status === 'completed') {
    return (
      <div className="flex items-center gap-3 bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl px-5 py-3">
        <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0" />
        <p className="text-sm font-medium text-[#22C55E]">Phase vidéo approuvée</p>
      </div>
    )
  }

  if (status !== 'in_review') return null

  // Non connecté : CTA connexion
  if (!isAuthenticated) {
    return (
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">
              Cette vidéo est en attente de votre approbation
            </p>
            <p className="text-xs text-[#666666] mt-0.5">
              Connectez-vous pour approuver ou laisser des commentaires.
            </p>
          </div>
        </div>
        <Link
          href={loginHref}
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            bg-white text-black hover:bg-white/90 transition-colors
          "
        >
          <LogIn className="h-4 w-4" />
          Se connecter
        </Link>
      </div>
    )
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveAnimationPhase(projectId, phaseId)
      if (result.success) {
        toast.success('Phase approuvée !')
        onStatusChange('approved')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRevision() {
    if (!message.trim()) {
      toast.error('Décrivez les modifications souhaitées.')
      return
    }
    startTransition(async () => {
      const result = await requestAnimationRevisions(projectId, phaseId, message)
      if (result.success) {
        toast.success('Demande de modifications envoyée.')
        setMode('idle')
        setMessage('')
        onStatusChange('in_progress')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">
            Cette vidéo est en attente de votre approbation
          </p>
          <p className="text-xs text-[#666666] mt-0.5">
            Visionnez la vidéo ci-dessous, laissez des commentaires si nécessaire, puis approuvez ou demandez des modifications.
          </p>
        </div>
      </div>

      {mode === 'revision' && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#a0a0a0]">
            Décrivez les modifications souhaitées
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex : Modifier la couleur du texte, ajuster la durée de l'intro…"
            rows={3}
            disabled={isPending}
            className="
              w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2
              text-xs text-white placeholder-[#3a3a3a] resize-none
              focus:outline-none focus:border-[#F59E0B]/40 transition-colors
              disabled:opacity-50
            "
          />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending || mode === 'revision'}
          className="
            inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
            bg-[#22C55E]/10 border border-[#22C55E]/25 text-[#22C55E]
            hover:bg-[#22C55E]/20 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPending && mode === 'idle' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Approuver
        </button>

        {mode === 'idle' ? (
          <button
            type="button"
            onClick={() => setMode('revision')}
            disabled={isPending}
            className="
              inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
              bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B]
              hover:bg-[#F59E0B]/20 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            <RotateCcw className="h-4 w-4" />
            Demander des modifications
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRevision}
              disabled={isPending || !message.trim()}
              className="
                inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B]
                hover:bg-[#F59E0B]/20 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => { setMode('idle'); setMessage('') }}
              disabled={isPending}
              className="text-xs text-[#555555] hover:text-white transition-colors"
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── CommentForm ───────────────────────────────────────────────────

interface ClientCommentFormProps {
  projectId: string
  phaseId: string
  videoVersion: number | null
  getCurrentTime: () => number
  onPause: () => void
  onAdded: (c: VideoComment) => void
  clientId: string
}

function ClientCommentForm({
  projectId,
  phaseId,
  videoVersion,
  getCurrentTime,
  onPause,
  onAdded,
  clientId,
}: ClientCommentFormProps) {
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
      const result = await addClientVideoComment(projectId, phaseId, content.trim(), capturedTime)
      if (result.success) {
        toast.success('Commentaire ajouté')
        onAdded({
          id: crypto.randomUUID(),
          user_id: clientId,
          content: content.trim(),
          timecode_seconds: capturedTime,
          video_version: videoVersion,
          is_resolved: false,
          created_at: new Date().toISOString(),
          author: null,
        })
        setContent('')
        setCapturedTime(null)
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
          placeholder="Laisser un commentaire… (la vidéo se met en pause)"
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
            À{' '}
            <span className="font-mono text-[#F59E0B]">{formatTime(capturedTime)}</span>
            {' · '}
            <button
              type="button"
              onClick={() => setCapturedTime(null)}
              className="text-[#555555] hover:text-[#888888] transition-colors"
            >
              retirer
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

// ── ClientCommentCard ─────────────────────────────────────────────

interface ClientCommentCardProps {
  comment: VideoComment
  clientId: string
  projectId: string
  onSeek: (t: number) => void
  onResolved: (id: string) => void
}

function ClientCommentCard({ comment, clientId, projectId, onSeek, onResolved }: ClientCommentCardProps) {
  const [isPending, startTransition] = useTransition()
  const isOwn = comment.user_id === clientId

  function handleResolve() {
    if (!isOwn) return
    startTransition(async () => {
      const result = await resolveClientVideoComment(projectId, comment.id)
      if (result.success) {
        onResolved(comment.id)
      } else {
        toast.error(result.error)
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
        <div className="h-6 w-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[9px] font-bold text-[#666666] flex-shrink-0 mt-0.5">
          {initials(comment.author?.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-white">
              {comment.author?.full_name ?? (isOwn ? 'Vous' : 'Inconnu')}
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
        {isOwn && (
          <button
            type="button"
            onClick={handleResolve}
            disabled={isPending}
            title={comment.is_resolved ? 'Ré-ouvrir' : 'Marquer résolu'}
            className="p-1 rounded text-[#444444] hover:text-[#22C55E] transition-colors flex-shrink-0 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── VideoViewerClient (main) ──────────────────────────────────────

export interface VideoViewerClientProps {
  token: string
  projectId: string
  phaseId: string
  phaseStatus: PhaseStatus
  clientId: string
  isAuthenticated: boolean
  initialVideo: VideoFile | null
  initialVersions: VideoFile[]
  initialComments: VideoComment[]
}

export default function VideoViewerClient({
  token,
  projectId,
  phaseId,
  phaseStatus,
  clientId,
  isAuthenticated,
  initialVideo,
  initialVersions,
  initialComments,
}: VideoViewerClientProps) {
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(initialVideo)
  const [allVersions, setAllVersions] = useState<VideoFile[]>(initialVersions)
  const [comments, setComments] = useState<VideoComment[]>(initialComments)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(
    initialVideo?.version ?? null,
  )
  const [status, setStatus] = useState<PhaseStatus>(phaseStatus)
  const [isVersionDropOpen, setIsVersionDropOpen] = useState(false)
  const [highlightedComment, setHighlightedComment] = useState<string | null>(null)

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const displayedComments = comments.filter(
    (c) => selectedVersion === null || c.video_version === selectedVersion,
  )

  // Video events
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTU = () => setCurrentTime(v.currentTime)
    const onDC = () => setDuration(v.duration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    v.addEventListener('timeupdate', onTU)
    v.addEventListener('durationchange', onDC)
    v.addEventListener('loadedmetadata', onDC)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTU)
      v.removeEventListener('durationchange', onDC)
      v.removeEventListener('loadedmetadata', onDC)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
    }
  }, [])

  // Fullscreen events
  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Polling
  useEffect(() => {
    const id = setInterval(async () => {
      const data = await fetchVideoData(token, phaseId)
      setAllVersions(data.allVersions)
      setComments(data.comments)
      if (data.currentVideo && !currentVideo) {
        setCurrentVideo(data.currentVideo)
        setSelectedVersion(data.currentVideo.version)
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [token, phaseId, currentVideo])

  // Version switch
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

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  function pause() { videoRef.current?.pause() }
  function getCurrentTime() { return videoRef.current?.currentTime ?? 0 }

  function seekTo(t: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(t, duration))
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
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  function handleMarkerClick(commentId: string, timecode: number) {
    seekTo(timecode)
    setHighlightedComment(commentId)
    setTimeout(() => {
      document.getElementById(`comment-${commentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
    setTimeout(() => setHighlightedComment(null), 2000)
  }

  function handleCommentAdded(c: VideoComment) {
    setComments((prev) =>
      [...prev, c].sort((a, b) => (a.timecode_seconds ?? 0) - (b.timecode_seconds ?? 0)),
    )
  }

  function handleCommentResolved(id: string) {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, is_resolved: !c.is_resolved } : c)))
  }

  // Keyboard: space to play/pause
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Approval panel */}
      <VideoApprovalPanel
        projectId={projectId}
        phaseId={phaseId}
        status={status}
        isAuthenticated={isAuthenticated}
        loginHref="/login"
        onStatusChange={setStatus}
      />

      {/* Player + comments */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Player */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Version selector */}
          {allVersions.length > 1 && (
            <div className="flex items-center justify-end">
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
                  Version {selectedVersion ?? '?'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {isVersionDropOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden z-20 w-44">
                    {allVersions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => switchVersion(v)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#1a1a1a] transition-colors text-left"
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
            </div>
          )}

          {/* Video */}
          {currentVideo ? (
            <div ref={containerRef} className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                src={currentVideo.file_url}
                className="w-full h-full object-contain"
                onClick={togglePlay}
                preload="metadata"
              />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
                {!isPlaying && (
                  <div className="bg-black/50 rounded-full p-4">
                    <Play className="h-8 w-8 text-white fill-white" />
                  </div>
                )}
              </div>
              {/* Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 opacity-0 hover:opacity-100 transition-opacity">
                <VideoTimeline
                  currentTime={currentTime}
                  duration={duration}
                  comments={displayedComments}
                  selectedVersion={selectedVersion}
                  onSeek={seekTo}
                  onMarkerClick={handleMarkerClick}
                />
                <div className="flex items-center gap-3 mt-2">
                  <button type="button" onClick={togglePlay} className="text-white hover:text-white/80 transition-colors">
                    {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
                  </button>
                  <span className="text-xs text-white/70 font-mono tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-16 h-1 accent-white cursor-pointer"
                    />
                  </div>
                  <button type="button" onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-12 text-center" style={{ aspectRatio: '16/9' }}>
              <Film className="h-12 w-12 text-[#333333] mx-auto mb-4" />
              <p className="text-sm text-[#444444] italic">Aucune vidéo disponible.</p>
            </div>
          )}
        </div>

        {/* Comments sidebar */}
        <div className="flex flex-col gap-4 lg:w-80 xl:w-96 flex-shrink-0">
          {/* Comment form (only authenticated + in review) */}
          {status === 'in_review' && currentVideo && isAuthenticated && (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
                Laisser un commentaire
              </h3>
              <ClientCommentForm
                projectId={projectId}
                phaseId={phaseId}
                videoVersion={selectedVersion}
                getCurrentTime={getCurrentTime}
                onPause={pause}
                onAdded={handleCommentAdded}
                clientId={clientId}
              />
            </div>
          )}

          {/* Comments */}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Commentaires</h3>
              <span className="text-xs text-[#444444]">{displayedComments.length}</span>
            </div>
            {displayedComments.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <MessageSquare className="h-8 w-8 text-[#2a2a2a] mx-auto mb-2" />
                <p className="text-xs text-[#444444]">Aucun commentaire sur cette version</p>
              </div>
            ) : (
              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                {displayedComments.map((c) => (
                  <div
                    key={c.id}
                    className={`transition-all rounded-lg ${
                      highlightedComment === c.id ? 'ring-2 ring-[#F59E0B]/60' : ''
                    }`}
                  >
                    <ClientCommentCard
                      comment={c}
                      clientId={clientId}
                      projectId={projectId}
                      onSeek={(t) => { seekTo(t); videoRef.current?.play().catch(() => {}) }}
                      onResolved={handleCommentResolved}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
