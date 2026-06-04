import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getDataSets, getEntryCounts } from '@/lib/supabase/data'
import DataListClient from './DataListClient'

export const metadata: Metadata = {
  title: 'Data — MOSTRA',
  description: 'Bases de statistiques personnalisables.',
}

export default async function DataPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [sets, counts] = await Promise.all([getDataSets(supabase), getEntryCounts(supabase)])

  return <DataListClient sets={sets} counts={counts} />
}
