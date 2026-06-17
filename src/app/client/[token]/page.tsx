import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientProjectView from '@/components/client/ClientProjectView'
import ContactManager from '@/components/client/ContactManager'
import type { Profile, Project, ProjectPhase, SubPhase } from '@/lib/types'

// Toujours lire l'état réel : le client doit voir les ajouts/suppressions/démarrages
// de phases faits côté admin (les actions admin ne revalident pas la route client).
export const dynamic = 'force-dynamic'

interface ClientProjectPageProps {
  params: { token: string }
}

export default async function ClientProjectPage({ params }: ClientProjectPageProps) {
  // Admin client pour bypass RLS — share_token est un accès public légitme
  const admin = createAdminClient()

  // 1. Projet par share_token
  const { data: rawProject } = await admin
    .from('projects')
    .select('*')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Project | null
  if (!project) notFound()

  // 2. Phases (ordonnées)
  const { data: rawPhases } = await admin
    .from('project_phases')
    .select('*')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })

  const phases = (rawPhases as ProjectPhase[] | null) ?? []

  // 3. Sous-phases visibles par le client :
  //    - in_progress : formulaire en attente de remplissage
  //    - in_review, completed, approved : terminées ou à valider
  const subPhasesByPhase: Record<string, SubPhase[]> = {}
  if (phases.length > 0) {
    const phaseIds = phases.map((p) => p.id)
    const { data: rawSubPhases } = await admin
      .from('sub_phases')
      .select('*')
      .in('phase_id', phaseIds)
      .in('status', ['in_progress', 'in_review', 'completed', 'approved'])
      .order('sort_order', { ascending: true })
    ;(rawSubPhases as SubPhase[] | null)?.forEach((sp) => {
      if (!subPhasesByPhase[sp.phase_id]) subPhasesByPhase[sp.phase_id] = []
      subPhasesByPhase[sp.phase_id].push(sp)
    })
  }

  // 4. Project Manager
  let projectManager: Profile | null = null
  if (project.project_manager_id) {
    const { data: rawPm } = await admin
      .from('profiles')
      .select('*')
      .eq('id', project.project_manager_id)
      .maybeSingle()
    projectManager = rawPm as Profile | null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* Gauche — vue projet */}
      <ClientProjectView
        project={project}
        phases={phases}
        subPhasesByPhase={subPhasesByPhase}
        token={params.token}
      />

      {/* Droite — contact PM */}
      <div className="space-y-4">
        <ContactManager projectManager={projectManager} />
      </div>
    </div>
  )
}
