'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireProjectAccess } from '@/lib/auth'
import { createNotifications, getProjectRecipients, notifyClientValidation } from '@/lib/notifications'
import { sendEmail } from '@/lib/email/send'
import type { PhaseFile, Project, ProjectPhase } from '@/lib/types'

// ============================================================================
// Actions côté client : exigent un user authentifié + qui est client_id du projet
// (utilisation du helper requireProjectAccess).
//
// Pour les fetch publics (lecture sans login via le share_token), on garde
// resolveByToken qui passe par createAdminClient — c'est le mode lecture seule.
// ============================================================================

export type ClientActionResult = { success: true } | { success: false; error: string }

// ── Helper : résoudre un share_token → projet (lecture publique seulement) ──

async function resolveByToken(token: string): Promise<Project | null> {
  const admin = createAdminClient()
  const { data } = await db(admin)
    .from('projects')
    .select('*')
    .eq('share_token', token)
    .maybeSingle()
  return data as Project | null
}

// ── recalcProgress ───────────────────────────────────────────────

async function recalcProgress(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
): Promise<void> {
  const { data: rawPhases } = await db(admin)
    .from('project_phases')
    .select('id, status')
    .eq('project_id', projectId)

  const phases = (rawPhases as Pick<ProjectPhase, 'id' | 'status'>[] | null) ?? []
  if (phases.length === 0) return

  const doneCount = phases.filter((p) => p.status === 'completed' || p.status === 'approved').length
  const progress = Math.round((doneCount / phases.length) * 100)
  const allDone = phases.every((p) => p.status === 'completed' || p.status === 'approved')

  const projectUpdate: Record<string, unknown> = { progress }
  if (allDone) projectUpdate.status = 'completed'

  await db(admin).from('projects').update(projectUpdate).eq('id', projectId)
}

// ── approveAsClient (auth requise) ───────────────────────────────

export async function approveAsClient(projectId: string, phaseId: string): Promise<ClientActionResult> {
  const auth = await requireProjectAccess(projectId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const { data: rawPhase } = await db(admin)
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { success: false, error: 'Phase introuvable' }
  if (phase.project_id !== projectId) return { success: false, error: 'Accès refusé' }
  if (phase.status !== 'in_review')
    return { success: false, error: "Cette phase n'est pas en attente de validation" }

  const now = new Date().toISOString()

  const { error } = await db(admin)
    .from('project_phases')
    .update({ status: 'approved', completed_at: now })
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  await recalcProgress(admin, projectId)

  await db(admin)
    .from('activity_logs')
    .insert({
      project_id: projectId,
      user_id: user.id,
      action: 'phase_approved',
      details: { phase_name: phase.name, via: 'client_auth' },
    })

  void notifyClientValidation(projectId, `${phase.name} validé par le client.`, `/projects/${projectId}/phases/${phaseId}`)

  // Token (pour revalidate du path public)
  const { data: rawProj } = await admin
    .from('projects')
    .select('share_token')
    .eq('id', projectId)
    .maybeSingle()
  const token = (rawProj as { share_token: string | null } | null)?.share_token

  if (token) {
    revalidatePath(`/client/${token}`)
    revalidatePath(`/client/${token}/phases/${phaseId}`)
  }
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/client/dashboard`)
  return { success: true }
}

// ── requestRevisionAsClient (auth requise) ───────────────────────

export async function requestRevisionAsClient(
  projectId: string,
  phaseId: string,
  message: string,
): Promise<ClientActionResult> {
  const auth = await requireProjectAccess(projectId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const { data: rawPhase } = await db(admin)
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { success: false, error: 'Phase introuvable' }
  if (phase.project_id !== projectId) return { success: false, error: 'Accès refusé' }
  if (phase.status !== 'in_review')
    return { success: false, error: "Cette phase n'est pas en attente de validation" }

  const { error: phaseError } = await db(admin)
    .from('project_phases')
    .update({ status: 'in_progress' })
    .eq('id', phaseId)

  if (phaseError) return { success: false, error: phaseError.message }

  const trimmed = message.trim()
  if (trimmed) {
    await db(admin).from('comments').insert({
      project_id: projectId,
      phase_id: phaseId,
      user_id: user.id,
      content: trimmed,
      is_resolved: false,
    })
  }

  await db(admin)
    .from('activity_logs')
    .insert({
      project_id: projectId,
      user_id: user.id,
      action: 'phase_review',
      details: {
        phase_name: phase.name,
        revision_requested: true,
        message: trimmed,
        via: 'client_auth',
      },
    })

  // Notifier admins + PM
  void (async () => {
    const r = await getProjectRecipients(projectId)
    if (!r.projectName) return

    const recipientIds = [
      ...new Set([...r.adminIds, ...(r.projectManagerId ? [r.projectManagerId] : [])]),
    ]
    if (recipientIds.length === 0) return

    const link = `/projects/${projectId}/phases/${phaseId}`
    const notifTitle = `🔄 Révision demandée — ${phase.name}`
    const notifMsg = trimmed || 'Le client a demandé des modifications.'

    await createNotifications(
      recipientIds.map((uid) => ({
        userId: uid,
        projectId,
        type: 'revision_requested' as const,
        title: notifTitle,
        message: notifMsg,
        link,
      })),
    )

    if (r.projectManagerId) {
      const { data: pmRaw } = await admin
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
            agencyName: 'Mostra',
            phaseName: phase.name,
            clientName: 'Le client',
          },
          link,
        })
      }
    }
  })()

  const { data: rawProj } = await admin
    .from('projects')
    .select('share_token')
    .eq('id', projectId)
    .maybeSingle()
  const token = (rawProj as { share_token: string | null } | null)?.share_token

  if (token) {
    revalidatePath(`/client/${token}`)
    revalidatePath(`/client/${token}/phases/${phaseId}`)
  }
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/client/dashboard`)
  return { success: true }
}

