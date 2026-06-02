import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { getCurrentProfile } from '@/lib/auth'
import DraggablePhaseList from '@/components/settings/DraggablePhaseList'
import type { PhaseTemplate } from '@/lib/types'

export default async function PipelineSettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { data: rawTemplates } = await db(supabase)
    .from('phase_templates')
    .select('id, name, slug, icon, sort_order, is_default, sub_phases, created_at')
    .eq('is_default', true)
    .order('sort_order', { ascending: true })

  const templates: PhaseTemplate[] = (rawTemplates ?? []) as PhaseTemplate[]

  return (
    <div className="max-w-2xl">
      <DraggablePhaseList initialTemplates={templates} />
    </div>
  )
}
