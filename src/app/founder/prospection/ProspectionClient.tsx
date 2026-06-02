'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Snowflake,
  MessageCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { StatCard } from '@/components/shared/StatCard'
import { useProspectDrawer } from '@/components/founder/ProspectDrawer'
import type { Client, PipelineStage } from '@/lib/types'
import {
  STAGE_META,
  STAGE_OPTIONS,
  isOverdue,
  isDueToday,
} from '@/components/founder/pipelineMeta'
import { updateProspectStage, setProspectFollowUp } from './actions'

// Normalise une URL collée sans protocole (linkedin.com/in/x → https://…).
function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

const dateBase =
  'bg-[#1a1a1a] border rounded-md px-2 py-1 text-xs focus:outline-none [color-scheme:dark] transition-colors'

const selectCls =
  'bg-[#1a1a1a] border border-[#333333] rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#555555]'

// ── Ligne prospect ────────────────────────────────────────────────

function ProspectRow({ p }: { p: Client }) {
  const router = useRouter()
  const { open } = useProspectDrawer()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(p.next_follow_up_on ?? '')

  function changeStage(stage: PipelineStage) {
    startTransition(async () => {
      const res = await updateProspectStage(p.id, stage)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const leftZone = !['froid', 'contacte', 'a_relancer'].includes(stage)
      toast.success(leftZone ? `→ ${STAGE_META[stage].label} (sorti de la prospection)` : 'Étape mise à jour.')
      router.refresh()
    })
  }

  function changeDate(value: string) {
    setDate(value)
    startTransition(async () => {
      const res = await setProspectFollowUp(p.id, value || null)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  const meta = p.pipeline_stage ? STAGE_META[p.pipeline_stage] : null
  const overdue = isOverdue(p.next_follow_up_on)
  const dueToday = isDueToday(p.next_follow_up_on)

  const dateColor = overdue
    ? 'border-[#EF4444]/60 text-[#EF4444]'
    : dueToday
      ? 'border-[#F59E0B]/60 text-[#F59E0B]'
      : 'border-[#333333] text-[#bbbbbb] focus:border-[#555555]'

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#161616] transition-colors">
      {/* Pastille étape */}
      <span
        className="block h-2.5 w-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: meta?.color ?? '#444444' }}
        title={meta?.label}
      />

      {/* Identité — clic ouvre le panneau latéral */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => open(p.id)}
            className="text-sm text-white truncate hover:text-[#00D76B] transition-colors text-left"
          >
            {p.contact_name}
          </button>
          {p.profile_url && (
            <a
              href={externalHref(p.profile_url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Ouvrir le profil"
              className="text-[#666666] hover:text-[#00D76B] transition-colors flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {p.company_name && (
          <button
            onClick={() => open(p.id)}
            className="block text-[11px] text-[#666666] truncate mt-0.5 hover:text-[#999999] transition-colors text-left"
          >
            {p.company_name}
          </button>
        )}
      </div>

      {/* Date de relance (inline) */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {overdue && <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />}
        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          disabled={isPending}
          aria-label="Date de relance"
          className={`${dateBase} ${dateColor} w-[130px]`}
        />
      </div>

      {/* Étape (inline) */}
      <select
        value={p.pipeline_stage ?? ''}
        onChange={(e) => changeStage(e.target.value as PipelineStage)}
        disabled={isPending}
        aria-label="Étape du pipeline"
        className={`${selectCls} flex-shrink-0`}
      >
        {STAGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#1a1a1a]">
            {o.label}
          </option>
        ))}
      </select>

      <div className="w-4 flex-shrink-0">
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#666666]" />}
      </div>
    </div>
  )
}

// ── Vue Prospection ───────────────────────────────────────────────

export default function ProspectionClient({ prospects }: { prospects: Client[] }) {
  const counts = useMemo(() => {
    let froid = 0
    let contacte = 0
    let aRelancer = 0
    let overdue = 0
    for (const p of prospects) {
      if (p.pipeline_stage === 'froid') froid++
      else if (p.pipeline_stage === 'contacte') contacte++
      else if (p.pipeline_stage === 'a_relancer') aRelancer++
      if (isOverdue(p.next_follow_up_on)) overdue++
    }
    return { froid, contacte, aRelancer, overdue }
  }, [prospects])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Prospection</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          {prospects.length} prospect{prospects.length !== 1 ? 's' : ''} dans la zone froide — triés par relance
        </p>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Snowflake} label="Froids" value={counts.froid} color="#6B7280" />
        <StatCard icon={MessageCircle} label="Contactés" value={counts.contacte} color="#3B82F6" />
        <StatCard icon={Clock} label="À relancer" value={counts.aRelancer} color="#F59E0B" />
        <StatCard icon={AlertTriangle} label="En retard" value={counts.overdue} color="#EF4444" />
      </div>

      {/* Liste dense */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[#1e1e1e]">
          <h2 className="text-sm font-semibold text-white">File de prospection</h2>
        </div>
        <div className="p-2">
          {prospects.length === 0 ? (
            <p className="text-xs text-[#555555] italic px-2 py-10 text-center">
              Aucun prospect dans la zone froide. Les nouveaux prospects apparaîtront ici.
            </p>
          ) : (
            <div className="space-y-0.5">
              {prospects.map((p) => (
                <ProspectRow key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
