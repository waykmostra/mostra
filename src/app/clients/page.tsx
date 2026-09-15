import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Building2, CircleDot, Users } from 'lucide-react'
import { StatCard, StatRow } from '@/components/shared/StatCard'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getClientsWithStats, getCompaniesWithStats } from '@/lib/supabase/queries'
import CrmView from './CrmView'

export const metadata: Metadata = {
  title: 'CRM — MOSTRA',
  description: 'Pilotez vos sociétés et contacts : Kanban par statut, fiches, projets.',
}

export default async function ClientsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [companies, clients] = await Promise.all([
    getCompaniesWithStats(supabase),
    getClientsWithStats(supabase),
  ])

  const totalCompanies = companies.length
  const activeCompanies = companies.filter((c) => c.status === 'active').length
  const totalContacts = clients.length

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">CRM</h1>
          <p className="text-sm text-faint mt-0.5">
            {totalCompanies} société{totalCompanies !== 1 ? 's' : ''} · {totalContacts} contact
            {totalContacts !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/clients/companies"
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-surface-2 border border-line text-ink hover:bg-surface-3
              transition-colors
            "
          >
            <Building2 className="h-4 w-4" />
            Gérer les sociétés
          </Link>
          <Link
            href="/clients/new"
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-brand text-ink hover:bg-brand
              transition-colors
            "
          >
            <UserPlus className="h-4 w-4" />
            Nouveau contact
          </Link>
        </div>
      </div>

      <StatRow>
        <StatCard icon={Building2} label="Sociétés" value={totalCompanies} />
        <StatCard icon={CircleDot} label="Actives" value={activeCompanies} />
        <StatCard icon={Users} label="Contacts" value={totalContacts} />
      </StatRow>

      {/* ── CRM (Sociétés Kanban / Contacts) ──────────────────────── */}
      <CrmView companies={companies} clients={clients} />
    </div>
  )
}
