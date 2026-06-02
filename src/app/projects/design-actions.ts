'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { DesignFileContent, SubPhase, ProjectPhase } from '@/lib/types'

export type DesignActionResult = { success: true } | { success: false; error: string }
export type DesignCreateResult =
  | { success: true; files: DesignFile[] }
  | { success: false; error: string }

export interface DesignFile {
  id: string
  content: DesignFileContent
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

function revalidateDesign(projectId: string, phaseId: string, subPhaseId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/phases/${phaseId}/sub/${subPhaseId}`)
}

// ── Storage path helper ───────────────────────────────────────────

function extractStoragePath(fileUrl: string): string | null {
  if (!fileUrl) return null
  const match = fileUrl.match(/\/project-files\/(.+?)(?:\?|$)/)
  if (match) return match[1]
  return fileUrl
}

async function enrichFilesWithSignedUrls(
  admin: ReturnType<typeof createAdminClient>,
  files: DesignFile[],
): Promise<DesignFile[]> {
  return Promise.all(
    files.map(async (f) => {
      const storagePath = extractStoragePath(f.content.file_url)
      if (!storagePath) return f
      const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
      return { ...f, content: { ...f.content, file_url: data?.signedUrl ?? '' } }
    }),
  )
}

// ── getDesignFiles ────────────────────────────────────────────────

export async function getDesignFiles(subPhaseId: string): Promise<DesignFile[]> {
  const ctx = await getCreativeContext()
  if (!ctx) return []

  const admin = createAdminClient()

  const { data: rawFiles } = await admin
    .from('phase_blocks')
    .select('id, content, sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'design_file')
    .order('sort_order', { ascending: true })

  const files = (rawFiles ?? []) as DesignFile[]
  return enrichFilesWithSignedUrls(admin, files)
}

// ── uploadDesignFiles ─────────────────────────────────────────────
// Batch upload: plusieurs fichiers en une seule action.

export async function uploadDesignFiles(
  formData: FormData,
): Promise<DesignCreateResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase, user } = ctx

  const subPhaseId = formData.get('subPhaseId') as string
  const projectId = formData.get('projectId') as string
  const files = formData.getAll('files') as File[]

  if (!subPhaseId || !projectId) return { success: false, error: 'Données manquantes' }

  const validFiles = files.filter((f) => f.size > 0)
  if (validFiles.length === 0) return { success: false, error: 'Aucun fichier sélectionné' }

  // Accept images + common design formats
  const validTypes = [
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf',
    'application/postscript', // .ai
    'image/vnd.adobe.photoshop', // .psd
    'application/octet-stream', // .fig, .sketch, .xd (generic binary)
    'application/zip', // some .fig exports
  ]
  const validExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'pdf', 'psd', 'ai', 'fig', 'xd', 'sketch']

  for (const file of validFiles) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!validExtensions.includes(ext)) {
      return { success: false, error: `Format non supporté : ${file.name} — PNG, JPG, SVG, PDF, PSD, AI, Fig, XD, Sketch` }
    }
    if (file.size > 100 * 1024 * 1024)
      return { success: false, error: `Fichier trop lourd : ${file.name} (max 100 MB)` }
  }

  const admin = createAdminClient()

  // Calcul du prochain sort_order
  const { data: maxRow } = await supabase
    .from('phase_blocks')
    .select('sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'design_file')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1

  const createdFiles: DesignFile[] = []

  for (const file of validFiles) {
    const placeholder: DesignFileContent = {
      file_url: '',
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      description: '',
    }

    const { data: rawBlock, error: insertErr } = await db(admin)
      .from('phase_blocks')
      .insert({
        sub_phase_id: subPhaseId,
        phase_id: null,
        type: 'design_file',
        content: placeholder,
        sort_order: nextOrder,
        is_approved: false,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertErr || !rawBlock) continue

    const blockId = (rawBlock as { id: string }).id
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${projectId}/design/${blockId}/${safeFileName}`

    const fileBuffer = await file.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('project-files')
      .upload(storagePath, fileBuffer, { contentType: file.type || 'application/octet-stream', upsert: true })

    if (uploadErr) {
      await admin.from('phase_blocks').delete().eq('id', blockId)
      continue
    }

    const pathContent: DesignFileContent = {
      file_url: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      description: '',
    }

    await db(admin).from('phase_blocks').update({ content: pathContent }).eq('id', blockId)

    const { data: signedData } = await admin.storage
      .from('project-files')
      .createSignedUrl(storagePath, 3600)

    createdFiles.push({
      id: blockId,
      content: { ...pathContent, file_url: signedData?.signedUrl ?? '' },
      sort_order: nextOrder,
    })

    nextOrder++
  }

  const parents = await resolveParents(supabase, subPhaseId)
  if (parents) revalidateDesign(parents.phase.project_id, parents.phase.id, subPhaseId)

  return { success: true, files: createdFiles }
}

// ── updateDesignFileDescription ───────────────────────────────────

export async function updateDesignFileDescription(
  blockId: string,
  description: string,
): Promise<DesignActionResult> {
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
    content: DesignFileContent
    sub_phase_id: string | null
  } | null
  if (!block) return { success: false, error: 'Fichier introuvable' }

  const updated: DesignFileContent = { ...block.content, description }
  const { error } = await db(admin).from('phase_blocks').update({ content: updated }).eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateDesign(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}

// ── deleteDesignFile ──────────────────────────────────────────────

export async function deleteDesignFile(blockId: string): Promise<DesignActionResult> {
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
    content: DesignFileContent
    sub_phase_id: string | null
  } | null
  if (!block) return { success: false, error: 'Fichier introuvable' }

  const storagePath = extractStoragePath(block.content?.file_url ?? '')
  if (storagePath) {
    await admin.storage.from('project-files').remove([storagePath])
  }

  const { error } = await admin.from('phase_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateDesign(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}
