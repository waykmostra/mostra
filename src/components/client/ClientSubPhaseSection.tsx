import { Lock } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureTableModel } from '@/lib/scriptTable'
import StatusBadge from '@/components/shared/StatusBadge'
import FormSubPhaseClient from '@/components/client/FormSubPhaseClient'
import ScriptViewerClient from '@/components/client/ScriptViewerClient'
import ClientScriptsGrid from '@/components/client/ClientScriptsGrid'
import MoodboardViewerClient from '@/components/client/MoodboardViewerClient'
import StoryboardViewerClient from '@/components/client/StoryboardViewerClient'
import DesignViewerClient from '@/components/client/DesignViewerClient'
import AudioViewerClient from '@/components/client/AudioViewerClient'
import type {
  AudioTrackContent,
  DesignFileContent,
  FormQuestionContent,
  MoodboardImageContent,
  PhaseStatus,
  Profile,
  Script,
  ScriptSectionContent,
  StoryboardShotContent,
  SubPhase,
} from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

const FORM_SLUGS = ['formulaire', 'form']
const SCRIPT_SLUGS = ['script']
const MOODBOARD_SLUGS = ['style', 'moodboard']
const STORYBOARD_SLUGS = ['storyboard']
const DESIGN_SLUGS = ['design']
const AUDIO_SLUGS = ['vo', 'musique', 'voix-off']

type SubPhaseLite = Pick<SubPhase, 'id' | 'name' | 'slug' | 'status'>

interface Props {
  token: string
  projectId: string
  phaseId: string
  subPhase: SubPhaseLite
  clientProfileId: string | null
  isAuthenticated: boolean
  /** Script ouvert (?s=) quand plusieurs propositions existent. */
  activeScriptParam?: string
  /** Titre de section — inutile quand la barre d'onglets porte déjà le nom. */
  showHeading?: boolean
}

/** Le bucket project-files est privé : toute URL stockée doit être resignée. */
async function signStoragePath(raw: string | null | undefined): Promise<string> {
  if (!raw) return ''
  const admin = createAdminClient()
  const match = raw.match(/\/project-files\/(.+?)(?:\?|$)/)
  const path = match ? match[1] : raw
  const { data } = await admin.storage.from('project-files').createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

async function loadComments(subPhaseId: string): Promise<BlockComment[]> {
  const admin = createAdminClient()
  const { data: raw } = await admin
    .from('comments')
    .select('*')
    .eq('sub_phase_id', subPhaseId)
    .order('created_at', { ascending: true })

  const list = (raw ?? []) as Omit<BlockComment, 'author'>[]
  const ids = [...new Set(list.map((c) => c.user_id))]
  const authors = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  if (ids.length > 0) {
    const { data: rawAuthors } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids)
    ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
      authors.set(p.id, p),
    )
  }
  return list.map((c) => ({ ...c, author: authors.get(c.user_id) ?? null }))
}

/**
 * Le contenu d'une sous-étape côté client — même découpage qu'en admin, mais
 * en lecture et validation seulement. Plusieurs sections s'empilent sous les
 * onglets d'une étape.
 */
