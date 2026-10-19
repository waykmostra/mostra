import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { loadBoard, loadBoardComments } from '@/lib/board'
import Breadcrumb from '@/components/shared/Breadcrumb'
import CopySubPhaseLink from '@/components/project/CopySubPhaseLink'
import Board from '@/components/board/Board'
import QuickNote from '@/components/board/QuickNote'
import type { Project } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Cadrage — MOSTRA' }

/**
 * Cadrage du projet, côté admin : on compose la grille, on range « À trier »,
 * on répond aux commentaires du client.
 */
export default async function ProjectCadragePage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { data: rawProject } = await supabase
    .from('projects')
    .select('id, name, share_token')
    .eq('id', params.id)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name' | 'share_token'> | null
  if (!project) notFound()

  const [board, comments] = await Promise.all([
    loadBoard(supabase, project.id, { withInbox: true }),
    loadBoardComments(supabase, project.id),
  ])

  return (
    <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
      <div className="space-y-5">
        <div>
          <Breadcrumb
            items={[
              { label: 'Projets', href: '/projects' },
              { label: project.name, href: `/projects/${project.id}` },
              { label: 'Cadrage' },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-[1.75rem] leading-tight text-ink">Cadrage</h1>
              <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-dim">
                La vision commune du projet. Toujours ouvert : on l’enrichit jusqu’à la livraison. Le client lit et commente.
              </p>
            </div>
            {project.share_token && <CopySubPhaseLink path={`/client/${project.share_token}/cadrage`} />}
          </div>
        </div>

        <QuickNote projectId={project.id} />

        <Board projectId={project.id} board={board} comments={comments} editable canComment />
      </div>
    </div>
  )
}
