'use client'

import type { PhaseStatus, UserRole } from '@/lib/types'
import type { VideoFile, VideoComment } from '@/app/projects/video-actions'
import ReviewPlayer from '@/components/review/ReviewPlayer'

// Review vidéo côté admin : le lecteur unifié (façon Frame.io) en rôle admin.
// Garde l'interface d'origine pour les pages qui l'appellent.

export interface VideoReviewPlayerProps {
  phaseId: string
  projectId: string
  phaseStatus: PhaseStatus
  userRole: UserRole
  initialVideo: VideoFile | null
  initialVersions: VideoFile[]
  initialComments: VideoComment[]
}

export default function VideoReviewPlayer({ userRole, ...props }: VideoReviewPlayerProps) {
  return <ReviewPlayer role={userRole === 'admin' ? 'admin' : 'client'} isAuthenticated {...props} />
}
