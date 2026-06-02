'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { ObjectiveMetric } from '@/lib/types'

// ============================================================================
// Objectifs (migration 022). metric = 'manual' (valeur saisie) ou liée aux
// données (revenue_month / new_leads_month / calls_booked, calculées à la
// lecture côté serveur).
// ============================================================================

export type ObjectiveResult = { success: true } | { success: false; error: string }

const METRICS: ObjectiveMetric[] = ['manual', 'revenue_month', 'new_leads_month', 'calls_booked']

function revalidate() {
  revalidatePath('/founder/objectifs')
  revalidatePath('/founder')
}

// ── createObjective ──────────────────────────────────────────────

export interface CreateObjectiveInput {
  label: string
  metric: ObjectiveMetric
  targetValue: number
  manualValue?: number
  deadline?: string | null
  isPriority?: boolean
}

export async function createObjective(input: CreateObjectiveInput): Promise<ObjectiveResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const label = input.label.trim()
  if (!label) return { success: false, error: 'Le libellé est requis.' }
  if (!METRICS.includes(input.metric)) return { success: false, error: 'Métrique invalide.' }
  if (!(input.targetValue >= 0)) return { success: false, error: 'Cible invalide.' }

  const { error } = await db(admin)
    .from('objectives')
    .insert({
      label,
      metric: input.metric,
      target_value: input.targetValue,
      manual_value: input.metric === 'manual' ? (input.manualValue ?? 0) : 0,
      deadline: input.deadline || null,
      is_priority: input.isPriority ?? false,
    })

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── updateObjective ──────────────────────────────────────────────

export interface UpdateObjectiveInput {
  label?: string
  targetValue?: number
  manualValue?: number
  deadline?: string | null
}

export async function updateObjective(
  id: string,
  input: UpdateObjectiveInput,
): Promise<ObjectiveResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const patch: Record<string, unknown> = {}
  if (input.label !== undefined) {
    const label = input.label.trim()
    if (!label) return { success: false, error: 'Le libellé ne peut pas être vide.' }
    patch.label = label
  }
  if (input.targetValue !== undefined) {
    if (!(input.targetValue >= 0)) return { success: false, error: 'Cible invalide.' }
    patch.target_value = input.targetValue
  }
  if (input.manualValue !== undefined) {
    if (!(input.manualValue >= 0)) return { success: false, error: 'Valeur invalide.' }
    patch.manual_value = input.manualValue
  }
  if (input.deadline !== undefined) patch.deadline = input.deadline || null

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db(admin).from('objectives').update(patch).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── togglePriority ───────────────────────────────────────────────

export async function togglePriority(id: string, isPriority: boolean): Promise<ObjectiveResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin)
    .from('objectives')
    .update({ is_priority: isPriority })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── deleteObjective ──────────────────────────────────────────────

export async function deleteObjective(id: string): Promise<ObjectiveResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('objectives').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}
