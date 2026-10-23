import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientProjectRail, { type RailPhase } from '@/components/client/ClientProjectRail'
import ClientTopbar from '@/components/client/ClientTopbar'
import { loadClientPhases } from '@/lib/clientPhases'
import type { Project } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ClientProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { token: string }
}) {
  // Le rail affiche l'avancement et l'état de chaque étape : sans ça, Next sert
  // le rendu du layout depuis son cache de données et le client voit encore
  // l'état d'avant sa validation, alors que la page, elle, est à jour.
  noStore()

  // share_token est un accès public légitime : on bypasse RLS volontairement.
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, progress')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name' | 'progress'> | null
  if (!project) notFound()

  const { phases: allPhases, viewableIds } = await loadClientPhases(admin, project.id)
  const phases: RailPhase[] = allPhases.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    viewable: viewableIds.has(p.id),
  }))

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
