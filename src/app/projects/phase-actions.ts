'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { ProjectPhase, PhaseStatus } from '@/lib/types'

type AuthSupabase = ReturnType<typeof createClient>

export type PhaseActionResult = { success: true } | { success: false; error: string }

// ── Étapes composables par type (migration 027 réutilise sub_phases/blocks) ──

export type StepType = 'formulaire' | 'script' | 'style' | 'storyboard' | 'audio' | 'video'

const STEP_TYPES: Record<
  StepType,
  { phaseName: string; phaseSlug: string; sub: { slug: string; name: string } | null }
> = {
  formulaire: { phaseName: 'Formulaire', phaseSlug: 'formulaire', sub: { slug: 'formulaire', name: 'Formulaire de brief' } },
  script:     { phaseName: 'Script',      phaseSlug: 'script',     sub: { slug: 'script',     name: 'Script' } },
  style:      { phaseName: 'Choix image', phaseSlug: 'style',      sub: { slug: 'style',      name: 'Moodboard / Style' } },
  storyboard: { phaseName: 'Storyboard',  phaseSlug: 'storyboard', sub: { slug: 'storyboard', name: 'Storyboard' } },
  audio:      { phaseName: 'Audio',       phaseSlug: 'audio',      sub: { slug: 'vo',         name: 'Audio' } },
  video:      { phaseName: 'Vidéo',       phaseSlug: 'video',      sub: null }, // basé fichiers + review timecode
}

// ─── startPhase ───────────────────────────────────────────────────

export async function startPhase(phaseId: string): Promise<PhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { success: false, error: 'Phase introuvable' }
  if (phase.status !== 'pending') return { success: false, error: 'La phase doit être en attente' }

  // Phase précédente terminée ?
  const { data: rawSiblings } = await supabase
    .from('project_phases')
    .select('id, sort_order, status')
    .eq('project_id', phase.project_id)
    .order('sort_order', { ascending: true })

  const siblings = (rawSiblings as Pick<ProjectPhase, 'id' | 'sort_order' | 'status'>[] | null) ?? []
  const idx = siblings.findIndex((p) => p.id === phaseId)

  if (idx > 0) {
    const prev = siblings[idx - 1]
    if (prev.status !== 'completed' && prev.status !== 'approved') {
      return {
        success: false,
        error: 'La phase précédente doit être terminée avant de démarrer celle-ci',
      }
    }
  }

  const { error } = await db(supabase)
    .from('project_phases')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: phase.project_id,
      user_id: user.id,
      action: 'phase_started',
      details: { phase_name: phase.name },
    })

  revalidatePath(`/projects/${phase.project_id}`)
  return { success: true }
}

// ─── sendToReview ─────────────────────────────────────────────────

export async function sendToReview(phaseId: string): Promise<PhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { success: false, error: 'Phase introuvable' }
  if (phase.status !== 'in_progress')
    return { success: false, error: 'La phase doit être en cours' }

  // Au moins 1 fichier ?
  const { count } = await supabase
    .from('phase_files')
    .select('*', { count: 'exact', head: true })
    .eq('phase_id', phaseId)

  if (!count || count === 0) {
    return { success: false, error: "Uploadez au moins un fichier avant d'envoyer en review" }
  }

  const { error } = await db(supabase)
    .from('project_phases')
    .update({ status: 'in_review' })
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: phase.project_id,
      user_id: user.id,
      action: 'phase_review',
      details: { phase_name: phase.name },
    })

  revalidatePath(`/projects/${phase.project_id}`)
  return { success: true }
}

// ─── completePhase ────────────────────────────────────────────────

export async function completePhase(phaseId: string): Promise<PhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { success: false, error: 'Phase introuvable' }

  const { error } = await db(supabase)
    .from('project_phases')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  // Recalcule progression
  const { data: rawAllPhases } = await supabase
    .from('project_phases')
    .select('id, status')
    .eq('project_id', phase.project_id)

  const allPhases = (rawAllPhases as Pick<ProjectPhase, 'id' | 'status'>[] | null) ?? []
  const updated = allPhases.map((p) =>
    p.id === phaseId ? { ...p, status: 'completed' as const } : p,
  )

  const doneCount = updated.filter(
    (p) => p.status === 'completed' || p.status === 'approved',
  ).length

  const progress = allPhases.length > 0 ? Math.round((doneCount / allPhases.length) * 100) : 0
  const allDone = updated.every((p) => p.status === 'completed' || p.status === 'approved')

  const projectUpdate: Record<string, unknown> = { progress }
  if (allDone) projectUpdate.status = 'completed'

  await db(supabase).from('projects').update(projectUpdate).eq('id', phase.project_id)

  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: phase.project_id,
      user_id: user.id,
      action: 'phase_completed',
      details: { phase_name: phase.name },
    })

  revalidatePath(`/projects/${phase.project_id}`)
  return { success: true }
}

