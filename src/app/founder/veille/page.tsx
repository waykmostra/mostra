import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getCompetitors } from '@/lib/supabase/founder'
import VeilleClient from './VeilleClient'

export const metadata: Metadata = {
  title: 'Veille — MOSTRA',
  description: 'Veille concurrentielle : positionnement, méthodes, ce que je peux répliquer.',
}

export default async function VeillePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const competitors = await getCompetitors(supabase)

  return <VeilleClient competitors={competitors} />
}
