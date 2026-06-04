import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getNotesData } from '@/lib/supabase/notes'
import NotesClient from './NotesClient'

export const metadata: Metadata = {
  title: 'Notes — MOSTRA',
  description: 'Notes organisées en groupes personnalisables.',
}

export default async function NotesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { groups, notes } = await getNotesData(supabase)

  return <NotesClient groups={groups} notes={notes} />
}
