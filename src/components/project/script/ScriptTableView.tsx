'use client'

import { useState } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronsRightLeft,
  GripVertical,
} from 'lucide-react'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import type { ScriptColumn, ScriptCategory, ColumnTag } from '@/lib/types'
import {
  COLUMN_TAGS,
  tagInfo,
  makeColumn,
  makeCategory,
  makeRow,
  categoryColor,
  categoryWordCount,
  type EditorRow,
} from '@/lib/scriptTable'

const CAT_W = 140 // colonne catégorie (gauche)
const GRIP_W = 20 // poignée de drag par ligne
const ACT_W = 32 // bouton supprimer la ligne (admin)
const COM_W = 44 // gouttière commentaires (droite)
const MIN_COL = 130 // largeur mini d'une colonne avant scroll
const FOLD_W = 30 // largeur d'une colonne repliée

interface ScriptTableViewProps {
  columns: ScriptColumn[]
  categories: ScriptCategory[]
  rows: EditorRow[]
  readOnly?: boolean
  onColumns?: (cols: ScriptColumn[]) => void
  onRows?: (rows: EditorRow[]) => void
  onCategories?: (cats: ScriptCategory[]) => void
  /** Contenu de la gouttière commentaires pour une ligne (à droite). */
  renderRowComments?: (row: EditorRow) => React.ReactNode
}

