'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { createNotifications, getProjectRecipients } from '@/lib/notifications'
import type { FormQuestionContent, SubPhase, ProjectPhase } from '@/lib/types'

export type FormActionResult = { success: true } | { success: false; error: string }

// ── Admin auth ────────────────────────────────────────────────────

async function getAdminContext() {
  const auth = await requireAdmin()
  if ('error' in auth) return null
  return { supabase: auth.supabase, user: auth.user }
}

// ── Token auth ────────────────────────────────────────────────────

async function resolveToken(token: string): Promise<{ id: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projects')
    .select('id')
    .eq('share_token', token)
    .maybeSingle()
  return data as { id: string } | null
}

// ── Sub-phase nav helpers ─────────────────────────────────────────

async function getSubPhaseParents(
  client: ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>,
  subPhaseId: string,
) {
  const { data: rawSp } = await client
    .from('sub_phases')
    .select('id, phase_id, status')
    .eq('id', subPhaseId)
    .maybeSingle()
  const sp = rawSp as Pick<SubPhase, 'id' | 'phase_id' | 'status'> | null
  if (!sp) return null

  const { data: rawPhase } = await client
    .from('project_phases')
    .select('id, project_id')
    .eq('id', sp.phase_id)
    .maybeSingle()
  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'project_id'> | null
  if (!phase) return null

  return { sp, phase }
}

// ── applyFormTemplate ─────────────────────────────────────────────

export async function applyFormTemplate(
  subPhaseId: string,
  templateId: string,
): Promise<FormActionResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  // Fetch template (global)
  const { data: rawTpl } = await supabase
    .from('form_templates')
    .select('questions')
    .eq('id', templateId)
    .maybeSingle()

  if (!rawTpl) return { success: false, error: 'Template introuvable' }
  const questions = (rawTpl as { questions: FormQuestionContent[] }).questions

  // Delete existing form_question blocks for this sub-phase
  await db(supabase)
    .from('phase_blocks')
    .delete()
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'form_question')

  // Insert one block per question
  const blocks = questions.map((q, i) => ({
    sub_phase_id: subPhaseId,
    phase_id: null,
    type: 'form_question',
    content: { ...q, answer: null } as FormQuestionContent,
    sort_order: i + 1,
    is_approved: false,
    created_by: null,
  }))

  const { error } = await db(supabase).from('phase_blocks').insert(blocks)
  if (error) return { success: false, error: error.message }

  const parents = await getSubPhaseParents(supabase, subPhaseId)
  if (parents) {
    revalidatePath(`/projects/${parents.phase.project_id}`)
    revalidatePath(
      `/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${subPhaseId}`,
    )
  }

  return { success: true }
}

// ── resetForm ─────────────────────────────────────────────────────

export async function resetForm(subPhaseId: string): Promise<FormActionResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  // Delete blocks
  const { error } = await db(supabase)
    .from('phase_blocks')
    .delete()
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'form_question')

  if (error) return { success: false, error: error.message }

  // Reset status to pending if still pending/in_progress
  await db(supabase)
    .from('sub_phases')
    .update({ status: 'pending', started_at: null })
    .eq('id', subPhaseId)
    .in('status', ['pending', 'in_progress'])

  const parents = await getSubPhaseParents(supabase, subPhaseId)
  if (parents) {
    revalidatePath(`/projects/${parents.phase.project_id}`)
    revalidatePath(
      `/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${subPhaseId}`,
    )
  }

  return { success: true }
}

// ── saveDraftAnswer ───────────────────────────────────────────────
// Public — called by the client (auto-save per field, no status change)

export async function saveDraftAnswer(
  token: string,
  blockId: string,
  answer: string,
): Promise<FormActionResult> {
  const project = await resolveToken(token)
  if (!project) return { success: false, error: 'Token invalide' }

  const admin = createAdminClient()

  // Fetch block + verify it belongs to this project
  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  if (!rawBlock) return { success: false, error: 'Bloc introuvable' }
  const block = rawBlock as {
    id: string
    content: FormQuestionContent
    sub_phase_id: string | null
  }

  if (!block.sub_phase_id) return { success: false, error: 'Bloc invalide' }

  const parents = await getSubPhaseParents(admin, block.sub_phase_id)
  if (!parents || parents.phase.project_id !== project.id) {
    return { success: false, error: 'Accès refusé' }
  }

  // Merge answer into content
  const newContent = { ...(block.content as unknown as Record<string, unknown>), answer }
  const { error } = await db(admin).from('phase_blocks').update({ content: newContent }).eq('id', blockId)
  if (error) return { success: false, error: error.message }

  return { success: true }
}

// ── submitFormAnswers ─────────────────────────────────────────────
// Public — client submits the completed form → status in_review

