import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getDataSetFull } from '@/lib/supabase/data'
import DataSetClient from '../DataSetClient'

export const metadata: Metadata = {
  title: 'Base Data — MOSTRA',
}

export default async function DataSetPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const full = await getDataSetFull(supabase, params.id)
  if (!full) redirect('/founder/data')

  return <DataSetClient set={full.set} columns={full.columns} entries={full.entries} />
}
