'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { Search, ChevronDown, GripVertical, Building2, Users, FolderOpen, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { updateCompanyStatus } from './companies/actions'
import type { ClientStatus, CompanyWithStats } from '@/lib/types'

const COLLAPSED_COUNT = 5

const STATUSES: { id: ClientStatus; label: string; color: string; bg: string }[] = [
  { id: 'active',   label: 'Actif',    color: '#22C55E', bg: '#22C55E15' },
  { id: 'former',   label: 'Ancien',   color: '#64748B', bg: '#64748B15' },
]

function eur(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}

export default function CompaniesCrmView({
  initialCompanies,
}: {
  initialCompanies: CompanyWithStats[]
}) {
  const [companies, setCompanies] = useState<CompanyWithStats[]>(initialCompanies)
  const [search, setSearch] = useState('')
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const filtered = useMemo(
    () =>
      companies.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())),
    [companies, search],
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const id = active.id as string
    const newStatus = over.id as ClientStatus
    const c = companies.find((x) => x.id === id)
    if (!c || c.status === newStatus) return

    setCompanies((prev) => prev.map((x) => (x.id === id ? { ...x, status: newStatus } : x)))

    startTransition(async () => {
      const result = await updateCompanyStatus(id, newStatus)
      if (!result.success) {
        setCompanies((prev) => prev.map((x) => (x.id === id ? { ...x, status: c.status } : x)))
        toast.error(result.error)
      } else {
        const label = STATUSES.find((s) => s.id === newStatus)?.label ?? newStatus
        toast.success(`${c.name} → ${label}`)
      }
    })
  }

  const byStatus = useMemo(() => {
    const map = new Map<ClientStatus, CompanyWithStats[]>()
    STATUSES.forEach((s) => map.set(s.id, []))
    filtered.forEach((c) => {
      // Statut absent/inconnu → colonne « Actif » pour que la société reste
      // visible au lieu de disparaître.
      const st = STATUSES.some((s) => s.id === c.status) ? c.status : ('active' as ClientStatus)
      const list = map.get(st) ?? []
      list.push(c)
      map.set(st, list)
    })
    return map
  }, [filtered])

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher une société…"
            className="
              w-full pl-9 pr-3 py-2 rounded-lg text-sm
              bg-surface border border-line text-ink placeholder-faint
              focus:outline-none focus:border-line-strong
            "
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 flex flex-col items-center gap-3">
          <Filter className="h-8 w-8 text-[rgb(var(--c-border))]" />
          <p className="text-sm text-faint">
            {companies.length === 0
              ? 'Aucune société. Crée-en une, ou rattache un client à une société depuis sa fiche.'
              : 'Aucune société ne correspond.'}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-4 -mx-1 px-1">
            <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-w-max">
              {STATUSES.map((s) => (
                <KanbanColumn
                  key={s.id}
                  status={s.id}
                  label={s.label}
                  color={s.color}
                  bg={s.bg}
                  companies={byStatus.get(s.id) ?? []}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  )
}

// ─── Colonne (droppable) ────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  color,
  bg,
  companies,
}: {
  status: ClientStatus
  label: string
  color: string
  bg: string
  companies: CompanyWithStats[]
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status })
  const [expanded, setExpanded] = useState(false)

  const hasOverflow = companies.length > COLLAPSED_COUNT
  const visible = expanded ? companies : companies.slice(0, COLLAPSED_COUNT)
  const hiddenCount = companies.length - visible.length

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl border transition-colors
        ${isOver ? 'border-brand/40 bg-brand/[0.04]' : 'border-line bg-surface'}
      `}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="px-3 py-3 border-b border-line flex items-center justify-between hover:bg-surface-2 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-ink">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
            style={{ color, backgroundColor: bg }}
          >
            {companies.length}
          </span>
          {hasOverflow && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-faint transition-transform ${expanded ? '' : '-rotate-90'}`}
            />
          )}
        </div>
      </button>

      <div className="p-2 flex flex-col gap-2 min-h-[120px]">
        {companies.length === 0 ? (
          <p className="text-[11px] text-faint text-center py-6 italic">Glissez une société ici</p>
        ) : (
          <>
            {visible.map((c) => (
              <KanbanCard key={c.id} company={c} />
            ))}
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[11px] text-faint hover:text-ink py-1.5 rounded-md hover:bg-surface-2 transition-colors"
              >
                voir les {hiddenCount} autres
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Carte société (draggable) ──────────────────────────────────

function KanbanCard({ company }: { company: CompanyWithStats }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: company.id })
  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle, zIndex: isDragging ? 10 : 1 }}
      className={`
        group rounded-lg border bg-surface-2 border-line
        ${isDragging ? 'shadow-2xl shadow-black/50 opacity-90' : 'hover:border-line-strong'}
        transition-colors
      `}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="mt-0.5 p-0.5 rounded text-faint hover:text-dim cursor-grab active:cursor-grabbing touch-none"
          aria-label="Déplacer"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <Link href={`/clients/companies/${company.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-brand" />
            </div>
            <p className="text-sm font-semibold text-ink truncate group-hover:text-brand transition-colors">
              {company.name}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-dim">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {company.client_count} contact{company.client_count !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              {company.project_count}
            </span>
            {company.total_revenue > 0 && (
              <span className="ml-auto text-[#22C55E] tabular-nums font-medium">
                {eur(company.total_revenue)}
              </span>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
