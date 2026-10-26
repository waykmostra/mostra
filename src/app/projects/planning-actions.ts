'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/supabase/helpers'

export type PlanningResult = { success: true } | { success: false; error: string }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Dates prévues d'une étape (planning en escalier, migration 040). `null` sur
 * les deux = retirer l'étape du planning.
 */
export async function updatePhasePlanning(
  phaseId: string,
  plannedStart: string | null,
  plannedEnd: string | null,
): Promise<PlanningResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  if ((plannedStart && !DAY_RE.test(plannedStart)) || (plannedEnd && !DAY_RE.test(plannedEnd))) {
    return { success: false, error: 'Date invalide.' }
  }
  if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
    return { success: false, error: 'La fin doit suivre le début.' }
  }

  const { data, error } = await db(supabase)
    .from('project_phases')
    .update({ planned_start: plannedStart, planned_end: plannedEnd })
    .eq('id', phaseId)
    .select('project_id')
    .single()

  if (error || !data) {
    const missing = error?.message?.includes('planned_')
    return { success: false, error: missing ? 'Planning indisponible : la migration 040 n’est pas encore appliquée.' : (error?.message ?? 'Erreur') }
  }

  revalidatePath(`/projects/${(data as { project_id: string }).project_id}`)
  return { success: true }
}
