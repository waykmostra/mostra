'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { StoryboardShotContent, SubPhase, ProjectPhase } from '@/lib/types'

export type StoryboardActionResult = { success: true } | { success: false; error: string }
export type StoryboardCreateResult =
  | { success: true; shots: StoryboardShot[] }
  | { success: false; error: string }

export interface StoryboardShot {
  id: string
  content: StoryboardShotContent
  sort_order: number
}

// ── Auth helper ───────────────────────────────────────────────────

async function getCreativeContext() {
  const auth = await requireAdmin()
  if ('error' in auth) return null
  return { supabase: auth.supabase, user: auth.user }
}

async function resolveParents(
  supabase: ReturnType<typeof createClient>,
  subPhaseId: string,
): Promise<{
  sp: Pick<SubPhase, 'id' | 'phase_id'>
  phase: Pick<ProjectPhase, 'id' | 'project_id'>
} | null> {
  const { data: rawSp } = await supabase
    .from('sub_phases')
    .select('id, phase_id')
    .eq('id', subPhaseId)
    .maybeSingle()
  const sp = rawSp as Pick<SubPhase, 'id' | 'phase_id'> | null
  if (!sp) return null

  const { data: rawPhase } = await supabase
    .from('project_phases')
    .select('id, project_id')
    .eq('id', sp.phase_id)
    .maybeSingle()
  const phase = rawPhase as Pick<ProjectPhase, 'id' | 'project_id'> | null
  if (!phase) return null

  return { sp, phase }
}

