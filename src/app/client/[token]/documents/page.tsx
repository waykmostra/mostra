import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ProjectDocuments from '@/components/project/ProjectDocuments'
import type { Project } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Vos documents — MOSTRA' }

export default async function ClientDocumentsPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name'> | null
  if (!project) notFound()

  return (
    <div className="max-w-[1000px] space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: project.name, href: `/client/${params.token}` },
            { label: 'Vos documents' },
          ]}
        />
        <h1 className="mt-3 text-[1.75rem] leading-tight text-ink">Vos documents</h1>
        <p className="mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-dim">
          Les livrables de chaque étape et vos pièces de facturation, réunis ici.
        </p>
      </div>

      <ProjectDocuments projectId={project.id} />
    </div>
  )
}
