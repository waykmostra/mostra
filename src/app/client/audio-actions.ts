'use server'

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { createNotifications, getProjectRecipients, notifyClientValidation } from '@/lib/notifications'
import { requireAssignedClient } from '@/lib/auth'
import { sendEmail } from '@/lib/email/send'
import type { Project, ProjectPhase, SubPhase, AudioTrackContent, Profile } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

export type AudioClientResult = { success: true } | { success: false; error: string }

function extractStoragePath(audioUrl: string): string | null {
  if (!audioUrl) return null
  const match = audioUrl.match(/\/project-files\/(.+?)(?:\?|$)/)
  if (match) return match[1]
  return audioUrl
}

async function verifyToken(token: string) {
  const admin = createAdminClient()
  const { data: rawProject } = await admin
    .from('projects')
    .select('id, client_id, share_token')
    .eq('share_token', token)
    .maybeSingle()
  return rawProject as Pick<Project, 'id' | 'client_id' | 'share_token'> | null
}

async function verifySubPhaseOwnership(
  admin: ReturnType<typeof createAdminClient>,
  subPhaseId: string,
  projectId: string,
): Promise<{
  subPhase: Pick<SubPhase, 'id' | 'phase_id' | 'status'>
  phase: Pick<ProjectPhase, 'id' | 'project_id'>
} | null> {
  const { data: rawSp } = await admin
    .from('sub_phases')
    .select('id, phase_id, status')
    .eq('id', subPhaseId)
    .maybeSingle()
  const subPhase = rawSp as Pick<SubPhase, 'id' | 'phase_id' | 'status'> | null
  if (!subPhase) return null

  const { data: rawPhase } = await admin
    .from('project_phases')
    .select('id, project_id')
    .eq('id', subPhase.phase_id)
    .maybeSingle()
  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'project_id'> | null
  if (!phase || phase.project_id !== projectId) return null

  return { subPhase, phase }
}

async function resolveClientUserId(
  admin: ReturnType<typeof createAdminClient>,
  project: Pick<Project, 'id' | 'client_id'>,
): Promise<string | null> {
  if (!project.client_id) return null
  const { data: rawClient } = await admin
    .from('clients')
    .select('profile_id')
    .eq('id', project.client_id)
    .maybeSingle()
  return (rawClient as { profile_id: string | null } | null)?.profile_id ?? null
}

// ── fetchAudioData ────────────────────────────────────────────────

export async function fetchAudioData(
  token: string,
  subPhaseId: string,
): Promise<{
  tracks: { id: string; content: AudioTrackContent; sort_order: number }[]
  comments: BlockComment[]
}> {
  noStore()
  const admin = createAdminClient()
  const project = await verifyToken(token)
  if (!project) return { tracks: [], comments: [] }

  const [{ data: rawTracks }, { data: rawComments }] = await Promise.all([
    admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('sub_phase_id', subPhaseId)
      .eq('type', 'audio_track')
      .order('sort_order', { ascending: true }),
    admin
      .from('comments')
      .select('*')
      .eq('sub_phase_id', subPhaseId)
      .order('created_at', { ascending: true }),
  ])

  const commentList = (rawComments ?? []) as {
    id: string; block_id: string | null; sub_phase_id: string | null
    phase_id: string | null; user_id: string; content: string
    is_resolved: boolean; created_at: string; updated_at: string
  }[]

  const authorIds = [...new Set(commentList.map((c) => c.user_id))]
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

  const rawTrackList = (rawTracks ?? []) as { id: string; content: AudioTrackContent; sort_order: number }[]
  const tracksWithUrls = await Promise.all(
    rawTrackList.map(async (t) => {
      const storagePath = extractStoragePath(t.content.audio_url)
      if (!storagePath) return t
      const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
      return { ...t, content: { ...t.content, audio_url: data?.signedUrl ?? '' } }
    }),
  )

  return {
    tracks: tracksWithUrls,
    comments: commentList.map((c) => ({ ...c, author: authorMap.get(c.user_id) ?? null })),
  }
}

// ── selectAudioTrack ──────────────────────────────────────────────
// Désélectionne toutes les pistes du même kind, sélectionne la cible.
// Toggle : si déjà sélectionnée → désélectionne.

