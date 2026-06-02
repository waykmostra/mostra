'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { AudioTrackContent, SubPhase, ProjectPhase } from '@/lib/types'

export type AudioActionResult = { success: true } | { success: false; error: string }
export type AudioCreateResult =
  | { success: true; track: AudioTrack }
  | { success: false; error: string }

export type AudioUploadUrlResult =
  | { success: true; uploadUrl: string; storagePath: string; blockId: string }
  | { success: false; error: string }

export type AudioRecordResult =
  | { success: true; track: AudioTrack }
  | { success: false; error: string }

export interface AudioTrack {
  id: string
  content: AudioTrackContent
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

function revalidateAudio(projectId: string, phaseId: string, subPhaseId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/phases/${phaseId}/sub/${subPhaseId}`)
}

function extractStoragePath(audioUrl: string): string | null {
  if (!audioUrl) return null
  const match = audioUrl.match(/\/project-files\/(.+?)(?:\?|$)/)
  if (match) return match[1]
  return audioUrl
}

async function enrichTracksWithSignedUrls(
  admin: ReturnType<typeof createAdminClient>,
  tracks: AudioTrack[],
): Promise<AudioTrack[]> {
  return Promise.all(
    tracks.map(async (t) => {
      const storagePath = extractStoragePath(t.content.audio_url)
      if (!storagePath) return t
      const { data } = await admin.storage.from('project-files').createSignedUrl(storagePath, 3600)
      return { ...t, content: { ...t.content, audio_url: data?.signedUrl ?? '' } }
    }),
  )
}

// ── getAudioTracks ────────────────────────────────────────────────

export async function getAudioTracks(subPhaseId: string): Promise<AudioTrack[]> {
  const ctx = await getCreativeContext()
  if (!ctx) return []

  const admin = createAdminClient()

  const { data: rawTracks } = await admin
    .from('phase_blocks')
    .select('id, content, sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'audio_track')
    .order('sort_order', { ascending: true })

  const tracks = (rawTracks ?? []) as AudioTrack[]
  return enrichTracksWithSignedUrls(admin, tracks)
}

// ── createAudioUploadUrl ──────────────────────────────────────────
// Étape 1 du flow client-direct : valide le fichier, crée le bloc
// placeholder et génère une signed upload URL pour que le navigateur
// puisse uploader directement vers Supabase (bypass limite Vercel 4.5 MB).

export async function createAudioUploadUrl(input: {
  subPhaseId: string
  projectId: string
  title: string
  description: string
  kind: 'vo' | 'music'
  fileName: string
  fileSize: number
  mimeType: string
}): Promise<AudioUploadUrlResult> {
  try {
    const ctx = await getCreativeContext()
    if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
    const { supabase, user } = ctx

    const { subPhaseId, projectId, title, description, kind, fileName, fileSize, mimeType } = input

    if (!subPhaseId || !projectId) return { success: false, error: 'Données manquantes' }
    if (!title.trim()) return { success: false, error: 'Le titre est requis' }
    if (!fileName) return { success: false, error: 'Nom de fichier manquant' }

    const AUDIO_MIME: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
    }

    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    const canonicalMime = AUDIO_MIME[ext] ?? mimeType
    if (!canonicalMime || !canonicalMime.startsWith('audio/')) {
      return { success: false, error: `Format non supporté : .${ext} — MP3, WAV, OGG, M4A, AAC uniquement` }
    }
    if (fileSize > 50 * 1024 * 1024) {
      return { success: false, error: `Fichier trop lourd (max 50 MB)` }
    }

    const admin = createAdminClient()

    // Calcul du prochain sort_order
    const { data: maxRow } = await supabase
      .from('phase_blocks')
      .select('sort_order')
      .eq('sub_phase_id', subPhaseId)
      .eq('type', 'audio_track')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1

    // Bloc placeholder (audio_url vide — sera rempli dans recordAudioUpload)
    const placeholder: AudioTrackContent = {
      title: title.trim(),
      audio_url: '',
      description: description.trim(),
      kind,
      is_selected: false,
    }

    const { data: rawBlock, error: insertErr } = await db(admin)
      .from('phase_blocks')
      .insert({
        sub_phase_id: subPhaseId,
        phase_id: null,
        type: 'audio_track',
        content: placeholder,
        sort_order: nextOrder,
        is_approved: false,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertErr || !rawBlock) return { success: false, error: 'Erreur création du bloc' }

    const blockId = (rawBlock as { id: string }).id
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${projectId}/audio/${blockId}/${safeFileName}`

    // Signed upload URL — le fichier ira directement du navigateur à Supabase
    const { data: signedData, error: signErr } = await admin.storage
      .from('project-files')
      .createSignedUploadUrl(storagePath)

    if (signErr || !signedData?.signedUrl) {
      // Nettoyer le bloc créé si l'URL échoue
      await admin.from('phase_blocks').delete().eq('id', blockId)
      return { success: false, error: `Impossible de créer l'URL d'upload : ${signErr?.message ?? 'erreur inconnue'}` }
    }

    return {
      success: true,
      uploadUrl: signedData.signedUrl,
      storagePath,
      blockId,
    }
  } catch (err) {
    console.error('[createAudioUploadUrl]', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inattendue' }
  }
}

// ── recordAudioUpload ─────────────────────────────────────────────
// Étape 3 du flow client-direct : après l'upload navigateur→Supabase,
// met à jour le bloc avec le storage path et retourne la piste avec URL signée.

export async function recordAudioUpload(input: {
  blockId: string
  subPhaseId: string
  storagePath: string
  canonicalMime: string
}): Promise<AudioRecordResult> {
  try {
    const ctx = await getCreativeContext()
    if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

    const { blockId, subPhaseId, storagePath, canonicalMime } = input

    const admin = createAdminClient()

    // Récupérer le bloc pour lire le contenu existant
    const { data: rawBlock } = await admin
      .from('phase_blocks')
      .select('id, content, sort_order')
      .eq('id', blockId)
      .maybeSingle()

    if (!rawBlock) return { success: false, error: 'Bloc introuvable' }

    const block = rawBlock as { id: string; content: AudioTrackContent; sort_order: number }
    const updatedContent: AudioTrackContent = { ...block.content, audio_url: storagePath }

    const { error: updateErr } = await db(admin)
      .from('phase_blocks')
      .update({ content: updatedContent })
      .eq('id', blockId)

    if (updateErr) return { success: false, error: `Erreur mise à jour : ${updateErr.message}` }

    // URL signée pour lecture immédiate
    const { data: signedData } = await admin.storage
      .from('project-files')
      .createSignedUrl(storagePath, 3600)

    // Revalider les chemins
    const parents = await resolveParents(ctx.supabase, subPhaseId)
    if (parents) revalidateAudio(parents.phase.project_id, parents.phase.id, subPhaseId)

    return {
      success: true,
      track: {
        id: blockId,
        content: { ...updatedContent, audio_url: signedData?.signedUrl ?? '' },
        sort_order: block.sort_order,
      },
    }
  } catch (err) {
    console.error('[recordAudioUpload]', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erreur inattendue' }
  }
}

// ── createAudioTrack (legacy — non utilisé sur Vercel >4.5 MB) ────

export async function createAudioTrack(
  formData: FormData,
): Promise<AudioCreateResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase, user } = ctx

