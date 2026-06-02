import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getObjectivesWithProgress } from '@/lib/supabase/founder'
import ObjectivesClient from './ObjectivesClient'

export const metadata: Metadata = {
  title: 'Objectifs — MOSTRA',
  description: 'Objectifs avec deadline et progression automatique.',
}

export default async function ObjectivesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const objectives = await getObjectivesWithProgress(supabase)

  return <ObjectivesClient objectives={objectives} />
}