export async function selectAudioTrack(
  token: string,
  blockId: string,
): Promise<AudioClientResult> {
  const admin = createAdminClient()
  const access = await requireAssignedClient(token)
  if ('error' in access) return { success: false, error: access.error }
  const { project } = access

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, sub_phase_id, content')
    .eq('id', blockId)
    .maybeSingle()
  const block = rawBlock as { id: string; sub_phase_id: string | null; content: AudioTrackContent } | null
  if (!block || !block.sub_phase_id) return { success: false, error: 'Piste introuvable' }

  const ownership = await verifySubPhaseOwnership(admin, block.sub_phase_id, project.id)
  if (!ownership) return { success: false, error: 'Accès refusé' }

  if (ownership.subPhase.status !== 'in_review') {
    return { success: false, error: 'La sous-phase doit être en review pour sélectionner une piste' }
  }

  const isAlreadySelected = block.content.is_selected
  const kind = block.content.kind

  // Fetch all sibling tracks of the same kind
  const { data: rawSiblings } = await admin
    .from('phase_blocks')
    .select('id, content')
    .eq('sub_phase_id', block.sub_phase_id)
    .eq('type', 'audio_track')

  const siblings = (rawSiblings ?? []) as { id: string; content: AudioTrackContent }[]
  const sameKind = siblings.filter((s) => s.content.kind === kind)

  // Deselect all of same kind, then select target (unless toggling off)
  for (const sib of sameKind) {
    const shouldSelect = !isAlreadySelected && sib.id === blockId
    const updated: AudioTrackContent = { ...sib.content, is_selected: shouldSelect }
    await db(admin).from('phase_blocks').update({ content: updated }).eq('id', sib.id)
  }

  revalidatePath(`/client/${token}`)
  revalidatePath(`/client/${token}/phases/${ownership.phase.id}/sub/${block.sub_phase_id}`)
  return { success: true }
}

// ── addAudioComment ───────────────────────────────────────────────

