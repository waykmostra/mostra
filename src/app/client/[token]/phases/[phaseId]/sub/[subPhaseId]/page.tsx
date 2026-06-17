import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import FormSubPhaseClient from '@/components/client/FormSubPhaseClient'
import ScriptViewerClient from '@/components/client/ScriptViewerClient'
import ClientScriptsGrid from '@/components/client/ClientScriptsGrid'
import MoodboardViewerClient from '@/components/client/MoodboardViewerClient'
import StoryboardViewerClient from '@/components/client/StoryboardViewerClient'
import DesignViewerClient from '@/components/client/DesignViewerClient'
import AudioViewerClient from '@/components/client/AudioViewerClient'
import type { Project, ProjectPhase, SubPhase, FormQuestionContent, ScriptSectionContent, MoodboardImageContent, StoryboardShotContent, DesignFileContent, AudioTrackContent, Profile, Script, PhaseStatus } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'
import { ensureTableModel } from '@/lib/scriptTable'

// Lecture toujours fraîche (le client doit voir les changements admin au reload).
export const dynamic = 'force-dynamic'

interface ClientSubPhasePageProps {
  params: { token: string; phaseId: string; subPhaseId: string }
  searchParams?: { s?: string }
}

const FORM_SLUGS = ['formulaire', 'form']
const SCRIPT_SLUGS = ['script']
const MOODBOARD_SLUGS = ['style', 'moodboard']
const STORYBOARD_SLUGS = ['storyboard']
const DESIGN_SLUGS = ['design']
const AUDIO_SLUGS = ['vo', 'musique', 'voix-off']