  const subPhaseId = formData.get('subPhaseId') as string
  const projectId = formData.get('projectId') as string
  const title = (formData.get('title') as string)?.trim() || ''
  const description = (formData.get('description') as string)?.trim() || ''
  const kind = (formData.get('kind') as 'vo' | 'music') || 'vo'
  const file = formData.get('file') as File

  if (!subPhaseId || !projectId) return { success: false, error: 'Données manquantes' }
  if (!file || file.size === 0) return { success: false, error: 'Aucun fichier sélectionné' }
  if (!title) return { success: false, error: 'Le titre est requis' }

  // Extension → canonical MIME type (never rely on file.type from the browser,
  // which can vary: audio/mpeg, audio/mp3, audio/x-mpeg, etc.)
  const AUDIO_MIME: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
  }

  // Also accept known browser-reported MIME aliases so the guard below doesn't false-positive
  const VALID_MIMES = new Set([
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'audio/aac', 'audio/x-aac',
    '',           // file.type is sometimes empty — fall through to ext check
  ])

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const canonicalMime = AUDIO_MIME[ext]

  if (!canonicalMime) {
    return { success: false, error: `Format non supporté : ${file.name} — MP3, WAV, OGG, M4A, AAC uniquement` }
  }
  if (file.type && !VALID_MIMES.has(file.type)) {
    return { success: false, error: `Type MIME non supporté : ${file.type}` }
  }
  if (file.size > 50 * 1024 * 1024) {
    return { success: false, error: `Fichier trop lourd : ${file.name} (max 50 MB)` }
  }

  const admin = createAdminClient()

  // Calcul du prochain sort_order
  const { data: maxRow } = await supabase
    .from('phase_blocks')
    .select('sort_order')
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'audio_track')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1

  // Placeholder block
  const placeholder: AudioTrackContent = {
    title,
    audio_url: '',
    description,
    kind,
    is_selected: false,
  }

  const { data: rawBlock, error: insertErr } = await db(admin)
    .from('phase_blocks')
    .insert({
      sub_phase_id: subPhaseId,
      phase_id: null,
      type: 'audio_track',
      content: placeholder,
      sort_order: nextOrder,
      is_approved: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertErr || !rawBlock) return { success: false, error: 'Erreur création du bloc' }

  const blockId = (rawBlock as { id: string }).id
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${projectId}/audio/${blockId}/${safeFileName}`

  const fileBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from('project-files')
    .upload(storagePath, fileBuffer, {
      contentType: canonicalMime,   // derived from extension, not file.type
      upsert: true,
    })

  if (uploadErr) {
    await admin.from('phase_blocks').delete().eq('id', blockId)
    return { success: false, error: `Erreur upload : ${uploadErr.message}` }
  }

  const pathContent: AudioTrackContent = {
    title,
    audio_url: storagePath,
    description,
    kind,
    is_selected: false,
  }

  await db(admin).from('phase_blocks').update({ content: pathContent }).eq('id', blockId)

  const { data: signedData } = await admin.storage
    .from('project-files')
    .createSignedUrl(storagePath, 3600)

  const parents = await resolveParents(supabase, subPhaseId)
  if (parents) revalidateAudio(parents.phase.project_id, parents.phase.id, subPhaseId)

  return {
    success: true,
    track: {
      id: blockId,
      content: { ...pathContent, audio_url: signedData?.signedUrl ?? '' },
      sort_order: nextOrder,
    },
  }
}

// ── updateAudioTrack ──────────────────────────────────────────────

export async function updateAudioTrack(
  blockId: string,
  patch: Partial<Pick<AudioTrackContent, 'title' | 'description'>>,
): Promise<AudioActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  const block = rawBlock as { id: string; content: AudioTrackContent; sub_phase_id: string | null } | null
  if (!block) return { success: false, error: 'Piste introuvable' }

  const updated: AudioTrackContent = { ...block.content, ...patch }
  const { error } = await db(admin).from('phase_blocks').update({ content: updated }).eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateAudio(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}

// ── deleteAudioTrack ──────────────────────────────────────────────

export async function deleteAudioTrack(blockId: string): Promise<AudioActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }

  const admin = createAdminClient()

  const { data: rawBlock } = await admin
    .from('phase_blocks')
    .select('id, content, sub_phase_id')
    .eq('id', blockId)
    .maybeSingle()

  const block = rawBlock as { id: string; content: AudioTrackContent; sub_phase_id: string | null } | null
  if (!block) return { success: false, error: 'Piste introuvable' }

  const storagePath = extractStoragePath(block.content?.audio_url ?? '')
  if (storagePath) {
    await admin.storage.from('project-files').remove([storagePath])
  }

  const { error } = await admin.from('phase_blocks').delete().eq('id', blockId)
  if (error) return { success: false, error: error.message }

  if (block.sub_phase_id) {
    const parents = await resolveParents(ctx.supabase, block.sub_phase_id)
    if (parents) revalidateAudio(parents.phase.project_id, parents.phase.id, block.sub_phase_id)
  }

  return { success: true }
}
