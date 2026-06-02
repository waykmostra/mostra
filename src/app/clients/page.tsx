import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Users, UserCheck, Bell } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getClientsWithStats } from '@/lib/supabase/queries'
import ClientsView from './ClientsView'

export const metadata: Metadata = {
  title: 'CRM Clients — MOSTRA',
  description: 'Gérez vos clients et prospects : Kanban, fiches, interactions.',
}

export default async function ClientsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const clients = await getClientsWithStats(supabase)

  const total       = clients.length
  const activeCount = clients.filter((c) => c.status === 'active').length
  const followUpCount = clients.filter((c) => c.follow_up_pending).length

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">CRM Clients</h1>
          <p className="text-sm text-[#666666] mt-0.5">
            {total} fiche{total !== 1 ? 's' : ''} — prospects, clients actifs et anciens
          </p>
        </div>
        <Link
          href="/clients/new"
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            bg-[#00D76B] text-white hover:bg-[#00C061]
            transition-colors flex-shrink-0
          "
        >
          <UserPlus className="h-4 w-4" />
          Nouveau client
        </Link>
      </div>

      {/* ── Stats cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users}     label="Total"        value={total}         color="#3B82F6" />
        <StatCard icon={UserCheck} label="Actifs"       value={activeCount}   color="#22C55E" />
        <StatCard icon={Bell}      label="Relances en cours" value={followUpCount} color="#F59E0B" />
      </div>

      {/* ── Vue Kanban / Liste ────────────────────────────────────── */}
      <ClientsView initialClients={clients} />
    </div>
  )
}
