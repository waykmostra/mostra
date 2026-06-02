'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { ProjectPhase } from '@/lib/types'

export type PhaseActionResult = { success: true } | { success: false; error: string }

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
