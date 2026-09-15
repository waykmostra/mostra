import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Users, CircleCheck, Briefcase } from 'lucide-react'
import { StatCard, StatRow } from '@/components/shared/StatCard'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getTeamMembersWithRoles, getTeamRoles } from '@/lib/supabase/team'
import TeamView from './TeamView'

export const metadata: Metadata = {
  title: 'Équipe — MOSTRA',
  description: 'Annuaire des intervenants : motion designers, voix off, monteurs, DA…',
}

export default async function TeamPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [members, roles] = await Promise.all([
    getTeamMembersWithRoles(supabase),
    getTeamRoles(supabase),
  ])

  const total = members.length
  const availableCount = members.filter((m) => m.availability === 'active').length

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Équipe</h1>
          <p className="text-sm text-faint mt-0.5">
            {total} intervenant{total !== 1 ? 's' : ''} — freelances & collaborateurs, par métier
          </p>
        </div>
        <Link
          href="/team/new"
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            bg-brand text-ink hover:bg-brand
            transition-colors flex-shrink-0
          "
        >
          <UserPlus className="h-4 w-4" />
          Nouvel intervenant
        </Link>
      </div>

      <StatRow>
        <StatCard icon={Users} label="Intervenants" value={total} />
        <StatCard icon={CircleCheck} label="Disponibles" value={availableCount} />
        <StatCard icon={Briefcase} label="Métiers" value={roles.length} />
      </StatRow>

      {/* ── Annuaire (sections par métier) ────────────────────────── */}
      <TeamView initialMembers={members} initialRoles={roles} />
    </div>
  )
}
