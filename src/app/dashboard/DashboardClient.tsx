'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Plus,
  UserPlus,
  Flag,
  ArrowRight,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  TrendingUp,
  Coins,
  UserCheck,
  PackageCheck,
  FolderKanban,
} from 'lucide-react'
import type { ProjectSummary } from '@/lib/types'
import type { WeeklyKpiData } from '@/lib/supabase/kpi'

interface Props {
  projects: ProjectSummary[]
  kpi: WeeklyKpiData
  userName: string
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
function eur(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}
function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

const LATE = 'var(--c-late)'
const SOON = 'var(--c-soon)'
const OK = 'var(--c-ok)'

export default function DashboardClient({ projects, kpi, userName }: Props) {
  const data = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const clientName = (p: ProjectSummary) =>
      p.client ? p.client.company_name || p.client.contact_name : null

    const active = projects.filter((p) => p.status === 'active')

    const dated = active
      .filter((p) => p.deadline)
      .map((p) => ({ ...p, days: daysUntil(p.deadline as string), client: clientName(p) }))
      .sort((a, b) => a.days - b.days)
    const overdueDeadline = dated.filter((p) => p.days < 0)
    const dueSoon = dated.filter((p) => p.days >= 0 && p.days <= 7)
    const focus = dated.slice(0, 6)

    const caMonth = projects
      .filter((p) => p.payment_status === 'paid' && new Date(p.updated_at) >= monthStart)
      .reduce((s, p) => s + (p.value_eur ?? 0), 0)

    const toInvoiceList = projects
      .filter((p) => p.payment_status === 'pending' && p.status !== 'archived' && (p.value_eur ?? 0) > 0)
      .map((p) => ({ id: p.id, name: p.name, client: clientName(p), value: p.value_eur ?? 0 }))
      .sort((a, b) => b.value - a.value)
    const toInvoiceTotal = toInvoiceList.reduce((s, p) => s + p.value, 0)

    const overdueList = projects
      .filter((p) => p.payment_status === 'overdue')
      .map((p) => ({ id: p.id, name: p.name, client: clientName(p), value: p.value_eur ?? 0 }))
      .sort((a, b) => b.value - a.value)
    const overdueTotal = overdueList.reduce((s, p) => s + p.value, 0)

    const topProjects = [...active]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map((p) => ({ ...p, client: clientName(p) }))

    const parts: string[] = []
    if (overdueDeadline.length)
      parts.push(`${overdueDeadline.length} projet${overdueDeadline.length > 1 ? 's' : ''} en retard`)
    if (dueSoon.length)
      parts.push(`${dueSoon.length} échéance${dueSoon.length > 1 ? 's' : ''} cette semaine`)
    const summary = parts.length ? cap(parts.join(' et ')) : 'Rien d’urgent — bonne journée.'
    const summaryColor = overdueDeadline.length ? LATE : dueSoon.length ? SOON : OK

    return {
      activeCount: active.length,
      overdueCount: overdueDeadline.length,
      dueSoonCount: dueSoon.length,
      caMonth,
      focus,
      toInvoiceList,
      toInvoiceTotal,
      overdueList,
      overdueTotal,
      topProjects,
      summary,
      summaryColor,
    }
  }, [projects])

  const dateLabel = cap(
    new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  )
  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir'

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-[18px]">
        <span
          className="w-[58px] h-[58px] rounded-2xl grid place-items-center font-display font-semibold text-2xl flex-shrink-0"
          style={{ background: 'var(--ink)', color: 'var(--ink-text)' }}
        >
          {userName[0]?.toUpperCase() ?? 'M'}
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-faint">{dateLabel}</p>
          <h1 className="font-display font-semibold text-[26px] tracking-tight leading-tight mt-0.5 text-ink">
            {greeting}, {userName}.
          </h1>
          <p className="text-[13.5px] text-dim flex items-center gap-2 mt-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: data.summaryColor }}
            />
            {data.summary}
          </p>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line border border-line rounded-2xl overflow-hidden bg-surface">
        <StatCell label="Projets actifs" value={data.activeCount} />
        <StatCell label="En retard" value={data.overdueCount} accent={data.overdueCount ? LATE : undefined} />
        <StatCell label="Cette semaine" value={data.dueSoonCount} accent={data.dueSoonCount ? SOON : undefined} />
        <StatCell label="Encaissé ce mois" value={eur(data.caMonth)} accent={data.caMonth ? OK : undefined} />
      </div>

      {/* ── Focus + Argent à venir ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        {/* Focus du jour */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-base flex items-center gap-2 text-ink">
              <Flag className="w-4 h-4 text-brand" /> Focus du jour
            </h2>
            <Link
              href="/projects"
              className="text-[12.5px] font-medium text-dim hover:text-ink flex items-center gap-1 transition-colors"
            >
              Tous les projets <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {data.focus.length === 0 ? (
            <div className="border border-dashed border-line rounded-2xl py-12 px-6 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="w-6 h-6 text-faint" />
              <p className="text-[13.5px] text-dim">Aucune échéance à venir. Tout est sous contrôle.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.focus.map((p) => {
                const color = p.days < 0 ? LATE : p.days <= 7 ? SOON : OK
                const lbl = p.days < 0 ? `Retard ${-p.days} j` : p.days === 0 ? "Aujourd'hui" : `Dans ${p.days} j`
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface hover:border-line-strong transition-colors"
                  >
                    <span className="w-[3px] h-9 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--c-brand))' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate text-ink">{p.name}</div>
                      {p.client && <div className="text-[12px] text-faint truncate">{p.client}</div>}
                    </div>
                    <span className="text-[12.5px] font-medium tnum flex-shrink-0" style={{ color }}>
                      {lbl}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Argent à venir */}
        <section className="border border-line rounded-2xl bg-surface p-4 flex flex-col gap-4">
          <MoneyRow
            icon={<Receipt className="w-4 h-4" style={{ color: SOON }} />}
            label="À facturer"
            total={data.toInvoiceTotal}
            count={data.toInvoiceList.length}
            items={data.toInvoiceList.slice(0, 3)}
            color={SOON}
          />
          <div className="h-px bg-line" />
          <MoneyRow
            icon={<AlertTriangle className="w-4 h-4" style={{ color: LATE }} />}
            label="Impayés"
            total={data.overdueTotal}
            count={data.overdueList.length}
            items={data.overdueList.slice(0, 3)}
            color={LATE}
          />
        </section>
      </div>

      {/* ── KPI hebdo (auto) ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base flex items-center gap-2 text-ink">
            <TrendingUp className="w-4 h-4 text-brand" /> KPI cette semaine
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiMini icon={UserCheck} label="Nouveaux clients" value={kpi.autoNewClients} color="#22C55E" />
          <KpiMini icon={PackageCheck} label="Projets livrés" value={kpi.autoProjectsDelivered} color="#A78BFA" />
          <KpiMini icon={FolderKanban} label="Projets actifs" value={kpi.autoActiveProjects} color="#3B82F6" />
          <KpiMini icon={Coins} label="CA encaissé" value={eur(kpi.autoCaCollected)} color="#14B8A6" />
        </div>
      </section>

      {/* ── Projets en cours ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base flex items-center gap-2 text-ink">
            <PackageCheck className="w-4 h-4 text-brand" /> Projets en cours
          </h2>
          <Link
            href="/projects"
            className="text-[12.5px] font-medium text-dim hover:text-ink flex items-center gap-1 transition-colors"
          >
            Voir tout <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {data.topProjects.length === 0 ? (
          <div className="border border-dashed border-line rounded-2xl py-10 px-6 text-center">
            <p className="text-[13.5px] text-dim">Aucun projet actif.</p>
          </div>
        ) : (
          <div className="border border-line rounded-2xl bg-surface overflow-hidden divide-y divide-line">
            {data.topProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate text-ink">{p.name}</div>
                  {p.client && <div className="text-[12px] text-faint truncate">{p.client}</div>}
                </div>
                <div className="hidden sm:flex items-center gap-2 w-40 flex-shrink-0">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${p.progress ?? 0}%`, background: 'rgb(var(--c-brand))' }}
                    />
                  </div>
                  <span className="text-[11px] text-faint tnum w-8 text-right">{p.progress ?? 0}%</span>
                </div>
                <ArrowRight className="w-4 h-4 text-faint flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Actions rapides ──────────────────────────────────── */}
      <section>
        <h2 className="font-display text-[13px] uppercase tracking-[0.08em] font-semibold text-dim mb-3">
          Actions rapides
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/projects/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Nouveau projet
          </Link>
          <Link href="/clients/new" className="btn-secondary">
            <UserPlus className="w-4 h-4" /> Nouveau client
          </Link>
        </div>
      </section>
    </div>
  )
}

// ─── Sous-composants ────────────────────────────────────────────

function StatCell({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11.5px] text-faint">{label}</div>
      <div
        className="tnum font-display font-semibold text-[24px] mt-1.5 leading-none text-ink"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function KpiMini({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof UserPlus
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="border border-line rounded-xl bg-surface p-3.5 flex flex-col gap-2">
      <span
        className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <div className="tnum font-semibold text-[17px] leading-none text-ink">{value}</div>
        <div className="text-[11px] text-faint mt-1">{label}</div>
      </div>
    </div>
  )
}

function MoneyRow({
  icon,
  label,
  total,
  count,
  items,
  color,
}: {
  icon: React.ReactNode
  label: string
  total: number
  count: number
  items: { id: string; name: string; client: string | null; value: number }[]
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-ink flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="tnum text-[15px] font-semibold" style={{ color }}>
          {eur(total)}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-[12px] text-faint">Rien à signaler.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between gap-2 text-[12.5px] hover:text-ink text-dim transition-colors"
            >
              <span className="truncate">{p.name}</span>
              <span className="tnum text-faint flex-shrink-0">{eur(p.value)}</span>
            </Link>
          ))}
          {count > items.length && (
            <p className="text-[11px] text-faint mt-0.5">+{count - items.length} autre{count - items.length > 1 ? 's' : ''}</p>
          )}
        </div>
      )}
    </div>
  )
}
