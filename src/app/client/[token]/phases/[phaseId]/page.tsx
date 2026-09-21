import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { getClientPhaseViewData, getClientSignedUrl } from '@/app/client/actions'
import { fetchVideoData } from '@/app/client/video-actions'
import FileViewer from '@/components/project/FileViewer'
import ApprovalPanel from '@/components/client/ApprovalPanel'
import VideoViewerClient from '@/components/client/VideoViewerClient'
import ClientSubPhaseSection from '@/components/client/ClientSubPhaseSection'
import PhaseStepper from '@/components/project/PhaseStepper'
import SubPhaseTabs from '@/components/project/SubPhaseTabs'
import Breadcrumb from '@/components/shared/Breadcrumb'
import StatusBadge from '@/components/shared/StatusBadge'
import type { Project, ProjectPhase, SubPhase } from '@/lib/types'

// Lecture toujours fraîche : le client doit voir les changements admin au reload.
export const dynamic = 'force-dynamic'

interface ClientPhasePageProps {
  params: { token: string; phaseId: string }
  searchParams: { v?: string; s?: string; sub?: string }
}

const ANIMATION_SLUGS = ['animation', 'animation-rendu', 'rendu']

export default async function ClientPhasePage({ params, searchParams }: ClientPhasePageProps) {
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, client_id, share_token')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name' | 'client_id' | 'share_token'> | null
  if (!project) redirect(`/client/${params.token}`)

  // Toutes les étapes — le stepper reste navigable depuis l'intérieur d'une étape.
  const { data: rawPhases } = await admin
    .from('project_phases')
    .select('id, name, slug, status, sort_order, completed_at')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })

  const allPhases =
    (rawPhases as Pick<
      ProjectPhase,
      'id' | 'name' | 'slug' | 'status' | 'sort_order' | 'completed_at'
    >[] | null) ?? []

  const phase = allPhases.find((p) => p.id === params.phaseId)
  if (!phase) redirect(`/client/${params.token}`)

  const isAnimation = ANIMATION_SLUGS.includes(phase.slug)

  // Sous-étapes visibles par le client, toutes étapes confondues (le stepper
  // affiche le compteur), puis celles de l'étape ouverte.
  const { data: rawSubs } = await admin
    .from('sub_phases')
    .select('id, name, slug, status, phase_id, sort_order')
    .in(
      'phase_id',
      allPhases.map((p) => p.id),
    )
    .order('sort_order', { ascending: true })

  const allSubs =
    (rawSubs as (Pick<SubPhase, 'id' | 'name' | 'slug' | 'status' | 'sort_order'> & {
      phase_id: string
    })[] | null) ?? []

  const subsByPhase: Record<string, Pick<SubPhase, 'id' | 'status'>[]> = {}
  for (const s of allSubs) {
    ;(subsByPhase[s.phase_id] ??= []).push({ id: s.id, status: s.status })
  }

  const subPhases = allSubs.filter((s) => s.phase_id === phase.id)

  // Une étape à sous-étapes reste « en cours » tant que toutes ne sont pas
  // validées, alors qu'une de ses sous-étapes peut déjà attendre le client
  // (ex. Analyse en cours, Script en review). On l'ouvre donc dès qu'elle a
  // démarré : chaque sous-étape pas encore prête reste masquée individuellement.
  // Sans sous-étape (Animation, Rendu), le fichier n'est montré qu'en review.
  const isAccessible =
    subPhases.length > 0
      ? phase.status !== 'pending' || subPhases.some((s) => s.status !== 'pending')
      : phase.status === 'in_review' || phase.status === 'approved' || phase.status === 'completed'
  if (!isAccessible) redirect(`/client/${params.token}`)

  // profile_id du client CRM (vide si aucun compte connectable)
  let clientId = ''
  if (project.client_id) {
    const { data: rawClient } = await admin
      .from('clients')
      .select('profile_id')
      .eq('id', project.client_id)
      .maybeSingle()
    clientId = (rawClient as { profile_id: string | null } | null)?.profile_id ?? ''
  }

  const currentProfile = await getCurrentProfile()
  const isAuthenticated = !!currentProfile

  const header = (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: project.name, href: `/client/${params.token}` },
            { label: phase.name },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="text-[1.75rem] leading-tight text-ink">{phase.name}</h1>
          <StatusBadge status={phase.status} className="flex-shrink-0" />
        </div>
      </div>

      {/* Les onglets du projet — mêmes qu'en admin. */}
      <PhaseStepper
        phases={allPhases}
        subPhasesByPhase={subsByPhase}
        currentPhaseId={phase.id}
        hrefForPhase={(p) => `/client/${params.token}/phases/${p.id}`}
        lockPending
      />

      <ApprovalPanel
        projectId={project.id}
        phaseId={params.phaseId}
        phaseName={phase.name}
        status={phase.status}
        completedAt={phase.completed_at}
        isAuthenticated={isAuthenticated}
        loginHref="/login"
      />
    </div>
  )

  // ── Sous-étapes : le contenu s'empile, comme en admin ────────────
  if (subPhases.length > 0) {
    // On ouvre sur ce qui demande une action, comme en admin.
    const activeSub =
      subPhases.find((s) => s.id === searchParams.sub) ??
      subPhases.find((s) => s.status === 'in_review') ??
      subPhases.find((s) => s.status === 'in_progress') ??
      subPhases[0]

    return (
      <div className="space-y-6">
        {header}

        <SubPhaseTabs
          subPhases={subPhases}
          activeId={activeSub.id}
          hrefFor={(sub) => `/client/${params.token}/phases/${phase.id}?sub=${sub.id}`}
        />

        <ClientSubPhaseSection
          token={params.token}
          projectId={project.id}
          phaseId={phase.id}
          subPhase={activeSub}
          clientProfileId={clientId || null}
          isAuthenticated={isAuthenticated}
          activeScriptParam={searchParams.s}
          showHeading={subPhases.length === 1}
        />
      </div>
    )
  }

  // ── Animation / Rendu : la vidéo est portée par l'étape ──────────
  if (isAnimation) {
    const { currentVideo, allVersions, comments } = await fetchVideoData(
      params.token,
      params.phaseId,
    )
    return (
      <div className="space-y-6">
        {header}
        <VideoViewerClient
          token={params.token}
          projectId={project.id}
          phaseId={params.phaseId}
          phaseStatus={phase.status}
          clientId={clientId}
          isAuthenticated={isAuthenticated}
          initialVideo={currentVideo}
          initialVersions={allVersions}
          initialComments={comments}
        />
      </div>
    )
  }

  // ── Fichiers ─────────────────────────────────────────────────────
  const requestedVersion = searchParams.v ? Number(searchParams.v) : undefined
  const data = await getClientPhaseViewData(params.token, params.phaseId, requestedVersion)

  async function clientGetSignedUrl(filePath: string) {
    'use server'
    return getClientSignedUrl(params.token, filePath)
  }

  return (
    <div className="space-y-6">
      {header}

      {'error' in data || data.files.length === 0 ? (
        <div className="surface px-5 py-10 text-center">
          <p className="text-[13.5px] text-faint">Aucun fichier disponible sur cette étape.</p>
        </div>
      ) : (
        <FileViewer
          files={data.files}
          activeVersion={data.activeVersion ?? data.files[0].version}
          signedUrl={data.signedUrl ?? ''}
          viewPath={`/client/${params.token}/phases/${params.phaseId}`}
          uploaders={data.uploaders}
          getSignedUrlFn={clientGetSignedUrl}
        />
      )}
    </div>
  )
}
