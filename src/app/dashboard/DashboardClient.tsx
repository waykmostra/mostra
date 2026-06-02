'use client'

import { useMemo, useState } from 'react'
import { Plus, FolderOpen, UserPlus } from 'lucide-react'
import Link from 'next/link'
import DashboardKpis from '@/components/dashboard/DashboardKpis'
import AlertsPanel, { type DeadlineAlert, type InvoiceAlert } from '@/components/dashboard/AlertsPanel'
import ProjectCard from '@/components/dashboard/ProjectCard'
import ProjectFilters, { type FilterTab } from '@/components/dashboard/ProjectFilters'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ProjectSummary, UserRole } from '@/lib/types'

interface Props {
  projects: ProjectSummary[]
  role: UserRole
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export default function DashboardClient({ projects, role }: Props) {
  const canCreate = role === 'admin'
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  // ── Agrégats finance + alertes (dérivés des projets) ──────────────
  const { kpis, deadlineAlerts, toInvoiceList, overdueList } = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const clientName = (p: ProjectSummary) =>
      p.client ? p.client.company_name || p.client.contact_name : null

    const activeCount = projects.filter((p) => p.status === 'active').length

    // CA encaissé ce mois — projets passés à "payé" sur le mois courant.
    const caMonth = projects
      .filter((p) => p.payment_status === 'paid' && new Date(p.updated_at) >= monthStart)
      .reduce((s, p) => s + (p.value_eur ?? 0), 0)

    const toInvoiceList: InvoiceAlert[] = projects
      .filter(
        (p) => p.payment_status === 'pending' && p.status !== 'archived' && (p.value_eur ?? 0) > 0,
      )
      .map((p) => ({ id: p.id, name: p.name, clientName: clientName(p), value: p.value_eur ?? 0 }))
      .sort((a, b) => b.value - a.value)

    const toInvoice = toInvoiceList.reduce((s, p) => s + p.value, 0)

    const overdueList: InvoiceAlert[] = projects
      .filter((p) => p.payment_status === 'overdue')
      .map((p) => ({ id: p.id, name: p.name, clientName: clientName(p), value: p.value_eur ?? 0 }))
      .sort((a, b) => b.value - a.value)

    const deadlineAlerts: DeadlineAlert[] = projects
      .filter((p) => p.deadline && p.status === 'active')
      .map((p) => ({
        id: p.id,
        name: p.name,
        clientName: clientName(p),
        deadline: p.deadline as string,
        days: daysUntil(p.deadline as string),
      }))
      .filter((p) => p.days <= 7)
      .sort((a, b) => a.days - b.days)

    return {
      kpis: { activeCount, caMonth, toInvoice, deadlineSoonCount: deadlineAlerts.length },
      deadlineAlerts,
      toInvoiceList,
      overdueList,
    }
  }, [projects])

  const filtered = projects.filter((p) => {
    const matchFilter = activeFilter === 'all' || p.status === activeFilter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="space-y-6">
      {/* Header + actions rapides */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-[#666666] mt-0.5">Vue d&apos;ensemble de l&apos;agence</p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/clients/new"
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Nouveau client
            </Link>
            <Link
              href="/projects/new"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nouveau projet
            </Link>
            {/* Mobile : icônes compactes */}
            <Link
              href="/clients/new"
              aria-label="Nouveau client"
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors"
            >
              <UserPlus className="h-4 w-4" />
            </Link>
            <Link
              href="/projects/new"
              aria-label="Nouveau projet"
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* KPIs */}
      <DashboardKpis {...kpis} />

      {/* Alertes & actions */}
      <AlertsPanel
        deadlineAlerts={deadlineAlerts}
        toInvoiceList={toInvoiceList}
        overdueList={overdueList}
      />

      {/* Projets */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Projets</h2>

        <ProjectFilters
          activeFilter={activeFilter}
          search={search}
          onFilterChange={setActiveFilter}
          onSearchChange={setSearch}
        />

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet trouvé"
            description={search ? `Aucun résultat pour "${search}"` : undefined}
            action={
              search ? (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-[#00D76B] hover:text-[#00C061] transition-colors"
                >
                  Effacer la recherche
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
