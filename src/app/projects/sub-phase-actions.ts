'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createNotification, createNotifications, getProjectRecipients } from '@/lib/notifications'
import { sendEmail } from '@/lib/email/send'
import type { SubPhase, ProjectPhase } from '@/lib/types'

export type SubPhaseActionResult = { success: true } | { success: false; error: string }

// ── Résoudre la sous-phase + sa phase parente ─────────────────────

async function resolveSubPhase(supabase: ReturnType<typeof createClient>, subPhaseId: string) {
  const { data: rawSp } = await supabase
    .from('sub_phases')
    .select('id, phase_id, name, slug, status, sort_order')
    .eq('id', subPhaseId)
    .maybeSingle()

  const sp = rawSp as Pick<SubPhase, 'id' | 'phase_id' | 'name' | 'slug' | 'status' | 'sort_order'> | null
  if (!sp) return null

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('id, project_id, name, slug, status')
    .eq('id', sp.phase_id)
    .maybeSingle()

  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'project_id' | 'name' | 'slug' | 'status'> | null
  if (!phase) return null

  return { sp, phase }
}

// ── startSubPhase ─────────────────────────────────────────────────

export async function startSubPhase(subPhaseId: string): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const resolved = await resolveSubPhase(supabase, subPhaseId)
  if (!resolved) return { success: false, error: 'Sous-phase introuvable' }
  const { sp, phase } = resolved

  if (sp.status !== 'pending') {
    return { success: false, error: 'La sous-phase doit être en attente pour être démarrée' }
  }

  // Sous-phase précédente terminée ?
  const { data: rawSiblings } = await supabase
    .from('sub_phases')
    .select('id, sort_order, status')
    .eq('phase_id', sp.phase_id)
    .order('sort_order', { ascending: true })

  const siblings = (rawSiblings as Pick<SubPhase, 'id' | 'sort_order' | 'status'>[] | null) ?? []
  const idx = siblings.findIndex((s) => s.id === subPhaseId)

  if (idx > 0) {
    const prev = siblings[idx - 1]
    if (prev.status !== 'completed' && prev.status !== 'approved') {
      return {
        success: false,
        error: 'La sous-phase précédente doit être terminée avant de démarrer celle-ci',
      }
    }
  }

  const { error: spErr } = await db(supabase)
    .from('sub_phases')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', subPhaseId)

  if (spErr) return { success: false, error: spErr.message }

  // Auto-démarre la phase parente si pending
  if (phase.status === 'pending') {
    await db(supabase)
      .from('project_phases')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', phase.id)
  }

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'phase_started',
    details: { phase_name: `${phase.name} › ${sp.name}` },
  })

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}

// ── sendSubPhaseToReview ──────────────────────────────────────────

export async function sendSubPhaseToReview(subPhaseId: string): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const resolved = await resolveSubPhase(supabase, subPhaseId)
  if (!resolved) return { success: false, error: 'Sous-phase introuvable' }
  const { sp, phase } = resolved

  if (sp.status !== 'in_progress') {
    return { success: false, error: 'La sous-phase doit être en cours pour être envoyée en review' }
  }

  const { error } = await db(supabase)
    .from('sub_phases')
    .update({ status: 'in_review' })
    .eq('id', subPhaseId)

  if (error) return { success: false, error: error.message }

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'phase_review',
    details: { phase_name: `${phase.name} › ${sp.name}` },
  })

  // Notifier le client
  void (async () => {
    const r = await getProjectRecipients(phase.project_id)
    if (!r.clientUserId) return

    const subPhaseLink = r.shareToken
      ? `/client/${r.shareToken}/phases/${phase.id}/sub/${subPhaseId}`
      : null
    const adminLink = `/projects/${phase.project_id}/phases/${phase.id}/sub/${subPhaseId}`

    await createNotification({
      userId: r.clientUserId,
      projectId: phase.project_id,
      type: 'phase_ready',
      title: `✅ ${sp.name} est prête pour votre validation`,
      message: `Phase ${phase.name} — disponible pour révision.`,
      link: subPhaseLink,
    })

    await createNotifications(
      r.adminIds.filter((id) => id !== user.id).map((userId) => ({
        userId,
        projectId: phase.project_id,
        type: 'phase_ready' as const,
        title: `Phase « ${sp.name} » envoyée en review`,
        message: `${phase.name} › ${sp.name} — en attente de validation client.`,
        link: adminLink,
      })),
    )

    if (r.clientEmail) {
      void sendEmail({
        to: r.clientEmail,
        template: 'phase_ready',
        data: {
          projectName: r.projectName,
          agencyName: 'Mostra',
          phaseName: `${phase.name} › ${sp.name}`,
        },
        link: subPhaseLink ?? undefined,
      })
    }
  })()

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}

// ── approveSubPhase ───────────────────────────────────────────────

