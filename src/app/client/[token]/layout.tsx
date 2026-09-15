import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientProjectRail, { type RailPhase } from '@/components/client/ClientProjectRail'
import ClientTopbar from '@/components/client/ClientTopbar'
import type { Project, ProjectPhase } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ClientProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { token: string }
}) {
  // share_token est un accès public légitime : on bypasse RLS volontairement.
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, progress')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name' | 'progress'> | null
  if (!project) notFound()

  const { data: rawPhases } = await admin
    .from('project_phases')
    .select('id, name, status')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })

  const phases = ((rawPhases as Pick<ProjectPhase, 'id' | 'name' | 'status'>[] | null) ??
    []) as RailPhase[]

  return (
    <>
      <ClientProjectRail
        token={params.token}
        projectName={project.name}
        progress={project.progress}
        phases={phases}
      />
      <ClientTopbar offset />

      <main className="min-h-screen pt-14 md:ml-[248px]">
        <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">{children}</div>
      </main>
    </>
  )
}
