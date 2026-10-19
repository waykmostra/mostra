'use client'

import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, LayoutGrid, Minus, Plus, Trash2 } from 'lucide-react'
import {
  addBoardColumn,
  addBoardSection,
  deleteBoardColumn,
  reorderBoardColumns,
  seedBoardTemplate,
  updateBoardColumnWidth,
} from '@/app/projects/board-actions'
import BoardSectionCard, { SECTION_META } from './BoardSectionCard'
import { ToolButton } from './BoardItemCard'
import { useBoard, useBoardAction } from './BoardContext'
import type { BoardColumnView } from '@/lib/board'
import type { BoardSectionType } from '@/lib/types'

const GAP_PX = 16

/**
 * La grille « bento » du Cadrage : des colonnes sur 12 (desktop), des sections
 * empilées dans chaque colonne. Sous `lg`, tout s'empile en une colonne.
 */
export default function BoardGrid({ columns }: { columns: BoardColumnView[] }) {
  const { editable, projectId } = useBoard()
  const { run, isPending } = useBoardAction()
  const gridRef = useRef<HTMLDivElement>(null)
  // Largeurs pendant un redimensionnement (aperçu local avant enregistrement).
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({})

  const used = columns.reduce((sum, c) => sum + (dragWidths[c.id] ?? c.width), 0)

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

  function startResize(e: React.PointerEvent, column: BoardColumnView) {
    const grid = gridRef.current
    if (!grid) return
    e.preventDefault()
    const unit = (grid.getBoundingClientRect().width + GAP_PX) / 12
    const startX = e.clientX
    const startW = column.width
    let current = startW

    const onMove = (ev: PointerEvent) => {
      current = Math.min(12, Math.max(1, startW + Math.round((ev.clientX - startX) / unit)))
      setDragWidths((w) => ({ ...w, [column.id]: current }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const done = () =>
        setDragWidths((w) => {
          const next = { ...w }
          delete next[column.id]
          return next
        })
      if (current === startW) return done()
      void run(() => updateBoardColumnWidth(column.id, current)).then(done)
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
          <p className={`mono-label tnum ${used > 12 ? 'text-soon' : 'text-faint'}`}>
            {used}/12 colonnes{used > 12 && ' — la grille passe à la ligne'}
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void run(() => addBoardColumn(projectId, Math.max(3, Math.min(6, 12 - used || 6))))}
            className="btn-ghost min-h-[32px] text-[12.5px]"
          >
            <Plus className="h-3.5 w-3.5" /> Colonne
          </button>
        </div>
      )}

      <div ref={gridRef} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {columns.map((column, idx) => {
          const width = dragWidths[column.id] ?? column.width
          const prev = columns[idx - 1]
          const next = columns[idx + 1]
          const sectionIds = column.sections.map((s) => s.id)

          return (
            <div
              key={column.id}
              style={{ '--span': width } as React.CSSProperties}
              className="relative min-w-0 space-y-4 lg:[grid-column:span_var(--span)/span_var(--span)]"
            >
              {editable && (
                <div className="flex items-center gap-0.5 rounded-md border border-dashed border-line px-1 py-0.5">
                  <ToolButton label="Réduire" onClick={() => void run(() => updateBoardColumnWidth(column.id, width - 1))} disabled={isPending || width <= 1}>
                    <Minus className="h-3.5 w-3.5" />
                  </ToolButton>
                  <span className="mono-label tnum px-1 text-faint">{width}/12</span>
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

              {/* Poignée de largeur : glisser le bord droit de la colonne. */}
              {editable && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Glisser pour régler la largeur"
                  onPointerDown={(e) => startResize(e, column)}
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