export async function approveSubPhase(subPhaseId: string): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const resolved = await resolveSubPhase(supabase, subPhaseId)
  if (!resolved) return { success: false, error: 'Sous-phase introuvable' }
  const { sp, phase } = resolved

  if (sp.status !== 'in_review') {
    return { success: false, error: 'La sous-phase doit être en review pour être approuvée' }
  }

  const { error } = await db(supabase)
    .from('sub_phases')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', subPhaseId)

  if (error) return { success: false, error: error.message }

  // Vérifier si toutes les sous-phases de la phase sont done
  const { data: rawAllSps } = await supabase
    .from('sub_phases')
    .select('id, status')
    .eq('phase_id', phase.id)

  const allSps = (rawAllSps as Pick<SubPhase, 'id' | 'status'>[] | null) ?? []
  const updatedSps = allSps.map((s) =>
    s.id === subPhaseId ? { ...s, status: 'completed' as const } : s,
  )
  const allDone = updatedSps.every((s) => s.status === 'completed' || s.status === 'approved')

  if (allDone) {
    await db(supabase)
      .from('project_phases')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', phase.id)

    // Recalc project progress
    const { data: rawAllPhases } = await supabase
      .from('project_phases')
      .select('id, status')
      .eq('project_id', phase.project_id)

    const allPhases = (rawAllPhases as Pick<ProjectPhase, 'id' | 'status'>[] | null) ?? []
    const updatedPhases = allPhases.map((p) =>
      p.id === phase.id ? { ...p, status: 'completed' as const } : p,
    )
    const doneCount = updatedPhases.filter(
      (p) => p.status === 'completed' || p.status === 'approved',
    ).length
    const progress = allPhases.length > 0 ? Math.round((doneCount / allPhases.length) * 100) : 0
    const projectAllDone = updatedPhases.every(
      (p) => p.status === 'completed' || p.status === 'approved',
    )

    const projectUpdate: Record<string, unknown> = { progress }
    if (projectAllDone) projectUpdate.status = 'completed'

    await db(supabase).from('projects').update(projectUpdate).eq('id', phase.project_id)
  }

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'phase_approved',
    details: { phase_name: `${phase.name} › ${sp.name}` },
  })

  void (async () => {
    const r = await getProjectRecipients(phase.project_id)
    if (!r.clientUserId) return

    await createNotification({
      userId: r.clientUserId,
      projectId: phase.project_id,
      type: 'phase_approved',
      title: `🎉 ${sp.name} a été approuvée`,
      message: `${phase.name} — validée et terminée.`,
      link: r.shareToken ? `/client/${r.shareToken}` : null,
    })

    if (r.clientEmail) {
      void sendEmail({
        to: r.clientEmail,
        template: 'phase_approved',
        data: {
          projectName: r.projectName,
          agencyName: 'Mostra',
          phaseName: `${phase.name} › ${sp.name}`,
          clientName: 'vous',
        },
        link: r.shareToken ? `/client/${r.shareToken}` : undefined,
      })
    }
  })()

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}

// ── unapproveSubPhase ─────────────────────────────────────────────

export async function unapproveSubPhase(subPhaseId: string): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const resolved = await resolveSubPhase(supabase, subPhaseId)
  if (!resolved) return { success: false, error: 'Sous-phase introuvable' }
  const { sp, phase } = resolved

  if (sp.status !== 'completed' && sp.status !== 'approved' && sp.status !== 'in_review') {
    return { success: false, error: 'La sous-phase doit être en review ou approuvée pour être désapprouvée' }
  }

  const { error } = await db(supabase)
    .from('sub_phases')
    .update({ status: 'in_progress', completed_at: null })
    .eq('id', subPhaseId)

  if (error) return { success: false, error: error.message }

  if (phase.status === 'completed' || phase.status === 'approved') {
    await db(supabase)
      .from('project_phases')
      .update({ status: 'in_progress', completed_at: null })
      .eq('id', phase.id)

    const { data: rawAllPhases } = await supabase
      .from('project_phases')
      .select('id, status')
      .eq('project_id', phase.project_id)

    const allPhases = (rawAllPhases as Pick<ProjectPhase, 'id' | 'status'>[] | null) ?? []
    const updatedPhases = allPhases.map((p) =>
      p.id === phase.id ? { ...p, status: 'in_progress' as const } : p,
    )
    const doneCount = updatedPhases.filter(
      (p) => p.status === 'completed' || p.status === 'approved',
    ).length
    const progress = allPhases.length > 0 ? Math.round((doneCount / allPhases.length) * 100) : 0

    await db(supabase)
      .from('projects')
      .update({ progress, status: 'active' })
      .eq('id', phase.project_id)
  }

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'status_changed',
    details: { phase_name: `${phase.name} › ${sp.name}`, message: 'Désapprouvée par admin' },
  })

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phase.id}/sub/${subPhaseId}`)
  return { success: true }
}
