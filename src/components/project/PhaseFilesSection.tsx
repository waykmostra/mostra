import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { getPhaseViewData } from '@/app/projects/file-actions'
import { getVideoData } from '@/app/projects/video-actions'
import FileViewer from '@/components/project/FileViewer'
import VideoReviewPlayer from '@/components/project/VideoReviewPlayer'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ProjectPhase } from '@/lib/types'

const ANIMATION_SLUGS = ['animation', 'animation-rendu', 'rendu']

interface Props {
  phase: Pick<ProjectPhase, 'id' | 'name' | 'slug' | 'status'>
  projectId: string
  requestedVersion?: number
}

/**
 * Le contenu d'une étape qui n'a pas de sous-étapes. Animation et Rendu
 * portent leurs fichiers directement sur la phase : la vidéo se revoit ici,
 * avec ses versions et ses commentaires timecodés.
 */
export default async function PhaseFilesSection({ phase, projectId, requestedVersion }: Props) {
  if (ANIMATION_SLUGS.includes(phase.slug)) {
    const { currentVideo, allVersions, comments } = await getVideoData(phase.id)
    return (
      <VideoReviewPlayer
        phaseId={phase.id}
        projectId={projectId}
        phaseStatus={phase.status}
        userRole="admin"
        initialVideo={currentVideo}
        initialVersions={allVersions}
        initialComments={comments}
      />
    )
  }

  const result = await getPhaseViewData(phase.id, requestedVersion)

  if ('error' in result || result.files.length === 0 || result.signedUrl === null) {
    return (
      <div className="surface">
        <EmptyState
          icon={FileQuestion}
          title="Aucun contenu sur cette étape"
          description="Cette étape n’a ni sous-étape ni fichier. Ajoutez-lui des sous-étapes pour y mettre un formulaire, un script ou un moodboard."
          action={
            <Link href={`/projects/${projectId}/settings`} className="btn-secondary">
              Modifier les étapes
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <FileViewer
      files={result.files}
      activeVersion={result.activeVersion!}
      signedUrl={result.signedUrl}
      viewPath={`/projects/${projectId}/phases/${phase.id}`}
      uploaders={result.uploaders}
    />
  )
}