export async function submitFormAnswers(
  token: string,
  subPhaseId: string,
  answers: Record<string, string>,
): Promise<FormActionResult> {
  const project = await resolveToken(token)
  if (!project) return { success: false, error: 'Token invalide' }

  const admin = createAdminClient()
  const parents = await getSubPhaseParents(admin, subPhaseId)

  if (!parents) return { success: false, error: 'Sous-phase introuvable' }
  if (parents.phase.project_id !== project.id) return { success: false, error: 'Accès refusé' }
  if (parents.sp.status !== 'in_progress') {
    return { success: false, error: 'Formulaire non disponible' }
  }

  // Update every block's answer
  const { data: rawBlocks } = await admin
    .from('phase_blocks')
    .select('id, content')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'form_question')
    .order('sort_order', { ascending: true })

  const blocks = (rawBlocks as { id: string; content: FormQuestionContent }[] | null) ?? []

  for (const block of blocks) {
    const answer = answers[block.id] ?? ''
    const newContent = { ...(block.content as unknown as Record<string, unknown>), answer }
    await db(admin).from('phase_blocks').update({ content: newContent }).eq('id', block.id)
  }

  // Move sub-phase to in_review
  await db(admin).from('sub_phases').update({ status: 'in_review' }).eq('id', subPhaseId)

  revalidatePath(`/client/${token}`)
  revalidatePath(
    `/client/${token}/phases/${parents.sp.phase_id}/sub/${subPhaseId}`,
  )
  revalidatePath(`/projects/${project.id}`)
  revalidatePath(
    `/projects/${project.id}/phases/${parents.sp.phase_id}/sub/${subPhaseId}`,
  )

  // ── Notify admins that client submitted the form ──────────────────
  void (async () => {
    const r = await getProjectRecipients(project.id)
    if (!r.projectName) return

    const adminLink = `/projects/${project.id}/phases/${parents.sp.phase_id}/sub/${subPhaseId}`

    await createNotifications(
      r.adminIds.map((userId) => ({
        userId,
        projectId: project.id,
        type: 'form_submitted' as const,
        title: `📋 Formulaire soumis — ${r.projectName}`,
        message: 'Le client a rempli et soumis le formulaire.',
        link: adminLink,
      })),
    )
  })()

  return { success: true }
}

// ── saveAdminAnswer ───────────────────────────────────────────────
// Admin/créatif remplit une réponse au nom du client.

export async function saveAdminAnswer(
  blockId: string,
  answer: string,
): Promise<FormActionResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  if (!rawBlock) return { success: false, error: 'Bloc introuvable' }
  const block = rawBlock as { id: string; content: FormQuestionContent; sub_phase_id: string | null }

  const newContent = { ...(block.content as unknown as Record<string, unknown>), answer }
  const { error } = await db(admin).from('phase_blocks').update({ content: newContent }).eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await getSubPhaseParents(admin, block.sub_phase_id)
    if (parents) {
      revalidatePath(`/projects/${parents.phase.project_id}`)
      revalidatePath(`/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${block.sub_phase_id}`)
    }
  }

  return { success: true }
}

// ── addFormQuestion ───────────────────────────────────────────────

export async function addFormQuestion(
  subPhaseId: string,
  question: Pick<FormQuestionContent, 'label' | 'type' | 'helpText' | 'required'>,
): Promise<FormActionResult & { blockId?: string }> {
  const ctx = await getAdminContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: maxRow } = await admin
    .from('phase_blocks')
    .select('sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'form_question')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1

  const content: FormQuestionContent = {
    label: question.label,
    type: question.type,
    helpText: question.helpText ?? '',
    required: question.required ?? false,
    answer: null,
  }

  const { data: rawBlock, error } = await db(admin)
    .from('phase_blocks')
    .insert({
      sub_phase_id: subPhaseId,
      phase_id: null,
      type: 'form_question',
      content,
      sort_order: nextOrder,
      is_approved: false,
      created_by: null,
    })
    .select('id')
    .single()

  if (error || !rawBlock) return { success: false, error: error?.message ?? 'Erreur création' }

  const blockId = (rawBlock as { id: string }).id

  const parents = await getSubPhaseParents(admin, subPhaseId)
  if (parents) {
    revalidatePath(`/projects/${parents.phase.project_id}`)
    revalidatePath(`/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${subPhaseId}`)
  }

  return { success: true, blockId }
}

// ── updateFormQuestion ────────────────────────────────────────────

export async function updateFormQuestion(
  blockId: string,
  patch: Partial<Pick<FormQuestionContent, 'label' | 'type' | 'helpText' | 'required'>>,
): Promise<FormActionResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  if (!rawBlock) return { success: false, error: 'Bloc introuvable' }
  const block = rawBlock as { id: string; content: FormQuestionContent; sub_phase_id: string | null }

  const newContent: FormQuestionContent = { ...block.content, ...patch }
  const { error } = await db(admin).from('phase_blocks').update({ content: newContent }).eq('id', blockId)
  if (error) return { success: false, error: error.message }

  return { success: true }
}

// ── deleteFormQuestion ────────────────────────────────────────────

export async function deleteFormQuestion(blockId: string): Promise<FormActionResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  if (!rawBlock) return { success: false, error: 'Bloc introuvable' }
  const block = rawBlock as { id: string; sub_phase_id: string | null }

  const { error } = await admin.from('phase_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await getSubPhaseParents(admin, block.sub_phase_id)
    if (parents) {
      revalidatePath(`/projects/${parents.phase.project_id}`)
      revalidatePath(`/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${block.sub_phase_id}`)
    }
  }

  return { success: true }
}
