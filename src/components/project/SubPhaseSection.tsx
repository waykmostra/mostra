import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { ensureTableModel } from '@/lib/scriptTable'
import StatusBadge from '@/components/shared/StatusBadge'
import RevisionAlert from '@/components/project/RevisionAlert'
import SubPhaseActions from '@/components/project/SubPhaseActions'
import CopySubPhaseLink from '@/components/project/CopySubPhaseLink'
import FormSubPhaseAdmin from '@/components/project/FormSubPhaseAdmin'
import ScriptEditor from '@/components/project/ScriptEditor'
import ScriptsGrid from '@/components/project/ScriptsGrid'
import MoodboardEditor from '@/components/project/MoodboardEditor'
import StoryboardEditor from '@/components/project/StoryboardEditor'
import DesignEditor from '@/components/project/DesignEditor'
import AudioEditor from '@/components/project/AudioEditor'
import { getMoodboardBlocks, type MoodboardBlock } from '@/app/projects/moodboard-actions'
import { getStoryboardShots, type StoryboardShot } from '@/app/projects/storyboard-actions'
import { getDesignFiles, type DesignFile } from '@/app/projects/design-actions'
import { getAudioTracks, type AudioTrack } from '@/app/projects/audio-actions'
import type {
  FormQuestionContent,
  FormTemplate,
  Profile,
  Script,
  ScriptSectionContent,
  SubPhase,
  UserRole,
} from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

const FORM_SLUGS = ['formulaire', 'form']
const SCRIPT_SLUGS = ['script']
const MOODBOARD_SLUGS = ['style', 'moodboard']
const STORYBOARD_SLUGS = ['storyboard']
const DESIGN_SLUGS = ['design']
const AUDIO_SLUGS = ['vo', 'musique', 'voix-off']

export const SUB_PHASE_META: Record<string, { label: string; description: string }> = {
  formulaire: {
    label: 'Formulaire de brief',
    description:
      'Formulaire dynamique pour collecter les informations du client (objectifs, ton, références…).',
  },
  script: {
    label: 'Éditeur de script',
    description: 'Éditeur de script par sections colorées avec commentaires par bloc.',
  },
  style: {
    label: 'Moodboard / Style',
    description: 'Grille de références visuelles et de directions artistiques à valider.',
  },
  storyboard: {
    label: 'Storyboard',
    description: 'Grille de plans séquentiels avec description et annotations.',
  },
  design: {
    label: 'Maquettes finales',
    description: 'Galerie des fichiers de design final pour approbation.',
  },
  vo: {
    label: 'Voix off',
    description: 'Lecteur audio pour les enregistrements de voix off avec sélection.',
  },
  musique: {
    label: 'Musique',
    description: 'Bibliothèque de pistes musicales avec prévisualisation et sélection.',
  },
}

type SubPhaseLite = Pick<SubPhase, 'id' | 'name' | 'slug' | 'status'>

interface Props {
  projectId: string
  phaseId: string
  subPhase: SubPhaseLite
  userRole: UserRole
  canStart: boolean
  shareToken: string | null
  /** Script ouvert (?script=) et retour forcé à la grille (?grid=1). */
  activeScriptParam?: string
  forceGrid?: boolean
  /** Titre de section — masqué quand la sous-étape est seule dans son étape. */
  showHeading?: boolean
}

/**
 * Le contenu d'une sous-étape : formulaire, script, moodboard, storyboard,
 * design ou audio. Autonome — il va chercher ses propres données — pour qu'on
 * puisse en empiler plusieurs sous les onglets d'une étape.
 */
