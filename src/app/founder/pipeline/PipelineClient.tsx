'use client'

import { useMemo, useState, useTransition } from 'react'
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
  GripVertical,
  ExternalLink,
  Building2,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { STAGE_META, PIPELINE_STAGES } from '@/components/founder/pipelineMeta'
import { useProspectDrawer } from '@/components/founder/ProspectDrawer'
import type { Client, PipelineStage } from '@/lib/types'
import { updateProspectStage, convertProspectToClient } from '../prospection/actions'

// Plafond conseillé de prospects chauds gérables en parallèle.
const MAX_HOT = 15

function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export default function PipelineClient({ initialProspects }: { initialProspects: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialProspects)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, Client[]>()
    PIPELINE_STAGES.forEach((s) => map.set(s, []))
    clients.forEach((c) => {
      if (c.pipeline_stage && map.has(c.pipeline_stage)) {
        map.get(c.pipeline_stage)!.push(c)
      }
    })
    return map
  }, [clients])

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const clientId = active.id as string
    const newStage = over.id as PipelineStage
    const c = clients.find((cc) => cc.id === clientId)
    if (!c || c.pipeline_stage === newStage) return

    setClients((prev) =>
      prev.map((cc) => (cc.id === clientId ? { ...cc, pipeline_stage: newStage } : cc)),
    )

    startTransition(async () => {
      const res = await updateProspectStage(clientId, newStage)
      if (!res.success) {
        setClients((prev) =>
          prev.map((cc) => (cc.id === clientId ? { ...cc, pipeline_stage: c.pipeline_stage } : cc)),
        )
        toast.error(res.error)
      } else {
        toast.success(`${c.company_name || c.contact_name} → ${STAGE_META[newStage].label}`)
      }
    })
  }

  // Retire un prospect du board (signé ou perdu) — quitte la zone chaude.
  function removeFromBoard(clientId: string) {
    setClients((prev) => prev.filter((c) => c.id !== clientId))
  }

  const total = clients.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Pipeline</h1>
          <p className="text-sm text-[#666666] mt-0.5">
            {total} prospect{total !== 1 ? 's' : ''} chaud{total !== 1 ? 's' : ''} — glissez pour faire avancer
          </p>
        </div>
        {total > MAX_HOT && (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Plus de {MAX_HOT} prospects chauds — concentre-toi.
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <p className="text-sm text-[#666666] text-center">
            Aucun prospect chaud. Fais passer un prospect en « Répondu » depuis la Prospection.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                clients={byStage.get(stage) ?? []}
                onRemove={removeFromBoard}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}

// ── Colonne ─────────────────────────────────────────────────────────────────

function PipelineColumn({
  stage,
  clients,
  onRemove,
}: {
  stage: PipelineStage
  clients: Client[]
  onRemove: (id: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage })
  const meta = STAGE_META[stage]

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border transition-colors min-h-[200px]
        ${isOver ? 'border-white/30 bg-white/[0.02]' : 'border-[#1f1f1f] bg-[#0e0e0e]'}`}
    >
      <div className="px-3 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
          <span className="text-xs font-semibold text-white">{meta.label}</span>
        </div>
        <span
          className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
          style={{ color: meta.color, backgroundColor: `${meta.color}15` }}
        >
          {clients.length}
        </span>
      </div>

      <div className="p-2 flex flex-col gap-2 flex-1">
        {clients.length === 0 ? (
          <p className="text-[11px] text-[#3a3a3a] text-center py-8 italic">Glissez un prospect ici</p>
        ) : (
          clients.map((c) => <PipelineCard key={c.id} client={c} onRemove={onRemove} />)
        )}
      </div>
    </div>
  )
}

// ── Carte ───────────────────────────────────────────────────────────────────

function PipelineCard({ client, onRemove }: { client: Client; onRemove: (id: string) => void }) {
  const { open } = useProspectDrawer()
  const [isPending, startTransition] = useTransition()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: client.id })

  const displayName = client.company_name || client.contact_name
  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined

  function sign() {
    startTransition(async () => {
      const res = await convertProspectToClient(client.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success(`${displayName} signé ✓`)
      onRemove(client.id)
    })
  }

  function lose() {
    startTransition(async () => {
      const res = await updateProspectStage(client.id, 'perdu')
      if (!res.success) { toast.error(res.error); return }
      toast.success(`${displayName} marqué perdu`)
      onRemove(client.id)
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle, zIndex: isDragging ? 10 : 1 }}
      className={`group rounded-lg border bg-[#141414] border-[#262626] transition-colors
        ${isDragging ? 'shadow-2xl shadow-black/50 opacity-90' : 'hover:border-[#3a3a3a]'}`}
    >
      <div className="flex items-start gap-2 px-3 pt-3">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="mt-0.5 p-0.5 rounded text-[#444444] hover:text-[#888888] cursor-grab active:cursor-grabbing touch-none"
          aria-label="Déplacer"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <button onClick={() => open(client.id)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-white truncate group-hover:text-[#00D76B] transition-colors">
              {displayName}
            </p>
            {client.profile_url && (
              <a
                href={externalHref(client.profile_url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label="Profil"
                className="text-[#555555] hover:text-[#00D76B] flex-shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {client.company_name && (
            <p className="text-[10px] text-[#777777] truncate mt-0.5 flex items-center gap-1">
              <Building2 className="h-2.5 w-2.5 flex-shrink-0" />
              {client.contact_name}
            </p>
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 mt-1">
        <button
          onClick={sign}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
            bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Signer
        </button>
        <button
          onClick={lose}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
            text-[#666666] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Perdu
        </button>
      </div>
    </div>
  )
}
