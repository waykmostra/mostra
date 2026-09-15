'use client'

import { useMemo } from 'react'
import FinanceKpis from '@/components/finance/FinanceKpis'
import FinanceChart, { type FinanceChartPoint } from '@/components/finance/FinanceChart'
import ExpensesPanel from '@/components/finance/ExpensesPanel'
import SubscriptionsPanel from '@/components/finance/SubscriptionsPanel'
import RevenuesPanel from '@/components/finance/RevenuesPanel'
import ManualRevenuesPanel from '@/components/finance/ManualRevenuesPanel'
import RecentMovements from '@/components/finance/RecentMovements'
import { monthlyBurn } from '@/components/finance/financeMeta'
import type { ExpenseWithProject, RevenueEntry, RevenueWithClient, Subscription } from '@/lib/types'

interface ProjectOption {
  id: string
  name: string
}

interface ClientOption {
  id: string
  name: string
}

interface Props {
  revenues: RevenueEntry[]
  manualRevenues: RevenueWithClient[]
  expenses: ExpenseWithProject[]
  subscriptions: Subscription[]
  projects: ProjectOption[]
  clients: ClientOption[]
}

const MONTH_LABELS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

export default function FinanceClient({
  revenues,
  manualRevenues,
  expenses,
  subscriptions,
  projects,
  clients,
}: Props) {
  const { kpis, chart, monthLabel } = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // ── KPIs du mois courant ──────────────────────────────────────
    const revenueMonthProjects = revenues
      .filter((r) => r.payment_status === 'paid' && r.paid_at && new Date(r.paid_at) >= monthStart)
      .reduce((s, r) => s + r.value_eur, 0)
    const revenueMonthManual = manualRevenues
      .filter((r) => new Date(r.received_on) >= monthStart)
      .reduce((s, r) => s + r.amount_eur, 0)
    const revenueMonth = revenueMonthProjects + revenueMonthManual

    const expensesMonth = expenses
      .filter((e) => new Date(e.incurred_on) >= monthStart)
      .reduce((s, e) => s + e.amount_eur, 0)

    const subscriptionsMonthly = subscriptions
      .filter((s) => s.active)
      .reduce((s, x) => s + monthlyBurn(x.amount_eur, x.billing_cycle), 0)

    const net = revenueMonth - expensesMonth - subscriptionsMonthly

    // ── Série 6 mois ──────────────────────────────────────────────
    const buckets = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return {
        label: MONTH_LABELS[d.getMonth()],
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1), // exclusif
        revenue: 0,
        outflow: 0,
      }
    })

    const inBucket = (t: Date) => buckets.find((b) => t >= b.start && t < b.end)

    for (const r of revenues) {
      if (r.payment_status !== 'paid' || !r.paid_at) continue
      const b = inBucket(new Date(r.paid_at))
      if (b) b.revenue += r.value_eur
    }
    for (const r of manualRevenues) {
      const b = inBucket(new Date(r.received_on))
      if (b) b.revenue += r.amount_eur
    }
    for (const e of expenses) {
      const b = inBucket(new Date(e.incurred_on))
      if (b) b.outflow += e.amount_eur
    }
    // Abonnements actifs : charge mensualisée à partir du mois de souscription.
    for (const s of subscriptions) {
      if (!s.active) continue
      const burn = monthlyBurn(s.amount_eur, s.billing_cycle)
      const started = new Date(s.started_on)
      for (const b of buckets) {
        if (started < b.end) b.outflow += burn
      }
    }

    const chart: FinanceChartPoint[] = buckets.map((b) => ({
      month: b.label,
      revenue: Math.round(b.revenue),
      outflow: Math.round(b.outflow),
    }))

    const monthLabel = `${MONTH_LABELS[now.getMonth()]} ${now.getFullYear()}`

    return {
      kpis: {
        revenue: revenueMonth,
        expenses: expensesMonth,
        subscriptions: subscriptionsMonthly,
        net,
      },
      chart,
      monthLabel,
    }
  }, [revenues, manualRevenues, expenses, subscriptions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-ink">Finance</h1>
        <p className="text-sm text-faint mt-0.5 capitalize">Cashflow — {monthLabel}</p>
      </div>

      {/* KPIs */}
      <FinanceKpis {...kpis} />

      {/* Graphe 6 mois */}
      <FinanceChart data={chart} />

      {/* Historique — 5 derniers mouvements */}
      <RecentMovements
        expenses={expenses}
        revenues={revenues}
        manualRevenues={manualRevenues}
      />

      {/* Dépenses + Abonnements */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <ExpensesPanel expenses={expenses} projects={projects} />
        <SubscriptionsPanel subscriptions={subscriptions} />
      </div>

      {/* Revenus libres (éditable) */}
      <ManualRevenuesPanel revenues={manualRevenues} clients={clients} />

      {/* Revenus dérivés des projets (lecture seule) */}
      <RevenuesPanel revenues={revenues} />
    </div>
  )
}
