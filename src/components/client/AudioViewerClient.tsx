'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  LogIn,
  MessageSquare,
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  Send,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import {
  fetchAudioData,
  selectAudioTrack,
  addAudioComment,
  resolveAudioComment,
  approveAudioSubPhase,
  requestAudioRevisions,
} from '@/app/client/audio-actions'
import type { AudioTrackContent, PhaseStatus } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

// ── Types ─────────────────────────────────────────────────────────

interface AudioTrack {
  id: string
  content: AudioTrackContent
  sort_order: number
}

interface AudioViewerClientProps {
  token: string
  subPhaseId: string
  phaseId: string
  status: PhaseStatus
  clientId: string | null
  kind: 'vo' | 'music'
  initialTracks: AudioTrack[]
  initialComments: BlockComment[]
  isAuthenticated: boolean
}

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
      document.querySelectorAll<HTMLAudioElement>('audio').forEach((a) => {
        if (a !== el) a.pause()
      })
      el.play().catch(() => {})
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
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

      <button
        type="button"
        onClick={toggle}
        disabled={!src || buffering}
        className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#888888] hover:text-white hover:border-[#444444] transition-colors disabled:opacity-30 flex-shrink-0"
      >
        {buffering
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : playing
            ? <Pause className="h-3.5 w-3.5" />
            : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      <div className="flex-1 relative h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          const newTime = ratio * duration
          if (audioRef.current) audioRef.current.currentTime = newTime
          setCurrentTime(newTime)
        }}
      >
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => {
            const t = Number(e.target.value)
            if (audioRef.current) audioRef.current.currentTime = t
            setCurrentTime(t)
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="h-full bg-[#00D76B] rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-[10px] text-[#555555] tabular-nums whitespace-nowrap flex-shrink-0">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
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
  const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={`flex gap-2 transition-opacity ${comment.is_resolved ? 'opacity-40' : ''}`}>
      <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[8px] text-[#666666] font-medium">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[10px] font-medium text-white">{authorName}</span>
          <span className="text-[9px] text-[#444444]">{formatRelative(comment.created_at)}</span>
          {comment.is_resolved && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-[#00D76B] bg-[#00D76B]/10 px-1 py-0.5 rounded-full border border-[#00D76B]/20">
              <CheckCircle className="h-2 w-2" />Résolu
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#999999] leading-relaxed">{comment.content}</p>
      </div>
      {canResolve && !comment.is_resolved && (
        <button
          type="button"
          onClick={() => onResolve(comment.id)}
          className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-0.5"
        >
          <CheckCircle className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── BlockComments ─────────────────────────────────────────────────

function BlockComments({
  blockId,
  comments,
  clientId,
  canComment,
  onAdd,
  onResolve,
}: {
  blockId: string
  comments: BlockComment[]
  clientId: string | null
  canComment: boolean
  onAdd: (blockId: string, content: string) => Promise<void>
  onResolve: (commentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const blockComments = comments.filter((c) => c.block_id === blockId)
  const unresolvedCount = blockComments.filter((c) => !c.is_resolved).length

  async function handleSubmit() {
    if (!text.trim()) return
    setSending(true)
    await onAdd(blockId, text.trim())
    setText('')
    setOpen(false)
    setSending(false)
  }

  return (
    <div className="px-3 pb-3 pt-2.5 border-t border-[#1e1e1e] space-y-2.5">
      {blockComments.length > 0 && (
        <div className="space-y-2">
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

      {!canComment ? (
        blockComments.length > 0 ? (
          <p className="text-[10px] text-[#444444]">
            {blockComments.length} commentaire{blockComments.length > 1 ? 's' : ''}
          </p>
        ) : null
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[10px] text-[#444444] hover:text-[#888888] transition-colors group"
        >
          <MessageSquare className="h-3 w-3 group-hover:text-[#00D76B] transition-colors" />
          {blockComments.length === 0
            ? 'Commenter cette piste'
            : `${unresolvedCount > 0 ? `${unresolvedCount} non résolu${unresolvedCount > 1 ? 's' : ''}` : `${blockComments.length} commentaire${blockComments.length > 1 ? 's' : ''}`}`}
        </button>
      ) : (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="Votre retour sur cette piste… (Ctrl+Entrée)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[10px] font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setText('') }}
              className="text-[10px] text-[#444444] hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AudioViewerClient ─────────────────────────────────────────────

export default function AudioViewerClient({
  token,
  subPhaseId,
  phaseId: _phaseId,
  status,
  clientId,
  kind,
  initialTracks,
  initialComments,
  isAuthenticated,
}: AudioViewerClientProps) {
  const [tracks, setTracks] = useState<AudioTrack[]>(initialTracks)
  const [comments, setComments] = useState<BlockComment[]>(initialComments)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(status === 'completed' || status === 'approved')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionText, setRevisionText] = useState('')
  const [requestingRevision, setRequestingRevision] = useState(false)

  const isApproved = approved || status === 'completed' || status === 'approved'
  const canInteract = status === 'in_review' && !isApproved && isAuthenticated
  const hasSelection = tracks.some((t) => t.content.is_selected)

  const kindLabel = kind === 'vo' ? 'Voix Off' : 'Musique'
  const KindIcon = kind === 'vo' ? Mic : Music

  // Poll every 10s
  const refresh = useCallback(async () => {
    const data = await fetchAudioData(token, subPhaseId)
    setTracks(data.tracks)
    setComments(data.comments)
  }, [token, subPhaseId])

  useEffect(() => {
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  // ── Track selection ───────────────────────────────────────────

  async function handleSelect(trackId: string) {
    if (!canInteract) return
    setSelectingId(trackId)
    // Optimistic: toggle selection locally
    const track = tracks.find((t) => t.id === trackId)
    if (!track) { setSelectingId(null); return }

    const willSelect = !track.content.is_selected
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        content: {
          ...t.content,
          is_selected: willSelect && t.id === trackId,
        },
      })),
    )

    const result = await selectAudioTrack(token, trackId)
    setSelectingId(null)
    if (!result.success) {
      toast.error((result as { error: string }).error)
      // Revert on error
      await refresh()
    }
  }

  // ── Comments ──────────────────────────────────────────────────

  async function handleAddComment(blockId: string, content: string) {
    const result = await addAudioComment(token, blockId, content)
    if (!result.success) toast.error((result as { error: string }).error)
    else await refresh()
  }

  async function handleResolve(commentId: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
    )
    const result = await resolveAudioComment(token, commentId)
    if (!result.success) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)),
      )
      toast.error((result as { error: string }).error)
    }
  }

  // ── Approve ───────────────────────────────────────────────────

  async function handleApprove() {
    if (!hasSelection) {
      toast.error('Sélectionnez une piste avant de valider')
      return
    }
    setApproving(true)
    const result = await approveAudioSubPhase(token, subPhaseId)
    setApproving(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success('Piste validée — merci !')
      setApproved(true)
    }
  }

  async function handleRequestRevision() {
    if (!revisionText.trim()) {
      toast.error('Précisez les modifications souhaitées')
      return
    }
    setRequestingRevision(true)
    const result = await requestAudioRevisions(token, subPhaseId, revisionText)
    setRequestingRevision(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success("Demande envoyée à l'équipe")
      setShowRevisionForm(false)
      setRevisionText('')
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Approved banner ── */}
      {isApproved && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#00D76B]/10 border border-[#00D76B]/20">
          <CheckCircle className="h-4 w-4 text-[#00D76B] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#00D76B]">{kindLabel} validée</p>
            {tracks.find((t) => t.content.is_selected) && (
              <p className="text-[11px] text-[#00D76B]/60">
                Piste sélectionnée : {tracks.find((t) => t.content.is_selected)?.content.title}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Auth gate (anonymous viewer) ── */}
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
              <p className="text-sm font-semibold text-white">Choisissez votre {kindLabel.toLowerCase()}</p>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Écoutez les propositions ci-dessous, sélectionnez celle que vous préférez, puis validez votre choix.
              </p>
            </div>
          </div>

          {!showRevisionForm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !hasSelection}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/25 text-[#00D76B] text-sm font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Valider ma sélection
              </button>
              {!hasSelection && (
                <p className="text-xs text-[#555555]">← Sélectionnez d&apos;abord une piste</p>
              )}
              <button
                type="button"
                onClick={() => setShowRevisionForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2a2a] text-[#888888] text-sm hover:text-white hover:border-[#444444] transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Demander d&apos;autres propositions
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#666666]">Décrivez ce que vous souhaitez comme ajustements.</p>
              <textarea
                autoFocus
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                placeholder="Ex: Le tempo de la piste 2 est trop rapide, et la voix de la piste 1 manque de chaleur…"
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
                  {requestingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRevisionForm(false); setRevisionText('') }}
                  className="text-xs text-[#444444] hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Track list ── */}
      {tracks.length > 0 ? (
        <div className="space-y-3">
          {tracks.map((track) => {
            const isSelected = track.content.is_selected
            const isSelecting = selectingId === track.id

            return (
              <div
                key={track.id}
                className={`bg-[#111111] border rounded-xl overflow-hidden transition-all duration-200 ${
                  isSelected
                    ? 'border-[#00D76B]/30 shadow-md shadow-[#00D76B]/5'
                    : 'border-[#1e1e1e] hover:border-[#2a2a2a]'
                }`}
              >
                {/* Track header */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#1a1a1a]">
                  {/* Kind icon */}
                  <div className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${
                    kind === 'vo'
                      ? 'bg-[#3B82F6]/10 border border-[#3B82F6]/20'
                      : 'bg-[#A259FF]/10 border border-[#A259FF]/20'
                  }`}>
                    <KindIcon className={`h-3.5 w-3.5 ${kind === 'vo' ? 'text-[#3B82F6]' : 'text-[#A259FF]'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{track.content.title}</p>
                    {track.content.description && (
                      <p className="text-[10px] text-[#555555] truncate mt-0.5">{track.content.description}</p>
                    )}
                  </div>

                  {/* Selected badge */}
                  {isSelected && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[10px] font-medium flex-shrink-0">
                      <CheckCircle className="h-2.5 w-2.5" />
                      Sélectionné
                    </div>
                  )}

                  {/* Select button */}
                  {canInteract && (
                    <button
                      type="button"
                      onClick={() => handleSelect(track.id)}
                      disabled={!!selectingId}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40 flex-shrink-0 ${
                        isSelected
                          ? 'bg-[#00D76B]/10 border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444]'
                      }`}
                    >
                      {isSelecting
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : isSelected
                          ? <CheckCircle className="h-3 w-3" />
                          : <Play className="h-3 w-3" />}
                      {isSelected ? 'Sélectionné' : 'Choisir'}
                    </button>
                  )}
                </div>

                {/* Player */}
                <div className="px-3 py-2.5">
                  <AudioPlayer src={track.content.audio_url} trackId={track.id} />
                </div>

                {/* Comments */}
                <BlockComments
                  blockId={track.id}
                  comments={comments}
                  clientId={clientId}
                  canComment={isAuthenticated}
                  onAdd={handleAddComment}
                  onResolve={handleResolve}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center">
            <KindIcon className="h-7 w-7 text-[#333333]" />
          </div>
          <p className="text-sm text-[#555555]">Aucune piste disponible pour le moment</p>
        </div>
      )}

    </div>
  )
}
