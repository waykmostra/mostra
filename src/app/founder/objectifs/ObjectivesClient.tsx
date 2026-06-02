'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Star,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Target,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ObjectiveMetric, ObjectiveWithProgress } from '@/lib/types'
import {
  createObjective,
  updateObjective,
  togglePriority,
  deleteObjective,
} from './actions'

const METRIC_META: Record<ObjectiveMetric, { label: string; auto: boolean; money: boolean }> = {
  manual:          { label: 'Manuel',        auto: false, money: false },
  revenue_month:   { label: 'CA du mois',    auto: true,  money: true },
  new_leads_month: { label: 'Leads du mois', auto: true,  money: false },
  calls_booked:    { label: 'Calls bookés',  auto: true,  money: false },
}

function fmt(value: number, money: boolean): string {
  if (money) return `${Math.round(value).toLocaleString('fr-FR')} €`
  return value.toLocaleString('fr-FR')
}

function daysLeft(deadline: string): number {
  const d = new Date(deadline)
  d.setHours(23, 59, 59, 999)
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

export default function ObjectivesClient({ objectives }: { objectives: ObjectiveWithProgress[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Objectifs</h1>
          <p className="text-sm text-[#666666] mt-0.5">
            {objectives.length} objectif{objectives.length !== 1 ? 's' : ''} — progression auto depuis Finance &amp; CRM
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvel objectif
        </button>
      </div>

      {adding && <AddForm onDone={() => { setAdding(false); router.refresh() }} />}

      {objectives.length === 0 && !adding ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <Target className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666]">Aucun objectif. Crée ton premier objectif.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {objectives.map((o) => (
            <ObjectiveCard key={o.id} objective={o} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Carte objectif ──────────────────────────────────────────────────────────

function ObjectiveCard({
  objective: o,
  onChanged,
}: {
  objective: ObjectiveWithProgress
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const meta = METRIC_META[o.metric]

  const [label, setLabel] = useState(o.label)
  const [target, setTarget] = useState(String(o.target_value))
  const [manual, setManual] = useState(String(o.manual_value))
  const [deadline, setDeadline] = useState(o.deadline ?? '')

  const pct = o.target_value > 0 ? Math.min(100, Math.round((o.current_value / o.target_value) * 100)) : 0
  const reached = o.current_value >= o.target_value && o.target_value > 0
  const dl = o.deadline ? daysLeft(o.deadline) : null

  function save() {
    startTransition(async () => {
      const res = await updateObjective(o.id, {
        label,
        targetValue: Number(target) || 0,
        manualValue: meta.auto ? undefined : Number(manual) || 0,
        deadline: deadline || null,
      })
      if (!res.success) { toast.error(res.error); return }
      setEditing(false)
      onChanged()
    })
  }

  function star() {
    startTransition(async () => {
      const res = await togglePriority(o.id, !o.is_priority)
      if (!res.success) { toast.error(res.error); return }
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteObjective(o.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Objectif supprimé')
      onChanged()
    })
  }

  return (
    <div className={`bg-[#111111] border rounded-xl p-5 ${o.is_priority ? 'border-[#00D76B]/30' : 'border-[#1a1a1a]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={field} />
          ) : (
            <div className="flex items-center gap-2">
              {o.is_priority && <Zap className="h-4 w-4 text-[#00D76B] flex-shrink-0" />}
              <h3 className="text-sm font-semibold text-white truncate">{o.label}</h3>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#666666] bg-[#1a1a1a] px-1.5 py-0.5 rounded">
              {meta.label}
            </span>
            {meta.auto && <span className="text-[10px] text-[#00D76B]">auto</span>}
            {dl !== null && (
              <span className={`text-[10px] ${dl < 0 ? 'text-[#EF4444]' : dl <= 7 ? 'text-[#F59E0B]' : 'text-[#555555]'}`}>
                {dl < 0 ? `${Math.abs(dl)}j de retard` : dl === 0 ? "aujourd'hui" : `J-${dl}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={star}
            disabled={isPending}
            aria-label="Priorité"
            title="Objectif prioritaire"
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors
              ${o.is_priority ? 'text-[#00D76B]' : 'text-[#555555] hover:text-white hover:bg-[#1a1a1a]'}`}
          >
            <Star className="h-4 w-4" fill={o.is_priority ? '#00D76B' : 'none'} />
          </button>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Modifier"
              className="w-8 h-8 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={remove}
            disabled={isPending}
            aria-label="Supprimer"
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Cible</label>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
          </div>
          {!meta.auto && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Valeur actuelle</label>
              <input type="number" value={manual} onChange={(e) => setManual(e.target.value)} className={field} />
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${field} [color-scheme:dark]`} />
          </div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <button
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              onClick={() => { setEditing(false); setLabel(o.label); setTarget(String(o.target_value)); setManual(String(o.manual_value)); setDeadline(o.deadline ?? '') }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-[#888888] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm text-white font-medium tabular-nums">
              {fmt(o.current_value, meta.money)}
              <span className="text-[#555555] font-normal"> / {fmt(o.target_value, meta.money)}</span>
            </span>
            <span className={`text-xs font-semibold tabular-nums ${reached ? 'text-[#00D76B]' : 'text-[#888888]'}`}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1f1f1f] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: reached ? '#00D76B' : '#3B82F6' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulaire de création ──────────────────────────────────────────────────

function AddForm({ onDone }: { onDone: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [label, setLabel] = useState('')
  const [metric, setMetric] = useState<ObjectiveMetric>('manual')
  const [target, setTarget] = useState('')
  const [manual, setManual] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState(false)

  function submit() {
    if (!label.trim()) return toast.error('Le libellé est requis.')
    startTransition(async () => {
      const res = await createObjective({
        label,
        metric,
        targetValue: Number(target) || 0,
        manualValue: metric === 'manual' ? Number(manual) || 0 : undefined,
        deadline: deadline || null,
        isPriority: priority,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success('Objectif créé ✓')
      onDone()
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white">Nouvel objectif</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Libellé *</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. 10 000 € de CA en juin" className={field} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Type</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value as ObjectiveMetric)} className={`${field} cursor-pointer`}>
            {(Object.keys(METRIC_META) as ObjectiveMetric[]).map((m) => (
              <option key={m} value={m} className="bg-[#1a1a1a]">{METRIC_META[m].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Cible</label>
          <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" className={field} />
        </div>
        {metric === 'manual' && (
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Valeur actuelle</label>
            <input type="number" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="0" className={field} />
          </div>
        )}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Deadline</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${field} [color-scheme:dark]`} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#aaaaaa] cursor-pointer">
        <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} className="accent-[#00D76B]" />
        Objectif prioritaire (affiché sur le dashboard)
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Créer
        </button>
        <button onClick={onDone} className="px-4 py-2 rounded-lg text-sm text-[#888888] hover:text-white transition-colors">
          Annuler
        </button>
      </div>
    </div>
  )
}