export default async function ClientSubPhasePage({ params, searchParams }: ClientSubPhasePageProps) {
  const admin = createAdminClient()

  // 0. Check authentication (anon allowed in read-only, but mutations require login)
  const currentProfile = await getCurrentProfile()
  const isAuthenticated = !!currentProfile

  // 1. Resolve token → project
  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, share_token, client_id')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name' | 'client_id'> | null
  if (!project) notFound()

  // Résoudre le profile_id du client CRM (NULL si pas de compte connectable)
  let clientProfileId: string | null = null
  if (project.client_id) {
    const { data: rawClient } = await admin
      .from('clients')
      .select('profile_id')
      .eq('id', project.client_id)
      .maybeSingle()
    clientProfileId = (rawClient as { profile_id: string | null } | null)?.profile_id ?? null
  }

  // 2. Phase (must belong to project)
  const { data: rawPhase } = await admin
    .from('project_phases')
    .select('id, name, slug, status, project_id')
    .eq('id', params.phaseId)
    .eq('project_id', project.id)
    .maybeSingle()

  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'name' | 'slug' | 'status' | 'project_id'> | null
  if (!phase) notFound()

  // 3. Sub-phase (must belong to phase)
  const { data: rawSubPhase } = await admin
    .from('sub_phases')
    .select('id, name, slug, status, phase_id')
    .eq('id', params.subPhaseId)
    .eq('phase_id', params.phaseId)
    .maybeSingle()

  const subPhase = rawSubPhase as Pick<SubPhase, 'id' | 'name' | 'slug' | 'status' | 'phase_id'> | null
  if (!subPhase) notFound()

  const isForm = FORM_SLUGS.includes(subPhase.slug)
  const isScript = SCRIPT_SLUGS.includes(subPhase.slug)
  const isMoodboard = MOODBOARD_SLUGS.includes(subPhase.slug)
  const isStoryboard = STORYBOARD_SLUGS.includes(subPhase.slug)
  const isDesign = DESIGN_SLUGS.includes(subPhase.slug)
  const isAudio = AUDIO_SLUGS.includes(subPhase.slug)

  // Only known sub-phase types are accessible via this route
  if (!isForm && !isScript && !isMoodboard && !isStoryboard && !isDesign && !isAudio) {
    redirect(`/client/${params.token}`)
  }

  // Review-gated types: accessibles en in_review / completed / approved.
  // Modèle : dès qu'une phase a des COMMENTAIRES, elle est considérée « en révision »
  // et reste accessible au client (lecture + ses commentaires), même repassée en
  // in_progress. On distingue ainsi un vrai brouillon jamais commenté (caché) d'une
  // phase déjà travaillée avec le client. Couvre aussi les anciens projets sans
  // marqueur [Demande de modification].
  const isReviewGated = isScript || isMoodboard || isStoryboard || isDesign || isAudio
  let hasComments = false
  if (isReviewGated && subPhase.status === 'in_progress') {
    const { data: rawComment } = await admin
      .from('comments')
      .select('id')
      .eq('sub_phase_id', subPhase.id)
      .limit(1)
      .maybeSingle()
    hasComments = !!rawComment
  }
  const revisionInProgress = subPhase.status === 'in_progress' && hasComments

  if (isReviewGated && (subPhase.status === 'pending' || (subPhase.status === 'in_progress' && !hasComments))) {
    redirect(`/client/${params.token}`)
  }

  // Form: not yet sent to client
  if (isForm && subPhase.status === 'pending') {
    redirect(`/client/${params.token}`)
  }

  // ── Form path ──────────────────────────────────────────────────

  if (isForm) {
    const { data: rawBlocks } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'form_question')
      .order('sort_order', { ascending: true })

    const blocks =
      (rawBlocks as { id: string; content: FormQuestionContent; sort_order: number }[] | null) ?? []

    const clientStatus = subPhase.status as 'in_progress' | 'in_review' | 'completed' | 'approved'

    return (
      <PageShell token={params.token} projectName={project.name} phaseName={phase.name} subPhaseName={subPhase.name}>
        <FormSubPhaseClient
          token={params.token}
          subPhaseId={subPhase.id}
          status={clientStatus}
          blocks={blocks}
          isAuthenticated={isAuthenticated}
        />
      </PageShell>
    )
  }

  // ── Moodboard path ─────────────────────────────────────────────

  if (isMoodboard) {
    const { data: rawBlocks } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'moodboard_image')
      .order('sort_order', { ascending: true })

    const rawBlockList =
      (rawBlocks as { id: string; content: MoodboardImageContent; sort_order: number }[] | null) ?? []

    // Generate signed URLs (bucket "project-files" is private)
    // Handles both legacy full URLs and new relative storage paths
    const moodboardBlocks = await Promise.all(
      rawBlockList.map(async (b) => {
        const raw = b.content.image_url
        const match = raw?.match(/\/project-files\/(.+?)(?:\?|$)/)
        const storagePath = match ? match[1] : raw
        if (!storagePath) return b
        const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
        return { ...b, content: { ...b.content, image_url: data?.signedUrl ?? '' } }
      }),
    )

    // Fetch comments
    const { data: rawComments } = await admin
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawCommentList = (rawComments as (typeof rawComments extends (infer T)[] | null ? T : never)[] | null) ?? []

    const authorIds = [...new Set((rawCommentList as { user_id: string }[]).map((c) => c.user_id))]
    const authorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (authorIds.length > 0) {
      const { data: rawAuthors } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        authorMap.set(p.id, p),
      )
    }

    const initialComments: BlockComment[] = (rawCommentList as {
      id: string
      block_id: string | null
      sub_phase_id: string | null
      phase_id: string | null
      user_id: string
      content: string
      is_resolved: boolean
      created_at: string
      updated_at: string
    }[]).map((c) => ({ ...c, author: authorMap.get(c.user_id) ?? null }))

    const moodboardStatus = subPhase.status as PhaseStatus

    return (
      <PageShell
        token={params.token}
        projectName={project.name}
        phaseName={phase.name}
        subPhaseName={subPhase.name}
        subtitle="Découvrez les directions artistiques et choisissez votre style préféré."
        wide
        revisionInProgress={revisionInProgress}
      >
        <MoodboardViewerClient
          token={params.token}
          subPhaseId={subPhase.id}
          phaseId={phase.id}
          status={moodboardStatus}
          clientId={clientProfileId}
          initialBlocks={moodboardBlocks}
          initialComments={initialComments}
          isAuthenticated={isAuthenticated}
        />
      </PageShell>
    )
  }

  // ── Storyboard path ────────────────────────────────────────────

  if (isStoryboard) {
    const { data: rawShots } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'storyboard_shot')
      .order('sort_order', { ascending: true })

    const rawShotList =
      (rawShots as { id: string; content: StoryboardShotContent; sort_order: number }[] | null) ?? []

    // Generate signed URLs
    const storyboardShots = await Promise.all(
      rawShotList.map(async (s) => {
        const raw = s.content.image_url
        const match = raw?.match(/\/project-files\/(.+?)(?:\?|$)/)
        const storagePath = match ? match[1] : raw
        if (!storagePath) return s
        const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
        return { ...s, content: { ...s.content, image_url: data?.signedUrl ?? '' } }
      }),
    )

    const { data: rawSbComments } = await admin
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawSbList = (rawSbComments as (typeof rawSbComments extends (infer T)[] | null ? T : never)[] | null) ?? []
    const sbAuthorIds = [...new Set((rawSbList as { user_id: string }[]).map((c) => c.user_id))]
    const sbAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (sbAuthorIds.length > 0) {
      const { data: rawAuthors } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', sbAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        sbAuthorMap.set(p.id, p),
      )
    }

    const initialSbComments = (rawSbList as {
      id: string; block_id: string | null; sub_phase_id: string | null
      phase_id: string | null; user_id: string; content: string
      is_resolved: boolean; created_at: string; updated_at: string
    }[]).map((c) => ({ ...c, author: sbAuthorMap.get(c.user_id) ?? null }))

    const storyboardStatus = subPhase.status as PhaseStatus

    return (
      <PageShell
        token={params.token}
        projectName={project.name}
        phaseName={phase.name}
        subPhaseName={subPhase.name}
        subtitle="Parcourez chaque scène du storyboard et partagez vos retours."
        wide
        revisionInProgress={revisionInProgress}
      >
        <StoryboardViewerClient
          token={params.token}
          subPhaseId={subPhase.id}
          phaseId={phase.id}
          status={storyboardStatus}
          clientId={clientProfileId}
          initialShots={storyboardShots}
          initialComments={initialSbComments}
          isAuthenticated={isAuthenticated}
        />
      </PageShell>
    )
  }

  // ── Design path ────────────────────────────────────────────────

  if (isDesign) {
    const { data: rawDesignFiles } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'design_file')
      .order('sort_order', { ascending: true })

    const rawDesignList =
      (rawDesignFiles as { id: string; content: DesignFileContent; sort_order: number }[] | null) ?? []

    // Generate signed URLs for all files
    const designFiles = await Promise.all(
      rawDesignList.map(async (f) => {
        const raw = f.content.file_url
        const match = raw?.match(/\/project-files\/(.+?)(?:\?|$)/)
        const storagePath = match ? match[1] : raw
        if (!storagePath) return f
        const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
        return { ...f, content: { ...f.content, file_url: data?.signedUrl ?? '' } }
      }),
    )

    const { data: rawDesignComments } = await admin
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawDesignCommentList = (rawDesignComments as (typeof rawDesignComments extends (infer T)[] | null ? T : never)[] | null) ?? []
    const designAuthorIds = [...new Set((rawDesignCommentList as { user_id: string }[]).map((c) => c.user_id))]
    const designAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (designAuthorIds.length > 0) {
      const { data: rawAuthors } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', designAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        designAuthorMap.set(p.id, p),
      )
    }

    const initialDesignComments: BlockComment[] = (rawDesignCommentList as {
      id: string; block_id: string | null; sub_phase_id: string | null
      phase_id: string | null; user_id: string; content: string
      is_resolved: boolean; created_at: string; updated_at: string
    }[]).map((c) => ({ ...c, author: designAuthorMap.get(c.user_id) ?? null }))

    const designStatus = subPhase.status as PhaseStatus

    return (
      <PageShell
        token={params.token}
        projectName={project.name}
        phaseName={phase.name}
        subPhaseName={subPhase.name}
        subtitle="Consultez les maquettes finales et partagez vos retours."
        wide
        revisionInProgress={revisionInProgress}
      >
        <DesignViewerClient
          token={params.token}
          subPhaseId={subPhase.id}
          phaseId={phase.id}
          status={designStatus}
          clientId={clientProfileId}
          initialFiles={designFiles}
          initialComments={initialDesignComments}
          isAuthenticated={isAuthenticated}
        />
      </PageShell>
    )
  }

  // ── Audio path ─────────────────────────────────────────────────

  if (isAudio) {
    const { data: rawTracks } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'audio_track')
      .order('sort_order', { ascending: true })

    const rawTrackList =
      (rawTracks as { id: string; content: AudioTrackContent; sort_order: number }[] | null) ?? []

    // Generate signed URLs
    const audioTracks = await Promise.all(
      rawTrackList.map(async (t) => {
        const raw = t.content.audio_url
        const match = raw?.match(/\/project-files\/(.+?)(?:\?|$)/)
        const storagePath = match ? match[1] : raw
        if (!storagePath) return t
        const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
        return { ...t, content: { ...t.content, audio_url: data?.signedUrl ?? '' } }
      }),
    )

    const { data: rawAudioComments } = await admin
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawAudioList = (rawAudioComments as (typeof rawAudioComments extends (infer T)[] | null ? T : never)[] | null) ?? []
    const audioAuthorIds = [...new Set((rawAudioList as { user_id: string }[]).map((c) => c.user_id))]
    const audioAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (audioAuthorIds.length > 0) {
      const { data: rawAuthors } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', audioAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        audioAuthorMap.set(p.id, p),
      )
    }

    const initialAudioComments: BlockComment[] = (rawAudioList as {
      id: string; block_id: string | null; sub_phase_id: string | null
      phase_id: string | null; user_id: string; content: string
      is_resolved: boolean; created_at: string; updated_at: string
    }[]).map((c) => ({ ...c, author: audioAuthorMap.get(c.user_id) ?? null }))

    const audioKind: 'vo' | 'music' = subPhase.slug === 'musique' ? 'music' : 'vo'
    const audioStatus = subPhase.status as PhaseStatus

    return (
      <PageShell
        token={params.token}
        projectName={project.name}
        phaseName={phase.name}
        subPhaseName={subPhase.name}
        subtitle={audioKind === 'vo' ? 'Écoutez les propositions de voix off et choisissez votre préférée.' : 'Écoutez les propositions musicales et choisissez votre préférée.'}
        wide
        revisionInProgress={revisionInProgress}
      >
        <AudioViewerClient
          token={params.token}
          subPhaseId={subPhase.id}
          phaseId={phase.id}
          status={audioStatus}
          clientId={clientProfileId}
          kind={audioKind}
          initialTracks={audioTracks}
          initialComments={initialAudioComments}
          isAuthenticated={isAuthenticated}
        />
      </PageShell>
    )
  }

  // ── Script path (multi-scripts, 027) ───────────────────────────
  // Le client voit TOUS les scripts, navigue, et en choisit un.
  const { data: rawAllScripts } = await admin
    .from('scripts')
    .select('*')
    .eq('sub_phase_id', params.subPhaseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  const allScripts = (rawAllScripts as Script[] | null) ?? []

  const multiScript = allScripts.length >= 2
  const requestedS = typeof searchParams?.s === 'string' ? searchParams.s : null

  let viewScriptId: string | null = null
  if (requestedS && allScripts.some((s) => s.id === requestedS)) viewScriptId = requestedS
  else if (!multiScript) viewScriptId = allScripts[0]?.id ?? null

  const scriptBasePath = `/client/${params.token}/phases/${phase.id}/sub/${subPhase.id}`

  // Grille : plusieurs scripts, aucun ouvert → le client choisit lequel consulter.
  if (multiScript && !viewScriptId) {
    const { data: rawCounts } = await admin
      .from('phase_blocks')
      .select('script_id')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'script_section')
    const counts: Record<string, number> = {}
    for (const r of (rawCounts as { script_id: string | null }[] | null) ?? []) {
      if (r.script_id) counts[r.script_id] = (counts[r.script_id] ?? 0) + 1
    }
    return (
      <PageShell
        token={params.token}
        projectName={project.name}
        phaseName={phase.name}
        subPhaseName={subPhase.name}
        subtitle="Plusieurs propositions de script — parcourez-les et choisissez votre préférée."
        wide
        revisionInProgress={revisionInProgress}
      >
        <ClientScriptsGrid scripts={allScripts} sectionCounts={counts} basePath={scriptBasePath} />
      </PageShell>
    )
  }

  // Vue d'un script
  let scriptBlocks: { id: string; content: ScriptSectionContent; sort_order: number }[] = []
  if (viewScriptId) {
    const { data: rawBlocks } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('script_id', viewScriptId)
      .eq('type', 'script_section')
      .order('sort_order', { ascending: true })
    scriptBlocks =
      (rawBlocks as { id: string; content: ScriptSectionContent; sort_order: number }[] | null) ?? []
  }

  // Fetch comments for this sub_phase
  const { data: rawComments } = await admin
    .from('comments')
    .select('*')
    .eq('sub_phase_id', params.subPhaseId)
    .order('created_at', { ascending: true })

  const rawCommentList = (rawComments as (typeof rawComments extends (infer T)[] | null ? T : never)[] | null) ?? []

  // Fetch author profiles
  const authorIds = [...new Set((rawCommentList as { user_id: string }[]).map((c) => c.user_id))]
  const authorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  if (authorIds.length > 0) {
    const { data: rawAuthors } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds)
    ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
      authorMap.set(p.id, p),
    )
  }

  const initialComments: BlockComment[] = (rawCommentList as {
    id: string
    block_id: string | null
    sub_phase_id: string | null
    phase_id: string | null
    user_id: string
    content: string
    is_resolved: boolean
    created_at: string
    updated_at: string
  }[]).map((c) => ({
    ...c,
    author: authorMap.get(c.user_id) ?? null,
  }))

  const scriptStatus = subPhase.status as PhaseStatus
  const viewedScript = allScripts.find((s) => s.id === viewScriptId)

  // Modèle tableau (migration 028) — migre l'ancien format « cartes » à la volée.
  const scriptModel = viewedScript
    ? ensureTableModel(viewedScript, scriptBlocks)
    : { columns: [], categories: [], beats: [], rows: [] }

  return (
    <PageShell
      token={params.token}
      projectName={project.name}
      phaseName={phase.name}
      subPhaseName={subPhase.name}
      subtitle="Relisez le script (tableau ou résumé) et commentez ligne par ligne."
      wide
      revisionInProgress={revisionInProgress}
    >
      <ScriptViewerClient
        token={params.token}
        projectId={project.id}
        subPhaseId={subPhase.id}
        status={scriptStatus}
        columns={scriptModel.columns}
        categories={scriptModel.categories}
        beats={scriptModel.beats}
        rows={scriptModel.rows}
        initialComments={initialComments}
        clientId={clientProfileId}
        isAuthenticated={isAuthenticated}
        scriptId={viewScriptId ?? undefined}
        multiScript={multiScript}
        isSelected={viewedScript?.is_selected ?? false}
        backHref={multiScript ? scriptBasePath : undefined}
        scriptTitle={multiScript ? viewedScript?.title : undefined}
      />
    </PageShell>
  )
}

