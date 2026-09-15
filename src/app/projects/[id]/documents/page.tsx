import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ProjectDocuments from '@/components/project/ProjectDocuments'
import type { Project } from '@/lib/types'

export const metadata: Metadata = { title: 'Documents — MOSTRA' }

export default async function ProjectDocumentsPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { data: rawProject } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name'> | null
  if (!project) notFound()

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <div className="max-w-[1000px] space-y-6">
        <div>
          <Breadcrumb
            items={[
              { label: 'Projets', href: '/projects' },
              { label: project.name, href: `/projects/${project.id}` },
              { label: 'Documents' },
            ]}
          />
          <h1 className="mt-3 text-[1.75rem] leading-tight text-ink">Documents</h1>
          <p className="mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-dim">
            Ce que le client voit : les livrables de chaque étape et les pièces de facturation.
          </p>
        </div>

        <ProjectDocuments projectId={project.id} />
      </div>
    </div>
  )
}
