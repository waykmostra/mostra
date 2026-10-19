'use client'

import { useEffect, useRef, useState } from 'react'
import { updateBoardItem } from '@/app/projects/board-actions'
import { useBoard, useBoardAction } from './BoardContext'
import type { BoardItemView } from '@/lib/board'

/** Base de largeur d'un média : `content.w` va de 1 à 6 (2 par défaut = un tiers). */
const BASE = 6
const DEFAULT_W = 2
const GAP_PX = 12

/** Nombre de colonnes selon la largeur réelle de la section. */
function colsFor(width: number): number {
  if (width < 320) return 2
  if (width < 520) return 3
  if (width < 760) return 4
  return BASE
}

function widthOf(item: BoardItemView): number {
  const w = item.content.w
  return typeof w === 'number' && w >= 1 && w <= BASE ? w : DEFAULT_W
}

interface Props {
  items: BoardItemView[]
  renderItem: (item: BoardItemView) => React.ReactNode
}

/**
 * Grille des images et vidéos d'une section. Chaque média a une largeur
 * réglable (poignée en bas à droite, admin) ; la grille s'adapte à la largeur
 * de la section et se remplit sans trou (`dense`).
 */
export default function BoardMediaGrid({ items, renderItem }: Props) {
  const { editable } = useBoard()
  const { run } = useBoardAction()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [dragW, setDragW] = useState<Record<string, number>>({})

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = colsFor(width || 800)
  const spanOf = (w: number) => Math.min(cols, Math.max(1, Math.round((w * cols) / BASE)))

  function startResize(e: React.PointerEvent, item: BoardItemView, cell: HTMLElement | null) {
    if (!cell || !width) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startPx = cell.getBoundingClientRect().width
    const unit = (width + GAP_PX) / BASE
    let current = widthOf(item)

    const onMove = (ev: PointerEvent) => {
      current = Math.min(BASE, Math.max(1, Math.round((startPx + GAP_PX + ev.clientX - startX) / unit)))
      setDragW((d) => ({ ...d, [item.id]: current }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const clear = () =>
        setDragW((d) => {
          const nextD = { ...d }
          delete nextD[item.id]
          return nextD
        })
      if (current === widthOf(item)) return clear()
      void run(() => updateBoardItem(item.id, { w: current })).then(clear)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      className="grid items-start"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoFlow: 'row dense', gap: GAP_PX }}
    >
      {items.map((item) => (
        <MediaCell
          key={item.id}
          span={spanOf(dragW[item.id] ?? widthOf(item))}
          resizable={editable}
          onResizeStart={(e, cell) => startResize(e, item, cell)}
        >
          {renderItem(item)}
        </MediaCell>
      ))}
    </div>
  )
}

function MediaCell({
  span,
  resizable,
  onResizeStart,
  children,
}: {
  span: number
  resizable: boolean
  onResizeStart: (e: React.PointerEvent, cell: HTMLElement | null) => void
  children: React.ReactNode
}) {
  const cellRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={cellRef} className="group/cell relative min-w-0" style={{ gridColumn: `span ${span} / span ${span}` }}>
      {children}
      {resizable && (
        <div
          role="separator"
          aria-orientation="vertical"
          title="Glisser pour changer la taille"
          onPointerDown={(e) => onResizeStart(e, cellRef.current)}
          className="absolute -right-1.5 bottom-6 top-6 z-10 hidden w-3 cursor-ew-resize items-center justify-center group-hover/cell:flex"
        >
          <span className="h-10 w-1 rounded-full bg-brand shadow-sm" />
        </div>
      )}
    </div>
  )
}