export default async function SubPhaseSection({
  projectId,
  phaseId,
  subPhase,
  userRole,
  canStart,
  shareToken,
  activeScriptParam,
  forceGrid = false,
  showHeading = true,
}: Props) {
  const supabase = createClient()
  const isAdmin = userRole === 'admin'

  const isForm = FORM_SLUGS.includes(subPhase.slug)
  const isScript = SCRIPT_SLUGS.includes(subPhase.slug)
  const isMoodboard = MOODBOARD_SLUGS.includes(subPhase.slug)
  const isStoryboard = STORYBOARD_SLUGS.includes(subPhase.slug)
  const isDesign = DESIGN_SLUGS.includes(subPhase.slug)
  const isAudio = AUDIO_SLUGS.includes(subPhase.slug)
  const isKnown = isForm || isScript || isMoodboard || isStoryboard || isDesign || isAudio

  const meta = SUB_PHASE_META[subPhase.slug]

  // Demande de révision — visible quand la sous-étape est repassée en in_progress.
  let revisionMessage: string | null = null
  if (subPhase.status === 'in_progress') {
    const { data: rawRev } = await supabase
      .from('comments')
      .select('content')
      .eq('sub_phase_id', subPhase.id)
      .ilike('content', '[Demande de modification]%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const raw = (rawRev as { content: string } | null)?.content
    if (raw) revisionMessage = raw.replace(/^\[Demande de modification\]\s*/i, '').trim()
  }

  // ── Formulaire ────────────────────────────────────────────────────
  let formBlocks: { id: string; content: FormQuestionContent; sort_order: number }[] = []
  let formTemplates: FormTemplate[] = []
  if (isForm && isAdmin) {
    const [{ data: rawBlocks }, { data: rawTemplates }] = await Promise.all([
      db(supabase)
        .from('phase_blocks')
        .select('id, content, sort_order')
        .eq('sub_phase_id', subPhase.id)
        .eq('type', 'form_question')
        .order('sort_order', { ascending: true }),
      db(supabase)
        .from('form_templates')
        .select('id, name, description, questions, is_default')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
    ])
    formBlocks = (rawBlocks ?? []) as typeof formBlocks
    formTemplates = (rawTemplates ?? []) as FormTemplate[]
  }

  // ── Commentaires par bloc, partagés par les éditeurs ──────────────
  async function loadBlockComments(): Promise<BlockComment[]> {
    const { data: rawComments } = await supabase
      .from('comments')
      .select('*')
      .eq('sub_phase_id', subPhase.id)
      .order('created_at', { ascending: true })

    const list = (rawComments ?? []) as Omit<BlockComment, 'author'>[]
    const authorIds = [...new Set(list.map((c) => c.user_id))]
    const authors = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (authorIds.length > 0) {
      const { data: rawAuthors } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        authors.set(p.id, p),
      )
    }
    return list.map((c) => ({ ...c, author: authors.get(c.user_id) ?? null }))
  }

  // ── Script ────────────────────────────────────────────────────────
  let scripts: Script[] = []
  let activeScriptId: string | null = null
  let scriptBlocks: { id: string; content: ScriptSectionContent; sort_order: number }[] = []
  let scriptComments: BlockComment[] = []
  const scriptSectionCounts: Record<string, number> = {}

  if (isScript) {
    const { data: rawScripts } = await supabase
      .from('scripts')
      .select('*')
      .eq('sub_phase_id', subPhase.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    scripts = (rawScripts as Script[] | null) ?? []

    const { data: rawCounts } = await db(supabase)
      .from('phase_blocks')
      .select('script_id')
      .eq('sub_phase_id', subPhase.id)
      .eq('type', 'script_section')
    for (const row of (rawCounts as { script_id: string | null }[] | null) ?? []) {
      if (row.script_id)
        scriptSectionCounts[row.script_id] = (scriptSectionCounts[row.script_id] ?? 0) + 1
    }

    if (activeScriptParam && scripts.some((s) => s.id === activeScriptParam)) {
      activeScriptId = activeScriptParam
    } else if (!forceGrid && scripts.length === 1) {
      activeScriptId = scripts[0].id
    }

    if (activeScriptId) {
      const { data: rawScriptBlocks } = await db(supabase)
        .from('phase_blocks')
        .select('id, content, sort_order')
        .eq('script_id', activeScriptId)
        .eq('type', 'script_section')
        .order('sort_order', { ascending: true })
      scriptBlocks = (rawScriptBlocks ?? []) as typeof scriptBlocks
      scriptComments = await loadBlockComments()
    }
  }

  const activeScript = activeScriptId ? scripts.find((s) => s.id === activeScriptId) ?? null : null
  const scriptModel = activeScript ? ensureTableModel(activeScript, scriptBlocks) : null

  // ── Moodboard / storyboard / design / audio ───────────────────────
  let moodboardBlocks: MoodboardBlock[] = []
  let storyboardShots: StoryboardShot[] = []
  let designFiles: DesignFile[] = []
  let audioTracks: AudioTrack[] = []
  let mediaComments: BlockComment[] = []

  if (isMoodboard) {
    moodboardBlocks = await getMoodboardBlocks(subPhase.id)
    mediaComments = await loadBlockComments()
  } else if (isStoryboard) {
    storyboardShots = await getStoryboardShots(subPhase.id)
    mediaComments = await loadBlockComments()
  } else if (isDesign) {
    designFiles = await getDesignFiles(subPhase.id)
    mediaComments = await loadBlockComments()
  } else if (isAudio) {
    audioTracks = await getAudioTracks(subPhase.id)
    mediaComments = await loadBlockComments()
  }

  const audioKind: 'vo' | 'music' = subPhase.slug === 'musique' ? 'music' : 'vo'
  // On reste sur la page à onglets : choisir un script change juste ?script=.
  const basePath = `/projects/${projectId}/phases/${phaseId}`

  return (
    <section className="space-y-4">
      {/* Quand la barre d'onglets porte déjà le nom, on ne garde que les actions. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        {showHeading ? (
          <div className="min-w-0">
            <h2 className="text-[1.125rem] leading-tight text-ink">{subPhase.name}</h2>
            {meta && <p className="mt-1 text-[13px] text-faint">{meta.label}</p>}
          </div>
        ) : (
          <p className="text-[13px] text-faint">{meta?.label ?? subPhase.name}</p>
        )}
        <div className="flex flex-shrink-0 items-center gap-2">
          {shareToken && (
            <CopySubPhaseLink path={`/client/${shareToken}/phases/${phaseId}/sub/${subPhase.id}`} />
          )}
          <StatusBadge status={subPhase.status} />
        </div>
      </div>

      {revisionMessage !== null && <RevisionAlert message={revisionMessage} />}

      {!isKnown && (
        <SubPhaseActions
          subPhaseId={subPhase.id}
          subPhaseStatus={subPhase.status}
          userRole={userRole}
          canStart={canStart}
        />
      )}

      {isForm && isAdmin && (
        <FormSubPhaseAdmin
          subPhaseId={subPhase.id}
          subPhaseStatus={subPhase.status}
          canStart={canStart}
          blocks={formBlocks}
          templates={formTemplates}
          projectId={projectId}
          phaseId={phaseId}
        />
      )}

      {isScript &&
        (activeScriptId && scriptModel ? (
          <div className="space-y-4">
            {scripts.length > 1 && (
              <Link
                href={`${basePath}?grid=1`}
                className="inline-flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tous les scripts
              </Link>
            )}
            <ScriptEditor
              scriptId={activeScriptId}
              subPhaseId={subPhase.id}
              subPhaseStatus={subPhase.status}
              userRole={userRole}
              canStart={canStart}
              initialColumns={scriptModel.columns}
              initialCategories={scriptModel.categories}
              initialBeats={scriptModel.beats}
              initialRows={scriptModel.rows}
              projectId={projectId}
              phaseId={phaseId}
              initialComments={scriptComments}
            />
          </div>
        ) : (
          <ScriptsGrid
            subPhaseId={subPhase.id}
            basePath={basePath}
            scripts={scripts}
            sectionCounts={scriptSectionCounts}
          />
        ))}

      {isStoryboard && (
        <StoryboardEditor
          subPhaseId={subPhase.id}
          subPhaseStatus={subPhase.status}
          userRole={userRole}
          canStart={canStart}
          projectId={projectId}
          phaseId={phaseId}
          initialShots={storyboardShots}
          initialComments={mediaComments}
        />
      )}

      {isDesign && (
        <DesignEditor
          subPhaseId={subPhase.id}
          subPhaseStatus={subPhase.status}
          userRole={userRole}
          canStart={canStart}
          projectId={projectId}
          phaseId={phaseId}
          initialFiles={designFiles}
          initialComments={mediaComments}
        />
      )}

      {isMoodboard && (
        <MoodboardEditor
          subPhaseId={subPhase.id}
          subPhaseStatus={subPhase.status}
          userRole={userRole}
          canStart={canStart}
          projectId={projectId}
          phaseId={phaseId}
          initialBlocks={moodboardBlocks}
          initialComments={mediaComments}
        />
      )}

      {isAudio && (
        <AudioEditor
          subPhaseId={subPhase.id}
          subPhaseStatus={subPhase.status}
          userRole={userRole}
          canStart={canStart}
          projectId={projectId}
          phaseId={phaseId}
          kind={audioKind}
          initialTracks={audioTracks}
          initialComments={mediaComments}
        />
      )}

      {!isKnown && (
        <div className="surface flex items-center gap-4 px-5 py-6">
          <Clock className="h-5 w-5 flex-shrink-0 text-faint" strokeWidth={1.75} />
          <p className="text-[13.5px] text-dim">
            {meta?.description ??
              `Aucune interface dédiée pour « ${subPhase.name} ». Les fichiers et commentaires
               restent disponibles depuis l’étape.`}
          </p>
        </div>
      )}
    </section>
  )
}
