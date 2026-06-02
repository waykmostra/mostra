import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getProspects } from '@/lib/supabase/queries'
import ProspectionClient from './ProspectionClient'

export const metadata: Metadata = {
  title: 'Prospection — MOSTRA',
  description: 'Liste dense des prospects froids, triée par date de relance.',
}

export default async function ProspectionPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const prospects = await getProspects(supabase)

  return <ProspectionClient prospects={prospects} />
}
