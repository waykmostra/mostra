'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface Props {
  src: string
  fileName?: string
  autoPlay?: boolean
  /** Hauteur max de l'image vidéo (la visionneuse limite à l'écran). */
  maxHeight?: string
}

/**
 * Lecteur vidéo du Cadrage, dans le style de la revue vidéo de l'app : image
 * sur fond noir, bouton lecture au centre, contrôles sous la vidéo.
 */
export default function BoardVideoPlayer({ src, fileName, autoPlay = false, maxHeight }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setTime(v.currentTime)
    const onMeta = () => setDuration(v.duration)
    // L'autoplay a pu démarrer avant l'abonnement aux événements.
    setPlaying(!v.paused)
    if (v.readyState >= 1) setDuration(v.duration)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
    }
  }, [])

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  function toggle() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  function seek(ratio: number) {
    const v = videoRef.current
    if (!v || !duration) return
    v.currentTime = Math.min(duration, Math.max(0, ratio * duration))
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void wrapRef.current?.requestFullscreen()
  }

  return (
    <div ref={wrapRef} className="overflow-hidden rounded-xl bg-black">
      <div className="relative flex items-center justify-center bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          autoPlay={autoPlay}
          muted={muted}
          playsInline
          preload="metadata"
          onClick={toggle}
          onError={() => setError(true)}
          className="w-full object-contain"
          style={{ maxHeight: fullscreen ? '100vh' : maxHeight, aspectRatio: duration ? undefined : '16 / 9' }}
        />

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
            <AlertCircle className="h-7 w-7 text-soon" />
            <p className="text-[13px] font-medium text-white">Lecture impossible sur cet appareil</p>
            <a
              href={src}
              download={fileName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-black"
            >
              <Download className="h-3.5 w-3.5" /> Télécharger
            </a>
          </div>
        ) : (
          !playing && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Lire"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="rounded-full bg-black/55 p-4 transition-transform hover:scale-105">
                <Play className="h-7 w-7 fill-white text-white" />
              </span>
            </button>
          )
        )}
      </div>

      {!error && (
        <div className="flex items-center gap-3 bg-chrome-2 px-3 py-2 text-chrome-text">
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Lire'} className="text-chrome-text hover:opacity-80">
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <span className="tnum font-mono text-[11.5px] text-chrome-dim">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <div
            role="slider"
            aria-label="Position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
            tabIndex={0}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              seek((e.clientX - rect.left) / rect.width)
            }}
            className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/15"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-brand"
              style={{ width: duration ? `${(time / duration) * 100}%` : 0 }}
            />
          </div>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Activer le son' : 'Couper le son'} className="text-chrome-dim hover:text-chrome-text">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label="Plein écran" className="text-chrome-dim hover:text-chrome-text">
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
