'use server'

import { revalidatePath } from 'next/cache'
import { syncPhaseFromSubPhases } from '@/lib/phaseSync'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createNotifications, getProjectRecipients } from '@/lib/notifications'
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

  await syncPhaseFromSubPhases(supabase, phase.id)

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

  await syncPhaseFromSubPhases(supabase, phase.id)

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'phase_review',
    details: { phase_name: `${phase.name} › ${sp.name}` },
  })

  // Notifier le client
  void (async () => {
    const r = await getProjectRecipients(phase.project_id)
    if (!r.projectName) return

    const subPhaseLink = r.shareToken
      ? `/client/${r.shareToken}/phases/${phase.id}/sub/${subPhaseId}`
      : null
    const adminLink = `/projects/${phase.project_id}/phases/${phase.id}/sub/${subPhaseId}`

    if (r.clientUserIds.length > 0) {
      await createNotifications(
        r.clientUserIds.map((userId) => ({
          userId,
          projectId: phase.project_id,
          type: 'phase_ready' as const,
          title: `✅ ${sp.name} est prête pour votre validation`,
          message: `Phase ${phase.name} — disponible pour révision.`,
          link: subPhaseLink,
        })),
      )
    }

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

  // Statut de la phase, déblocage de la suivante et avancement du projet.
  await syncPhaseFromSubPhases(supabase, phase.id)

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'phase_approved',
    details: { phase_name: `${phase.name} › ${sp.name}` },
  })

  void (async () => {
    const r = await getProjectRecipients(phase.project_id)
    if (r.clientUserIds.length === 0 && !r.clientEmail) return

    if (r.clientUserIds.length > 0) {
      await createNotifications(
        r.clientUserIds.map((userId) => ({
          userId,
          projectId: phase.project_id,
          type: 'phase_approved' as const,
          title: `🎉 ${sp.name} a été approuvée`,
          message: `${phase.name} — validée et terminée.`,
          link: r.shareToken ? `/client/${r.shareToken}` : null,
        })),
      )
    }

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

  await syncPhaseFromSubPhases(supabase, phase.id)

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

// ── CRUD des sous-étapes (mode éditeur) ───────────────────────────
// Le type détermine l'interface rendue côté admin et côté client : c'est le
// `slug` qui aiguille (formulaire, script, moodboard, storyboard, design, VO…).

export type SubPhaseType =
  | 'formulaire'
  | 'script'
  | 'style'
  | 'storyboard'
  | 'design'
  | 'vo'
  | 'musique'

export const SUB_PHASE_TYPES: { type: SubPhaseType; slug: string; name: string }[] = [
  { type: 'formulaire', slug: 'formulaire', name: 'Formulaire de brief' },
  { type: 'script', slug: 'script', name: 'Script' },
  { type: 'style', slug: 'style', name: 'Moodboard / Style' },
  { type: 'storyboard', slug: 'storyboard', name: 'Storyboard' },
  { type: 'design', slug: 'design', name: 'Maquettes' },
  { type: 'vo', slug: 'vo', name: 'Voix off' },
  { type: 'musique', slug: 'musique', name: 'Musique' },
]

export async function addSubPhase(
  phaseId: string,
  type: SubPhaseType,
  name?: string,
): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const def = SUB_PHASE_TYPES.find((t) => t.type === type)
  if (!def) return { success: false, error: 'Type de sous-étape invalide' }

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('id, project_id, name')
    .eq('id', phaseId)
    .maybeSingle()
  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'project_id' | 'name'> | null
  if (!phase) return { success: false, error: 'Étape introuvable' }

  const { data: rawMax } = await supabase
    .from('sub_phases')
    .select('sort_order')
    .eq('phase_id', phaseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((rawMax as { sort_order: number } | null)?.sort_order ?? 0) + 1

  const { error } = await db(supabase).from('sub_phases').insert({
    phase_id: phaseId,
    name: name?.trim() || def.name,
    slug: def.slug,
    sort_order: nextOrder,
    status: 'pending',
  })
  if (error) return { success: false, error: error.message }

  await syncPhaseFromSubPhases(supabase, phaseId)

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'status_changed',
    details: { phase_name: `${phase.name} › ${name?.trim() || def.name}`, message: 'Sous-étape ajoutée' },
  })

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phaseId}`)
  return { success: true }
}

export async function renameSubPhase(
  subPhaseId: string,
  name: string,
): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom est requis' }

  const resolved = await resolveSubPhase(supabase, subPhaseId)
  if (!resolved) return { success: false, error: 'Sous-étape introuvable' }
  const { phase } = resolved

  const { error } = await db(supabase)
    .from('sub_phases')
    .update({ name: clean })
    .eq('id', subPhaseId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phase.id}`)
  return { success: true }
}

export async function deleteSubPhase(subPhaseId: string): Promise<SubPhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const resolved = await resolveSubPhase(supabase, subPhaseId)
  if (!resolved) return { success: false, error: 'Sous-étape introuvable' }
  const { sp, phase } = resolved

  // Commentaires et blocs (questions, sections de script, images…) d'abord :
  // les FK ne cascadent pas toutes.
  await db(supabase).from('comments').delete().eq('sub_phase_id', subPhaseId)
  await db(supabase).from('phase_blocks').delete().eq('sub_phase_id', subPhaseId)
  await db(supabase).from('scripts').delete().eq('sub_phase_id', subPhaseId)

  const { error } = await db(supabase).from('sub_phases').delete().eq('id', subPhaseId)
  if (error) return { success: false, error: error.message }

  await syncPhaseFromSubPhases(supabase, phase.id)

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'status_changed',
    details: { phase_name: `${phase.name} › ${sp.name}`, message: 'Sous-étape supprimée' },
  })

  revalidatePath(`/projects/${phase.project_id}`)
  revalidatePath(`/projects/${phase.project_id}/phases/${phase.id}`)
  return { success: true }
}
