import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getProjectDetail } from '@/lib/supabase/queries'
import Breadcrumb from '@/components/shared/Breadcrumb'
import PhasePipeline from '@/components/project/PhasePipeline'

export const metadata: Metadata = { title: 'Étapes du projet — MOSTRA' }

/** Édition de la structure du projet. La page projet sert à suivre l'avancement ;
 *  ajouter, renommer ou supprimer des étapes se fait ici. */
export default async function ProjectSettingsPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const data = await getProjectDetail(supabase, params.id)
  if (!data) notFound()

  const { project, phases, subPhasesByPhase, filesByPhase } = data

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <div className="max-w-[1100px] space-y-6">
        <div>
          <Breadcrumb
            items={[
              { label: 'Projets', href: '/projects' },
              { label: project.name, href: `/projects/${project.id}` },
              { label: 'Étapes' },
            ]}
          />
          <h1 className="mt-3 text-[1.625rem] leading-tight text-ink">Étapes du projet</h1>
          <p className="mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-dim">
            Ajoutez, renommez ou supprimez les étapes de ce projet. Active le mode éditeur pour
            modifier la structure.
          </p>
        </div>

        <div className="surface p-5">
          <PhasePipeline
            phases={phases}
            filesByPhase={filesByPhase}
            subPhasesByPhase={subPhasesByPhase}
            projectId={project.id}
            userRole="admin"
          />
        </div>
      </div>
    </div>
  )
}