function revalidateStoryboard(projectId: string, phaseId: string, subPhaseId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/phases/${phaseId}/sub/${subPhaseId}`)
}

// ── Storage path helper ───────────────────────────────────────────

function extractStoragePath(imageUrl: string): string | null {
  if (!imageUrl) return null
  const match = imageUrl.match(/\/project-files\/(.+?)(?:\?|$)/)
  if (match) return match[1]
  return imageUrl
}

async function enrichShotsWithSignedUrls(
  admin: ReturnType<typeof createAdminClient>,
  shots: StoryboardShot[],
): Promise<StoryboardShot[]> {
  return Promise.all(
    shots.map(async (s) => {
      const storagePath = extractStoragePath(s.content.image_url)
      if (!storagePath) return s
      const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
      return { ...s, content: { ...s.content, image_url: data?.signedUrl ?? '' } }
    }),
  )
}

// ── getStoryboardShots ────────────────────────────────────────────

export async function getStoryboardShots(subPhaseId: string): Promise<StoryboardShot[]> {
  const ctx = await getCreativeContext()
  if (!ctx) return []

  const admin = createAdminClient()

  const { data: rawShots } = await admin
    .from('phase_blocks')
    .select('id, content, sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'storyboard_shot')
    .order('sort_order', { ascending: true })

  const shots = (rawShots ?? []) as StoryboardShot[]
  return enrichShotsWithSignedUrls(admin, shots)
}

// ── createStoryboardShots ─────────────────────────────────────────
// Batch upload: plusieurs fichiers en une seule action.

export async function createStoryboardShots(
  formData: FormData,
): Promise<StoryboardCreateResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase, user } = ctx

  const subPhaseId = formData.get('subPhaseId') as string
  const projectId = formData.get('projectId') as string
  const files = formData.getAll('files') as File[]

  if (!subPhaseId || !projectId) return { success: false, error: 'Données manquantes' }

  const validFiles = files.filter((f) => f.size > 0)
  if (validFiles.length === 0) return { success: false, error: 'Aucune image sélectionnée' }

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  for (const file of validFiles) {
    if (!validTypes.includes(file.type))
      return { success: false, error: `Format invalide : ${file.name} — PNG, JPG ou WEBP uniquement` }
    if (file.size > 10 * 1024 * 1024)
      return { success: false, error: `Image trop lourde : ${file.name} (max 10 MB)` }
  }

  const admin = createAdminClient()

  // Calcul du prochain sort_order
  const { data: maxRow } = await supabase
    .from('phase_blocks')
    .select('sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'storyboard_shot')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1

  const createdShots: StoryboardShot[] = []

  for (const file of validFiles) {
    const placeholder: StoryboardShotContent = {
      shot_number: nextOrder,
      image_url: '',
      description: '',
    }

    const { data: rawBlock, error: insertErr } = await db(admin)
      .from('phase_blocks')
      .insert({
        sub_phase_id: subPhaseId,
        phase_id: null,
        type: 'storyboard_shot',
        content: placeholder,
        sort_order: nextOrder,
        is_approved: false,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertErr || !rawBlock) continue

    const blockId = (rawBlock as { id: string }).id
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `${projectId}/storyboard/${blockId}/image.${ext}`

    const fileBuffer = await file.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('project-files')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: true })

    if (uploadErr) {
      await admin.from('phase_blocks').delete().eq('id', blockId)
      continue
    }

    const pathContent: StoryboardShotContent = {
      shot_number: nextOrder,
      image_url: storagePath,
      description: '',
    }

    await db(admin).from('phase_blocks').update({ content: pathContent }).eq('id', blockId)

    const { data: signedData } = await admin.storage
      .from('project-files')
      .createSignedUrl(storagePath, 3600)

    createdShots.push({
      id: blockId,
      content: { ...pathContent, image_url: signedData?.signedUrl ?? '' },
      sort_order: nextOrder,
    })

    nextOrder++
  }

  const parents = await resolveParents(supabase, subPhaseId)
  if (parents) revalidateStoryboard(parents.phase.project_id, parents.phase.id, subPhaseId)

  return { success: true, shots: createdShots }
}

// ── updateStoryboardShot ──────────────────────────────────────────

export async function updateStoryboardShot(
  blockId: string,
  patch: Partial<Pick<StoryboardShotContent, 'description'>>,
): Promise<StoryboardActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  const block = rawBlock as {
    id: string
    content: StoryboardShotContent
    sub_phase_id: string | null
  } | null
  if (!block) return { success: false, error: 'Shot introuvable' }

  const updated: StoryboardShotContent = { ...block.content, ...patch }
  const { error } = await db(admin).from('phase_blocks').update({ content: updated }).eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateStoryboard(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}

// ── deleteStoryboardShot ──────────────────────────────────────────

export async function deleteStoryboardShot(blockId: string): Promise<StoryboardActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  const block = rawBlock as {
    id: string
    content: StoryboardShotContent
    sub_phase_id: string | null
  } | null
  if (!block) return { success: false, error: 'Shot introuvable' }

  const storagePath = extractStoragePath(block.content?.image_url ?? '')
  if (storagePath) {
    await admin.storage.from('project-files').remove([storagePath])
  }

  const { error } = await admin.from('phase_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateStoryboard(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}

// ── reorderStoryboardShots ────────────────────────────────────────

export async function reorderStoryboardShots(
  subPhaseId: string,
  orderedIds: string[],
): Promise<StoryboardActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  // Fetch all blocks content in one query
  const { data: rawBlocks } = await admin
    .from('phase_blocks')
    .select('id, content')
    .in('id', orderedIds)

  const blockMap = new Map(
    ((rawBlocks ?? []) as { id: string; content: StoryboardShotContent }[]).map((b) => [b.id, b]),
  )

  for (let i = 0; i < orderedIds.length; i++) {
    const blockId = orderedIds[i]
    const block = blockMap.get(blockId)
    if (!block) continue

    await db(admin)
      .from('phase_blocks')
      .update({
        sort_order: i + 1,
        content: { ...block.content, shot_number: i + 1 },
      })
      .eq('id', blockId)
  }

  const parents = await resolveParents(ctx.supabase, subPhaseId)
  if (parents) revalidateStoryboard(parents.phase.project_id, parents.phase.id, subPhaseId)

  return { success: true }
}
