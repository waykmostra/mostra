'use client'

import { useState, useTransition, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Trash2,
  Loader2,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import IconPicker from './IconPicker'
import { updatePhaseTemplates, resetToDefaults } from '@/app/settings/pipeline-actions'
import type {
  PipelinePhaseInput,
  PipelinePhaseRow,
} from '@/app/settings/pipeline-actions'
import type { PhaseTemplate, SubPhaseDefinition } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────

let _newCounter = 0
function tempId() {
  return `__new_${++_newCounter}`
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'phase'
  )
}

function dedupeSlug(slug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(slug)) return slug
  let i = 2
  while (existingSlugs.includes(`${slug}-${i}`)) i++
  return `${slug}-${i}`
}

// ── Types ─────────────────────────────────────────────────────────

interface SubPhaseRow {
  _key: string
  name: string
  slug: string
  sort_order: number
}

interface PhaseRow {
  _key: string
  id: string | null
  name: string
  slug: string
  icon: string
  sort_order: number
  isNew: boolean
  sub_phases: SubPhaseRow[]
  showSubPhases: boolean
}

function spKey(phaseKey: string, n: number) {
  return `${phaseKey}_sp_${n}`
}

function toRow(tpl: PhaseTemplate): PhaseRow {
  const sps: SubPhaseDefinition[] = Array.isArray(tpl.sub_phases) ? tpl.sub_phases : []
  return {
    _key: tpl.id,
    id: tpl.id,
    name: tpl.name,
    slug: tpl.slug,
    icon: tpl.icon ?? 'FileText',
    sort_order: tpl.sort_order,
    isNew: false,
    sub_phases: sps.map((sp, i) => ({
      _key: spKey(tpl.id, i),
      name: sp.name,
      slug: sp.slug,
      sort_order: sp.sort_order,
    })),
    showSubPhases: sps.length > 0,
  }
}

// ── Sub-phase row item ────────────────────────────────────────────

