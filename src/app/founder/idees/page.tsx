import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getContentIdeas } from '@/lib/supabase/founder'
import IdeasClient from './IdeasClient'

export const metadata: Metadata = {
  title: 'Idées — MOSTRA',
  description: 'Inbox des idées de contenu : LinkedIn, Instagram, X.',
}

export default async function IdeesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const ideas = await getContentIdeas(supabase)

  return <IdeasClient ideas={ideas} />
}
