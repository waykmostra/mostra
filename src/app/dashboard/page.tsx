import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/supabase/queries'
import { getWeeklyKpiData } from '@/lib/supabase/kpi'
import DashboardClient from './DashboardClient'

export const metadata: Metadata = {
  title: 'Dashboard — MOSTRA',
  description: "Vue d'ensemble pour piloter l'agence.",
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [projects, kpi] = await Promise.all([
    getProjects(supabase),
    getWeeklyKpiData(supabase),
  ])

  const firstName = (profile.full_name ?? '').split(' ')[0] || 'Tarik'

  return <DashboardClient projects={projects} kpi={kpi} userName={firstName} />
}
