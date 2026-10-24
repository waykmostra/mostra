import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientProjectView from '@/components/client/ClientProjectView'
import ContactManager from '@/components/client/ContactManager'
import PaymentReminder, { type OpenPayment } from '@/components/payments/PaymentReminder'
import ClientPhaseContent from '@/components/client/ClientPhaseContent'
import Board from '@/components/board/Board'
import { getCurrentProfile } from '@/lib/auth'
import { loadBoard, loadBoardComments } from '@/lib/board'
import { pickCurrentPhase } from '@/lib/currentPhase'
import { loadClientPhases } from '@/lib/clientPhases'
import type { Profile, Project, SubPhase } from '@/lib/types'

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

  // 2. Phases (ordonnées) et droit d'ouverture de chacune
  const { phases, viewableIds } = await loadClientPhases(admin, project.id)

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

  // 3b. Sous-phases ayant des commentaires → considérées « en révision » et donc
  //     accessibles au client même repassées en in_progress (cf. gating sous-phase).
  const commentedSubPhaseIds: string[] = []
  const visibleSubPhaseIds = Object.values(subPhasesByPhase).flat().map((sp) => sp.id)
  if (visibleSubPhaseIds.length > 0) {
    const { data: rawCommented } = await admin
      .from('comments')
      .select('sub_phase_id')
      .in('sub_phase_id', visibleSubPhaseIds)
    const seen = new Set<string>()
    for (const c of (rawCommented as { sub_phase_id: string | null }[] | null) ?? []) {
      if (c.sub_phase_id) seen.add(c.sub_phase_id)
    }
    commentedSubPhaseIds.push(...seen)
  }

  // 3c. Demandes de paiement à régler (rappel sur la vue d'ensemble)
  const { data: rawOpenPayments } = await admin
    .from('payment_requests')
    .select('label, amount_cents, pay_token')
    .eq('project_id', project.id)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  const openPayments = (rawOpenPayments as OpenPayment[] | null) ?? []

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

  // 5. Contenu principal : l'étape en cours (ou la dernière validée), sinon le
  //    Cadrage (avant le R3, rien n'a démarré — la vision commune se construit là).
  // Une étape encore en production chez Mostra (ex. Animation sans vidéo en
  // review) n'est pas ouvrable : on montre alors la dernière étape validée.
  const current = pickCurrentPhase(phases, (p) => viewableIds.has(p.id))

  let main: React.ReactNode
  if (current) {
    main = (
      // Une seule grande carte, en contraste avec la page : tout ce qui concerne
      // l'étape (titre, statut, contenu, validation) se lit d'un bloc.
      <section className="rounded-2xl bg-surface-3/70 p-4 ring-1 ring-line sm:p-6">
        <ClientPhaseContent
          params={{ token: params.token, phaseId: current.id }}
          searchParams={{}}
          embedded
        />
      </section>
    )
  } else {
    const [profile, board, comments] = await Promise.all([
      getCurrentProfile(),
      loadBoard(admin, project.id, { withInbox: false }),
      loadBoardComments(admin, project.id),
    ])
    main = (
      <section className="space-y-4 rounded-2xl bg-surface-3/70 p-4 ring-1 ring-line sm:p-6">
        <div>
          <p className="mono-label text-faint">Cadrage</p>
          <h2 className="mt-1.5 text-[1.375rem] leading-tight text-ink">La vision commune du projet</h2>
        </div>
        <Board projectId={project.id} board={board} comments={comments} editable={false} canComment={!!profile} />
      </section>
    )
  }

  return (
    <ClientProjectView
      main={main}
      project={project}
      phases={phases}
      viewablePhaseIds={[...viewableIds]}
      shownPhaseId={current?.id ?? null}
      subPhasesByPhase={subPhasesByPhase}
      commentedSubPhaseIds={commentedSubPhaseIds}
      token={params.token}
      payment={<PaymentReminder token={params.token} payments={openPayments} />}
      aside={<ContactManager projectManager={projectManager} />}
    />
  )
}
