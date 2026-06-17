import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientDashboardTabs from './ClientDashboardTabs'
import type { Project, ProjectPhase } from '@/lib/types'

// Lecture toujours fraîche (statuts/avancement des projets côté client).
export const dynamic = 'force-dynamic'

type ProjectRow = Project & { project_phases: ProjectPhase[] }

export default async function ClientDashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // 1. Résoudre le clients row du user via profile_id, en parallèle avec le profile.
  const [crmClientResult, profileResult] = await Promise.all([
    admin.from('clients').select('id').eq('profile_id', user.id).maybeSingle(),
    admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
  ])

  const crmClientId = (crmClientResult.data as { id: string } | null)?.id ?? null
  const profileData = profileResult.data as { full_name: string; email: string } | null

  // 2. Récupérer les projets uniquement si on a une fiche CRM liée
  const rawProjects: ProjectRow[] = crmClientId
    ? (((await admin
        .from('projects')
        .select('*, project_phases(*)')
        .eq('client_id', crmClientId)
        .order('updated_at', { ascending: false })).data as unknown as ProjectRow[] | null) ?? [])
    : []

  // Construire la liste de projets avec la phase courante
  const projects = rawProjects.map((project) => {
    const phases = [...project.project_phases].sort(
      (a, b) => a.sort_order - b.sort_order,
    )
    const currentPhase =
      phases.find(
        (ph) => ph.status !== 'completed' && ph.status !== 'approved',
      ) ??
      phases[phases.length - 1] ??
      null

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      progress: project.progress,
      share_token: project.share_token,
      updated_at: project.updated_at,
      currentPhaseName: currentPhase?.name ?? null,
    }
  })

  const profile = {
    fullName: profileData?.full_name ?? user.email ?? 'Utilisateur',
    email: profileData?.email ?? user.email ?? '',
  }

  return (
    <ClientDashboardTabs projects={projects} profile={profile} />
  )
}
