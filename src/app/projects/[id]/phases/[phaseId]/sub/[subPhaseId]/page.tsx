import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { getCurrentProfile } from '@/lib/auth'
import StatusBadge from '@/components/shared/StatusBadge'
import RevisionAlert from '@/components/project/RevisionAlert'
import SubPhaseActions from '@/components/project/SubPhaseActions'
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
import { ensureTableModel } from '@/lib/scriptTable'
import type { Project, ProjectPhase, SubPhase, FormTemplate, FormQuestionContent, ScriptSectionContent, UserRole, Profile, Script } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

interface SubPhasePageProps {
  params: { id: string; phaseId: string; subPhaseId: string }
  searchParams?: { script?: string; grid?: string }
}

const FORM_SLUGS = ['formulaire', 'form']
const SCRIPT_SLUGS = ['script']
const MOODBOARD_SLUGS = ['style', 'moodboard']
const STORYBOARD_SLUGS = ['storyboard']
const DESIGN_SLUGS = ['design']
const AUDIO_SLUGS = ['vo', 'musique', 'voix-off']

const SUB_PHASE_META: Record<string, { label: string; description: string; sprint: string }> = {
  formulaire: {
    label: 'Formulaire de brief',
    description:
      'Formulaire dynamique pour collecter les informations du client (objectifs, ton, références…).',
    sprint: 'Sprint 10',
  },
  script: {
    label: 'Éditeur de script',
    description: 'Éditeur de script par sections colorées avec commentaires par bloc.',
    sprint: 'Sprint 11',
  },
  style: {
    label: 'Moodboard / Style',
    description: 'Grille de références visuelles et de directions artistiques à valider.',
    sprint: 'Sprint 12',
  },
  storyboard: {
    label: 'Storyboard',
    description: 'Grille de plans séquentiels avec description et annotations.',
    sprint: 'Sprint 12',
  },
  design: {
    label: 'Maquettes finales',
    description: 'Galerie des fichiers de design final pour approbation.',
    sprint: 'Sprint 12',
  },
  vo: {
    label: 'Voix off',
    description: 'Lecteur audio pour les enregistrements de voix off avec sélection.',
    sprint: 'Sprint 13',
  },
  musique: {
    label: 'Musique',
    description: 'Bibliothèque de pistes musicales avec prévisualisation et sélection.',
    sprint: 'Sprint 13',
  },
}

export async function generateMetadata({ params }: SubPhasePageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data: rawSubPhase } = await supabase
    .from('sub_phases')
    .select('name')
    .eq('id', params.subPhaseId)
    .maybeSingle()
  const name = (rawSubPhase as { name: string } | null)?.name ?? 'Sous-phase'
  return { title: `${name} — MOSTRA` }
}

