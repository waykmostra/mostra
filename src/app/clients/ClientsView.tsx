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
import {
  Search,
  KanbanSquare,
  List,
  Mail,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Filter,
  Bell,
  GripVertical,
  X,
} from 'lucide-react'

// Nb de cartes visibles quand une colonne est repliée.
const COLLAPSED_COUNT = 5
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { updateClientStatus } from './actions'
import DeleteClientButton from './DeleteClientButton'
import { STAGE_META } from '@/components/founder/pipelineMeta'
import type {
  ClientStatus,
  ClientSource,
  ClientWithStats,
  PipelineStage,
} from '@/lib/types'

// ─── Configuration ──────────────────────────────────────────────

const STATUSES: { id: ClientStatus; label: string; color: string; bg: string }[] = [
  { id: 'cold',     label: 'Froid',    color: '#94A3B8', bg: '#94A3B815' },
  { id: 'interest', label: 'Intérêt',  color: '#A78BFA', bg: '#A78BFA15' },
  { id: 'warm',     label: 'Chaud',    color: '#F59E0B', bg: '#F59E0B15' },
  { id: 'active',   label: 'Actif',    color: '#22C55E', bg: '#22C55E15' },
  { id: 'former',   label: 'Ancien',   color: '#64748B', bg: '#64748B15' },
  { id: 'lost',     label: 'Perdu',    color: '#EF4444', bg: '#EF444415' },
]

const SOURCE_LABEL: Record<ClientSource, string> = {
  instagram:     'Instagram',
  linkedin:      'LinkedIn',
  word_of_mouth: 'Bouche-à-oreille',
  website:       'Site web',
  referral:      'Recommandation',
  cold_outreach: 'Démarchage',
  other:         'Autre',
}

// Étapes du funnel commercial (migration 021) — partagé avec l'espace Founder.
const STAGE_FILTER_OPTIONS = (Object.keys(STAGE_META) as PipelineStage[]).map((value) => ({
  value,
  label: STAGE_META[value].label,
}))

// ─── Props ──────────────────────────────────────────────────────

interface ClientsViewProps {
  initialClients: ClientWithStats[]
}

type ViewMode = 'kanban' | 'list'

// ─── Composant principal ────────────────────────────────────────

