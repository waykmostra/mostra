'use client'

import type { PhaseStatus } from '@/lib/types'
import type { VideoFile, VideoComment } from '@/app/projects/video-actions'
import ReviewPlayer from '@/components/review/ReviewPlayer'

// Review vidéo côté client : le lecteur unifié (façon Frame.io) en rôle client.
// Garde l'interface d'origine pour les pages qui l'appellent.

export interface VideoViewerClientProps {
  token: string
  projectId: string
  phaseId: string
  phaseStatus: PhaseStatus
  clientId: string
  isAuthenticated: boolean
  initialVideo: VideoFile | null
  initialVersions: VideoFile[]
  initialComments: VideoComment[]
  compact?: boolean
}

export default function VideoViewerClient({ clientId, ...props }: VideoViewerClientProps) {
  return <ReviewPlayer role="client" viewerId={clientId} {...props} />
}
