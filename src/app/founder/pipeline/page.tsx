import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getPipelineProspects } from '@/lib/supabase/founder'
import PipelineClient from './PipelineClient'

export const metadata: Metadata = {
  title: 'Pipeline — MOSTRA',
  description: 'Kanban des prospects chauds : répondu, call booké, proposition.',
}

export default async function PipelinePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const prospects = await getPipelineProspects(supabase)

  return <PipelineClient initialProspects={prospects} />
}
