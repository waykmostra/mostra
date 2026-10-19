'use client'

import { useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import BoardVideoPlayer from './BoardVideoPlayer'
import type { BoardItemView } from '@/lib/board'

interface Props {
  items: BoardItemView[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Visionneuse plein écran des images et vidéos d'une section, comme celle du
 * storyboard : flèches, compteur, légende. Clavier : ← → pour naviguer, Échap.
 */
export default function BoardMediaLightbox({ items, index, onIndex, onClose }: Props) {
  const current = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  const prev = useCallback(() => hasPrev && onIndex(index - 1), [hasPrev, index, onIndex])
  const next = useCallback(() => hasNext && onIndex(index + 1), [hasNext, index, onIndex])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, prev, next])

  if (!current || !current.url) return null
  const caption = str(current.content.caption)

  const navBtn =
    'absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-4 w-4" />
      </button>

      {items.length > 1 && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/10 bg-white/10 px-3 py-1">
          <span className="tnum text-[12px] font-medium text-white/70">
            {index + 1} / {items.length}
          </span>
        </div>
      )}

      {hasPrev && (
        <button type="button" aria-label="Précédent" onClick={(e) => { e.stopPropagation(); prev() }} className={`${navBtn} left-4`}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {hasNext && (
        <button type="button" aria-label="Suivant" onClick={(e) => { e.stopPropagation(); next() }} className={`${navBtn} right-4`}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div className="flex max-h-[90vh] w-[calc(100%-7rem)] max-w-5xl flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {current.kind === 'video' ? (
          <div key={current.id} className="w-full">
            <BoardVideoPlayer src={current.url} fileName={str(current.content.file_name)} autoPlay maxHeight="72vh" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={current.url}
            alt={caption || str(current.content.file_name)}
            className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl"
            draggable={false}
          />
        )}
        {caption && <p className="max-w-2xl px-4 text-center text-[14px] leading-relaxed text-white/75">{caption}</p>}
      </div>
    </div>
  )
}
