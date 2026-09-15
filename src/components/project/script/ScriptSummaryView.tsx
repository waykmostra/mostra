'use client'

import { useRef, useState } from 'react'
import { AlignLeft, Plus, Trash2, Wind } from 'lucide-react'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import type { ScriptColumn, ScriptCategory, ScriptBeat } from '@/lib/types'
import {
  tableWordCount,
  categoryWordCount,
  tagInfo,
  categoryColor,
  makeBeat,
  hasAnyContent,
  type EditorRow,
} from '@/lib/scriptTable'

interface ScriptSummaryViewProps {
  columns: ScriptColumn[]
  categories: ScriptCategory[]
  rows: EditorRow[]
  beats: ScriptBeat[]
  /** Fourni => beats éditables (admin). Absent => lecture seule (client). */
  onBeatsChange?: (beats: ScriptBeat[]) => void
  /** Déclencheur de commentaires d'une ligne (icône hover desktop / swipe mobile). */
  renderRowComment?: (row: EditorRow) => React.ReactNode
  /** Vrai si la ligne a déjà des commentaires → indicateur affiché en permanence. */
  rowHasComments?: (row: EditorRow) => boolean
}

const REVEAL = 48 // largeur révélée au swipe (mobile)

/**
 * Une ligne du résumé, commentable :
 *  - si la ligne a déjà des commentaires → indicateur affiché en permanence à droite ;
 *  - sinon (affordance « ajouter ») : desktop = icône au survol ; mobile = swipe à droite.
 */
function SummaryRow({
  comment,
  hasComments = false,
  children,
}: {
  comment?: React.ReactNode
  hasComments?: boolean
  children: React.ReactNode
}) {
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(false)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const horiz = useRef(false)

  if (!comment) {
    return <div className="text-[14px] leading-relaxed">{children}</div>
  }

  // Ligne déjà commentée → indicateur permanent (visible sans survol ni swipe).
  if (hasComments) {
    return (
      <div className="relative">
        <div className="text-[14px] leading-relaxed pr-9">{children}</div>
        <div className="absolute right-0 top-0 flex items-start pt-0.5">{comment}</div>
      </div>
    )
  }

  return (
    <div className="relative group/srow">
      {/* slot gauche — mobile, révélé au swipe */}
      <div
        className="md:hidden absolute left-0 top-0 flex items-start pt-0.5"
        style={{ width: REVEAL, opacity: offset > 4 ? 1 : 0, pointerEvents: offset > 4 ? 'auto' : 'none' }}
      >
        {comment}
      </div>

      {/* contenu (translaté au swipe) */}
      <div
        style={{
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: start.current ? 'none' : 'transform .18s ease',
        }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          start.current = { x: t.clientX, y: t.clientY, base: open ? REVEAL : 0 }
          horiz.current = false
        }}
        onTouchMove={(e) => {
          if (!start.current) return
          const t = e.touches[0]
          const dx = t.clientX - start.current.x
          const dy = t.clientY - start.current.y
          if (!horiz.current) {
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) horiz.current = true
            else if (Math.abs(dy) > 8) {
              start.current = null
              return
            }
          }
          if (horiz.current) {
            const o = Math.max(0, Math.min(REVEAL, start.current.base + dx))
            setOffset(o)
          }
        }}
        onTouchEnd={() => {
          if (!start.current) return
          const opened = offset > REVEAL / 2
          setOpen(opened)
          setOffset(opened ? REVEAL : 0)
          start.current = null
        }}
      >
        <div className="text-[14px] leading-relaxed pr-7 md:pr-9">{children}</div>
      </div>

      {/* slot droite — desktop, au survol */}
      <div className="hidden md:flex absolute right-0 top-0 items-start pt-0.5 opacity-0 group-hover/srow:opacity-100 transition-opacity">
        {comment}
      </div>
    </div>
  )
}

/**
 * Relecture du script : groupé par catégorie, la narration (voix off) en avant,
 * les autres colonnes en annotations discrètes. Le total compte UNIQUEMENT les
 * colonnes Narration. Héberge aussi les repères de « Rythme & intentions ».
 */