export default async function SubPhasePage({ params, searchParams }: SubPhasePageProps) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const userRole: UserRole = 'admin'
  const isAdmin = true

  // Projet
  const { data: rawProject } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle()

  const project = rawProject as Pick<Project, 'id' | 'name'> | null
  if (!project) notFound()

  // Phase
  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('id, name, slug, status, project_id')
    .eq('id', params.phaseId)
    .eq('project_id', params.id)
    .maybeSingle()

  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'name' | 'slug' | 'status' | 'project_id'> | null
  if (!phase) notFound()

  // Sous-phase
  const { data: rawSubPhase } = await supabase
    .from('sub_phases')
    .select('id, name, slug, status, phase_id, sort_order, started_at, completed_at')
    .eq('id', params.subPhaseId)
    .eq('phase_id', params.phaseId)
    .maybeSingle()

  const subPhase = rawSubPhase as Pick<
    SubPhase,
    'id' | 'name' | 'slug' | 'status' | 'phase_id' | 'sort_order' | 'started_at' | 'completed_at'
  > | null
  if (!subPhase) notFound()

  // Siblings pour canStart
  const { data: rawSiblings } = await supabase
    .from('sub_phases')
    .select('id, sort_order, status')
    .eq('phase_id', params.phaseId)
    .order('sort_order', { ascending: true })

  const siblings = (rawSiblings as Pick<SubPhase, 'id' | 'sort_order' | 'status'>[] | null) ?? []
  const idx = siblings.findIndex((s) => s.id === params.subPhaseId)
  const canStart =
    idx === 0 ||
    (idx > 0 &&
      (siblings[idx - 1].status === 'completed' || siblings[idx - 1].status === 'approved'))

  // Demande de révision — dernier commentaire "[Demande de modification]" sur cette sous-phase
  // Affiché uniquement quand la sous-phase est revenue en in_progress après une review
  let revisionMessage: string | null = null
  if (subPhase.status === 'in_progress') {
    const { data: rawRevComment } = await supabase
      .from('comments')
      .select('content')
      .eq('sub_phase_id', params.subPhaseId)
      .ilike('content', '[Demande de modification]%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const raw = (rawRevComment as { content: string } | null)?.content
    if (raw) {
      revisionMessage = raw.replace(/^\[Demande de modification\]\s*/i, '').trim()
    }
  }

  const isFormSubPhase = FORM_SLUGS.includes(subPhase.slug)
  const isScriptSubPhase = SCRIPT_SLUGS.includes(subPhase.slug)
  const isMoodboardSubPhase = MOODBOARD_SLUGS.includes(subPhase.slug)
  const isStoryboardSubPhase = STORYBOARD_SLUGS.includes(subPhase.slug)
  const isDesignSubPhase = DESIGN_SLUGS.includes(subPhase.slug)
  const isAudioSubPhase = AUDIO_SLUGS.includes(subPhase.slug)

  // Data spécifique formulaire
  let formBlocks: { id: string; content: FormQuestionContent; sort_order: number }[] = []
  let formTemplates: FormTemplate[] = []

  if (isFormSubPhase && isAdmin) {
    const [{ data: rawBlocks }, { data: rawTemplates }] = await Promise.all([
      db(supabase)
        .from('phase_blocks')
        .select('id, content, sort_order')
        .eq('sub_phase_id', params.subPhaseId)
        .eq('type', 'form_question')
        .order('sort_order', { ascending: true }),
      db(supabase)
        .from('form_templates')
        .select('id, name, description, questions, is_default')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
    ])
    formBlocks = (rawBlocks ?? []) as { id: string; content: FormQuestionContent; sort_order: number }[]
    formTemplates = (rawTemplates ?? []) as FormTemplate[]
  }

  // Data spécifique script (multi-scripts, migration 027)
  let scriptBlocks: { id: string; content: ScriptSectionContent; sort_order: number }[] = []
  let scriptComments: BlockComment[] = []
  let scripts: Script[] = []
  let activeScriptId: string | null = null
  const scriptSectionCounts: Record<string, number> = {}

  if (isScriptSubPhase) {
    const { data: rawScripts } = await supabase
      .from('scripts')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    scripts = (rawScripts as Script[] | null) ?? []

    // Compte des sections par script (pour la grille)
    const { data: rawCounts } = await db(supabase)
      .from('phase_blocks')
      .select('script_id')
      .eq('sub_phase_id', params.subPhaseId)
      .eq('type', 'script_section')
    for (const row of (rawCounts as { script_id: string | null }[] | null) ?? []) {
      if (row.script_id) scriptSectionCounts[row.script_id] = (scriptSectionCounts[row.script_id] ?? 0) + 1
    }

    const requested = searchParams?.script
    const forceGrid = searchParams?.grid === '1'
    if (requested && scripts.some((s) => s.id === requested)) activeScriptId = requested
    else if (!forceGrid && scripts.length === 1) activeScriptId = scripts[0].id

    if (activeScriptId) {
      const { data: rawScriptBlocks } = await db(supabase)
        .from('phase_blocks')
        .select('id, content, sort_order')
        .eq('script_id', activeScriptId)
        .eq('type', 'script_section')
        .order('sort_order', { ascending: true })
      scriptBlocks = (rawScriptBlocks ?? []) as { id: string; content: ScriptSectionContent; sort_order: number }[]

      // Fetch comments for this sub-phase
      const { data: rawComments } = await supabase
        .from('comments')
        .select('*')
        .eq('sub_phase_id', params.subPhaseId)
        .order('created_at', { ascending: true })

      const rawCommentList = (rawComments ?? []) as {
        id: string
        block_id: string | null
        sub_phase_id: string | null
        phase_id: string | null
        user_id: string
        content: string
        is_resolved: boolean
        created_at: string
        updated_at: string
      }[]

      // Fetch author profiles
      const authorIds = [...new Set(rawCommentList.map((c) => c.user_id))]
      const authorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
      if (authorIds.length > 0) {
        const { data: rawAuthors } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', authorIds)
        ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
          authorMap.set(p.id, p),
        )
      }

      scriptComments = rawCommentList.map((c) => ({
        ...c,
        author: authorMap.get(c.user_id) ?? null,
      }))
    }
  }

  // Data spécifique storyboard
  let storyboardShots: StoryboardShot[] = []
  let storyboardComments: BlockComment[] = []

  if (isStoryboardSubPhase) {
    storyboardShots = await getStoryboardShots(params.subPhaseId)

    const { data: rawSbComments } = await supabase
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawSbCommentList = (rawSbComments ?? []) as {
      id: string; block_id: string | null; sub_phase_id: string | null
      phase_id: string | null; user_id: string; content: string
      is_resolved: boolean; created_at: string; updated_at: string
    }[]

    const sbAuthorIds = [...new Set(rawSbCommentList.map((c) => c.user_id))]
    const sbAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (sbAuthorIds.length > 0) {
      const { data: rawAuthors } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', sbAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        sbAuthorMap.set(p.id, p),
      )
    }
    storyboardComments = rawSbCommentList.map((c) => ({
      ...c,
      author: sbAuthorMap.get(c.user_id) ?? null,
    }))
  }

  // Data spécifique design
  let designFiles: DesignFile[] = []
  let designComments: BlockComment[] = []

  if (isDesignSubPhase) {
    designFiles = await getDesignFiles(params.subPhaseId)

    const { data: rawDesignComments } = await supabase
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawDesignCommentList = (rawDesignComments ?? []) as {
      id: string; block_id: string | null; sub_phase_id: string | null
      phase_id: string | null; user_id: string; content: string
      is_resolved: boolean; created_at: string; updated_at: string
    }[]

    const designAuthorIds = [...new Set(rawDesignCommentList.map((c) => c.user_id))]
    const designAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (designAuthorIds.length > 0) {
      const { data: rawAuthors } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', designAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        designAuthorMap.set(p.id, p),
      )
    }
    designComments = rawDesignCommentList.map((c) => ({
      ...c,
      author: designAuthorMap.get(c.user_id) ?? null,
    }))
  }

  // Data spécifique moodboard
  let moodboardBlocks: MoodboardBlock[] = []
  let moodboardComments: BlockComment[] = []

  if (isMoodboardSubPhase) {
    // getMoodboardBlocks génère les signed URLs via admin client
    moodboardBlocks = await getMoodboardBlocks(params.subPhaseId)

    // Fetch comments (même pattern que script)
    const { data: rawMbComments } = await supabase
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawMbCommentList = (rawMbComments ?? []) as {
      id: string
      block_id: string | null
      sub_phase_id: string | null
      phase_id: string | null
      user_id: string
      content: string
      is_resolved: boolean
      created_at: string
      updated_at: string
    }[]

    const mbAuthorIds = [...new Set(rawMbCommentList.map((c) => c.user_id))]
    const mbAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (mbAuthorIds.length > 0) {
      const { data: rawAuthors } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', mbAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        mbAuthorMap.set(p.id, p),
      )
    }
    moodboardComments = rawMbCommentList.map((c) => ({
      ...c,
      author: mbAuthorMap.get(c.user_id) ?? null,
    }))
  }

  // Data spécifique audio
  let audioTracks: AudioTrack[] = []
  let audioComments: BlockComment[] = []

  if (isAudioSubPhase) {
    audioTracks = await getAudioTracks(params.subPhaseId)

    const { data: rawAudioComments } = await supabase
      .from('comments')
      .select('*')
      .eq('sub_phase_id', params.subPhaseId)
      .order('created_at', { ascending: true })

    const rawAudioCommentList = (rawAudioComments ?? []) as {
      id: string; block_id: string | null; sub_phase_id: string | null
      phase_id: string | null; user_id: string; content: string
      is_resolved: boolean; created_at: string; updated_at: string
    }[]

    const audioAuthorIds = [...new Set(rawAudioCommentList.map((c) => c.user_id))]
    const audioAuthorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
    if (audioAuthorIds.length > 0) {
      const { data: rawAuthors } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', audioAuthorIds)
      ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
        audioAuthorMap.set(p.id, p),
      )
    }
    audioComments = rawAudioCommentList.map((c) => ({
      ...c,
      author: audioAuthorMap.get(c.user_id) ?? null,
    }))
  }

  const audioKind: 'vo' | 'music' = subPhase.slug === 'musique' ? 'music' : 'vo'

  const meta = SUB_PHASE_META[subPhase.slug]

  // Modèle tableau du script actif (migration 028) — migre l'ancien format à la volée.
  const activeScript = activeScriptId ? scripts.find((s) => s.id === activeScriptId) ?? null : null
  const scriptModel = activeScript ? ensureTableModel(activeScript, scriptBlocks) : null

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-[#444444] flex-wrap">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <Link href={`/projects/${project.id}`} className="hover:text-white transition-colors truncate max-w-[150px]">
            {project.name}
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <span className="text-[#555555]">{phase.name}</span>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <span className="text-white font-medium">{subPhase.name}</span>
        </nav>

        {/* Retour */}
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au projet
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[#444444] uppercase tracking-widest mb-1">{phase.name}</p>
            <h1 className="text-xl font-bold text-white">{subPhase.name}</h1>
            {meta && <p className="text-xs text-[#555555] mt-1">{meta.label}</p>}
          </div>
          <StatusBadge status={subPhase.status} className="flex-shrink-0" />
        </div>

        {/* Alerte demande de révision — visible quand la sous-phase revient en in_progress */}
        {revisionMessage !== null && (
          <RevisionAlert message={revisionMessage} />
        )}

        {/* Actions standard — masquées pour formulaire, script, moodboard, storyboard, design et audio (gèrent leur propre workflow) */}
        {!isFormSubPhase && !isScriptSubPhase && !isMoodboardSubPhase && !isStoryboardSubPhase && !isDesignSubPhase && !isAudioSubPhase && (
          <SubPhaseActions
            subPhaseId={subPhase.id}
            subPhaseStatus={subPhase.status}
            userRole={userRole}
            canStart={canStart}
          />
        )}

        {/* Interface formulaire */}
        {isFormSubPhase && isAdmin && (
          <FormSubPhaseAdmin
            subPhaseId={subPhase.id}
            subPhaseStatus={subPhase.status}
            canStart={canStart}
            blocks={formBlocks}
            templates={formTemplates}
            projectId={project.id}
            phaseId={phase.id}
          />
        )}

        {/* Script(s) — grille si plusieurs, éditeur si 1 sélectionné */}
        {isScriptSubPhase && (
          activeScriptId && scriptModel ? (
            <div className="space-y-4">
              <Link
                href={`/projects/${project.id}/phases/${phase.id}/sub/${subPhase.id}?grid=1`}
                className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tous les scripts
              </Link>
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
                projectId={project.id}
                phaseId={phase.id}
                initialComments={scriptComments}
              />
            </div>
          ) : (
            <ScriptsGrid
              subPhaseId={subPhase.id}
              basePath={`/projects/${project.id}/phases/${phase.id}/sub/${subPhase.id}`}
              scripts={scripts}
              sectionCounts={scriptSectionCounts}
            />
          )
        )}

        {/* Éditeur de storyboard */}
        {isStoryboardSubPhase && (
          <StoryboardEditor
            subPhaseId={subPhase.id}
            subPhaseStatus={subPhase.status}
            userRole={userRole}
            canStart={canStart}
            projectId={project.id}
            phaseId={phase.id}
            initialShots={storyboardShots}
            initialComments={storyboardComments}
          />
        )}

        {/* Éditeur de design */}
        {isDesignSubPhase && (
          <DesignEditor
            subPhaseId={subPhase.id}
            subPhaseStatus={subPhase.status}
            userRole={userRole}
            canStart={canStart}
            projectId={project.id}
            phaseId={phase.id}
            initialFiles={designFiles}
            initialComments={designComments}
          />
        )}

        {/* Éditeur de moodboard */}
        {isMoodboardSubPhase && (
          <MoodboardEditor
            subPhaseId={subPhase.id}
            subPhaseStatus={subPhase.status}
            userRole={userRole}
            canStart={canStart}
            projectId={project.id}
            phaseId={phase.id}
            initialBlocks={moodboardBlocks}
            initialComments={moodboardComments}
          />
        )}

        {/* Éditeur audio (VO / Musique) */}
        {isAudioSubPhase && (
          <AudioEditor
            subPhaseId={subPhase.id}
            subPhaseStatus={subPhase.status}
            userRole={userRole}
            canStart={canStart}
            projectId={project.id}
            phaseId={phase.id}
            kind={audioKind}
            initialTracks={audioTracks}
            initialComments={audioComments}
          />
        )}

        {/* Placeholder pour les autres sous-phases */}
        {!isFormSubPhase && !isScriptSubPhase && !isMoodboardSubPhase && !isStoryboardSubPhase && !isDesignSubPhase && !isAudioSubPhase && (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto">
              <Clock className="h-6 w-6 text-[#333333]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Contenu à venir</h2>
              <p className="text-xs text-[#555555] max-w-sm mx-auto">
                {meta?.description ??
                  `L'interface pour la sous-phase "${subPhase.name}" sera disponible dans un prochain sprint.`}
              </p>
            </div>
            {meta && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                <span className="text-[10px] text-[#444444] uppercase tracking-widest">Développé en</span>
                <span className="text-xs text-[#00D76B] font-medium">{meta.sprint}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-[10px] text-[#333333] font-mono bg-[#0d0d0d] border border-[#1e1e1e] px-2 py-1 rounded">
                slug: {subPhase.slug}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
