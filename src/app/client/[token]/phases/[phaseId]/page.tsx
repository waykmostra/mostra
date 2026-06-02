import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth'
import { getClientPhaseViewData, getClientSignedUrl } from '@/app/client/actions'
import { fetchVideoData } from '@/app/client/video-actions'
import FileViewer from '@/components/project/FileViewer'
import ApprovalPanel from '@/components/client/ApprovalPanel'
import VideoViewerClient from '@/components/client/VideoViewerClient'
import type { Project, ProjectPhase } from '@/lib/types'

interface ClientPhasePageProps {
  params: { token: string; phaseId: string }
  searchParams: { v?: string }
}

const ANIMATION_SLUGS = ['animation', 'animation-rendu', 'rendu']

export default async function ClientPhasePage({ params, searchParams }: ClientPhasePageProps) {
  const admin = createAdminClient()

  // Resolve token → project
  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, client_id, share_token')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<
    Project,
    'id' | 'name' | 'client_id' | 'share_token'
  > | null
  if (!project) redirect(`/client/${params.token}`)

  // Fetch phase with slug
  const { data: rawPhase } = await admin
    .from('project_phases')
    .select('id, name, slug, project_id, status, completed_at')
    .eq('id', params.phaseId)
    .maybeSingle()

  const phase = rawPhase as Pick<
    ProjectPhase,
    'id' | 'name' | 'slug' | 'project_id' | 'status' | 'completed_at'
  > | null

  if (!phase || phase.project_id !== project.id) redirect(`/client/${params.token}`)

  // Gate: client can only see phases in_review, approved, or completed
  const isAnimation = ANIMATION_SLUGS.includes(phase.slug)
  const isAccessible =
    phase.status === 'in_review' ||
    phase.status === 'approved' ||
    phase.status === 'completed'

  if (!isAccessible) redirect(`/client/${params.token}`)

  // Résoudre le profile_id du client CRM (NULL si pas de compte connectable)
  let clientId = ''
  if (project.client_id) {
    const { data: rawClient } = await admin
      .from('clients')
      .select('profile_id')
      .eq('id', project.client_id)
      .maybeSingle()
    clientId = (rawClient as { profile_id: string | null } | null)?.profile_id ?? ''
  }

  // Check auth (parallel with other data)
  const currentProfile = await getCurrentProfile()
  const isAuthenticated = !!currentProfile

  // ── Animation → Video Review ─────────────────────────────────────
  if (isAnimation) {
    const { currentVideo, allVersions, comments } = await fetchVideoData(
      params.token,
      params.phaseId,
    )

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[#666666]">
          <Link
            href={`/client/${params.token}`}
            className="inline-flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            {project.name}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-[#a0a0a0]">{phase.name}</span>
        </div>

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

  // ── Other phases → File Viewer ───────────────────────────────────
  const requestedVersion = searchParams.v ? Number(searchParams.v) : undefined
  const data = await getClientPhaseViewData(params.token, params.phaseId, requestedVersion)

  if ('error' in data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-[#EF4444]">{data.error}</p>
        <Link
          href={`/client/${params.token}`}
          className="text-xs text-[#666666] hover:text-white transition-colors"
        >
          ← Retour au projet
        </Link>
      </div>
    )
  }

  // Signed URL for "download" link (no session needed)
  async function clientGetSignedUrl(filePath: string) {
    'use server'
    return getClientSignedUrl(params.token, filePath)
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#666666]">
        <Link
          href={`/client/${params.token}`}
          className="inline-flex items-center gap-1 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {data.projectName}
        </Link>
        <span className="text-[#333333]">/</span>
        <span className="text-[#a0a0a0]">{data.phaseName}</span>
      </div>

      {/* Approval panel */}
      <ApprovalPanel
        projectId={project.id}
        phaseId={params.phaseId}
        phaseName={data.phaseName}
        status={data.phaseStatus}
        completedAt={data.completedAt}
        isAuthenticated={isAuthenticated}
        loginHref="/login"
      />

      {/* File viewer */}
      {data.files.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 text-center">
          <p className="text-sm text-[#444444] italic">
            Aucun fichier disponible pour cette phase.
          </p>
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
