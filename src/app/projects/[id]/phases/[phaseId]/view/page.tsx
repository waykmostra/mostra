import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { getPhaseViewData } from '@/app/projects/file-actions'
import { getVideoData } from '@/app/projects/video-actions'
import FileViewer from '@/components/project/FileViewer'
import VideoReviewPlayer from '@/components/project/VideoReviewPlayer'
import type { ProjectPhase } from '@/lib/types'

interface PageProps {
  params: { id: string; phaseId: string }
  searchParams: { v?: string }
}

const ANIMATION_SLUGS = ['animation', 'animation-rendu', 'rendu']

export default async function PhaseViewPage({ params, searchParams }: PageProps) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const admin = createAdminClient()

  // Fetch phase to determine type
  const { data: rawPhase } = await admin
    .from('project_phases')
    .select('id, name, slug, project_id, status')
    .eq('id', params.phaseId)
    .maybeSingle()

  const phase = rawPhase as Pick<
    ProjectPhase,
    'id' | 'name' | 'slug' | 'project_id' | 'status'
  > | null
  if (!phase) notFound()

  // Verify project exists
  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name')
    .eq('id', phase.project_id)
    .maybeSingle()

  const project = rawProject as { id: string; name: string } | null
  if (!project) notFound()

  const isAnimation = ANIMATION_SLUGS.includes(phase.slug)

  // ── Animation → Video Review Player ───────────────────────────
  if (isAnimation) {
    const { currentVideo, allVersions, comments } = await getVideoData(params.phaseId)

    return (
      <div className="min-h-screen bg-[#0a0a0a] px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Header */}
          <div>
            <Link
              href={`/projects/${project.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {project.name}
            </Link>
            <div className="flex items-baseline gap-3">
              <h1 className="text-lg font-bold text-white">{phase.name}</h1>
              <span className="text-[#444444] text-sm">·</span>
              <span className="text-sm text-[#666666]">Review vidéo</span>
            </div>
          </div>

          <VideoReviewPlayer
            phaseId={params.phaseId}
            projectId={project.id}
            phaseStatus={phase.status}
            userRole="admin"
            initialVideo={currentVideo}
            initialVersions={allVersions}
            initialComments={comments}
          />
        </div>
      </div>
    )
  }

  // ── Other phases → File Viewer ─────────────────────────────────
  const requestedVersion = searchParams.v ? parseInt(searchParams.v, 10) : undefined
  const result = await getPhaseViewData(params.phaseId, requestedVersion)

  if ('error' in result) notFound()

  const { projectId, projectName, phaseName, files, signedUrl, activeVersion, uploaders } = result

  if (files.length === 0 || signedUrl === null || activeVersion === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {projectName}
          </Link>
          <h1 className="text-lg font-bold text-white mb-1">{phaseName}</h1>
          <p className="text-sm text-[#444444] italic mt-8">
            Aucun fichier uploadé sur cette phase.
          </p>
        </div>
      </div>
    )
  }

  const viewPath = `/projects/${params.id}/phases/${params.phaseId}/view`

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-8 flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 gap-5">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {projectName}
          </Link>
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-bold text-white">{phaseName}</h1>
            <span className="text-[#444444] text-sm">·</span>
            <span className="text-sm text-[#666666]">Fichiers</span>
          </div>
        </div>

        <FileViewer
          files={files}
          activeVersion={activeVersion}
          signedUrl={signedUrl}
          viewPath={viewPath}
          uploaders={uploaders}
        />
      </div>
    </div>
  )
}
