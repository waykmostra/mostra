'use client'

import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, LayoutGrid, Minus, Plus, Trash2 } from 'lucide-react'
import {
  addBoardColumn,
  addBoardSection,
  deleteBoardColumn,
  reorderBoardColumns,
  seedBoardTemplate,
  setBoardColumnWidths,
  updateBoardColumnWidth,
} from '@/app/projects/board-actions'
import BoardSectionCard, { SECTION_META } from './BoardSectionCard'
import { ToolButton } from './BoardItemCard'
import { useBoard, useBoardAction } from './BoardContext'
import type { BoardColumnView } from '@/lib/board'
import type { BoardSectionType } from '@/lib/types'

const GAP_PX = 16

/**
 * La grille « bento » du Cadrage : des colonnes côte à côte qui se partagent
 * toute la largeur, des sections empilées dans chaque colonne. Les largeurs
 * sont des proportions : réduire une colonne élargit les autres, sans trou.
 * Sous `lg`, tout s'empile en une colonne.
 */
export default function BoardGrid({ columns }: { columns: BoardColumnView[] }) {
  const { editable, projectId } = useBoard()
  const { run, isPending } = useBoardAction()
  const gridRef = useRef<HTMLDivElement>(null)
  // Largeurs pendant un redimensionnement (aperçu local avant enregistrement).
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({})

  const widthOf = (c: BoardColumnView) => dragWidths[c.id] ?? c.width
  const total = columns.reduce((sum, c) => sum + widthOf(c), 0)

  if (columns.length === 0) {
    if (!editable) {
      return (
        <div className="surface px-6 py-12 text-center">
          <p className="text-[14px] text-dim">Le cadrage du projet sera bientôt prêt.</p>
        </div>
      )
    }
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-12 text-center">
        <LayoutGrid className="h-8 w-8 text-faint" strokeWidth={1.5} />
        <div>
          <p className="text-[15px] font-medium text-ink">Cadrage vide</p>
          <p className="mt-1 max-w-[48ch] text-[13px] text-dim">
            Pose une première mise en page (objectif, références, décisions, documents) ou pars d’une colonne vide.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={isPending} onClick={() => void run(() => seedBoardTemplate(projectId))} className="btn-brand">
            Démarrer avec le modèle
          </button>
          <button type="button" disabled={isPending} onClick={() => void run(() => addBoardColumn(projectId, 12))} className="btn-secondary">
            Colonne vide
          </button>
        </div>
      </div>
    )
  }

  /** Déplace la frontière entre la colonne `idx` et sa voisine de droite. */
  function startResize(e: React.PointerEvent, idx: number) {
    const grid = gridRef.current
    const left = columns[idx]
    const right = columns[idx + 1]
    if (!grid || !left || !right) return
    e.preventDefault()
    const free = grid.getBoundingClientRect().width - GAP_PX * (columns.length - 1)
    const unit = free / total
    const startX = e.clientX
    const pair = left.width + right.width
    let nextLeft = left.width

    const onMove = (ev: PointerEvent) => {
      nextLeft = Math.min(pair - 1, Math.max(1, left.width + Math.round((ev.clientX - startX) / unit)))
      setDragWidths({ [left.id]: nextLeft, [right.id]: pair - nextLeft })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (nextLeft === left.width) return setDragWidths({})
      void run(() =>
        setBoardColumnWidths(projectId, [
          { id: left.id, width: nextLeft },
          { id: right.id, width: pair - nextLeft },
        ]),
      ).then(() => setDragWidths({}))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function moveColumn(idx: number, delta: number) {
    const ids = columns.map((c) => c.id)
    const [moved] = ids.splice(idx, 1)
    ids.splice(idx + delta, 0, moved)
    void run(() => reorderBoardColumns(projectId, ids))
  }

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex items-center justify-between gap-3">
          <p className="mono-label text-faint">
            {columns.length} colonne{columns.length > 1 ? 's' : ''} · glisser une frontière pour répartir la largeur
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void run(() => addBoardColumn(projectId, 4))}
            className="btn-ghost min-h-[32px] text-[12.5px]"
          >
            <Plus className="h-3.5 w-3.5" /> Colonne
          </button>
        </div>
      )}

      <div ref={gridRef} className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {columns.map((column, idx) => {
          const width = widthOf(column)
          const percent = Math.round((width / total) * 100)
          const prev = columns[idx - 1]
          const next = columns[idx + 1]
          const sectionIds = column.sections.map((s) => s.id)

          return (
            <div
              key={column.id}
              style={{ '--w': width } as React.CSSProperties}
              className="relative min-w-0 space-y-4 lg:[flex:var(--w)_1_0%]"
            >
              {editable && (
                <div className="flex items-center gap-0.5 rounded-md border border-dashed border-line px-1 py-0.5">
                  <ToolButton label="Réduire (les autres colonnes s’élargissent)" onClick={() => void run(() => updateBoardColumnWidth(column.id, width - 1))} disabled={isPending || width <= 1}>
                    <Minus className="h-3.5 w-3.5" />
                  </ToolButton>
                  <span className="mono-label tnum px-1 text-faint">{percent}%</span>
                  <ToolButton label="Élargir" onClick={() => void run(() => updateBoardColumnWidth(column.id, width + 1))} disabled={isPending || width >= 12}>
                    <Plus className="h-3.5 w-3.5" />
                  </ToolButton>
                  <span className="flex-1" />
                  {prev && (
                    <ToolButton label="Déplacer à gauche" onClick={() => moveColumn(idx, -1)} disabled={isPending}>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </ToolButton>
                  )}
                  {next && (
                    <ToolButton label="Déplacer à droite" onClick={() => moveColumn(idx, 1)} disabled={isPending}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </ToolButton>
                  )}
                  <DeleteColumn columnId={column.id} hasSections={column.sections.length > 0} />
                </div>
              )}

              {column.sections.map((section) => (
                <BoardSectionCard
                  key={section.id}
                  section={section}
                  columnId={column.id}
                  columnSectionIds={sectionIds}
                  prevColumn={prev ? { id: prev.id, sectionIds: prev.sections.map((s) => s.id) } : null}
                  nextColumn={next ? { id: next.id, sectionIds: next.sections.map((s) => s.id) } : null}
                />
              ))}

              {editable && <AddSection columnId={column.id} />}

              {/* Frontière avec la colonne de droite : la glisser répartit la largeur entre les deux. */}
              {editable && next && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Glisser pour répartir la largeur entre ces deux colonnes"
                  onPointerDown={(e) => startResize(e, idx)}
                  className="group/handle absolute -right-[10px] top-0 hidden h-full w-[8px] cursor-ew-resize justify-center lg:flex"
                >
                  <span className="h-full w-px bg-transparent transition-colors group-hover/handle:bg-brand" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AddSection({ columnId }: { columnId: string }) {
  const { run, isPending } = useBoardAction()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-3 text-[12.5px] text-faint transition-colors hover:border-line-strong hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" /> Section
      </button>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-dashed border-line p-1.5">
      {(Object.keys(SECTION_META) as BoardSectionType[]).map((type) => {
        const { label, icon: Icon } = SECTION_META[type]
        return (
          <button
            key={type}
            type="button"
            disabled={isPending}
            onClick={() => void run(() => addBoardSection(columnId, type)).then((ok) => ok && setOpen(false))}
            className="flex flex-col items-center gap-1 rounded-md bg-surface-2 px-2 py-2.5 text-[12px] text-dim transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function DeleteColumn({ columnId, hasSections }: { columnId: string; hasSections: boolean }) {
  const { run, isPending } = useBoardAction()
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1 px-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => void run(() => deleteBoardColumn(columnId), hasSections ? 'Colonne supprimée, contenu renvoyé dans « À trier »' : undefined)}
          className="text-[11px] font-medium text-late hover:opacity-80"
        >
          Supprimer
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="text-[11px] text-dim hover:text-ink">
          Non
        </button>
      </span>
    )
  }
  return (
    <ToolButton label="Supprimer la colonne" onClick={() => setConfirm(true)} disabled={isPending}>
      <Trash2 className="h-3.5 w-3.5" />
    </ToolButton>
  )
}
