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

  // 1. Profil de l'utilisateur (nom + email).
  const { data: rawProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()
  const profileData = rawProfile as { full_name: string; email: string } | null
  const email = profileData?.email ?? user.email ?? null

  // 2. Toutes les fiches CRM de l'utilisateur — par compte lié (profile_id) OU email.
  //    Tolère les fiches en double pour le même email (projet assigné à l'une, compte sur l'autre).
  const orFilter = email
    ? `profile_id.eq.${user.id},email.eq.${email}`
    : `profile_id.eq.${user.id}`
  const { data: rawClients } = await admin.from('clients').select('id').or(orFilter)
  const clientIds = [...new Set(((rawClients as { id: string }[] | null) ?? []).map((c) => c.id))]

  // 2b. Projets où l'utilisateur est client ADDITIONNEL (migration 031).
  let linkedProjectIds: string[] = []
  if (clientIds.length) {
    const { data: rawLinks } = await admin
      .from('project_clients')
      .select('project_id')
      .in('client_id', clientIds)
    linkedProjectIds = [
      ...new Set(((rawLinks as { project_id: string }[] | null) ?? []).map((l) => l.project_id)),
    ]
  }

  // 3. Projets : client principal (client_id) OU client additionnel (project_clients).
  const orProjects =
    `client_id.in.(${clientIds.join(',')})` +
    (linkedProjectIds.length ? `,id.in.(${linkedProjectIds.join(',')})` : '')

  const rawProjects: ProjectRow[] = clientIds.length
    ? (((await admin
        .from('projects')
        .select('*, project_phases(*)')
        .or(orProjects)
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
    <div className="px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
      <ClientDashboardTabs projects={projects} profile={profile} />
    </div>
  )
}
