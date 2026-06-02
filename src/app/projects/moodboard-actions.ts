'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { MoodboardImageContent, SubPhase, ProjectPhase } from '@/lib/types'

export type MoodboardActionResult = { success: true } | { success: false; error: string }
export type MoodboardCreateResult =
  | { success: true; block: MoodboardBlock }
  | { success: false; error: string }

export interface MoodboardBlock {
  id: string
  content: MoodboardImageContent
  sort_order: number
}

// ── Auth helpers ──────────────────────────────────────────────────

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

function revalidateMoodboard(projectId: string, phaseId: string, subPhaseId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/phases/${phaseId}/sub/${subPhaseId}`)
}

// ── Signed URL helper ─────────────────────────────────────────────
// Le bucket "project-files" est privé — on génère des signed URLs (1h)
// au moment de la lecture. On stocke le chemin Storage dans image_url.
// Anciens blocs : image_url peut être une URL publique complète (https://…/project-files/…)
// Nouveaux blocs : image_url est déjà un chemin relatif (projectId/style/…)

function extractStoragePath(imageUrl: string): string | null {
  if (!imageUrl) return null
  const match = imageUrl.match(/\/project-files\/(.+?)(?:\?|$)/)
  if (match) return match[1]
  return imageUrl // déjà un chemin relatif
}

async function enrichWithSignedUrls(
  admin: ReturnType<typeof createAdminClient>,
  blocks: MoodboardBlock[],
): Promise<MoodboardBlock[]> {
  return Promise.all(
    blocks.map(async (b) => {
      const storagePath = extractStoragePath(b.content.image_url)
      if (!storagePath) return b
      const { data } = await admin.storage
        .from('project-files')
        .createSignedUrl(storagePath, 3600)
      return {
        ...b,
        content: { ...b.content, image_url: data?.signedUrl ?? '' },
      }
    }),
  )
}

// ── getMoodboardBlocks ────────────────────────────────────────────

export async function getMoodboardBlocks(subPhaseId: string): Promise<MoodboardBlock[]> {
  const ctx = await getCreativeContext()
  if (!ctx) return []

  const admin = createAdminClient()

  const { data: rawBlocks } = await admin
    .from('phase_blocks')
    .select('id, content, sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'moodboard_image')
    .order('sort_order', { ascending: true })

  const blocks = (rawBlocks ?? []) as MoodboardBlock[]
  return enrichWithSignedUrls(admin, blocks)
}

// ── createMoodboardBlock ──────────────────────────────────────────

export async function createMoodboardBlock(
  formData: FormData,
): Promise<MoodboardCreateResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase, user } = ctx

  const subPhaseId = formData.get('subPhaseId') as string
  const projectId = formData.get('projectId') as string
  const title = ((formData.get('title') as string | null) ?? '').trim() || 'Sans titre'
  const description = ((formData.get('description') as string | null) ?? '').trim()
  const file = formData.get('file') as File | null

  if (!subPhaseId || !projectId) return { success: false, error: 'Données manquantes' }
  if (!file || file.size === 0) return { success: false, error: 'Image requise' }

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Format invalide — PNG, JPG ou WEBP uniquement' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Image trop lourde — maximum 10 MB' }
  }

  const admin = createAdminClient()

  // Next sort_order
  const { data: maxRow } = await supabase
    .from('phase_blocks')
    .select('sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'moodboard_image')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1

  // Insert placeholder to get ID
  const placeholder: MoodboardImageContent = {
    title,
    image_url: '',
    description,
    is_selected: false,
  }

  const { data: rawBlock, error: insertErr } = await db(admin)
    .from('phase_blocks')
    .insert({
      sub_phase_id: subPhaseId,
      phase_id: null,
      type: 'moodboard_image',
      content: placeholder,
      sort_order: nextOrder,
      is_approved: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertErr || !rawBlock) {
    return { success: false, error: insertErr?.message ?? 'Erreur création bloc' }
  }

  const blockId = (rawBlock as { id: string }).id
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${projectId}/style/${blockId}/image.${ext}`

  // Upload
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from('project-files')
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: true })

  if (uploadErr) {
    await admin.from('phase_blocks').delete().eq('id', blockId)
    return { success: false, error: `Upload échoué : ${uploadErr.message}` }
  }

  // Store the storage PATH (not a public URL) — bucket is private
  const pathContent: MoodboardImageContent = {
    title,
    image_url: storagePath,
    description,
    is_selected: false,
  }

  await db(admin)
    .from('phase_blocks')
    .update({ content: pathContent })
    .eq('id', blockId)

  // Generate signed URL for the returned block (so UI can display immediately)
  const { data: signedData } = await admin.storage
    .from('project-files')
    .createSignedUrl(storagePath, 3600)

  const displayContent: MoodboardImageContent = {
    ...pathContent,
    image_url: signedData?.signedUrl ?? '',
  }

  const parents = await resolveParents(supabase, subPhaseId)
  if (parents) revalidateMoodboard(parents.phase.project_id, parents.phase.id, subPhaseId)

  return { success: true, block: { id: blockId, content: displayContent, sort_order: nextOrder } }
}

// ── updateMoodboardBlock ──────────────────────────────────────────

export async function updateMoodboardBlock(
  blockId: string,
  patch: Partial<Pick<MoodboardImageContent, 'title' | 'description' | 'is_selected'>>,
): Promise<MoodboardActionResult> {
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
    content: MoodboardImageContent
    sub_phase_id: string | null
  } | null
  if (!block) return { success: false, error: 'Bloc introuvable' }

  const updated: MoodboardImageContent = { ...block.content, ...patch }
  const { error } = await db(admin).from('phase_blocks').update({ content: updated }).eq('id', blockId)

  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateMoodboard(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}

// ── deleteMoodboardBlock ──────────────────────────────────────────

export async function deleteMoodboardBlock(blockId: string): Promise<MoodboardActionResult> {
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
    content: MoodboardImageContent
    sub_phase_id: string | null
  } | null
  if (!block) return { success: false, error: 'Bloc introuvable' }

  // Remove image from Storage — handle both relative paths and legacy full URLs
  const storagePath = extractStoragePath(block.content?.image_url ?? '')
  if (storagePath) {
    await admin.storage.from('project-files').remove([storagePath])
  }

  const { error } = await admin.from('phase_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateMoodboard(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}
