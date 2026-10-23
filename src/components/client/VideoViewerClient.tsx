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
  Loader2,
  MessageSquare,
  Film,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  LogIn,
  Download,
  ExternalLink,
  SendHorizonal,
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
// Toujours visible. Chaque commentaire y est une bulle. Un clic (sans glisser)
// pose un repère et ouvre une bulle de saisie juste au-dessus ; un clic
// ailleurs la ferme. Glisser fait défiler la vidéo sans rien poser.

const DRAG_THRESHOLD_PX = 4

interface VideoTimelineProps {
  currentTime: number
  duration: number
  comments: VideoComment[]
  selectedVersion: number | null
  onSeek: (t: number) => void
  onMarkerClick: (commentId: string, timecode: number) => void
  /** Client connecté et vidéo en review : un clic propose de commenter. */
  canComment: boolean
  onPause: () => void
  /** Publie un commentaire au timecode donné ; true si réussi. */
  onAddComment: (timecode: number, content: string) => Promise<boolean>
}

function VideoTimeline({
  currentTime,
  duration,
  comments,
  selectedVersion,
  onSeek,
  onMarkerClick,
  canComment,
  onPause,
  onAddComment,
}: VideoTimelineProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null)
  const [draftTime, setDraftTime] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const pct = (t: number) => (duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0)

  const filteredComments = comments.filter(
    (c) =>
      c.timecode_seconds !== null &&
      (selectedVersion === null || c.video_version === selectedVersion),
  )

  function timeAt(clientX: number): number {
    if (!barRef.current || duration <= 0) return 0
    const rect = barRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    const startX = e.clientX
    let dragged = false
    onSeek(timeAt(startX))

    const onMove = (ev: PointerEvent) => {
      if (!dragged && Math.abs(ev.clientX - startX) > DRAG_THRESHOLD_PX) {
        dragged = true
        setDraftTime(null) // glisser = défiler, jamais de bulle
      }
      if (dragged) onSeek(timeAt(ev.clientX))
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (dragged || !canComment) return
      const t = timeAt(ev.clientX)
      onPause()
      onSeek(t)
      setDraftTime(t)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Un clic n'importe où ailleurs (hors timeline et bulle) ferme la bulle.
  useEffect(() => {
    if (draftTime === null) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDraftTime(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [draftTime])

  async function submit() {
    const content = draft.trim()
    if (!content || draftTime === null || sending) return
    setSending(true)
    const ok = await onAddComment(draftTime, content)
    setSending(false)
    if (ok) {
      setDraft('')
      setDraftTime(null)
    }
  }

  const draftPct = draftTime !== null ? pct(draftTime) : 0

  return (
    <div ref={wrapRef} className="relative w-full pt-4 pb-1">
      {/* Bulle de saisie, juste au-dessus du point cliqué (recadrée près des bords) */}
      {draftTime !== null && (
        <div
          className="absolute bottom-full z-30 mb-1 w-72 max-w-[80vw]"
          style={
            draftPct < 18
              ? { left: 0 }
              : draftPct > 82
                ? { right: 0 }
                : { left: `${draftPct}%`, transform: 'translateX(-50%)' }
          }
        >
          <div className="rounded-xl border border-line bg-surface p-2.5 shadow-xl">
            <p className="mb-1.5 px-0.5 text-[11.5px] text-faint">
              Commenter à <span className="font-mono text-[#F59E0B]">{formatTime(draftTime)}</span>
            </p>
            <div className="relative">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void submit()
                  }
                  if (e.key === 'Escape') setDraftTime(null)
                }}
                rows={2}
                placeholder="Qu’est-ce qui doit changer ici ?"
                className="w-full resize-none rounded-lg border border-line bg-surface py-2 pl-3 pr-11 text-sm text-ink placeholder-faint focus:border-line-strong focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={sending || !draft.trim()}
                aria-label="Envoyer le commentaire"
                className="absolute bottom-2.5 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[#020302] transition-opacity disabled:opacity-35"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        className="relative h-1.5 w-full cursor-pointer touch-none rounded-full bg-[rgb(var(--c-border))]"
        title={canComment ? 'Cliquez pour commenter ce moment, glissez pour avancer' : undefined}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${progress}%` }} />

        {/* Tête de lecture */}
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${progress}%` }}
        />

        {/* Bulles des commentaires */}
        {filteredComments.map((c) => {
          const color = c.is_resolved ? '#22C55E' : '#F59E0B'
          return (
            <button
              key={c.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseEnter={() => setHoveredMarker(c.id)}
              onMouseLeave={() => setHoveredMarker(null)}
              onClick={() => {
                if (c.timecode_seconds !== null) onMarkerClick(c.id, c.timecode_seconds)
              }}
              aria-label={`Commentaire à ${formatTime(c.timecode_seconds ?? 0)}`}
              style={{ left: `${pct(c.timecode_seconds ?? 0)}%`, backgroundColor: color }}
              className="absolute -top-3.5 z-10 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full rounded-bl-none shadow-sm ring-2 ring-surface transition-transform hover:scale-125"
            >
              {hoveredMarker === c.id && (
                <span className="pointer-events-none absolute bottom-5 left-1/2 z-20 max-w-56 -translate-x-1/2 truncate whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-xs text-ink shadow-sm">
                  <span className="text-dim">{formatTime(c.timecode_seconds ?? 0)}</span>
                  {' · '}
                  {c.content}
                </span>
              )}
            </button>
          )
        })}

        {/* Repère posé par le clic */}
        {draftTime !== null && (
          <div
            className="pointer-events-none absolute -top-3.5 z-20 h-3.5 w-3.5 -translate-x-1/2 rounded-full rounded-bl-none bg-brand ring-2 ring-surface"
            style={{ left: `${draftPct}%` }}
          />
        )}
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
  /** Nb de remarques laissées par le client sur cette version. */
  commentCount: number
  /** Met le focus sur la zone de commentaire (et scrolle jusqu'à elle). */
  onComment: () => void
}

function VideoApprovalPanel({
  projectId,
  phaseId,
  status,
  isAuthenticated,
  loginHref = '/login',
  onStatusChange,
  commentCount,
  onComment,
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
            <p className="text-sm font-semibold text-ink">
              Cette vidéo est en attente de votre approbation
            </p>
            <p className="text-xs text-faint mt-0.5">
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
    if (!message.trim() && commentCount === 0) {
      toast.error('Ajoutez au moins une remarque sur la vidéo, ou décrivez les modifications.')
      return
    }
    startTransition(async () => {
      const result = await requestAnimationRevisions(projectId, phaseId, message)
      if (result.success) {
        toast.success('Demande envoyée à Mostra.')
        setMode('idle')
        setMessage('')
        onStatusChange('in_progress')
      } else {
        toast.error(result.error)
      }
    })
  }

  // En review et connecté : la décision. Elle découle des commentaires — avec
  // des retours, on les envoie ; sans retour, on approuve.
  const hasFeedback = commentCount > 0
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">
          {hasFeedback ? 'Envoyer vos retours à Mostra' : 'Tout vous convient ?'}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-dim">
          {hasFeedback ? (
            <>
              Vous avez laissé <span className="font-medium text-ink tabular-nums">{commentCount}</span>{' '}
              commentaire{commentCount > 1 ? 's' : ''} sur cette version. Mostra préparera une nouvelle
              version à partir de vos retours.
            </>
          ) : (
            'Approuvez la vidéo pour passer à l’étape suivante. Une correction ? Commentez d’abord le moment concerné sur la timeline.'
          )}
        </p>
      </div>

      {mode === 'revision' && (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={hasFeedback ? 'Un mot d’ensemble (facultatif)…' : 'Décrivez les modifications souhaitées…'}
          rows={3}
          disabled={isPending}
          className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder-faint transition-colors focus:border-[#F59E0B]/40 focus:outline-none disabled:opacity-50"
        />
      )}

      <div className="flex flex-col gap-2">
        {hasFeedback || mode === 'revision' ? (
          <button
            type="button"
            onClick={handleRevision}
            disabled={isPending || (!message.trim() && !hasFeedback)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            {hasFeedback
              ? `Envoyer mes ${commentCount} retour${commentCount > 1 ? 's' : ''}`
              : 'Envoyer la demande'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-[#020302] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approuver la vidéo
          </button>
        )}

        {/* L'autre choix, en retrait */}
        {mode === 'revision' && !hasFeedback ? (
          <button
            type="button"
            onClick={() => { setMode('idle'); setMessage('') }}
            disabled={isPending}
            className="text-xs text-faint transition-colors hover:text-ink"
          >
            Annuler
          </button>
        ) : hasFeedback ? (
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="text-xs text-faint transition-colors hover:text-ink disabled:opacity-40"
          >
            Approuver quand même
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode('revision')}
            disabled={isPending}
            className="text-xs text-faint transition-colors hover:text-ink disabled:opacity-40"
          >
            Demander des modifications sans commenter la vidéo
          </button>
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
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div className="relative">
        <textarea
          id="client-video-comment"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="Écrivez votre remarque… (la vidéo se met en pause)"
          rows={3}
          disabled={isPending}
          className="w-full resize-none rounded-lg border border-line bg-surface py-2 pl-3 pr-12 text-sm text-ink placeholder-faint transition-colors focus:border-line-strong focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          aria-label="Envoyer le commentaire"
          className="absolute bottom-3 right-2.5 flex h-8 w-8 items-center justify-center rounded-md bg-brand text-[#020302] transition-opacity disabled:opacity-35"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-faint">
        {capturedTime !== null ? (
          <>
            Au moment{' '}
            <span className="font-mono text-[#F59E0B]">{formatTime(capturedTime)}</span>
            {' · '}
            <button type="button" onClick={() => setCapturedTime(null)} className="hover:text-dim">
              sans moment précis
            </button>
          </>
        ) : (
          'Entrée pour envoyer · Maj+Entrée pour aller à la ligne'
        )}
      </p>
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
          : 'bg-surface border-line'}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="h-6 w-6 rounded-full bg-surface-2 border border-line flex items-center justify-center text-[9px] font-bold text-faint flex-shrink-0 mt-0.5">
          {initials(comment.author?.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-ink">
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
          <p className="text-xs text-dim mt-1 leading-relaxed">{comment.content}</p>
        </div>
        {isOwn && (
          <button
            type="button"
            onClick={handleResolve}
            disabled={isPending}
            title={comment.is_resolved ? 'Ré-ouvrir' : 'Marquer résolu'}
            className="p-1 rounded text-faint hover:text-[#22C55E] transition-colors flex-shrink-0 disabled:opacity-40"
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
  /**
   * Intégré à la vue d'ensemble (colonne plus étroite) : les commentaires
   * passent sous la vidéo, et ne se remettent à côté que sur très grand écran.
   */
  compact?: boolean
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
  compact = false,
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
  const [videoError, setVideoError] = useState(false)

  const displayedComments = comments.filter(
    (c) => selectedVersion === null || c.video_version === selectedVersion,
  )
  const myCommentCount = displayedComments.filter((c) => c.user_id === clientId).length

  function focusCommentBox() {
    const el = document.getElementById('client-video-comment') as HTMLTextAreaElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => el?.focus(), 350)
  }

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
    setVideoError(false)
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

  const canCommentVideo = status === 'in_review' && !!currentVideo && isAuthenticated

  async function addCommentAt(timecode: number, content: string): Promise<boolean> {
    const result = await addClientVideoComment(projectId, phaseId, content, timecode)
    if (!result?.success) {
      toast.error(result?.error ?? 'Commentaire non envoyé')
      return false
    }
    toast.success('Commentaire ajouté')
    handleCommentAdded({
      id: crypto.randomUUID(),
      user_id: clientId,
      content,
      timecode_seconds: timecode,
      video_version: selectedVersion,
      is_resolved: false,
      created_at: new Date().toISOString(),
      author: null,
    })
    return true
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
      {/* En haut : vidéo approuvée, ou invitation à se connecter. La décision
          d'un client connecté se prend à droite de la vidéo, sous le commentaire. */}
      {!(status === 'in_review' && isAuthenticated) && (
        <VideoApprovalPanel
          projectId={projectId}
          phaseId={phaseId}
          status={status}
          isAuthenticated={isAuthenticated}
          loginHref="/login"
          onStatusChange={setStatus}
          commentCount={myCommentCount}
          onComment={focusCommentBox}
        />
      )}

      {/* Player + comments */}
      <div
        className={`flex flex-col gap-5 ${compact ? '2xl:flex-row 2xl:items-start' : 'lg:flex-row lg:items-start'}`}
      >
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
                    bg-surface-2 border border-line text-dim
                    hover:border-line-strong hover:text-ink transition-colors
                  "
                >
                  <Film className="h-3.5 w-3.5" />
                  Version {selectedVersion ?? '?'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {isVersionDropOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-surface border border-line rounded-lg overflow-hidden z-20 w-44">
                    {allVersions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => switchVersion(v)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-2 transition-colors text-left"
                      >
                        <span className={v.version === selectedVersion ? 'text-ink font-medium' : 'text-dim'}>
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
            <div ref={containerRef} className="group rounded-xl overflow-hidden border border-line bg-surface">
              {/* Vidéo — seul le bouton play/stop par-dessus */}
              <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  src={currentVideo.file_url}
                  className="w-full h-full object-contain"
                  onClick={togglePlay}
                  onError={() => setVideoError(true)}
                  preload="metadata"
                  playsInline
                />

                {/* Fallback si format illisible (ex. .MOV sur Android) */}
                {videoError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
                    <AlertCircle className="h-8 w-8 text-[#F59E0B]" />
                    <p className="text-sm text-white font-medium">Lecture impossible sur cet appareil</p>
                    <p className="text-xs text-white/60 max-w-xs">
                      Le format de cette vidéo n&apos;est peut-être pas supporté par votre navigateur
                      (ex. .MOV sur Android). Ouvrez-la ou téléchargez-la pour la visionner.
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={currentVideo.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-black hover:bg-white/90 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ouvrir
                      </a>
                      <a
                        href={currentVideo.file_url}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-2 border border-line text-ink hover:bg-surface-3 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Télécharger
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Play overlay — seul élément par-dessus la vidéo */
                  <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
                    {!isPlaying && (
                      <div className="bg-black/50 rounded-full p-4">
                        <Play className="h-8 w-8 text-white fill-white" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contrôles SOUS la vidéo, toujours visibles */}
              {!videoError && (
                <div className="bg-surface border-t border-line px-3 sm:px-4 pb-2.5">
                  <VideoTimeline
                    currentTime={currentTime}
                    duration={duration}
                    comments={displayedComments}
                    selectedVersion={selectedVersion}
                    onSeek={seekTo}
                    onMarkerClick={handleMarkerClick}
                    canComment={canCommentVideo}
                    onPause={pause}
                    onAddComment={addCommentAt}
                  />
                  <div className="flex items-center gap-3 mt-1.5">
                    <button type="button" onClick={togglePlay} className="text-ink hover:text-ink/80 transition-colors">
                      {isPlaying ? <Pause className="h-4 w-4 fill-ink" /> : <Play className="h-4 w-4 fill-ink" />}
                    </button>
                    <span className="text-xs text-ink/70 font-mono tabular-nums">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={toggleMute} className="text-ink/70 hover:text-ink transition-colors">
                        {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-16 h-1 accent-[rgb(var(--c-brand))] cursor-pointer"
                      />
                    </div>
                    <button type="button" onClick={toggleFullscreen} className="text-ink/70 hover:text-ink transition-colors">
                      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-xl p-12 text-center" style={{ aspectRatio: '16/9' }}>
              <Film className="h-12 w-12 text-faint mx-auto mb-4" />
              <p className="text-sm text-faint italic">Aucune vidéo disponible.</p>
            </div>
          )}
        </div>

        {/* Comments sidebar */}
        <div
          className={`flex flex-col gap-4 flex-shrink-0 ${
            compact ? 'md:grid md:grid-cols-2 md:items-start 2xl:flex 2xl:w-96' : 'lg:w-80 xl:w-96'
          }`}
        >
          {/* Comment form (only authenticated + in review) */}
          {status === 'in_review' && currentVideo && isAuthenticated && (
            <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <MessageSquare className="h-4 w-4 text-brand" />
                  Commenter la vidéo
                </h3>
                <p className="text-xs leading-relaxed text-dim">
                  Chaque commentaire est rattaché à un moment précis de la vidéo. Cliquez sur la
                  timeline à l’endroit voulu, ou mettez en pause et écrivez ici : le moment est noté
                  automatiquement.
                </p>
              </div>
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
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <h3 className="text-xs font-semibold text-faint uppercase tracking-wider">Commentaires</h3>
              <span className="text-xs text-faint">{displayedComments.length}</span>
            </div>
            {displayedComments.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <MessageSquare className="h-8 w-8 text-[rgb(var(--c-border))] mx-auto mb-2" />
                <p className="text-xs text-faint">Aucun commentaire sur cette version</p>
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

          {/* Dernière étape : décider, une fois les commentaires posés. */}
          {status === 'in_review' && currentVideo && isAuthenticated && (
            <VideoApprovalPanel
              projectId={projectId}
              phaseId={phaseId}
              status={status}
              isAuthenticated={isAuthenticated}
              loginHref="/login"
              onStatusChange={setStatus}
              commentCount={myCommentCount}
              onComment={focusCommentBox}
            />
          )}
        </div>
      </div>
    </div>
  )
}
