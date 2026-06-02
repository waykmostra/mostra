'use server'

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { createNotifications, getProjectRecipients } from '@/lib/notifications'
import { sendEmail } from '@/lib/email/send'
import type { Project, ProjectPhase, SubPhase, PhaseBlock, Profile } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'

export type ScriptClientActionResult = { success: true } | { success: false; error: string }

// ── fetchSubPhaseComments ─────────────────────────────────────────
// Récupère tous les commentaires d'une sous-phase (pour le polling client).

export async function fetchSubPhaseComments(
  token: string,
  subPhaseId: string,
): Promise<BlockComment[]> {
  noStore()
  const admin = createAdminClient()
  const project = await verifyToken(token)
  if (!project) return []

  const { data: rawComments } = await admin
    .from('comments')
    .select('*')
    .eq('sub_phase_id', subPhaseId)
    .order('created_at', { ascending: true })

  const list = (rawComments ?? []) as {
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

  if (list.length === 0) return []

  // Fetch author profiles
  const authorIds = [...new Set(list.map((c) => c.user_id))]
  const { data: rawAuthors } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', authorIds)

  const authorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  ;(rawAuthors as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) =>
    authorMap.set(p.id, p),
  )

  return list.map((c) => ({ ...c, author: authorMap.get(c.user_id) ?? null }))
}

// ── Token helper ──────────────────────────────────────────────────

async function verifyToken(token: string) {
  const admin = createAdminClient()
  const { data: rawProject } = await admin
    .from('projects')
    .select('id, client_id, share_token')
    .eq('share_token', token)
    .maybeSingle()
  return rawProject as Pick<Project, 'id' | 'client_id' | 'share_token'> | null
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

async function verifySubPhaseOwnership(
  admin: ReturnType<typeof createAdminClient>,
  subPhaseId: string,
  projectId: string,
): Promise<{ subPhase: Pick<SubPhase, 'id' | 'phase_id' | 'status'>; phase: Pick<ProjectPhase, 'id' | 'project_id'> } | null> {
  const { data: rawSubPhase } = await admin
    .from('sub_phases')
    .select('id, phase_id, status')
    .eq('id', subPhaseId)
    .maybeSingle()
  const subPhase = rawSubPhase as Pick<SubPhase, 'id' | 'phase_id' | 'status'> | null
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

// ── addBlockComment ───────────────────────────────────────────────

export async function addBlockComment(
  token: string,
  blockId: string,
  content: string,
): Promise<ScriptClientActionResult> {
  const admin = createAdminClient()
  const project = await verifyToken(token)
  if (!project) return { success: false, error: 'Token invalide' }
  if (!content.trim()) return { success: false, error: 'Contenu vide' }

  const userId = await resolveClientUserId(admin, project)
  if (!userId) return { success: false, error: 'Client introuvable' }

  // Verify block → sub_phase → phase → project chain
  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()
  const block = rawBlock as Pick<PhaseBlock, 'id' | 'sub_phase_id'> | null
  if (!block || !block.sub_phase_id) return { success: false, error: 'Bloc introuvable' }

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

// ── resolveBlockComment ───────────────────────────────────────────

export async function resolveBlockComment(
  token: string,
  commentId: string,
): Promise<ScriptClientActionResult> {
  const admin = createAdminClient()
  const project = await verifyToken(token)
  if (!project) return { success: false, error: 'Token invalide' }

  const { data: rawComment } = await admin
    .from('comments')
    .select('id, project_id, user_id, is_resolved')
    .eq('id', commentId)
    .maybeSingle()
  const comment = rawComment as {
    id: string
    project_id: string
    user_id: string
    is_resolved: boolean
  } | null
  if (!comment || comment.project_id !== project.id) return { success: false, error: 'Commentaire introuvable' }

  // Client can only resolve their own comments
  const clientUserId = await resolveClientUserId(admin, project)
  if (clientUserId && comment.user_id !== clientUserId) {
    return { success: false, error: 'Vous ne pouvez résoudre que vos propres commentaires' }
  }

  const { error } = await db(admin)
    .from('comments')
    .update({ is_resolved: !comment.is_resolved })
    .eq('id', commentId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── approveScriptSubPhase ─────────────────────────────────────────

export async function approveScriptSubPhase(
  token: string,
  subPhaseId: string,
): Promise<ScriptClientActionResult> {
  const admin = createAdminClient()
  const project = await verifyToken(token)
  if (!project) return { success: false, error: 'Token invalide' }

  const ownership = await verifySubPhaseOwnership(admin, subPhaseId, project.id)
  if (!ownership) return { success: false, error: 'Sous-phase introuvable' }
  const { subPhase, phase } = ownership

  if (subPhase.status !== 'in_review') {
    return { success: false, error: 'Le script doit être en review pour être approuvé' }
  }

  const { error } = await db(admin)
    .from('sub_phases')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', subPhaseId)

  if (error) return { success: false, error: error.message }

  // Auto-complete parent phase if all sub_phases are done
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

  const clientUserId = await resolveClientUserId(admin, project)
  if (clientUserId) {
    await db(admin).from('activity_logs').insert({
      project_id: project.id,
      user_id: clientUserId,
      action: 'phase_approved',
      details: { phase_name: 'Script (client)' },
    })
  }

  revalidatePath(`/client/${token}`)
  revalidatePath(`/client/${token}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}

// ── requestScriptRevisions ────────────────────────────────────────

export async function requestScriptRevisions(
  token: string,
  subPhaseId: string,
  message: string,
): Promise<ScriptClientActionResult> {
  const admin = createAdminClient()
  const project = await verifyToken(token)
  if (!project) return { success: false, error: 'Token invalide' }

  const userId = await resolveClientUserId(admin, project)
  if (!userId) return { success: false, error: 'Client introuvable' }

  const ownership = await verifySubPhaseOwnership(admin, subPhaseId, project.id)
  if (!ownership) return { success: false, error: 'Sous-phase introuvable' }
  const { subPhase, phase } = ownership

  if (subPhase.status !== 'in_review') {
    return { success: false, error: 'Le script doit être en review pour demander des modifications' }
  }

  const { error: spErr } = await db(admin)
    .from('sub_phases')
    .update({ status: 'in_progress' })
    .eq('id', subPhaseId)

  if (spErr) return { success: false, error: spErr.message }

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
    details: { phase_name: 'Script', message: 'Demande de modifications client' },
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
    const notifTitle = `🔄 Révision demandée — Script`
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
            phaseName: 'Script',
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