export default async function ClientSubPhaseSection({
  token,
  projectId,
  phaseId,
  subPhase,
  clientProfileId,
  isAuthenticated,
  activeScriptParam,
  showHeading = true,
}: Props) {
  const admin = createAdminClient()

  const isForm = FORM_SLUGS.includes(subPhase.slug)
  const isScript = SCRIPT_SLUGS.includes(subPhase.slug)
  const isMoodboard = MOODBOARD_SLUGS.includes(subPhase.slug)
  const isStoryboard = STORYBOARD_SLUGS.includes(subPhase.slug)
  const isDesign = DESIGN_SLUGS.includes(subPhase.slug)
  const isAudio = AUDIO_SLUGS.includes(subPhase.slug)
  const isReviewGated = isScript || isMoodboard || isStoryboard || isDesign || isAudio

  const status = subPhase.status as PhaseStatus

  // Une sous-étape déjà commentée reste visible même repassée en in_progress :
  // c'est une révision en cours, pas un brouillon jamais montré.
  let hasComments = false
  if (isReviewGated && status === 'in_progress') {
    const { data } = await admin
      .from('comments')
      .select('id')
      .eq('sub_phase_id', subPhase.id)
      .limit(1)
      .maybeSingle()
    hasComments = !!data
  }

  const hidden =
    (isReviewGated && (status === 'pending' || (status === 'in_progress' && !hasComments))) ||
    (isForm && status === 'pending') ||
    (!isForm && !isReviewGated)

  const heading = showHeading ? (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
      <h2 className="min-w-0 text-[1.125rem] leading-tight text-ink">{subPhase.name}</h2>
      <StatusBadge status={subPhase.status} className="flex-shrink-0" />
    </div>
  ) : null

  if (hidden) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="surface flex items-center gap-3 px-5 py-4">
          <Lock className="h-4 w-4 flex-shrink-0 text-faint" />
          <p className="text-[13.5px] text-faint">
            Cette partie vous sera présentée dès qu’elle sera prête.
          </p>
        </div>
      </section>
    )
  }

  let body: React.ReactNode = null

  if (isForm) {
    const { data: rawBlocks } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', subPhase.id)
      .eq('type', 'form_question')
      .order('sort_order', { ascending: true })

    body = (
      <FormSubPhaseClient
        token={token}
        subPhaseId={subPhase.id}
        status={status as 'in_progress' | 'in_review' | 'completed' | 'approved'}
        blocks={
          (rawBlocks as { id: string; content: FormQuestionContent; sort_order: number }[] | null) ??
          []
        }
        isAuthenticated={isAuthenticated}
      />
    )
  } else if (isMoodboard) {
    const { data: raw } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', subPhase.id)
      .eq('type', 'moodboard_image')
      .order('sort_order', { ascending: true })

    const blocks = await Promise.all(
      ((raw as { id: string; content: MoodboardImageContent; sort_order: number }[] | null) ?? []).map(
        async (b) => ({
          ...b,
          content: { ...b.content, image_url: await signStoragePath(b.content.image_url) },
        }),
      ),
    )

    body = (
      <MoodboardViewerClient
        token={token}
        subPhaseId={subPhase.id}
        phaseId={phaseId}
        status={status}
        clientId={clientProfileId}
        initialBlocks={blocks}
        initialComments={await loadComments(subPhase.id)}
        isAuthenticated={isAuthenticated}
      />
    )
  } else if (isStoryboard) {
    const { data: raw } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', subPhase.id)
      .eq('type', 'storyboard_shot')
      .order('sort_order', { ascending: true })

    const shots = await Promise.all(
      ((raw as { id: string; content: StoryboardShotContent; sort_order: number }[] | null) ?? []).map(
        async (s) => ({
          ...s,
          content: { ...s.content, image_url: await signStoragePath(s.content.image_url) },
        }),
      ),
    )

    body = (
      <StoryboardViewerClient
        token={token}
        subPhaseId={subPhase.id}
        phaseId={phaseId}
        status={status}
        clientId={clientProfileId}
        initialShots={shots}
        initialComments={await loadComments(subPhase.id)}
        isAuthenticated={isAuthenticated}
      />
    )
  } else if (isDesign) {
    const { data: raw } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', subPhase.id)
      .eq('type', 'design_file')
      .order('sort_order', { ascending: true })

    const files = await Promise.all(
      ((raw as { id: string; content: DesignFileContent; sort_order: number }[] | null) ?? []).map(
        async (f) => ({
          ...f,
          content: { ...f.content, file_url: await signStoragePath(f.content.file_url) },
        }),
      ),
    )

    body = (
      <DesignViewerClient
        token={token}
        subPhaseId={subPhase.id}
        phaseId={phaseId}
        status={status}
        clientId={clientProfileId}
        initialFiles={files}
        initialComments={await loadComments(subPhase.id)}
        isAuthenticated={isAuthenticated}
      />
    )
  } else if (isAudio) {
    const { data: raw } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', subPhase.id)
      .eq('type', 'audio_track')
      .order('sort_order', { ascending: true })

    const tracks = await Promise.all(
      ((raw as { id: string; content: AudioTrackContent; sort_order: number }[] | null) ?? []).map(
        async (t) => ({
          ...t,
          content: { ...t.content, audio_url: await signStoragePath(t.content.audio_url) },
        }),
      ),
    )

    body = (
      <AudioViewerClient
        token={token}
        subPhaseId={subPhase.id}
        phaseId={phaseId}
        status={status}
        clientId={clientProfileId}
        kind={subPhase.slug === 'musique' ? 'music' : 'vo'}
        initialTracks={tracks}
        initialComments={await loadComments(subPhase.id)}
        isAuthenticated={isAuthenticated}
      />
    )
  } else if (isScript) {
    const { data: rawScripts } = await admin
      .from('scripts')
      .select('*')
      .eq('sub_phase_id', subPhase.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    const scripts = (rawScripts as Script[] | null) ?? []

    const multi = scripts.length >= 2
    const viewId =
      activeScriptParam && scripts.some((s) => s.id === activeScriptParam)
        ? activeScriptParam
        : multi
          ? null
          : (scripts[0]?.id ?? null)

    // On reste sur la page à onglets : choisir un script change juste ?s=.
    const basePath = `/client/${token}/phases/${phaseId}`

    if (multi && !viewId) {
      const { data: rawCounts } = await admin
        .from('phase_blocks')
        .select('script_id')
        .eq('sub_phase_id', subPhase.id)
        .eq('type', 'script_section')
      const counts: Record<string, number> = {}
      for (const r of (rawCounts as { script_id: string | null }[] | null) ?? []) {
        if (r.script_id) counts[r.script_id] = (counts[r.script_id] ?? 0) + 1
      }
      body = <ClientScriptsGrid scripts={scripts} sectionCounts={counts} basePath={basePath} />
    } else {
      let blocks: { id: string; content: ScriptSectionContent; sort_order: number }[] = []
      if (viewId) {
        const { data: rawBlocks } = await admin
          .from('phase_blocks')
          .select('id, content, sort_order')
          .eq('script_id', viewId)
          .eq('type', 'script_section')
          .order('sort_order', { ascending: true })
        blocks = (rawBlocks as typeof blocks | null) ?? []
      }
      const viewed = scripts.find((s) => s.id === viewId)
      const model = viewed
        ? ensureTableModel(viewed, blocks)
        : { columns: [], categories: [], beats: [], rows: [] }

      body = (
        <ScriptViewerClient
          token={token}
          projectId={projectId}
          subPhaseId={subPhase.id}
          status={status}
          columns={model.columns}
          categories={model.categories}
          beats={model.beats}
          rows={model.rows}
          initialComments={await loadComments(subPhase.id)}
          clientId={clientProfileId}
          isAuthenticated={isAuthenticated}
          scriptId={viewId ?? undefined}
          multiScript={multi}
          isSelected={viewed?.is_selected ?? false}
          backHref={multi ? basePath : undefined}
          scriptTitle={multi ? viewed?.title : undefined}
        />
      )
    }
  }

  return (
    <section className="space-y-4">
      {heading}
      {body}
    </section>
  )
}
