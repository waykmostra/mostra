'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { todayISO } from '@/lib/supabase/founder'

// ============================================================================
// Daily Workflow — checklist quotidienne (migration 022).
// Présence d'une ligne dans daily_workflow_log = tâche cochée ce jour-là.
// "Reset à minuit" = on ne lit que les lignes de la date courante.
// ============================================================================

export type WorkflowResult = { success: true } | { success: false; error: string }

function revalidate() {
  revalidatePath('/founder/workflow')
  revalidatePath('/founder')
}

// ── toggleTask ───────────────────────────────────────────────────
// done=true → insère la ligne du jour ; done=false → la supprime.

export async function toggleTask(taskId: string, done: boolean): Promise<WorkflowResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const today = todayISO()

  if (done) {
    const { error } = await db(admin)
      .from('daily_workflow_log')
      .upsert({ task_id: taskId, done_on: today }, { onConflict: 'task_id,done_on' })
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await db(admin)
      .from('daily_workflow_log')
      .delete()
      .eq('task_id', taskId)
      .eq('done_on', today)
    if (error) return { success: false, error: error.message }
  }

  revalidate()
  return { success: true }
}

// ── addTask ──────────────────────────────────────────────────────

export async function addTask(label: string): Promise<WorkflowResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = label.trim()
  if (!clean) return { success: false, error: 'Le libellé est requis.' }

  // Prochain sort_order = max + 1.
  const { data: rawMax } = await admin
    .from('daily_workflow_tasks')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((rawMax as { sort_order: number } | null)?.sort_order ?? 0) + 1

  const { error } = await db(admin)
    .from('daily_workflow_tasks')
    .insert({ label: clean, sort_order: nextOrder })

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── updateTaskLabel ──────────────────────────────────────────────

export async function updateTaskLabel(taskId: string, label: string): Promise<WorkflowResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = label.trim()
  if (!clean) return { success: false, error: 'Le libellé est requis.' }

  const { error } = await db(admin)
    .from('daily_workflow_tasks')
    .update({ label: clean })
    .eq('id', taskId)

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── setTaskActive ────────────────────────────────────────────────

export async function setTaskActive(taskId: string, active: boolean): Promise<WorkflowResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin)
    .from('daily_workflow_tasks')
    .update({ active })
    .eq('id', taskId)

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── deleteTask ───────────────────────────────────────────────────

export async function deleteTask(taskId: string): Promise<WorkflowResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Les logs cascadent (FK ON DELETE CASCADE).
  const { error } = await db(admin).from('daily_workflow_tasks').delete().eq('id', taskId)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}