interface SubPhaseRowItemProps {
  sp: SubPhaseRow
  index: number
  total: number
  disabled: boolean
  onUpdate: (patch: Partial<SubPhaseRow>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function SubPhaseRowItem({
  sp,
  index,
  total,
  disabled,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SubPhaseRowItemProps) {
  function handleNameChange(val: string) {
    onUpdate({ name: val, slug: slugify(val) })
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-line">
      {/* Sort order */}
      <span className="text-[10px] text-faint tabular-nums w-4 text-center flex-shrink-0">
        {index + 1}
      </span>

      {/* Name */}
      <input
        type="text"
        value={sp.name}
        onChange={(e) => handleNameChange(e.target.value)}
        disabled={disabled}
        placeholder="Nom de la sous-phase"
        className="
          flex-1 px-2 py-1 rounded text-xs
          bg-canvas border border-[rgb(var(--c-surface-3))] text-ink placeholder:text-faint
          outline-none transition-colors
          focus:border-brand focus:ring-1 focus:ring-brand/20
          disabled:opacity-50
        "
      />

      {/* Slug */}
      <span className="text-[10px] text-faint font-mono min-w-[60px] max-w-[80px] truncate hidden sm:block">
        {sp.slug || '…'}
      </span>

      {/* Up / Down */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || index === 0}
          className="w-5 h-4 flex items-center justify-center rounded text-faint hover:text-dim disabled:opacity-20 transition-colors"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || index === total - 1}
          className="w-5 h-4 flex items-center justify-center rounded text-faint hover:text-dim disabled:opacity-20 transition-colors"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="
          flex-shrink-0 w-6 h-6 rounded flex items-center justify-center
          text-faint hover:text-[#EF4444]
          transition-colors disabled:opacity-30 disabled:cursor-not-allowed
        "
        title="Supprimer la sous-phase"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Sortable phase row ────────────────────────────────────────────

interface RowItemProps {
  row: PhaseRow
  index: number
  total: number
  disabled: boolean
  onUpdate: (key: string, patch: Partial<PhaseRow>) => void
  onRemove: (key: string) => void
  onToggleSubPhases: (key: string) => void
  onAddSubPhase: (key: string) => void
  onUpdateSubPhase: (phaseKey: string, spKey: string, patch: Partial<SubPhaseRow>) => void
  onRemoveSubPhase: (phaseKey: string, spKey: string) => void
  onMoveSubPhase: (phaseKey: string, spKey: string, dir: 'up' | 'down') => void
}

function SortableRow({
  row,
  index,
  total,
  disabled,
  onUpdate,
  onRemove,
  onToggleSubPhases,
  onAddSubPhase,
  onUpdateSubPhase,
  onRemoveSubPhase,
  onMoveSubPhase,
}: RowItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row._key,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  function handleNameChange(val: string) {
    const newSlug = slugify(val)
    onUpdate(row._key, { name: val, slug: newSlug })
  }

  return (
    <div ref={setNodeRef} style={style} className="space-y-1.5">
      {/* Phase row */}
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
          ${
            isDragging
              ? 'bg-surface-2 border-brand/30 shadow-2xl shadow-black/50'
              : 'bg-surface border-line hover:border-line-strong'
          }
        `}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-faint hover:text-faint transition-colors flex-shrink-0 touch-none"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Sort order */}
        <span className="text-[10px] text-faint tabular-nums w-4 text-center flex-shrink-0">
          {index + 1}
        </span>

        {/* Icon picker */}
        <IconPicker
          value={row.icon}
          onChange={(icon) => onUpdate(row._key, { icon })}
          disabled={disabled}
        />

        {/* Name */}
        <input
          type="text"
          value={row.name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={disabled}
          placeholder="Nom de la phase"
          className="
            flex-1 px-3 py-1.5 rounded-lg text-sm
            bg-canvas border border-line text-ink placeholder:text-faint
            outline-none transition-colors
            focus:border-brand focus:ring-1 focus:ring-brand/30
            disabled:opacity-50
          "
        />

        {/* Slug */}
        <span className="text-[11px] text-faint font-mono min-w-[80px] max-w-[100px] truncate hidden sm:block">
          {row.slug || '…'}
        </span>

        {/* Toggle sub-phases */}
        <button
          type="button"
          onClick={() => onToggleSubPhases(row._key)}
          disabled={disabled}
          className="
            flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px]
            border-line text-faint hover:text-dim hover:border-line-strong
            transition-colors disabled:opacity-30
          "
          title={row.showSubPhases ? 'Masquer les sous-phases' : 'Configurer les sous-phases'}
        >
          {row.showSubPhases ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span>{row.sub_phases.length}</span>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onRemove(row._key)}
          disabled={disabled || total <= 1}
          className="
            flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
            text-faint hover:text-[#EF4444] hover:border-[#EF4444]/30
            border border-transparent hover:border hover:bg-[#EF4444]/10
            transition-colors disabled:opacity-30 disabled:cursor-not-allowed
          "
          title="Supprimer la phase"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sub-phases panel */}
      {row.showSubPhases && (
        <div className="ml-9 space-y-1.5 border-l border-line pl-4">
          <p className="text-[10px] text-faint uppercase tracking-widest mb-1">Sous-phases</p>

          {row.sub_phases.length === 0 ? (
            <p className="text-[11px] text-faint italic">Aucune sous-phase — accès direct aux fichiers.</p>
          ) : (
            row.sub_phases.map((sp, i) => (
              <SubPhaseRowItem
                key={sp._key}
                sp={sp}
                index={i}
                total={row.sub_phases.length}
                disabled={disabled}
                onUpdate={(patch) => onUpdateSubPhase(row._key, sp._key, patch)}
                onRemove={() => onRemoveSubPhase(row._key, sp._key)}
                onMoveUp={() => onMoveSubPhase(row._key, sp._key, 'up')}
                onMoveDown={() => onMoveSubPhase(row._key, sp._key, 'down')}
              />
            ))
          )}

          <button
            type="button"
            onClick={() => onAddSubPhase(row._key)}
            disabled={disabled}
            className="
              w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs
              border border-dashed border-[rgb(var(--c-surface-3))] text-faint
              hover:border-brand/30 hover:text-brand hover:bg-brand/5
              transition-colors disabled:opacity-40
            "
          >
            <Plus className="h-3 w-3" />
            Ajouter une sous-phase
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

interface Props {
  initialTemplates: PhaseTemplate[]
}

export default function DraggablePhaseList({ initialTemplates }: Props) {
  const [rows, setRows] = useState<PhaseRow[]>(() => initialTemplates.map(toRow))
  const [isPending, startTransition] = useTransition()
  const [isDirty, setIsDirty] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Phase mutations ──────────────────────────────────────────

  const updateRow = useCallback((key: string, patch: Partial<PhaseRow>) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)))
    setIsDirty(true)
  }, [])

  const removeRow = useCallback((key: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((r) => r._key !== key)
    })
    setIsDirty(true)
  }, [])

  const toggleSubPhases = useCallback((key: string) => {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, showSubPhases: !r.showSubPhases } : r)),
    )
  }, [])

  function addRow() {
    const key = tempId()
    const existingSlugs = rows.map((r) => r.slug)
    const slug = dedupeSlug('phase', existingSlugs)
    setRows((prev) => [
      ...prev,
      {
        _key: key,
        id: null,
        name: '',
        slug,
        icon: 'FileText',
        sort_order: prev.length + 1,
        isNew: true,
        sub_phases: [],
        showSubPhases: true,
      },
    ])
    setIsDirty(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIdx = prev.findIndex((r) => r._key === active.id)
      const newIdx = prev.findIndex((r) => r._key === over.id)
      return arrayMove(prev, oldIdx, newIdx).map((r, i) => ({ ...r, sort_order: i + 1 }))
    })
    setIsDirty(true)
  }

  // ── Sub-phase mutations ──────────────────────────────────────

  const addSubPhase = useCallback((phaseKey: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== phaseKey) return r
        const key = spKey(phaseKey, Date.now())
        const newSp: SubPhaseRow = {
          _key: key,
          name: '',
          slug: 'sous-phase',
          sort_order: r.sub_phases.length + 1,
        }
        return { ...r, sub_phases: [...r.sub_phases, newSp] }
      }),
    )
    setIsDirty(true)
  }, [])

  const updateSubPhase = useCallback(
    (phaseKey: string, spK: string, patch: Partial<SubPhaseRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r._key !== phaseKey) return r
          return {
            ...r,
            sub_phases: r.sub_phases.map((sp) => (sp._key === spK ? { ...sp, ...patch } : sp)),
          }
        }),
      )
      setIsDirty(true)
    },
    [],
  )

  const removeSubPhase = useCallback((phaseKey: string, spK: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== phaseKey) return r
        const filtered = r.sub_phases
          .filter((sp) => sp._key !== spK)
          .map((sp, i) => ({ ...sp, sort_order: i + 1 }))
        return { ...r, sub_phases: filtered }
      }),
    )
    setIsDirty(true)
  }, [])

  const moveSubPhase = useCallback((phaseKey: string, spK: string, dir: 'up' | 'down') => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== phaseKey) return r
        const idx = r.sub_phases.findIndex((sp) => sp._key === spK)
        if (idx === -1) return r
        const newIdx = dir === 'up' ? idx - 1 : idx + 1
        if (newIdx < 0 || newIdx >= r.sub_phases.length) return r
        const newSps = [...r.sub_phases]
        ;[newSps[idx], newSps[newIdx]] = [newSps[newIdx], newSps[idx]]
        return { ...r, sub_phases: newSps.map((sp, i) => ({ ...sp, sort_order: i + 1 })) }
      }),
    )
    setIsDirty(true)
  }, [])

  // ── Build payload ────────────────────────────────────────────

  function buildPayload(): PipelinePhaseInput[] | null {
    const usedSlugs: string[] = []
    const result: PipelinePhaseInput[] = []

    for (const r of rows) {
      const name = r.name.trim()
      if (!name) {
        toast.error('Toutes les phases doivent avoir un nom.')
        return null
      }
      let slug = r.slug.trim() || slugify(name)
      if (usedSlugs.includes(slug)) slug = dedupeSlug(slug, usedSlugs)
      usedSlugs.push(slug)

      // Valide les sous-phases
      const sub_phases: SubPhaseDefinition[] = []
      for (const sp of r.sub_phases) {
        const spName = sp.name.trim()
        if (!spName) {
          toast.error(`Phase "${name}" : toutes les sous-phases doivent avoir un nom.`)
          return null
        }
        sub_phases.push({
          name: spName,
          slug: sp.slug.trim() || slugify(spName),
          sort_order: sp.sort_order,
        })
      }

      result.push({ id: r.id, name, slug, icon: r.icon, sort_order: r.sort_order, sub_phases })
    }
    return result
  }

  // ── Save ─────────────────────────────────────────────────────

  function handleSave() {
    const payload = buildPayload()
    if (!payload) return

    startTransition(async () => {
      const result = await updatePhaseTemplates(payload)
      if (result.success) {
        toast.success('Pipeline sauvegardé')
        setIsDirty(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Reset to defaults ─────────────────────────────────────────

  function handleReset() {
    if (!showResetConfirm) {
      setShowResetConfirm(true)
      return
    }
    setShowResetConfirm(false)

    startTransition(async () => {
      const result = await resetToDefaults()
      if (result.success) {
        if (result.phases.length > 0) {
          setRows(
            result.phases.map((p: PipelinePhaseRow) => ({
              _key: p.id,
              id: p.id,
              name: p.name,
              slug: p.slug,
              icon: p.icon || 'FileText',
              sort_order: p.sort_order,
              isNew: false,
              sub_phases: (p.sub_phases ?? []).map((sp, i) => ({
                _key: spKey(p.id, i),
                name: sp.name,
                slug: sp.slug,
                sort_order: sp.sort_order,
              })),
              showSubPhases: (p.sub_phases ?? []).length > 0,
            })),
          )
        }
        setIsDirty(false)
        toast.success('Pipeline réinitialisé aux valeurs par défaut')
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Pipeline de phases</h2>
          <p className="text-xs text-faint mt-0.5">
            {rows.length} phase{rows.length !== 1 ? 's' : ''} active{rows.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Reset to defaults */}
          {showResetConfirm ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-dim mr-1">Confirmer ?</span>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-line text-faint hover:text-ink transition-colors"
              >
                Non
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
              >
                Oui
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                border border-line text-faint hover:text-ink hover:border-line-strong
                transition-colors disabled:opacity-40"
              title="Restaurer Analyse / Design / Audio / Animation / Rendu"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Défaut
            </button>
          )}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !isDirty}
            className="
              inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium
              bg-brand text-ink hover:bg-brand active:bg-brand
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20">
        <AlertTriangle className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-dim">
          Les modifications s&apos;appliqueront uniquement aux{' '}
          <span className="text-ink font-medium">nouveaux projets</span>. Les projets en cours
          conservent leurs phases actuelles.
        </p>
      </div>

      {/* Legend row */}
      <div className="grid grid-cols-[24px_20px_36px_1fr_100px_32px_28px] gap-3 px-4 text-[10px] text-faint uppercase tracking-widest font-medium">
        <span />
        <span>#</span>
        <span>Icône</span>
        <span>Nom</span>
        <span className="hidden sm:block">Slug</span>
        <span>SP</span>
        <span />
      </div>

      {/* Draggable list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r._key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((row, index) => (
              <SortableRow
                key={row._key}
                row={row}
                index={index}
                total={rows.length}
                disabled={isPending}
                onUpdate={updateRow}
                onRemove={removeRow}
                onToggleSubPhases={toggleSubPhases}
                onAddSubPhase={addSubPhase}
                onUpdateSubPhase={updateSubPhase}
                onRemoveSubPhase={removeSubPhase}
                onMoveSubPhase={moveSubPhase}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add phase */}
      <button
        type="button"
        onClick={addRow}
        disabled={isPending}
        className="
          w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm
          border border-dashed border-line text-faint
          hover:border-brand/30 hover:text-brand hover:bg-brand/5
          transition-colors disabled:opacity-40
        "
      >
        <Plus className="h-4 w-4" />
        Ajouter une phase
      </button>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-end pt-2">
          <div className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-3 shadow-2xl shadow-black/60">
            <span className="text-xs text-faint">Modifications non sauvegardées</span>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium
                bg-brand text-ink hover:bg-brand transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
