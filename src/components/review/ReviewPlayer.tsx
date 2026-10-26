'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, ChevronDown, Check, Loader2, Film, AlertCircle,
  Download, ExternalLink, SendHorizonal, X, Trash2, LogIn, CheckCircle2, MessageSquare, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PhaseStatus } from '@/lib/types'
import type { VideoFile, VideoComment } from '@/app/projects/video-actions'
import { getVideoData, addTimecodedComment, resolveVideoComment, deleteVideoComment, deleteVideoVersion } from '@/app/projects/video-actions'
import { startPhase, sendToReview, completePhase, unapprovePhase } from '@/app/projects/phase-actions'
import {
  fetchVideoData, addClientVideoComment, resolveClientVideoComment, approveAnimationPhase, requestAnimationRevisions,
} from '@/app/client/video-actions'
import VideoUploadZone from '@/components/review/VideoUploadZone'

// ============================================================
// ReviewPlayer — la review vidéo, façon Frame.io, pour l'admin et le client
// ============================================================
// Lecteur à gauche (barre fine, une bulle d'auteur par commentaire à son
// timecode, aperçu de l'image au survol), panneau Commentaires / Infos à
// droite avec le composeur collé en bas. La décision du client (approuver /
// demander des modifications) et le workflow admin sont dans la barre du haut.
// Raccourcis : espace ou K lecture, J/L ±5 s, ← → image par image, C commenter.

const FPS = 25
const SPEEDS = [1, 1.5, 2, 0.5]

export type ReviewRole = 'admin' | 'client'

export interface ReviewPlayerProps {
  role: ReviewRole
  projectId: string
  phaseId: string
  phaseStatus: PhaseStatus
  initialVideo: VideoFile | null
  initialVersions: VideoFile[]
  initialComments: VideoComment[]
  /** Client : jeton du lien (lecture publique) et id du client pour ses propres commentaires. */
  token?: string
  viewerId?: string
  /** Client connecté (sinon lecture seule, invitation à se connecter). Toujours vrai pour l'admin. */
  isAuthenticated?: boolean
  /** Intégré dans une colonne étroite : le panneau passe sous la vidéo jusqu'aux très grands écrans. */
  compact?: boolean
}

