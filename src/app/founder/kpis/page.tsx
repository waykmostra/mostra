import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getWeeklyKpiData } from '@/lib/supabase/founder'
import KpisClient from './KpisClient'

export const metadata: Metadata = {
  title: 'KPIs hebdo — MOSTRA',
  description: 'Revue hebdomadaire : prospection, réponses, calls, posts.',
}

export default async function KpisPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const data = await getWeeklyKpiData(supabase)

  return <KpisClient data={data} />
}