// ── getClientSignedUrl (lecture publique via token) ──────────────
// Mode lecture seule : sans login, on peut consulter les fichiers
// si on a le share_token. C'est le seul accès anonyme autorisé.

export async function getClientSignedUrl(
  token: string,
  filePath: string,
): Promise<{ url: string } | { error: string }> {
  const project = await resolveByToken(token)
  if (!project) return { error: 'Lien invalide' }

  // Vérifier que le file appartient au projet (filePath commence par projectId)
  if (!filePath.startsWith(`${project.id}/`)) {
    return { error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('project-files').createSignedUrl(filePath, 3600)

  if (error || !data?.signedUrl) return { error: error?.message ?? 'Erreur inconnue' }
  return { url: data.signedUrl }
}

// ── getClientPhaseViewData (lecture publique via token) ──────────

export interface ClientPhaseViewData {
  projectId: string
  projectName: string
  phaseName: string
  phaseStatus: ProjectPhase['status']
  completedAt: string | null
  files: PhaseFile[]
  signedUrl: string | null
  activeVersion: number | null
  uploaders: Record<string, string>
  token: string
}

export async function getClientPhaseViewData(
  token: string,
  phaseId: string,
  requestedVersion?: number,
): Promise<ClientPhaseViewData | { error: string }> {
  const project = await resolveByToken(token)
  if (!project) return { error: 'Lien invalide' }

  const admin = createAdminClient()

  const { data: rawPhase } = await db(admin)
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { error: 'Phase introuvable' }
  if (phase.project_id !== project.id) return { error: 'Accès refusé' }

  const { data: rawFiles } = await db(admin)
    .from('phase_files')
    .select('*')
    .eq('phase_id', phaseId)
    .order('version', { ascending: false })

  const files = (rawFiles as PhaseFile[] | null) ?? []

  if (files.length === 0) {
    return {
      projectId: project.id,
      projectName: project.name,
      phaseName: phase.name,
      phaseStatus: phase.status,
      completedAt: phase.completed_at,
      files: [],
      signedUrl: null,
      activeVersion: null,
      uploaders: {},
      token,
    }
  }

  const target =
    requestedVersion !== undefined
      ? (files.find((f) => f.version === requestedVersion) ?? files[0])
      : (files.find((f) => f.is_current) ?? files[0])

  let signedUrl: string | null = null
  if (target) {
    const { data: signed } = await admin.storage
      .from('project-files')
      .createSignedUrl(target.file_url, 3600)
    signedUrl = signed?.signedUrl ?? null
  }

  const uploaderIds = [...new Set(files.map((f) => f.uploaded_by))]
  const uploaders: Record<string, string> = {}
  if (uploaderIds.length > 0) {
    const { data: profiles } = await db(admin)
      .from('profiles')
      .select('id, full_name')
      .in('id', uploaderIds)
    ;(profiles as { id: string; full_name: string }[] | null)?.forEach(
      (p: { id: string; full_name: string }) => {
        uploaders[p.id] = p.full_name
      },
    )
  }

  return {
    projectId: project.id,
    projectName: project.name,
    phaseName: phase.name,
    phaseStatus: phase.status,
    completedAt: phase.completed_at,
    files,
    signedUrl,
    activeVersion: target?.version ?? null,
    uploaders,
    token,
  }
}