export default function ScriptSummaryView({
  columns,
  categories,
  rows,
  beats,
  onBeatsChange,
  renderRowComment,
  rowHasComments,
}: ScriptSummaryViewProps) {
  const total = tableWordCount(columns, rows)
  const editable = !!onBeatsChange

  const voCols = columns.filter((c) => c.tag === 'voixoff' && !c.collapsed)
  const otherCols = columns.filter((c) => c.tag !== 'voixoff' && !c.collapsed)

  const addBeat = () => onBeatsChange?.([...(beats || []), makeBeat()])
  const updateBeat = (id: string, patch: Partial<ScriptBeat>) =>
    onBeatsChange?.(beats.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const removeBeat = (id: string) => onBeatsChange?.(beats.filter((b) => b.id !== id))

  const filled = hasAnyContent(rows)

  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
        <AlignLeft className="w-4 h-4 text-brand" />
        <span className="text-[13px] font-semibold text-ink">Résumé du script</span>
        <span
          className="ml-auto text-[11px] font-mono text-dim bg-surface-2 px-2 py-0.5 rounded-full"
          title="Mots de narration"
        >
          {total} mot{total > 1 ? 's' : ''}
        </span>
        <span className="text-[10px] text-faint hidden sm:inline">~{Math.round(total / 130)} min</span>
      </div>

      <div className="px-3 sm:px-5 pb-5 pt-4">
        {/* Rythme & intentions — non compté */}
        {(editable || (beats && beats.length > 0)) && (
          <div className="mb-4 rounded-xl border border-dashed border-line p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-3.5 h-3.5 text-faint" />
              <span className="text-[11px] uppercase tracking-widest text-faint">
                Rythme &amp; intentions
              </span>
              <span className="text-[10px] text-faint hidden sm:inline">(non compté)</span>
              {editable && (
                <button
                  type="button"
                  onClick={addBeat}
                  className="ml-auto h-6 w-6 grid place-items-center rounded text-faint hover:text-ink hover:bg-surface-2"
                  title="Ajouter un repère de rythme"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            {(beats || []).length === 0 ? (
              <p className="text-[12px] text-faint">
                Ajoute des repères (Intention, Ambiance, Tempo…) pour donner le rythme de la vidéo.
              </p>
            ) : (
              <div className="space-y-2">
                {beats.map((b) =>
                  editable ? (
                    <div key={b.id} className="group flex items-start gap-2">
                      <input
                        value={b.title}
                        onChange={(e) => updateBeat(b.id, { title: e.target.value })}
                        placeholder="Titre"
                        className="w-20 sm:w-28 shrink-0 bg-surface-2 border border-line rounded-md px-2 py-1 text-[12px] font-semibold text-ink outline-none focus:border-brand"
                      />
                      <AutoGrowTextarea
                        value={b.note}
                        onChange={(e) => updateBeat(b.id, { note: e.target.value })}
                        placeholder="Note de rythme…"
                        minRows={1}
                        className="flex-1 min-w-0 bg-surface-2 border border-line rounded-md px-2 py-1 text-[13px] text-ink outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => removeBeat(b.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 grid place-items-center rounded text-faint hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div key={b.id} className="flex items-start gap-2 text-[13px]">
                      <span className="w-20 sm:w-28 shrink-0 text-[12px] font-semibold text-dim">{b.title}</span>
                      <span className="flex-1 min-w-0 text-dim whitespace-pre-wrap">{b.note}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {!filled ? (
          <p className="text-faint text-[13px] py-2">
            Le résumé apparaîtra ici à mesure que tu remplis le tableau.
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((cat, ci) => {
              const catRows = rows.filter((r) => r.categoryId === cat.id)
              const any = catRows.some((r) => Object.values(r.cells || {}).some((v) => (v || '').trim()))
              if (!any) return null
              const color = cat.color || categoryColor(ci)
              const words = categoryWordCount(columns, rows, cat.id)
              return (
                <div key={cat.id} className="flex gap-2 sm:gap-3">
                  <div className="w-16 sm:w-24 shrink-0 text-right pt-0.5">
                    <div
                      className="font-bold text-[11px] sm:text-[12px] uppercase tracking-widest break-words leading-tight"
                      style={{ color }}
                    >
                      {cat.name || 'Catégorie'}
                    </div>
                    <div className="text-[10px] text-faint font-mono mt-0.5">
                      {words} mot{words > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="w-[3px] rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0 space-y-2">
                    {catRows.map((row) => {
                      const vo = voCols.map((c) => (row.cells?.[c.id] || '').trim()).filter(Boolean)
                      const others = otherCols
                        .map((c) => ({ c, val: (row.cells?.[c.id] || '').trim() }))
                        .filter((x) => x.val)
                      if (!vo.length && !others.length) return null
                      const body = (
                        <>
                          {vo.map((v, i) => (
                            <p key={i} className="text-ink whitespace-pre-wrap">
                              {v}
                            </p>
                          ))}
                          {others.map(({ c, val }) => {
                            const t = tagInfo(c.tag)
                            return (
                              <p key={c.id} className="text-[12px] text-dim">
                                <span className="mr-1.5 font-medium" style={{ color: t.color }}>
                                  {c.title || t.label} :
                                </span>
                                {val}
                              </p>
                            )
                          })}
                        </>
                      )
                      return (
                        <SummaryRow
                          key={row._key}
                          comment={renderRowComment?.(row)}
                          hasComments={rowHasComments?.(row) ?? false}
                        >
                          {body}
                        </SummaryRow>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