// ─── unapprovePhase ───────────────────────────────────────────────

export async function unapprovePhase(phaseId: string): Promise<PhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('*')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as ProjectPhase | null
  if (!phase) return { success: false, error: 'Phase introuvable' }
  if (phase.status !== 'completed' && phase.status !== 'approved' && phase.status !== 'in_review') {
    return { success: false, error: 'La phase doit être en review ou approuvée pour être désapprouvée' }
  }

  const { error } = await db(supabase)
    .from('project_phases')
    .update({ status: 'in_progress', completed_at: null })
    .eq('id', phaseId)

  if (error) return { success: false, error: error.message }

  const { data: rawAllPhases } = await supabase
    .from('project_phases')
    .select('id, status')
    .eq('project_id', phase.project_id)

  const allPhases = (rawAllPhases as Pick<ProjectPhase, 'id' | 'status'>[] | null) ?? []
  const updatedPhases = allPhases.map((p) =>
    p.id === phaseId ? { ...p, status: 'in_progress' as const } : p,
  )
  const doneCount = updatedPhases.filter(
    (p) => p.status === 'completed' || p.status === 'approved',
  ).length
  const progress = allPhases.length > 0 ? Math.round((doneCount / allPhases.length) * 100) : 0

  await db(supabase)
    .from('projects')
    .update({ progress, status: 'active' })
    .eq('id', phase.project_id)

  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: phase.project_id,
      user_id: user.id,
      action: 'status_changed',
      details: { phase_name: phase.name, message: 'Désapprouvée par admin' },
    })

  revalidatePath(`/projects/${phase.project_id}`)
  return { success: true }
}

// ─── recompute progress ───────────────────────────────────────────

async function recomputeProgress(
  supabase: AuthSupabase,
  projectId: string,
): Promise<void> {
  const { data: rawPhases } = await supabase
    .from('project_phases')
    .select('status')
    .eq('project_id', projectId)
  const all = (rawPhases as { status: PhaseStatus }[] | null) ?? []
  const done = all.filter((p) => p.status === 'completed' || p.status === 'approved').length
  const progress = all.length > 0 ? Math.round((done / all.length) * 100) : 0
  await db(supabase).from('projects').update({ progress }).eq('id', projectId)
}

// ─── addProjectPhase ──────────────────────────────────────────────
// Ajoute une étape (phase typée) en fin de pipeline d'un projet en cours.

export async function addProjectPhase(
  projectId: string,
  type: StepType,
): Promise<PhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const def = STEP_TYPES[type]
  if (!def) return { success: false, error: 'Type d’étape invalide' }

  const { data: rawMax } = await supabase
    .from('project_phases')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((rawMax as { sort_order: number } | null)?.sort_order ?? 0) + 1

  const { data: phaseRow, error: phaseErr } = await db(supabase)
    .from('project_phases')
    .insert({
      project_id: projectId,
      phase_template_id: null,
      name: def.phaseName,
      slug: def.phaseSlug,
      sort_order: nextOrder,
      status: 'pending',
    })
    .select('id')
    .single()

  if (phaseErr || !phaseRow) return { success: false, error: phaseErr?.message ?? 'Erreur création étape' }

  if (def.sub) {
    const { error: subErr } = await db(supabase).from('sub_phases').insert({
      phase_id: phaseRow.id as string,
      name: def.sub.name,
      slug: def.sub.slug,
      sort_order: 1,
      status: 'pending',
    })
    if (subErr) return { success: false, error: subErr.message }
  }

  await recomputeProgress(supabase, projectId)

  await db(supabase).from('activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action: 'status_changed',
    details: { phase_name: def.phaseName, message: 'Étape ajoutée' },
  })

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

// ─── deleteProjectPhase ───────────────────────────────────────────
// Supprime une étape (phase) et tout son contenu (cascade).

export async function deleteProjectPhase(phaseId: string): Promise<PhaseActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('id, project_id, name')
    .eq('id', phaseId)
    .maybeSingle()
  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'project_id' | 'name'> | null
  if (!phase) return { success: false, error: 'Étape introuvable' }

  // Nettoyage explicite des fichiers + commentaires de niveau phase (au cas où
  // les FK ne cascadent pas), puis suppression de la phase (cascade sous-phases
  // → blocs/scripts).
  await db(supabase).from('phase_files').delete().eq('phase_id', phaseId)
  await db(supabase).from('comments').delete().eq('phase_id', phaseId)

  const { error } = await db(supabase).from('project_phases').delete().eq('id', phaseId)
  if (error) return { success: false, error: error.message }

  await recomputeProgress(supabase, phase.project_id)

  await db(supabase).from('activity_logs').insert({
    project_id: phase.project_id,
    user_id: user.id,
    action: 'status_changed',
    details: { phase_name: phase.name, message: 'Étape supprimée' },
  })

  revalidatePath(`/projects/${phase.project_id}`)
  return { success: true }
}