export async function addAudioComment(
  token: string,
  blockId: string,
  content: string,
): Promise<AudioClientResult> {
  const admin = createAdminClient()
  if (!content.trim()) return { success: false, error: 'Contenu vide' }

  const access = await requireAssignedClient(token)
  if ('error' in access) return { success: false, error: access.error }
  const { project, userId } = access

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()
  const block = rawBlock as { id: string; sub_phase_id: string | null } | null
  if (!block || !block.sub_phase_id) return { success: false, error: 'Piste introuvable' }

  const ownership = await verifySubPhaseOwnership(admin, block.sub_phase_id, project.id)
  if (!ownership) return { success: false, error: 'Accès refusé' }

  const { error } = await db(admin).from('comments').insert({
    project_id: project.id,
    phase_id: ownership.phase.id,
    sub_phase_id: block.sub_phase_id,
    block_id: blockId,
    user_id: userId,
    content: content.trim(),
    is_resolved: false,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── resolveAudioComment ───────────────────────────────────────────

export async function resolveAudioComment(
  token: string,
  commentId: string,
): Promise<AudioClientResult> {
  const admin = createAdminClient()
  const access = await requireAssignedClient(token)
  if ('error' in access) return { success: false, error: access.error }
  const { project, userId, isAdmin } = access

  const { data: rawComment } = await admin
    .from('comments')
    .select('id, project_id, user_id, is_resolved')
    .eq('id', commentId)
    .maybeSingle()
  const comment = rawComment as { id: string; project_id: string; user_id: string; is_resolved: boolean } | null
  if (!comment || comment.project_id !== project.id)
    return { success: false, error: 'Commentaire introuvable' }

  if (!isAdmin && comment.user_id !== userId)
    return { success: false, error: 'Vous ne pouvez résoudre que vos propres commentaires' }

  const { error } = await db(admin)
    .from('comments')
    .update({ is_resolved: !comment.is_resolved })
    .eq('id', commentId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── approveAudioSubPhase ──────────────────────────────────────────

export async function approveAudioSubPhase(
  token: string,
  subPhaseId: string,
): Promise<AudioClientResult> {
  const admin = createAdminClient()
  const access = await requireAssignedClient(token)
  if ('error' in access) return { success: false, error: access.error }
  const { project } = access

  const ownership = await verifySubPhaseOwnership(admin, subPhaseId, project.id)
  if (!ownership) return { success: false, error: 'Sous-phase introuvable' }
  const { subPhase, phase } = ownership

  if (subPhase.status !== 'in_review')
    return { success: false, error: 'La sous-phase doit être en review pour être approuvée' }

  // Verify at least one track is selected
  const { data: rawTracks } = await admin
    .from('phase_blocks')
    .select('id, content')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'audio_track')

  const tracks = (rawTracks ?? []) as { id: string; content: AudioTrackContent }[]
  const hasSelection = tracks.some((t) => t.content.is_selected)
  if (!hasSelection)
    return { success: false, error: 'Sélectionnez une piste avant de valider' }

  const { error } = await db(admin)
    .from('sub_phases')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', subPhaseId)

  if (error) return { success: false, error: error.message }

  // Auto-complete parent phase if all sub_phases done
  const { data: rawAllSps } = await admin
    .from('sub_phases')
    .select('id, status')
    .eq('phase_id', phase.id)

  const allSps = (rawAllSps as Pick<SubPhase, 'id' | 'status'>[] | null) ?? []
  const updatedSps = allSps.map((s) =>
    s.id === subPhaseId ? { ...s, status: 'completed' as const } : s,
  )
  const allDone = updatedSps.every((s) => s.status === 'completed' || s.status === 'approved')

  if (allDone) {
    await db(admin)
      .from('project_phases')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', phase.id)
  }

  const userId = await resolveClientUserId(admin, project)
  if (userId) {
    await db(admin).from('activity_logs').insert({
      project_id: project.id,
      user_id: userId,
      action: 'phase_approved',
      details: { phase_name: 'Audio (client)' },
    })
  }

  void notifyClientValidation(project.id, 'Audio validé par le client.', `/projects/${project.id}`)

  revalidatePath(`/client/${token}`)
  revalidatePath(`/client/${token}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}

// ── requestAudioRevisions ─────────────────────────────────────────

export async function requestAudioRevisions(
  token: string,
  subPhaseId: string,
  message: string,
): Promise<AudioClientResult> {
  const admin = createAdminClient()
  const access = await requireAssignedClient(token)
  if ('error' in access) return { success: false, error: access.error }
  const { project, userId } = access

  const ownership = await verifySubPhaseOwnership(admin, subPhaseId, project.id)
  if (!ownership) return { success: false, error: 'Sous-phase introuvable' }
  const { subPhase, phase } = ownership

  if (subPhase.status !== 'in_review')
    return { success: false, error: 'La sous-phase doit être en review pour demander des modifications' }

  const { error } = await db(admin)
    .from('sub_phases')
    .update({ status: 'in_progress' })
    .eq('id', subPhaseId)

  if (error) return { success: false, error: error.message }

  if (message.trim()) {
    await db(admin).from('comments').insert({
      project_id: project.id,
      phase_id: phase.id,
      sub_phase_id: subPhaseId,
      block_id: null,
      user_id: userId,
      content: `[Demande de modification] ${message.trim()}`,
      is_resolved: false,
    })
  }

  await db(admin).from('activity_logs').insert({
    project_id: project.id,
    user_id: userId,
    action: 'status_changed',
    details: { phase_name: 'Audio', message: 'Demande de modifications client' },
  })

  // ── Notify admins / PM (fire-and-forget) ─────────────────────────
  void (async () => {
    const r = await getProjectRecipients(project.id)
    if (!r.projectName) return

    const recipientIds = [
      ...new Set([...r.adminIds, ...(r.projectManagerId ? [r.projectManagerId] : [])]),
    ]
    if (recipientIds.length === 0) return

    const link = `/projects/${project.id}/phases/${phase.id}/sub/${subPhaseId}`
    const notifTitle = `🔄 Révision demandée — Audio`
    const notifMsg = message.trim() || 'Le client a demandé des modifications.'

    await createNotifications(
      recipientIds.map((uid) => ({
        userId: uid,
        projectId: project.id,
        type: 'revision_requested' as const,
        title: notifTitle,
        message: notifMsg,
        link,
      })),
    )

    if (r.projectManagerId) {
      const { data: pmRaw } = await createAdminClient()
        .from('profiles')
        .select('email')
        .eq('id', r.projectManagerId)
        .maybeSingle()
      const pmEmail = (pmRaw as { email: string } | null)?.email
      if (pmEmail) {
        void sendEmail({
          to: pmEmail,
          template: 'revision_requested',
          data: {
            projectName: r.projectName,
            agencyName: r.agencyName,
            phaseName: 'Audio',
            clientName: 'Le client',
          },
          link,
        })
      }
    }
  })()

  revalidatePath(`/client/${token}`)
  revalidatePath(`/client/${token}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}
