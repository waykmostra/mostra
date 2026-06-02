'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, Check, TrendingUp, Banknote, Handshake } from 'lucide-react'
import { toast } from 'sonner'
import { StatCard } from '@/components/shared/StatCard'
import type { WeeklyKpi } from '@/lib/types'
import type { WeeklyKpiData } from '@/lib/supabase/founder'
import { upsertWeeklyKpi } from './actions'

// recharts est lourd et client-only : on le sort du bundle initial via un import dynamique.
const KpisTrendChart = dynamic(() => import('./KpisTrendChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[240px] flex items-center justify-center">
      <span className="text-xs text-[#555555] italic">Chargement du graphique…</span>
    </div>
  ),
})

function fmtRange(weekStart: string): string {
  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('fr-FR', opts)} – ${end.toLocaleDateString('fr-FR', opts)}`
}

function shortWeek(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

const NUM_FIELDS: { key: keyof WeeklyKpiInputState; label: string }[] = [
  { key: 'prospectsContacted', label: 'Prospects contactés' },
  { key: 'replies', label: 'Réponses' },
  { key: 'callsHeld', label: 'Calls tenus' },
  { key: 'postsLinkedin', label: 'Posts LinkedIn' },
  { key: 'postsInstagram', label: 'Posts Instagram' },
]

interface WeeklyKpiInputState {
  prospectsContacted: string
  replies: string
  callsHeld: string
  postsLinkedin: string
  postsInstagram: string
  whatWorked: string
  whatDidnt: string
  oneChange: string
}

function fromRow(row: WeeklyKpi | null): WeeklyKpiInputState {
  return {
    prospectsContacted: String(row?.prospects_contacted ?? ''),
    replies: String(row?.replies ?? ''),
    callsHeld: String(row?.calls_held ?? ''),
    postsLinkedin: String(row?.posts_linkedin ?? ''),
    postsInstagram: String(row?.posts_instagram ?? ''),
    whatWorked: row?.what_worked ?? '',
    whatDidnt: row?.what_didnt ?? '',
    oneChange: row?.one_change ?? '',
  }
}

export default function KpisClient({ data }: { data: WeeklyKpiData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<WeeklyKpiInputState>(fromRow(data.current))

  function set<K extends keyof WeeklyKpiInputState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function save() {
    startTransition(async () => {
      const res = await upsertWeeklyKpi(data.currentWeekStart, {
        prospectsContacted: Number(form.prospectsContacted) || 0,
        replies: Number(form.replies) || 0,
        callsHeld: Number(form.callsHeld) || 0,
        postsLinkedin: Number(form.postsLinkedin) || 0,
        postsInstagram: Number(form.postsInstagram) || 0,
        whatWorked: form.whatWorked,
        whatDidnt: form.whatDidnt,
        oneChange: form.oneChange,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success('KPIs enregistrés ✓')
      router.refresh()
    })
  }

  const chartData = data.weeks.map((w) => ({
    week: shortWeek(w.week_start),
    Prospects: w.prospects_contacted,
    Réponses: w.replies,
    Calls: w.calls_held,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">KPIs hebdo</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          Revue de la semaine du {fmtRange(data.currentWeekStart)}
        </p>
      </div>

      {/* Auto depuis Finance/CRM */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Banknote} label="CA signé cette semaine" value={`${Math.round(data.autoCaSigned).toLocaleString('fr-FR')} €`} color="#00D76B" />
        <StatCard icon={Handshake} label="Deals signés" value={data.autoDeals} color="#A78BFA" />
      </div>

      {/* Saisie */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Cette semaine</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {NUM_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">{f.label}</label>
              <input
                type="number"
                inputMode="numeric"
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder="0"
                className={field}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Ce qui a marché</label>
            <textarea rows={2} value={form.whatWorked} onChange={(e) => set('whatWorked', e.target.value)} className={`${field} resize-none`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Ce qui n&apos;a pas marché</label>
            <textarea rows={2} value={form.whatDidnt} onChange={(e) => set('whatDidnt', e.target.value)} className={`${field} resize-none`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#00D76B] mb-1">1 seul changement pour la semaine prochaine</label>
            <textarea rows={2} value={form.oneChange} onChange={(e) => set('oneChange', e.target.value)} className={`${field} resize-none border-[#00D76B]/30`} />
          </div>
        </div>

        <button
          onClick={save}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Enregistrer la semaine
        </button>
      </div>

      {/* Tendance 8 semaines */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#00D76B]" />
            Tendance — 8 dernières semaines
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-[#666666]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#3B82F6]" /> Prospects</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#A78BFA]" /> Réponses</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#00D76B]" /> Calls</span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center">
            <p className="text-xs text-[#555555] italic">Aucune donnée hebdo pour le moment.</p>
          </div>
        ) : (
          <KpisTrendChart data={chartData} />
        )}
      </div>
    </div>
  )
}