export default function ClientsView({ initialClients }: ClientsViewProps) {
  const [clients, setClients] = useState<ClientWithStats[]>(initialClients)
  const [mode, setMode] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<ClientSource | 'all'>('all')
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all')
  const [followUpOnly, setFollowUpOnly] = useState(false)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Filtres
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (followUpOnly && !c.follow_up_pending) return false
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false
      if (stageFilter !== 'all' && c.pipeline_stage !== stageFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = [
          c.contact_name,
          c.company_name,
          c.email,
          c.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [clients, search, sourceFilter, stageFilter, followUpOnly])

  // DnD
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const clientId = active.id as string
    const newStatus = over.id as ClientStatus
    const c = clients.find((cc) => cc.id === clientId)
    if (!c || c.status === newStatus) return

    // Optimistic update
    setClients((prev) =>
      prev.map((cc) =>
        cc.id === clientId ? { ...cc, status: newStatus } : cc,
      ),
    )

    startTransition(async () => {
      const result = await updateClientStatus(clientId, newStatus)
      if (!result.success) {
        // Revert
        setClients((prev) =>
          prev.map((cc) =>
            cc.id === clientId ? { ...cc, status: c.status } : cc,
          ),
        )
        toast.error(result.error)
      } else {
        const label = STATUSES.find((s) => s.id === newStatus)?.label ?? newStatus
        toast.success(`${c.company_name || c.contact_name} → ${label}`)
      }
    })
  }

  // Grouper par statut pour le Kanban
  const byStatus = useMemo(() => {
    const map = new Map<ClientStatus, ClientWithStats[]>()
    STATUSES.forEach((s) => map.set(s.id, []))
    filtered.forEach((c) => {
      const list = map.get(c.status) ?? []
      list.push(c)
      map.set(c.status, list)
    })
    return map
  }, [filtered])

  const activeFilters =
    (sourceFilter !== 'all' ? 1 : 0) +
    (stageFilter !== 'all' ? 1 : 0) +
    (followUpOnly ? 1 : 0) +
    (search ? 1 : 0)

  return (
    <div className="space-y-5">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un client, une société, un email…"
            className="
              w-full pl-9 pr-3 py-2 rounded-lg text-sm
              bg-[#111111] border border-[#2a2a2a] text-white
              placeholder-[#3a3a3a]
              focus:outline-none focus:border-[#444444]
            "
          />
        </div>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as ClientSource | 'all')}
          className="
            px-3 py-2 rounded-lg text-sm
            bg-[#111111] border border-[#2a2a2a] text-white
            focus:outline-none focus:border-[#444444]
            cursor-pointer
          "
        >
          <option value="all">Toutes sources</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Pipeline stage filter (funnel commercial — relié à la Prospection) */}
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as PipelineStage | 'all')}
          className="
            px-3 py-2 rounded-lg text-sm
            bg-[#111111] border border-[#2a2a2a] text-white
            focus:outline-none focus:border-[#444444]
            cursor-pointer
          "
        >
          <option value="all">Tout le pipeline</option>
          {STAGE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Follow-up toggle */}
        <button
          type="button"
          onClick={() => setFollowUpOnly((v) => !v)}
          className={`
            inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
            border
            ${followUpOnly
              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
              : 'bg-[#111111] border-[#2a2a2a] text-[#666666] hover:text-white'}
          `}
        >
          <Bell className="h-4 w-4" />
          Relances
        </button>

        {/* Active filters indicator + reset */}
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setSourceFilter('all')
              setStageFilter('all')
              setFollowUpOnly(false)
            }}
            className="
              inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs
              bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] hover:text-white
              transition-colors
            "
          >
            <X className="h-3 w-3" />
            Réinitialiser ({activeFilters})
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="inline-flex bg-[#111111] border border-[#2a2a2a] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('kanban')}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${mode === 'kanban'
                ? 'bg-[#222222] text-white'
                : 'text-[#666666] hover:text-white'}
            `}
          >
            <KanbanSquare className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${mode === 'list'
                ? 'bg-[#222222] text-white'
                : 'text-[#666666] hover:text-white'}
            `}
          >
            <List className="h-3.5 w-3.5" />
            Liste
          </button>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <Filter className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666]">
            {clients.length === 0
              ? 'Aucun client pour le moment.'
              : 'Aucun client ne correspond à ces filtres.'}
          </p>
        </div>
      )}

      {/* ── Kanban ───────────────────────────────────────────────── */}
      {mode === 'kanban' && filtered.length > 0 && (
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
                  clients={byStatus.get(s.id) ?? []}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}

      {/* ── Liste ────────────────────────────────────────────────── */}
      {mode === 'list' && filtered.length > 0 && (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#1a1a1a] overflow-x-auto">
            <div className="grid grid-cols-[1fr_120px_120px_120px_100px] gap-4 px-5 py-2.5 text-[10px] text-[#444444] uppercase tracking-widest font-medium min-w-[720px]">
              <span>Client</span>
              <span>Source</span>
              <span>Statut</span>
              <span>Projets</span>
              <span className="text-right">Actions</span>
            </div>

            {filtered.map((client) => {
              const status = STATUSES.find((s) => s.id === client.status)!
              const displayName = client.company_name || client.contact_name
              return (
                <div
                  key={client.id}
                  className="grid grid-cols-[1fr_120px_120px_120px_100px] gap-4 px-5 py-3.5 items-center hover:bg-[#161616] transition-colors min-w-[720px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#00D76B]/10 border border-[#00D76B]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#00D76B]">
                        {displayName[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{displayName}</p>
                      {client.company_name && (
                        <p className="text-[11px] text-[#888888] truncate">{client.contact_name}</p>
                      )}
                      {client.email && (
                        <p className="text-[11px] text-[#555555] flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {client.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#888888]">{SOURCE_LABEL[client.source]}</p>

                  <div className="flex flex-col gap-1 items-start">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border w-fit"
                      style={{
                        color: status.color,
                        backgroundColor: status.bg,
                        borderColor: `${status.color}40`,
                      }}
                    >
                      {status.label}
                    </span>
                    {client.pipeline_stage && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium w-fit"
                        style={{
                          color: STAGE_META[client.pipeline_stage].color,
                          backgroundColor: `${STAGE_META[client.pipeline_stage].color}1a`,
                        }}
                      >
                        {STAGE_META[client.pipeline_stage].label}
                      </span>
                    )}
                  </div>

                  <div>
                    {client.active_projects > 0 ? (
                      <p className="text-xs text-[#22C55E]">
                        {client.active_projects} actif{client.active_projects !== 1 ? 's' : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-[#555555]">—</p>
                    )}
                    {client.total_projects > 0 && (
                      <p className="text-[10px] text-[#444444]">
                        {client.total_projects} au total
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/clients/${client.id}`}
                      className="
                        inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px]
                        border border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444]
                        transition-colors
                      "
                    >
                      Voir
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                    <DeleteClientButton
                      clientId={client.id}
                      clientName={displayName}
                      onDeleted={() => setClients((prev) => prev.filter((c) => c.id !== client.id))}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kanban Column (droppable) ──────────────────────────────────

function KanbanColumn({
  status,
  label,
  color,
  bg,
  clients,
}: {
  status: ClientStatus
  label: string
  color: string
  bg: string
  clients: ClientWithStats[]
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status })
  const [expanded, setExpanded] = useState(false)

  const hasOverflow = clients.length > COLLAPSED_COUNT
  const visible = expanded ? clients : clients.slice(0, COLLAPSED_COUNT)
  const hiddenCount = clients.length - visible.length

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl border transition-colors
        ${isOver ? 'border-white/30 bg-white/[0.02]' : 'border-[#1f1f1f] bg-[#0e0e0e]'}
      `}
    >
      {/* Header — cliquable pour replier / déplier */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="px-3 py-3 border-b border-[#1a1a1a] flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-white">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
            style={{ color, backgroundColor: bg }}
          >
            {clients.length}
          </span>
          {hasOverflow && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#666666] transition-transform ${expanded ? '' : '-rotate-90'}`}
            />
          )}
        </div>
      </button>

      {/* Cards */}
      <div className="p-2 flex flex-col gap-2 min-h-[120px]">
        {clients.length === 0 ? (
          <p className="text-[11px] text-[#3a3a3a] text-center py-6 italic">
            Glissez un client ici
          </p>
        ) : (
          <>
            {visible.map((c) => (
              <KanbanCard key={c.id} client={c} />
            ))}
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[11px] text-[#666666] hover:text-white py-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors"
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

// ─── Kanban Card (draggable) ────────────────────────────────────

function KanbanCard({ client }: { client: ClientWithStats }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
  })

  const displayName = client.company_name || client.contact_name
  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle, zIndex: isDragging ? 10 : 1 }}
      className={`
        group rounded-lg border bg-[#141414] border-[#262626]
        ${isDragging ? 'shadow-2xl shadow-black/50 opacity-90' : 'hover:border-[#3a3a3a]'}
        transition-colors
      `}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        {/* Drag handle */}
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="
            mt-0.5 p-0.5 rounded text-[#444444] hover:text-[#888888] cursor-grab
            active:cursor-grabbing touch-none
          "
          aria-label="Déplacer"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Body — clic ouvre la fiche */}
        <Link href={`/clients/${client.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate group-hover:text-[#00D76B] transition-colors">
              {displayName}
            </p>
            {client.follow_up_pending && (
              <Bell className="h-3 w-3 text-[#F59E0B] flex-shrink-0" />
            )}
          </div>
          {client.pipeline_stage && (
            <span
              className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
              style={{
                color: STAGE_META[client.pipeline_stage].color,
                backgroundColor: `${STAGE_META[client.pipeline_stage].color}1a`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: STAGE_META[client.pipeline_stage].color }}
              />
              {STAGE_META[client.pipeline_stage].label}
            </span>
          )}
          {client.company_name && (
            <p className="text-[10px] text-[#777777] truncate mt-0.5">
              {client.contact_name}
            </p>
          )}
          {client.email && (
            <p className="text-[10px] text-[#555555] truncate mt-0.5 flex items-center gap-1">
              <Mail className="h-2.5 w-2.5 flex-shrink-0" />
              {client.email}
            </p>
          )}
          {client.last_project_name && (
            <p className="text-[10px] text-[#555555] truncate mt-1 flex items-center gap-1">
              <FolderOpen className="h-2.5 w-2.5 flex-shrink-0" />
              {client.last_project_name}
              {client.active_projects > 0 && (
                <span className="text-[#22C55E]">· {client.active_projects} actif</span>
              )}
            </p>
          )}
          {client.last_message_sent_at && (
            <p className="text-[10px] text-[#444444] mt-1.5">
              Dernier message : {formatDate(client.last_message_sent_at)}
            </p>
          )}
        </Link>
      </div>
    </div>
  )
}