export default function ScriptTableView({
  columns,
  categories,
  rows,
  readOnly = false,
  onColumns,
  onRows,
  onCategories,
  renderRowComments,
}: ScriptTableViewProps) {
  const [tagMenu, setTagMenu] = useState<string | null>(null)
  const [dragRow, setDragRow] = useState<string | null>(null)
  const [overRow, setOverRow] = useState<string | null>(null)
  const [dragCol, setDragCol] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [dragCat, setDragCat] = useState<string | null>(null)
  const [overCat, setOverCat] = useState<string | null>(null)

  const editable = !readOnly
  const showComments = !!renderRowComments

  const colStyle = (col: ScriptColumn): React.CSSProperties =>
    col.collapsed
      ? { flexGrow: 0, flexShrink: 0, flexBasis: `${FOLD_W}px`, width: FOLD_W }
      : col.width
        ? { flexGrow: 0, flexShrink: 0, flexBasis: `${col.width}px`, width: col.width }
        : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: MIN_COL }

  // ── Colonnes ──────────────────────────────────────────────────
  const setColTitle = (id: string, title: string) =>
    onColumns?.(columns.map((c) => (c.id === id ? { ...c, title } : c)))
  const setColTag = (id: string, tag: ColumnTag) => {
    onColumns?.(columns.map((c) => (c.id === id ? { ...c, tag } : c)))
    setTagMenu(null)
  }
  const toggleCollapse = (id: string) =>
    onColumns?.(columns.map((c) => (c.id === id ? { ...c, collapsed: !c.collapsed } : c)))
  const addColumn = () => onColumns?.([...columns, makeColumn('', 'texte')])
  const deleteColumn = (id: string) => {
    onColumns?.(columns.filter((c) => c.id !== id))
    onRows?.(
      rows.map((r) => {
        if (!r.cells || !(id in r.cells)) return r
        const cells = { ...r.cells }
        delete cells[id]
        return { ...r, cells }
      }),
    )
  }
  const reorderCol = (dragId: string, targetId: string) => {
    if (dragId === targetId) return
    const arr = [...columns]
    const di = arr.findIndex((c) => c.id === dragId)
    if (di === -1) return
    const [moved] = arr.splice(di, 1)
    const ti = arr.findIndex((c) => c.id === targetId)
    arr.splice(ti === -1 ? arr.length : ti, 0, moved)
    onColumns?.(arr)
  }
  const onResizeStart = (e: React.MouseEvent, col: ScriptColumn) => {
    e.preventDefault()
    e.stopPropagation()
    const cell = (e.currentTarget as HTMLElement).closest('[data-colhead]') as HTMLElement | null
    const startW = cell ? cell.offsetWidth : col.width || 200
    const startX = e.clientX
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(MIN_COL, Math.round(startW + (ev.clientX - startX)))
      onColumns?.(columns.map((c) => (c.id === col.id ? { ...c, width: w } : c)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Cellules ──────────────────────────────────────────────────
  const setCell = (rowId: string, colId: string, val: string) =>
    onRows?.(rows.map((r) => (r._key === rowId ? { ...r, cells: { ...r.cells, [colId]: val } } : r)))

  // ── Lignes ────────────────────────────────────────────────────
  const addRow = (categoryId: string) => {
    const next = [...rows]
    let idx = -1
    next.forEach((r, i) => {
      if (r.categoryId === categoryId) idx = i
    })
    const row = makeRow(categoryId)
    if (idx === -1) next.push(row)
    else next.splice(idx + 1, 0, row)
    onRows?.(next)
  }
  const deleteRow = (rowKey: string) => onRows?.(rows.filter((r) => r._key !== rowKey))
  const reorderRow = (dragKey: string, targetKey: string) => {
    if (dragKey === targetKey) return
    const arr = [...rows]
    const di = arr.findIndex((r) => r._key === dragKey)
    const ti0 = arr.findIndex((r) => r._key === targetKey)
    if (di === -1 || ti0 === -1) return
    const moved = { ...arr[di], categoryId: arr[ti0].categoryId }
    arr.splice(di, 1)
    const ti = arr.findIndex((r) => r._key === targetKey)
    arr.splice(ti, 0, moved)
    onRows?.(arr)
  }
  const dropRowInCategory = (dragKey: string, categoryId: string) => {
    const arr = [...rows]
    const di = arr.findIndex((r) => r._key === dragKey)
    if (di === -1) return
    const moved = { ...arr[di], categoryId }
    arr.splice(di, 1)
    let last = -1
    arr.forEach((r, i) => {
      if (r.categoryId === categoryId) last = i
    })
    arr.splice(last + 1, 0, moved)
    onRows?.(arr)
  }

  // ── Catégories ────────────────────────────────────────────────
  const renameCategory = (id: string, name: string) =>
    onCategories?.(categories.map((c) => (c.id === id ? { ...c, name } : c)))
  const addCategory = () => {
    const cat = makeCategory(`Catégorie ${categories.length + 1}`, categoryColor(categories.length))
    onCategories?.([...categories, cat])
    onRows?.([...rows, makeRow(cat.id)])
  }
  const deleteCategory = (id: string) => {
    if (categories.length <= 1) return
    const idx = categories.findIndex((c) => c.id === id)
    const neighbour = categories[idx - 1] || categories[idx + 1]
    onRows?.(rows.map((r) => (r.categoryId === id ? { ...r, categoryId: neighbour.id } : r)))
    onCategories?.(categories.filter((c) => c.id !== id))
  }
  const reorderCat = (dragId: string, targetId: string) => {
    if (dragId === targetId) return
    const arr = [...categories]
    const di = arr.findIndex((c) => c.id === dragId)
    if (di === -1) return
    const [moved] = arr.splice(di, 1)
    const ti = arr.findIndex((c) => c.id === targetId)
    arr.splice(ti === -1 ? arr.length : ti, 0, moved)
    onCategories?.(arr)
  }

  const colWidth = (c: ScriptColumn) => (c.collapsed ? FOLD_W : c.width || MIN_COL)
  const gridMinWidth =
    CAT_W + GRIP_W + columns.reduce((s, c) => s + colWidth(c), 0) + (editable ? ACT_W : 0) + (showComments ? COM_W : 0)

  const visibleCols = columns.filter((c) => !c.collapsed)

  return (
    <>
      {/* ════════ Desktop : tableau ════════ */}
      <div className="hidden md:block overflow-x-auto pb-2">
      <div
        className="border border-[#2a2a2a] rounded-2xl overflow-hidden bg-[#111111]"
        style={{ minWidth: gridMinWidth }}
      >
        {/* ── En-tête ── */}
        <div className="flex items-stretch border-b-2 border-[#2a2a2a] bg-[#161616]">
          <div style={{ width: CAT_W }} className="shrink-0" />
          <div style={{ width: GRIP_W }} className="shrink-0" />
          {columns.map((col) => {
            const t = tagInfo(col.tag)
            if (col.collapsed) {
              return (
                <div
                  key={col.id}
                  onClick={() => toggleCollapse(col.id)}
                  draggable={editable}
                  onDragStart={(e) => {
                    if (!editable) return
                    e.dataTransfer.effectAllowed = 'move'
                    setDragCol(col.id)
                  }}
                  onDragEnd={() => {
                    setDragCol(null)
                    setOverCol(null)
                  }}
                  onDragOver={(e) => {
                    if (dragCol) {
                      e.preventDefault()
                      if (overCol !== col.id) setOverCol(col.id)
                    }
                  }}
                  onDrop={(e) => {
                    if (dragCol) {
                      e.preventDefault()
                      reorderCol(dragCol, col.id)
                      setDragCol(null)
                      setOverCol(null)
                    }
                  }}
                  style={{ width: FOLD_W, background: `${t.color}14` }}
                  className="shrink-0 border-l border-[#2a2a2a] grid place-items-center py-2 cursor-pointer hover:bg-[#1a1a1a]"
                  title={`Déplier « ${col.title || t.label} »`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: t.color }} />
                  </div>
                </div>
              )
            }
            return (
              <div
                key={col.id}
                data-colhead
                style={{ ...colStyle(col), background: `${t.color}14` }}
                className={`relative border-l border-[#2a2a2a] group/col ${overCol === col.id ? 'ring-2 ring-[#00D76B] ring-inset' : ''}`}
                onDragOver={(e) => {
                  if (dragCol) {
                    e.preventDefault()
                    if (overCol !== col.id) setOverCol(col.id)
                  }
                }}
                onDrop={(e) => {
                  if (dragCol) {
                    e.preventDefault()
                    reorderCol(dragCol, col.id)
                    setDragCol(null)
                    setOverCol(null)
                  }
                }}
              >
                <div className="px-2 pt-2 flex items-center gap-1">
                  {editable && (
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        setDragCol(col.id)
                      }}
                      onDragEnd={() => {
                        setDragCol(null)
                        setOverCol(null)
                      }}
                      title="Glisser pour déplacer la colonne"
                      className="cursor-grab text-[#555555] hover:text-white shrink-0"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => editable && setTagMenu(tagMenu === col.id ? null : col.id)}
                      className="flex items-center gap-1 px-1.5 h-[22px] rounded-md text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: `${t.color}26`, color: t.color, cursor: editable ? 'pointer' : 'default' }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                      {t.label}
                      {editable && <ChevronDown className="w-3 h-3" />}
                    </button>
                    {tagMenu === col.id && editable && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setTagMenu(null)} />
                        <div className="absolute left-0 top-7 z-30 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-1 min-w-[170px] shadow-2xl">
                          {COLUMN_TAGS.map((tag) => (
                            <button
                              type="button"
                              key={tag.id}
                              onClick={() => setColTag(col.id, tag.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[#222222] text-left"
                            >
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: tag.color }} />
                              <span className="text-white">{tag.label}</span>
                              {tag.counted && <span className="ml-auto text-[10px] text-[#00D76B]">compté</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {editable && (
                    <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100">
                      <button
                        type="button"
                        onClick={() => toggleCollapse(col.id)}
                        title="Replier la colonne"
                        className="h-6 w-6 grid place-items-center rounded text-[#555555] hover:text-white hover:bg-[#222222]"
                      >
                        <ChevronsRightLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteColumn(col.id)}
                        title="Supprimer la colonne"
                        className="h-6 w-6 grid place-items-center rounded text-[#555555] hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {editable ? (
                  <input
                    value={col.title}
                    onChange={(e) => setColTitle(col.id, e.target.value)}
                    placeholder="Titre"
                    className="w-full bg-transparent px-2 py-1.5 mt-1 font-bold text-[14px] text-white outline-none placeholder:text-[#444444]"
                    style={{ borderBottom: `3px solid ${t.color}` }}
                  />
                ) : (
                  <div
                    className="w-full px-2 py-1.5 mt-1 font-bold text-[14px] text-white truncate"
                    style={{ borderBottom: `3px solid ${t.color}` }}
                  >
                    {col.title || <span className="text-[#555555]">{t.label}</span>}
                  </div>
                )}
                {editable && (
                  <div
                    onMouseDown={(e) => onResizeStart(e, col)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[#00D76B]/40"
                    title="Glisser pour redimensionner"
                  />
                )}
              </div>
            )
          })}
          {editable && (
            <button
              type="button"
              onClick={addColumn}
              title="Ajouter une colonne"
              style={{ width: ACT_W }}
              className="shrink-0 border-l border-[#2a2a2a] grid place-items-center text-[#555555] hover:text-[#00D76B] hover:bg-[#1a1a1a]"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {showComments && (
            <div style={{ width: COM_W }} className="shrink-0 border-l border-[#2a2a2a]" />
          )}
        </div>

        {/* ── Catégories ── */}
        {categories.map((cat, ci) => {
          const color = cat.color || categoryColor(ci)
          const catRows = rows.filter((r) => r.categoryId === cat.id)
          const words = categoryWordCount(columns, rows, cat.id)
          return (
            <div
              key={cat.id}
              className="flex items-stretch border-t border-[#2a2a2a] first:border-t-0"
              style={overCat === cat.id ? { boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
              onDragOver={(e) => {
                if (dragCat) {
                  e.preventDefault()
                  if (overCat !== cat.id) setOverCat(cat.id)
                }
              }}
              onDrop={(e) => {
                if (dragCat) {
                  e.preventDefault()
                  reorderCat(dragCat, cat.id)
                  setDragCat(null)
                  setOverCat(null)
                }
              }}
            >
              {/* libellé catégorie (à gauche du trait coloré) */}
              <div style={{ width: CAT_W }} className="shrink-0 flex items-stretch group/catlabel">
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 pl-2 pr-1.5 py-2">
                  <div className="flex items-center gap-1">
                    {editable && (
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          setDragCat(cat.id)
                        }}
                        onDragEnd={() => {
                          setDragCat(null)
                          setOverCat(null)
                        }}
                        title="Glisser pour déplacer la catégorie"
                        className="cursor-grab text-[#444444] hover:text-white shrink-0 opacity-0 group-hover/catlabel:opacity-100"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {editable ? (
                      <input
                        value={cat.name}
                        onChange={(e) => renameCategory(cat.id, e.target.value)}
                        placeholder="Catégorie"
                        className="flex-1 min-w-0 bg-transparent font-bold text-[11px] uppercase tracking-wider text-right outline-none"
                        style={{ color }}
                      />
                    ) : (
                      <span
                        className="flex-1 min-w-0 font-bold text-[11px] uppercase tracking-wider text-right truncate"
                        style={{ color }}
                      >
                        {cat.name || 'Catégorie'}
                      </span>
                    )}
                    {editable && categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat.id)}
                        title="Supprimer la catégorie (les lignes rejoignent la voisine)"
                        className="opacity-0 group-hover/catlabel:opacity-100 h-5 w-5 grid place-items-center rounded text-[#555555] hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-[#555555] font-mono text-right">
                    {words} mot{words > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="shrink-0" style={{ width: 4, background: color }} />
              </div>

              {/* lignes */}
              <div
                className="flex-1 min-w-0"
                onDragOver={(e) => {
                  if (dragRow) e.preventDefault()
                }}
                onDrop={(e) => {
                  if (dragRow) {
                    e.preventDefault()
                    dropRowInCategory(dragRow, cat.id)
                    setDragRow(null)
                    setOverRow(null)
                  }
                }}
              >
                {catRows.map((row, ri) => (
                  <div key={row._key}>
                    <div
                      className={`flex items-stretch group/row ${ri ? 'border-t border-[#222222]' : ''} ${overRow === row._key ? 'bg-[#00D76B]/5' : ''}`}
                      onDragOver={(e) => {
                        if (dragRow) {
                          e.preventDefault()
                          if (overRow !== row._key) setOverRow(row._key)
                        }
                      }}
                      onDrop={(e) => {
                        if (dragRow) {
                          e.preventDefault()
                          e.stopPropagation()
                          reorderRow(dragRow, row._key)
                          setDragRow(null)
                          setOverRow(null)
                        }
                      }}
                    >
                      <div style={{ width: GRIP_W }} className="shrink-0 grid place-items-center">
                        {editable && (
                          <span
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              setDragRow(row._key)
                            }}
                            onDragEnd={() => {
                              setDragRow(null)
                              setOverRow(null)
                            }}
                            title="Glisser pour réordonner la ligne"
                            className="cursor-grab text-[#444444] hover:text-white opacity-0 group-hover/row:opacity-100"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      {columns.map((col) =>
                        col.collapsed ? (
                          <div
                            key={col.id}
                            onClick={() => editable && toggleCollapse(col.id)}
                            title="Déplier la colonne"
                            style={{ width: FOLD_W, background: `${tagInfo(col.tag).color}0c` }}
                            className="shrink-0 border-l border-[#222222] cursor-pointer hover:bg-[#1a1a1a]"
                          />
                        ) : (
                          <div key={col.id} style={colStyle(col)} className="border-l border-[#222222]">
                            {editable ? (
                              <AutoGrowTextarea
                                value={row.cells?.[col.id] || ''}
                                onChange={(e) => setCell(row._key, col.id, e.target.value)}
                                placeholder="—"
                                minRows={1}
                                className="w-full bg-transparent text-[13px] text-white outline-none px-2.5 py-2 focus:bg-[#1a1a1a]/60 placeholder:text-[#3a3a3a]"
                              />
                            ) : (
                              <p className="w-full text-[13px] text-[#cccccc] whitespace-pre-wrap leading-relaxed px-2.5 py-2 min-h-[34px]">
                                {row.cells?.[col.id] || <span className="text-[#3a3a3a]">—</span>}
                              </p>
                            )}
                          </div>
                        ),
                      )}
                      {editable && (
                        <button
                          type="button"
                          onClick={() => deleteRow(row._key)}
                          title="Supprimer la ligne"
                          style={{ width: ACT_W }}
                          className="shrink-0 border-l border-[#222222] grid place-items-center text-[#555555] opacity-0 group-hover/row:opacity-100 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {showComments && (
                        <div
                          style={{ width: COM_W }}
                          className="shrink-0 border-l border-[#222222] grid place-items-start justify-items-center pt-1.5"
                        >
                          {renderRowComments?.(row)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {editable && (
                  <button
                    type="button"
                    onClick={() => addRow(cat.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#666666] hover:text-white hover:bg-[#1a1a1a]/60 ${catRows.length ? 'border-t border-[#222222]' : ''}`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Ligne
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editable && (
        <button
          type="button"
          onClick={addCategory}
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-[#666666] hover:text-white hover:bg-[#1a1a1a] border border-dashed border-[#2a2a2a]"
        >
          <Plus className="w-4 h-4" /> Ajouter une catégorie
        </button>
      )}
      </div>

      {/* ════════ Mobile : cartes empilées ════════ */}
      <div className="md:hidden space-y-3">
        {categories.map((cat, ci) => {
          const color = cat.color || categoryColor(ci)
          const catRows = rows.filter((r) => r.categoryId === cat.id)
          const words = categoryWordCount(columns, rows, cat.id)
          return (
            <div key={cat.id} className="rounded-2xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
              {/* En-tête catégorie */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1f1f1f]"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                {editable ? (
                  <input
                    value={cat.name}
                    onChange={(e) => renameCategory(cat.id, e.target.value)}
                    placeholder="Catégorie"
                    className="flex-1 min-w-0 bg-transparent font-bold text-[12px] uppercase tracking-wider outline-none"
                    style={{ color }}
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 font-bold text-[12px] uppercase tracking-wider truncate"
                    style={{ color }}
                  >
                    {cat.name || 'Catégorie'}
                  </span>
                )}
                <span className="text-[10px] text-[#555555] font-mono shrink-0">
                  {words} mot{words > 1 ? 's' : ''}
                </span>
                {editable && categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    title="Supprimer la catégorie"
                    className="h-6 w-6 grid place-items-center rounded text-[#555555] hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Lignes (cartes) */}
              <div className="divide-y divide-[#1f1f1f]">
                {catRows.map((row, ri) => (
                  <div key={row._key} className="p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#555555]">#{ri + 1}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {showComments && renderRowComments?.(row)}
                        {editable && (
                          <button
                            type="button"
                            onClick={() => deleteRow(row._key)}
                            title="Supprimer la ligne"
                            className="h-7 w-7 grid place-items-center rounded-lg text-[#555555] hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {visibleCols.map((col) => {
                      const t = tagInfo(col.tag)
                      return (
                        <div key={col.id}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                            <span
                              className="text-[10px] uppercase tracking-wide font-semibold"
                              style={{ color: t.color }}
                            >
                              {col.title || t.label}
                            </span>
                          </div>
                          {editable ? (
                            <AutoGrowTextarea
                              value={row.cells?.[col.id] || ''}
                              onChange={(e) => setCell(row._key, col.id, e.target.value)}
                              placeholder="—"
                              minRows={1}
                              className="w-full bg-[#0d0d0d] border border-[#222222] rounded-lg px-2.5 py-2 text-[14px] text-white outline-none focus:border-[#444444] placeholder:text-[#3a3a3a]"
                            />
                          ) : (
                            <p className="text-[14px] text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                              {row.cells?.[col.id] || <span className="text-[#3a3a3a]">—</span>}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {editable && (
                  <button
                    type="button"
                    onClick={() => addRow(cat.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-[#666666] hover:text-white hover:bg-[#1a1a1a]/60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ligne
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {editable && (
          <button
            type="button"
            onClick={addCategory}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] text-[#666666] hover:text-white hover:bg-[#1a1a1a] border border-dashed border-[#2a2a2a]"
          >
            <Plus className="w-4 h-4" /> Ajouter une catégorie
          </button>
        )}
      </div>
    </>
  )
}
