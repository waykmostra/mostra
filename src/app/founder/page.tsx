import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CheckSquare,
  Flame,
  Target,
  Calendar,
  Eye,
  AlertTriangle,
  ArrowRight,
  Columns3,
  TrendingUp,
  StickyNote,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getFounderDashboard } from '@/lib/supabase/founder'
import { STAGE_META } from '@/components/founder/pipelineMeta'
import type { ObjectiveWithProgress } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Cockpit — MOSTRA',
  description: "Vue d'ensemble : workflow du jour, objectif prioritaire, relances, veille.",
}

function todayLabel(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtObjective(o: ObjectiveWithProgress): string {
  const money = o.metric === 'revenue_month'
  const fmt = (n: number) => (money ? `${Math.round(n).toLocaleString('fr-FR')} €` : String(n))
  return `${fmt(o.current_value)} / ${fmt(o.target_value)}`
}

export default async function FounderDashboard() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { workflow, priorityObjective, prospectsDueToday, veille } = await getFounderDashboard(supabase)

  const workflowPct = workflow.total > 0 ? Math.round((workflow.done / workflow.total) * 100) : 0
  const objPct =
    priorityObjective && priorityObjective.target_value > 0
      ? Math.min(100, Math.round((priorityObjective.current_value / priorityObjective.target_value) * 100))
      : 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white">Cockpit</h1>
        <p className="text-sm text-[#666666] mt-0.5">{todayLabel()}</p>
      </div>

      {/* Rangée 1 : Workflow + Objectif prioritaire */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Workflow du jour */}
        <Link
          href="/founder/workflow"
          className="group bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-[#00D76B]" />
              <h2 className="text-sm font-semibold text-white">Workflow du jour</h2>
            </div>
            {workflow.streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-[#F59E0B]">
                <Flame className="h-3.5 w-3.5" />
                {workflow.streak}j
              </span>
            )}
          </div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl font-bold text-white">
              {workflow.done}
              <span className="text-[#444444] text-lg">/{workflow.total}</span>
            </span>
            <span className="text-xs text-[#666666]">{workflowPct}%</span>
          </div>
          <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full bg-[#00D76B] rounded-full transition-all" style={{ width: `${workflowPct}%` }} />
          </div>
        </Link>

        {/* Objectif prioritaire */}
        <Link
          href="/founder/objectifs"
          className="group bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-[#A78BFA]" />
            <h2 className="text-sm font-semibold text-white">Objectif prioritaire</h2>
          </div>
          {priorityObjective ? (
            <>
              <p className="text-sm text-white truncate mb-2">{priorityObjective.label}</p>
              <div className="flex items-end justify-between mb-2">
                <span className="text-lg font-bold text-white">{fmtObjective(priorityObjective)}</span>
                <span className="text-xs text-[#666666]">{objPct}%</span>
              </div>
              <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className="h-full bg-[#A78BFA] rounded-full transition-all" style={{ width: `${objPct}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-[#555555] italic">Aucun objectif défini.</p>
          )}
        </Link>
      </div>

      {/* Relances du jour */}
      <Link
        href="/founder/prospection"
        className="block bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-white">Relances du jour</h2>
          </div>
          <span className="text-xs text-[#666666]">{prospectsDueToday.length}</span>
        </div>
        {prospectsDueToday.length === 0 ? (
          <p className="text-sm text-[#555555] italic">Aucune relance prévue aujourd&apos;hui.</p>
        ) : (
          <div className="space-y-1.5">
            {prospectsDueToday.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-1">
                <div className="min-w-0 truncate">
                  <span className="text-sm text-white">{p.contact_name}</span>
                  {p.company_name && <span className="text-xs text-[#555555]"> · {p.company_name}</span>}
                </div>
                {p.pipeline_stage && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      color: STAGE_META[p.pipeline_stage].color,
                      backgroundColor: `${STAGE_META[p.pipeline_stage].color}1a`,
                    }}
                  >
                    {STAGE_META[p.pipeline_stage].label}
                  </span>
                )}
              </div>
            ))}
            {prospectsDueToday.length > 6 && (
              <p className="text-xs text-[#555555] pt-1">+{prospectsDueToday.length - 6} autres…</p>
            )}
          </div>
        )}
      </Link>

      {/* Veille concurrentielle */}
      <Link
        href="/founder/veille"
        className={`block rounded-xl p-5 transition-colors ${
          veille.isStale
            ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/30 hover:border-[#F59E0B]/50'
            : 'bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Eye className={`h-4 w-4 ${veille.isStale ? 'text-[#F59E0B]' : 'text-[#666666]'}`} />
          <h2 className="text-sm font-semibold text-white">Veille concurrentielle</h2>
        </div>
        {veille.isStale ? (
          <div className="flex items-center gap-2 text-sm text-[#F59E0B]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {veille.count === 0
                ? 'Aucun concurrent suivi — commence ta veille.'
                : `Pas mise à jour depuis ${veille.staleDays} jours.`}
            </span>
          </div>
        ) : (
          <p className="text-sm text-[#22C55E]">
            À jour · {veille.count} concurrent{veille.count !== 1 ? 's' : ''} suivi{veille.count !== 1 ? 's' : ''}.
          </p>
        )}
      </Link>

      {/* Accès rapide */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#555555] mb-2">Accès rapide</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickTile href="/founder/pipeline" icon={Columns3} label="Pipeline" />
          <QuickTile href="/founder/kpis" icon={TrendingUp} label="KPIs hebdo" />
          <QuickTile href="/founder/notes" icon={StickyNote} label="Notes" />
          <QuickTile href="/founder/wiki" icon={BookOpen} label="Wiki" />
        </div>
      </div>
    </div>
  )
}

function QuickTile({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof Columns3
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-2 bg-[#111111] border border-[#1a1a1a] rounded-xl px-4 py-3 hover:border-[#2a2a2a] transition-colors"
    >
      <span className="flex items-center gap-2 text-sm text-[#cccccc] group-hover:text-white transition-colors">
        <Icon className="h-4 w-4 text-[#666666] group-hover:text-[#00D76B] transition-colors" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-[#444444] group-hover:text-[#666666] transition-colors" />
    </Link>
  )
}
