import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { loadBoard, loadBoardComments } from '@/lib/board'
import Breadcrumb from '@/components/shared/Breadcrumb'
import Board from '@/components/board/Board'
import type { Project } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Cadrage — MOSTRA' }

/** Cadrage côté client : lecture seule, commentaires si connecté. */
export default async function ClientCadragePage({ params }: { params: { token: string } }) {
  // share_token est un accès public légitime : on bypasse RLS volontairement.
  // « À trier » n'est jamais chargé ici (withInbox: false).
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name'> | null
  if (!project) notFound()

  const [profile, board, comments] = await Promise.all([
    getCurrentProfile(),
    loadBoard(admin, project.id, { withInbox: false }),
    loadBoardComments(admin, project.id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: project.name, href: `/client/${params.token}` }, { label: 'Cadrage' }]} />
        <h1 className="mt-3 text-[1.75rem] leading-tight text-ink">Cadrage</h1>
        <p className="mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-dim">
          La vision commune du projet : objectifs, références et décisions. Commentez directement ce qui vous parle ou ce qui manque.
        </p>
      </div>

      <Board projectId={project.id} board={board} comments={comments} editable={false} canComment={!!profile} />
    </div>
  )
}