// ── PageShell ─────────────────────────────────────────────────────

function PageShell({
  token,
  projectName,
  phaseName,
  subPhaseName,
  subtitle,
  wide = false,
  revisionInProgress = false,
  children,
}: {
  token: string
  projectName: string
  phaseName: string
  subPhaseName: string
  subtitle?: string
  wide?: boolean
  /** Affiche une bannière « révision en cours de traitement » au-dessus du contenu. */
  revisionInProgress?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8">
      <div className={`${wide ? 'max-w-3xl' : 'max-w-2xl'} mx-auto space-y-6`}>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-[#444444] flex-wrap">
          <Link href={`/client/${token}`} className="hover:text-white transition-colors">
            {projectName}
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <span className="text-[#555555]">{phaseName}</span>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <span className="text-white font-medium">{subPhaseName}</span>
        </nav>

        {/* Back */}
        <Link
          href={`/client/${token}`}
          className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au projet
        </Link>

        {/* Header */}
        <div>
          <p className="text-xs text-[#444444] uppercase tracking-widest mb-1">{phaseName}</p>
          <h1 className="text-xl font-bold text-white">{subPhaseName}</h1>
          {subtitle && <p className="text-xs text-[#555555] mt-1">{subtitle}</p>}
        </div>

        {/* Révision demandée : la phase est de nouveau travaillée par l'équipe */}
        {revisionInProgress && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
            <RotateCcw className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#F59E0B]">Modifications en cours de traitement</p>
              <p className="text-xs text-[#9a7b3a] mt-0.5 leading-relaxed">
                L&apos;équipe traite votre demande de révision. Vous pouvez relire la version actuelle
                et vos commentaires ci-dessous — une nouvelle version vous sera soumise pour validation.
              </p>
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