function clock(s: number, frames = false): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const base = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return frames ? `${base}:${String(Math.floor((s % 1) * FPS)).padStart(2, '0')}` : base
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function ReviewPlayer({
  role, projectId, phaseId, phaseStatus, initialVideo, initialVersions, initialComments,
  token, viewerId, isAuthenticated = role === 'admin', compact = false,
}: ReviewPlayerProps) {
  const isAdmin = role === 'admin'
  const [video, setVideo] = useState<VideoFile | null>(initialVideo)
  const [versions, setVersions] = useState<VideoFile[]>(initialVersions)
  const [comments, setComments] = useState<VideoComment[]>(initialComments)
  const [version, setVersion] = useState<number | null>(initialVideo?.version ?? null)
  const [status, setStatus] = useState<PhaseStatus>(phaseStatus)

  // Lecteur
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [frames, setFrames] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [videoError, setVideoError] = useState(false)

  // Panneau
  const [tab, setTab] = useState<'comments' | 'info'>('comments')
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all')
  const [sort, setSort] = useState<'timecode' | 'recent'>('timecode')
  const [highlight, setHighlight] = useState<string | null>(null)

  const canComment = !!video && (isAdmin || (isAuthenticated && status === 'in_review'))

  // ── Données ───────────────────────────────────────────────────
  const versionComments = useMemo(
    () => comments.filter((c) => version === null || c.video_version === version),
    [comments, version],
  )
  // Numéro #n : ordre des timecodes, comme Frame.io.
  const numbers = useMemo(() => {
    const ordered = [...versionComments].sort((a, b) => (a.timecode_seconds ?? -1) - (b.timecode_seconds ?? -1))
    return new Map(ordered.map((c, i) => [c.id, i + 1]))
  }, [versionComments])
  const listed = useMemo(() => {
    const kept = versionComments.filter((c) => (filter === 'open' ? !c.is_resolved : filter === 'done' ? c.is_resolved : true))
    return sort === 'recent'
      ? [...kept].sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [...kept].sort((a, b) => (a.timecode_seconds ?? -1) - (b.timecode_seconds ?? -1))
  }, [versionComments, filter, sort])
  const ownCount = versionComments.filter((c) => c.user_id === viewerId).length

  const authorName = (c: VideoComment) => c.author?.full_name ?? (c.user_id && c.user_id === viewerId ? 'Vous' : isAdmin && !c.user_id ? 'Vous' : 'Inconnu')

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Rafraîchissement (nouveaux commentaires, nouvelle version).
  useEffect(() => {
    const id = setInterval(async () => {
      const data = isAdmin ? await getVideoData(phaseId) : token ? await fetchVideoData(token, phaseId) : null
      if (!data) return
      setVersions(data.allVersions)
      setComments(data.comments)
      if (data.currentVideo && !video) {
        setVideo(data.currentVideo)
        setVersion(data.currentVideo.version)
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [isAdmin, token, phaseId, video])

  // ── Commandes ─────────────────────────────────────────────────
  const v = () => videoRef.current
  function togglePlay() { const el = v(); if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause() }
  function pause() { v()?.pause() }
  function seek(t: number) { const el = v(); if (!el) return; el.currentTime = Math.max(0, Math.min(t, duration || el.duration || 0)) }
  function step(frames: number) { const el = v(); if (!el) return; el.pause(); seek(el.currentTime + frames / FPS) }
  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (v()) v()!.playbackRate = next
  }
  function toggleMute() { const el = v(); if (!el) return; el.muted = !el.muted; setMuted(el.muted) }
  function changeVolume(val: number) { const el = v(); if (!el) return; el.volume = val; el.muted = val === 0; setVolume(val); setMuted(val === 0) }
  function toggleFullscreen() {
    const el = stageRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  function openComment(c: VideoComment) {
    if (c.timecode_seconds !== null) { pause(); seek(c.timecode_seconds) }
    setTab('comments')
    setHighlight(c.id)
    setTimeout(() => document.getElementById(`comment-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }

  function switchVersion(f: VideoFile) {
    setVideo(f)
    setVersion(f.version)
    setTime(0)
    setPlaying(false)
    setVideoError(false)
    setHighlight(null)
  }

  // Raccourcis clavier (hors champs de saisie).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (e.code === 'Space' || k === 'k') { e.preventDefault(); togglePlay() }
      else if (k === 'j') seek((v()?.currentTime ?? 0) - 5)
      else if (k === 'l') seek((v()?.currentTime ?? 0) + 5)
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
      else if (k === 'c' && canComment) { e.preventDefault(); composerRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }) // re-bind à chaque rendu : les handlers lisent l'état courant

  // ── Commentaires ──────────────────────────────────────────────
  async function addComment(content: string, at: number | null): Promise<boolean> {
    const res = isAdmin
      ? await addTimecodedComment(phaseId, content, at, version)
      : await addClientVideoComment(projectId, phaseId, content, at)
    if (!res?.success) { toast.error(res && 'error' in res ? res.error : 'Commentaire non envoyé'); return false }
    setComments((prev) => [...prev, {
      id: crypto.randomUUID(), user_id: viewerId ?? '', content, timecode_seconds: at,
      video_version: version, is_resolved: false, created_at: new Date().toISOString(), author: null,
    }])
    return true
  }

  async function toggleResolved(c: VideoComment) {
    const res = isAdmin ? await resolveVideoComment(c.id) : await resolveClientVideoComment(projectId, c.id)
    if (!res.success) { toast.error(res.error); return }
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_resolved: !x.is_resolved } : x)))
  }

  async function removeComment(c: VideoComment) {
    const res = await deleteVideoComment(c.id)
    if (!res.success) { toast.error(res.error); return }
    setComments((prev) => prev.filter((x) => x.id !== c.id))
    toast.success('Commentaire supprimé')
  }

  function onUploaded(f: VideoFile) {
    setVersions((prev) => [f, ...prev.map((x) => ({ ...x, is_current: false }))].sort((a, b) => b.version - a.version))
    switchVersion(f)
  }

  async function removeVersion() {
    if (!video) return
    const removed = video
    const res = await deleteVideoVersion(removed.id)
    if (!res?.success) { toast.error(res?.error ?? 'Suppression impossible'); return }
    toast.success(`Version ${removed.version} supprimée`)
    setVersions((prev) => prev.filter((x) => x.id !== removed.id).map((x) => (res.current && x.id === res.current.id ? res.current : { ...x, is_current: false })))
    setComments((prev) => prev.filter((c) => c.video_version !== removed.version))
    setStatus(res.status)
    setVideo(res.current)
    setVersion(res.current?.version ?? null)
  }

  const grid = compact ? '2xl:grid 2xl:grid-cols-[minmax(0,1fr)_374px]' : 'lg:grid lg:grid-cols-[minmax(0,1fr)_374px]'

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* ── Barre du haut ── */}
      <div className="flex min-h-[50px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2 sm:px-4">
        <VersionMenu versions={versions} current={version} onPick={switchVersion} />
        {video && <span className="hidden min-w-0 truncate text-[13px] text-faint sm:block">{video.file_name}</span>}
        <div className="flex-1" />
        {isAdmin ? (
          <>
            <AdminWorkflow phaseId={phaseId} status={status} hasVideo={!!video} onStatus={setStatus} />
            {video && <VideoUploadZone phaseId={phaseId} projectId={projectId} onUploaded={onUploaded} isNewVersion />}
          </>
        ) : (
          <ClientDecision
            projectId={projectId} phaseId={phaseId} status={status} isAuthenticated={isAuthenticated}
            ownCount={ownCount} onStatus={setStatus} onComment={() => composerRef.current?.focus()}
          />
        )}
      </div>

      <div className={grid}>
        {/* ── Lecteur ── */}
        <div className="min-w-0 border-line lg:border-r">
          {video ? (
            <div ref={stageRef} className="flex flex-col bg-black">
              <div className="relative" style={{ aspectRatio: '16/9' }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  key={video.id}
                  ref={videoRef}
                  src={video.file_url}
                  className="h-full w-full object-contain"
                  onClick={togglePlay}
                  onError={() => setVideoError(true)}
                  // Événements en props : « loadedmetadata » peut arriver avant un useEffect.
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = speed }}
                  onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  preload="metadata"
                  playsInline
                />
                {videoError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
                    <AlertCircle className="h-8 w-8 text-soon" />
                    <p className="text-sm font-medium text-white">Lecture impossible sur cet appareil</p>
                    <p className="max-w-xs text-xs text-white/60">
                      Le format de cette vidéo n’est peut-être pas lu par ce navigateur (ex. .MOV sur Android). Ouvrez-la ou téléchargez-la.
                    </p>
                    <div className="flex items-center gap-2">
                      <a href={video.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black">
                        <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
                      </a>
                      <a href={video.file_url} download className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white">
                        <Download className="h-3.5 w-3.5" /> Télécharger
                      </a>
                    </div>
                  </div>
                ) : (
                  !playing && (
                    <button type="button" onClick={togglePlay} aria-label="Lecture" className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white">
                      <Play className="h-7 w-7 fill-white" />
                    </button>
                  )
                )}
              </div>

              {!videoError && (
                <div className="bg-surface px-3 pb-2 pt-3 sm:px-4">
                  <ScrubBar
                    src={video.file_url}
                    time={time}
                    duration={duration}
                    comments={versionComments}
                    highlight={highlight}
                    authorName={authorName}
                    onSeek={seek}
                    onBubble={openComment}
                  />
                  <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="flex items-center gap-1">
                      <CtrlButton label={playing ? 'Pause (espace)' : 'Lecture (espace)'} onClick={togglePlay}>
                        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                      </CtrlButton>
                      <button type="button" onClick={cycleSpeed} title="Vitesse" className="h-11 min-w-11 rounded-md px-1.5 font-mono text-[12px] text-dim hover:text-ink sm:h-8 sm:min-w-8">
                        {speed.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}x
                      </button>
                      <CtrlButton label={muted ? 'Activer le son' : 'Couper le son'} onClick={toggleMute}>
                        {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </CtrlButton>
                      <input
                        type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                        onChange={(e) => changeVolume(Number(e.target.value))}
                        aria-label="Volume"
                        className="hidden h-1 w-16 cursor-pointer accent-[rgb(var(--c-brand))] sm:block"
                      />
                    </div>
                    <button type="button" onClick={() => setFrames((f) => !f)} title="Changer le format du temps" className="font-mono text-[13px] tabular-nums text-ink">
                      {clock(time, frames)} <span className="text-faint">/ {clock(duration, frames)}</span>
                    </button>
                    <div className="flex items-center justify-end">
                      <CtrlButton label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'} onClick={toggleFullscreen}>
                        {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                      </CtrlButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : isAdmin ? (
            <div className="p-4"><VideoUploadZone phaseId={phaseId} projectId={projectId} onUploaded={onUploaded} /></div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center" style={{ aspectRatio: '16/9' }}>
              <Film className="h-10 w-10 text-faint" />
              <p className="text-sm text-faint">Aucune vidéo pour l’instant.</p>
            </div>
          )}
        </div>

        {/* ── Panneau de droite ── */}
        <aside className="flex min-h-0 flex-col border-t border-line lg:border-t-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-line p-2">
            <div className="flex rounded-lg bg-surface-2 p-0.5">
              {([['comments', `Commentaires${versionComments.length ? ` ${versionComments.length}` : ''}`], ['info', 'Infos']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={`h-8 rounded-md px-3 text-[13px] font-medium transition-colors ${tab === id ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'comments' && (
              <div className="ml-auto flex items-center gap-1">
                <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtrer"
                  className="h-8 rounded-md border border-line bg-surface px-1.5 text-[12px] text-dim">
                  <option value="all">Tous</option>
                  <option value="open">À traiter</option>
                  <option value="done">Terminés</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier"
                  className="h-8 rounded-md border border-line bg-surface px-1.5 text-[12px] text-dim">
                  <option value="timecode">Timecode</option>
                  <option value="recent">Plus récents</option>
                </select>
              </div>
            )}
          </div>

          {tab === 'comments' ? (
            <>
              <div className={`flex-1 overflow-y-auto p-2 ${compact ? '2xl:max-h-[560px]' : 'lg:max-h-[560px]'}`}>
                {listed.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <MessageSquare className="h-6 w-6 text-faint" />
                    <p className="text-[13px] text-dim">Aucun commentaire pour l’instant.</p>
                    {canComment && <p className="text-[12.5px] text-faint">Mettez la vidéo en pause et écrivez ci-dessous : le moment est noté tout seul.</p>}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {listed.map((c) => (
                      <CommentCard
                        key={c.id}
                        comment={c}
                        number={numbers.get(c.id) ?? 0}
                        name={authorName(c)}
                        highlighted={highlight === c.id}
                        canResolve={isAdmin || (isAuthenticated && c.user_id === viewerId)}
                        canDelete={isAdmin}
                        onOpen={() => openComment(c)}
                        onResolve={() => toggleResolved(c)}
                        onDelete={() => removeComment(c)}
                      />
                    ))}
                  </ul>
                )}
              </div>
              {canComment ? (
                <Composer inputRef={composerRef} getTime={() => v()?.currentTime ?? 0} onPause={pause} onSubmit={addComment} />
              ) : !isAdmin && !isAuthenticated && status === 'in_review' ? (
                <div className="sticky bottom-0 border-t border-line bg-surface p-3">
                  <Link href="/login" className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line text-[13px] font-medium text-ink hover:bg-surface-2">
                    <LogIn className="h-4 w-4" /> Se connecter pour commenter
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <InfoPanel video={video} duration={duration} status={status} canDelete={isAdmin} onDeleteVersion={removeVersion} />
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Pièces ──────────────────────────────────────────────────────

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-surface-2 sm:h-8 sm:w-8">
      {children}
    </button>
  )
}

function VersionMenu({ versions, current, onPick }: { versions: VideoFile[]; current: number | null; onPick: (f: VideoFile) => void }) {
  const [open, setOpen] = useState(false)
  if (current === null) return <span className="text-[13px] font-semibold text-ink">Vidéo</span>
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={versions.length < 2}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-ink hover:bg-surface-2 disabled:hover:bg-transparent">
        V{current}
        {versions.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-faint" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
          {versions.map((f) => (
            <button key={f.id} type="button" onClick={() => { onPick(f); setOpen(false) }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-surface-2">
              <span className={f.version === current ? 'font-medium text-ink' : 'text-dim'}>Version {f.version}</span>
              {f.is_current && <span className="text-[12px] text-brand-text">actuelle</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Barre de progression fine. Survol : l'image et le timecode au-dessus du
 * curseur (une seconde <video> qu'on fait avancer, sans canvas). Sous la barre,
 * une bulle d'auteur par commentaire, à son timecode.
 */
function ScrubBar({ src, time, duration, comments, highlight, authorName, onSeek, onBubble }: {
  src: string
  time: number
  duration: number
  comments: VideoComment[]
  highlight: string | null
  authorName: (c: VideoComment) => string
  onSeek: (t: number) => void
  onBubble: (c: VideoComment) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null)
  const pct = (t: number) => (duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0)

  function at(clientX: number) {
    const r = barRef.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - r.left, r.width))
    return { x, t: duration > 0 ? (x / r.width) * duration : 0 }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    onSeek(at(e.clientX).t)
    const move = (ev: PointerEvent) => onSeek(at(ev.clientX).t)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  useEffect(() => {
    const p = previewRef.current
    if (p && hover && Math.abs(p.currentTime - hover.t) > 0.04) p.currentTime = hover.t
  }, [hover])

  const timed = comments.filter((c) => c.timecode_seconds !== null)

  return (
    <div className="relative select-none">
      {hover && (
        <div className="pointer-events-none absolute bottom-full z-20 mb-2 hidden -translate-x-1/2 flex-col items-center gap-1 sm:flex"
          style={{ left: Math.max(84, Math.min(hover.x, (barRef.current?.clientWidth ?? 0) - 84)) }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={previewRef} src={src} muted preload="metadata" playsInline className="w-40 rounded-md border border-line bg-black" style={{ aspectRatio: '16/9' }} />
          <span className="rounded bg-black/80 px-1.5 py-0.5 font-mono text-[12px] text-white">{clock(hover.t)}</span>
        </div>
      )}
      <div
        ref={barRef}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { if (e.pointerType === 'mouse') setHover(at(e.clientX)) }}
        onPointerLeave={() => setHover(null)}
        className="group relative flex h-5 cursor-pointer touch-none items-center"
        role="slider"
        aria-label="Position dans la vidéo"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
      >
        <div className="relative h-1 w-full rounded-full bg-surface-3 transition-[height] group-hover:h-1.5">
          <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct(time)}%` }} />
        </div>
        <div className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${pct(time)}%` }} />
      </div>
      {/* Une bulle par commentaire, sous la barre */}
      <div className="relative h-6">
        {timed.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onBubble(c)}
            title={`${clock(c.timecode_seconds ?? 0)} · ${authorName(c)} : ${c.content}`}
            aria-label={`Commentaire de ${authorName(c)} à ${clock(c.timecode_seconds ?? 0)}`}
            style={{ left: `${pct(c.timecode_seconds ?? 0)}%` }}
            className={`absolute top-0.5 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-surface transition-transform hover:z-10 hover:scale-125 ${
              c.is_resolved ? 'bg-brand/25 text-brand-text' : 'bg-surface-3 text-ink'
            } ${highlight === c.id ? 'z-10 scale-125 outline outline-2 outline-brand' : ''}`}
          >
            {initials(authorName(c))}
          </button>
        ))}
      </div>
    </div>
  )
}

function CommentCard({ comment, number, name, highlighted, canResolve, canDelete, onOpen, onResolve, onDelete }: {
  comment: VideoComment
  number: number
  name: string
  highlighted: boolean
  canResolve: boolean
  canDelete: boolean
  onOpen: () => void
  onResolve: () => void
  onDelete: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  return (
    <li
      id={`comment-${comment.id}`}
      onClick={onOpen}
      className={`group cursor-pointer rounded-lg px-3 py-2.5 transition-colors ${highlighted ? 'bg-surface-2' : 'hover:bg-surface-2/60'}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-ink">{initials(name)}</span>
        <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
        <span className="flex-shrink-0 text-[12px] text-faint">{formatDistanceToNow(new Date(comment.created_at), { locale: fr })}</span>
        <span className="ml-auto flex-shrink-0 font-mono text-[12px] text-faint">#{number}</span>
      </div>
      <p className={`mt-1.5 text-[14px] leading-relaxed ${comment.is_resolved ? 'text-faint line-through decoration-faint/40' : 'text-ink'}`}>
        {comment.timecode_seconds !== null && (
          <span className="mr-1.5 rounded-md bg-soon/15 px-1.5 py-0.5 font-mono text-[13px] text-soon">{clock(comment.timecode_seconds)}</span>
        )}
        {comment.content}
      </p>
      {(canResolve || canDelete) && (
        <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canResolve && (
            <button type="button" disabled={pending} onClick={() => startTransition(onResolve)}
              className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] transition-colors ${comment.is_resolved ? 'text-brand-text' : 'text-faint hover:text-ink'}`}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {comment.is_resolved ? 'Terminé' : 'Marquer terminé'}
            </button>
          )}
          {canDelete && (
            <button type="button" disabled={pending}
              onClick={() => { if (!confirm) { setConfirm(true); return } startTransition(onDelete) }}
              onBlur={() => setConfirm(false)}
              className={`ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 ${confirm ? 'text-late opacity-100' : 'text-faint hover:text-late'}`}>
              <Trash2 className="h-3.5 w-3.5" /> {confirm ? 'Confirmer' : 'Supprimer'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/** Composeur collé en bas du panneau : le focus met en pause et capte le timecode. */
function Composer({ inputRef, getTime, onPause, onSubmit }: {
  inputRef: React.RefObject<HTMLTextAreaElement>
  getTime: () => number
  onPause: () => void
  onSubmit: (content: string, at: number | null) => Promise<boolean>
}) {
  const [content, setContent] = useState('')
  const [at, setAt] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  async function send() {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    const ok = await onSubmit(text, at)
    setSending(false)
    if (ok) { setContent(''); setAt(null); toast.success('Commentaire ajouté') }
  }

  return (
    <div className="sticky bottom-0 border-t border-line bg-surface p-3">
      <div className="rounded-lg border border-line bg-surface focus-within:border-line-strong">
        <div className="flex items-start gap-2 px-3 pt-2.5">
          {at !== null && (
            <span className="mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-soon/15 px-1.5 py-0.5 font-mono text-[13px] text-soon">
              {clock(at)}
              <button type="button" onClick={() => setAt(null)} aria-label="Commentaire général, sans moment précis" className="text-soon/70 hover:text-soon">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <textarea
            ref={inputRef}
            value={content}
            rows={2}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => { onPause(); setAt(getTime()) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
            placeholder="Laisser un commentaire…"
            className="min-h-[44px] w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="px-1 text-[12px] text-faint">Entrée pour envoyer</span>
          <button type="button" onClick={() => void send()} disabled={sending || !content.trim()} aria-label="Envoyer le commentaire"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-[#020302] transition-opacity disabled:opacity-35">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoPanel({ video, duration, status, canDelete, onDeleteVersion }: {
  video: VideoFile | null
  duration: number
  status: PhaseStatus
  canDelete: boolean
  onDeleteVersion: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const STATUS: Record<PhaseStatus, string> = { pending: 'À venir', in_progress: 'En production', in_review: 'À valider', approved: 'Approuvée', completed: 'Approuvée' }
  if (!video) return <p className="p-5 text-[13px] text-faint">Aucune vidéo pour l’instant.</p>
  const rows: [string, string][] = [
    ['Version', `V${video.version}${video.is_current ? ' (actuelle)' : ''}`],
    ['Fichier', video.file_name],
    ['Durée', duration ? clock(duration) : '—'],
    ['Poids', video.file_size ? `${(video.file_size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : '—'],
    ['Envoyée le', format(new Date(video.created_at), 'd MMMM yyyy, HH:mm', { locale: fr })],
    ['Statut', STATUS[status]],
  ]
  return (
    <div className="p-4">
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
        {rows.map(([k, val]) => (
          <div key={k} className="contents">
            <dt className="text-faint">{k}</dt>
            <dd className="min-w-0 break-words text-ink">{val}</dd>
          </div>
        ))}
      </dl>
      <a href={video.file_url} download className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-ink hover:bg-surface-2">
        <Download className="h-4 w-4" /> Télécharger
      </a>
      {canDelete && (
        <button type="button" disabled={pending}
          onClick={() => { if (!confirm) { setConfirm(true); return } startTransition(async () => { await onDeleteVersion(); setConfirm(false) }) }}
          className={`ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] ${confirm ? 'text-late' : 'text-faint hover:text-late'}`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {confirm ? `Confirmer : supprimer la V${video.version} et ses commentaires` : 'Supprimer cette version'}
        </button>
      )}
    </div>
  )
}

/** Décision du client dans la barre du haut : approuver la version ou demander des modifications. */
function ClientDecision({ projectId, phaseId, status, isAuthenticated, ownCount, onStatus, onComment }: {
  projectId: string
  phaseId: string
  status: PhaseStatus
  isAuthenticated: boolean
  ownCount: number
  onStatus: (s: PhaseStatus) => void
  onComment: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState('')

  if (status === 'approved' || status === 'completed') {
    return <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text"><CheckCircle2 className="h-4 w-4" /> Version approuvée</span>
  }
  if (status !== 'in_review') return null
  if (!isAuthenticated) {
    return (
      <Link href="/login" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-[rgb(var(--c-surface))]">
        <LogIn className="h-4 w-4" /> Se connecter pour valider
      </Link>
    )
  }

  function approve() {
    startTransition(async () => {
      const res = await approveAnimationPhase(projectId, phaseId)
      if (res.success) { toast.success('Version approuvée'); onStatus('approved') } else toast.error(res.error)
    })
  }
  function sendRevisions() {
    if (!ownCount && !message.trim()) { toast.error('Laissez au moins un commentaire, ou décrivez les modifications.'); return }
    startTransition(async () => {
      const res = await requestAnimationRevisions(projectId, phaseId, message)
      if (res.success) { toast.success('Demande envoyée à Mostra'); setAsking(false); setMessage(''); onStatus('in_progress') } else toast.error(res.error)
    })
  }

  return (
    <div className="relative flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => setAsking((a) => !a)}
        className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-[13px] font-medium text-ink hover:bg-surface-2 disabled:opacity-50">
        Demander des modifications{ownCount ? ` (${ownCount})` : ''}
      </button>
      <button type="button" disabled={pending} onClick={approve}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-[#020302] disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approuver la version
      </button>
      {asking && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(340px,90vw)] rounded-xl border border-line bg-surface p-3 shadow-xl">
          <p className="text-[13px] text-dim">
            {ownCount
              ? `Vos ${ownCount} commentaire${ownCount > 1 ? 's' : ''} partiront avec la demande. Un mot d’ensemble ?`
              : 'Décrivez ce qui doit changer, ou commentez d’abord les moments concernés.'}
          </p>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
            placeholder={ownCount ? 'Facultatif' : 'Les modifications souhaitées…'}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none" />
          <div className="mt-2 flex items-center justify-between">
            {!ownCount
              ? <button type="button" onClick={() => { setAsking(false); onComment() }} className="text-[12.5px] text-dim hover:text-ink">Commenter la vidéo</button>
              : <span />}
            <button type="button" disabled={pending} onClick={sendRevisions}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-soon px-3 text-[13px] font-semibold text-black disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />} Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Workflow de l'étape côté admin : démarrer, envoyer en review, approuver, ré-ouvrir. */
function AdminWorkflow({ phaseId, status, hasVideo, onStatus }: {
  phaseId: string
  status: PhaseStatus
  hasVideo: boolean
  onStatus: (s: PhaseStatus) => void
}) {
  const [pending, startTransition] = useTransition()
  function run(fn: () => Promise<{ success: boolean; error?: string }>, next: PhaseStatus, msg: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.success) { toast.success(msg); onStatus(next) } else toast.error(res.error ?? 'Erreur')
    })
  }
  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors disabled:opacity-40'
  return (
    <div className="flex items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-faint" />}
      {status === 'pending' && (
        <button type="button" disabled={pending} onClick={() => run(() => startPhase(phaseId), 'in_progress', 'Étape démarrée')} className={`${btn} border border-line text-ink hover:bg-surface-2`}>
          <Play className="h-4 w-4" /> Démarrer
        </button>
      )}
      {status === 'in_progress' && (
        <button type="button" disabled={pending || !hasVideo} title={hasVideo ? undefined : 'Envoyez une vidéo d’abord'}
          onClick={() => run(() => sendToReview(phaseId), 'in_review', 'Envoyée en review')} className={`${btn} bg-ink text-[rgb(var(--c-surface))]`}>
          <SendHorizonal className="h-4 w-4" /> Envoyer en review
        </button>
      )}
      {status === 'in_review' && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => unapprovePhase(phaseId), 'in_progress', 'Étape ré-ouverte')} className={`${btn} border border-line text-ink hover:bg-surface-2`}>
            Ré-ouvrir
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => completePhase(phaseId), 'completed', 'Étape approuvée')} className={`${btn} bg-brand font-semibold text-[#020302]`}>
            <Check className="h-4 w-4" /> Approuver
          </button>
        </>
      )}
      {(status === 'completed' || status === 'approved') && (
        <button type="button" disabled={pending} onClick={() => run(() => unapprovePhase(phaseId), 'in_progress', 'Étape ré-ouverte')} className={`${btn} border border-line text-dim hover:text-ink`}>
          <Info className="h-4 w-4" /> Approuvée · ré-ouvrir
        </button>
      )}
    </div>
  )
}
