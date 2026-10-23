'use server'

import { revalidatePath } from 'next/cache'
import type { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin, requireProjectAccess } from '@/lib/auth'
import type { PhaseFile } from '@/lib/types'

// ─── Upload d'un fichier d'étape ──────────────────────────────────
// Flux direct navigateur → Supabase (voir src/lib/uploadDirect.ts) : le
// fichier ne transite jamais par une Server Action, limitée à 4,5 Mo sur Vercel.

export type UploadFileResult =
  | { success: true; file: PhaseFile }
  | { success: false; error: string }

const MAX_PHASE_FILE_BYTES = 500 * 1024 * 1024

/** Vérifie que l'étape appartient au projet. */
async function phaseInProject(
  admin: ReturnType<typeof createAdminClient>,
  phaseId: string,
  projectId: string,
): Promise<{ name: string } | null> {
  const { data } = await admin.from('project_phases').select('name, project_id').eq('id', phaseId).maybeSingle()
  const row = data as { name: string; project_id: string } | null
  return row && row.project_id === projectId ? { name: row.name } : null
}

/** Étape 1 : version suivante + URL d'upload signée. */
export async function createPhaseFileUploadUrl(input: {
  phaseId: string
  projectId: string
  phaseSlug: string
  fileName: string
  fileSize: number
}): Promise<
  | { success: true; uploadUrl: string; storagePath: string; version: number }
  | { success: false; error: string }
> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { phaseId, projectId, phaseSlug, fileName, fileSize } = input
  if (!phaseId || !projectId || !phaseSlug || !fileName) return { success: false, error: 'Données manquantes' }
  if (fileSize > MAX_PHASE_FILE_BYTES) return { success: false, error: 'Fichier trop lourd (max 500 MB)' }
  if (!(await phaseInProject(admin, phaseId, projectId))) return { success: false, error: 'Étape introuvable' }

  const { data: lastVersion } = await admin
    .from('phase_files')
    .select('version')
    .eq('phase_id', phaseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = ((lastVersion as { version: number } | null)?.version ?? 0) + 1

  const safeSlug = phaseSlug.replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${projectId}/${safeSlug}/v${version}/${safeName}`

  const { data, error } = await admin.storage.from('project-files').createSignedUploadUrl(storagePath)
  if (error || !data?.signedUrl) {
    return { success: false, error: `Impossible de créer l'URL d'upload : ${error?.message ?? 'erreur inconnue'}` }
  }
  return { success: true, uploadUrl: data.signedUrl, storagePath, version }
}

/** Étape 3 : le fichier est dans le bucket, on l'enregistre comme version courante. */
export async function recordPhaseFileUpload(input: {
  phaseId: string
  projectId: string
  storagePath: string
  fileName: string
  fileType: string
  fileSize: number
  version: number
}): Promise<UploadFileResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const { phaseId, projectId, storagePath, fileName, fileType, fileSize, version } = input
  const phase = await phaseInProject(admin, phaseId, projectId)
  if (!phase) return { success: false, error: 'Étape introuvable' }
  // Le chemin doit être celui signé pour ce projet et cette version.
  if (!storagePath.startsWith(`${projectId}/`) || !storagePath.includes(`/v${version}/`)) {
    return { success: false, error: 'Chemin de fichier invalide' }
  }

  await db(admin).from('phase_files').update({ is_current: false }).eq('phase_id', phaseId)

  const { data: fileRecord, error: dbError } = await db(admin)
    .from('phase_files')
    .insert({
      phase_id: phaseId,
      uploaded_by: user.id,
      file_name: fileName,
      file_url: storagePath,
      file_type: fileType || null,
      file_size: fileSize,
      version,
      is_current: true,
    })
    .select('*')
    .single()

  if (dbError) return { success: false, error: `[DB] ${dbError.message}` }

  await db(admin)
    .from('activity_logs')
    .insert({
      project_id: projectId,
      user_id: user.id,
      action: 'file_uploaded',
      details: { file_name: fileName, phase_name: phase.name, version },
    })

  revalidatePath(`/projects/${projectId}`)
  return { success: true, file: fileRecord as PhaseFile }
}

// ─── getPhaseViewData ─────────────────────────────────────────────

export interface PhaseViewData {
  projectId: string
  projectName: string
  phaseName: string
  files: PhaseFile[]
  signedUrl: string | null
  activeVersion: number | null
  uploaders: Record<string, string>
}

export async function getPhaseViewData(
  phaseId: string,
  requestedVersion?: number,
): Promise<PhaseViewData | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data: rawPhase } = await admin
    .from('project_phases')
    .select('id, name, project_id')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as { id: string; name: string; project_id: string } | null
  if (!phase) return { error: 'Phase introuvable' }

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name')
    .eq('id', phase.project_id)
    .maybeSingle()

  const project = rawProject as { id: string; name: string } | null
  if (!project) return { error: 'Projet introuvable' }

  const { data: rawFiles } = await admin
    .from('phase_files')
    .select('*')
    .eq('phase_id', phaseId)
    .order('version', { ascending: false })

  const files = (rawFiles as PhaseFile[] | null) ?? []

  if (files.length === 0) {
    return {
      projectId: project.id,
      projectName: project.name,
      phaseName: phase.name,
      files: [],
      signedUrl: null,
      activeVersion: null,
      uploaders: {},
    }
  }

  const target =
    requestedVersion !== undefined
      ? files.find((f) => f.version === requestedVersion)
      : (files.find((f) => f.is_current) ?? files[0])

  let signedUrl: string | null = null
  if (target) {
    const { data: signed } = await admin.storage
      .from('project-files')
      .createSignedUrl(target.file_url, 3600)
    signedUrl = signed?.signedUrl ?? null
  }

  const uploaderIds = [...new Set(files.map((f) => f.uploaded_by))]
  const uploaders: Record<string, string> = {}
  if (uploaderIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', uploaderIds)
    ;(profiles as { id: string; full_name: string }[] | null)?.forEach((p) => {
      uploaders[p.id] = p.full_name
    })
  }

  return {
    projectId: project.id,
    projectName: project.name,
    phaseName: phase.name,
    files,
    signedUrl,
    activeVersion: target?.version ?? null,
    uploaders,
  }
}

// ─── getSignedUrl ─────────────────────────────────────────────────
// Génère une URL signée. Vérifie l'accès via le project_id extrait du path.

export async function getSignedUrl(filePath: string): Promise<{ url: string } | { error: string }> {
  // Extraire le project_id (premier segment du path)
  const projectId = filePath.split('/')[0]
  if (!projectId) return { error: 'Chemin invalide' }

  const auth = await requireProjectAccess(projectId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const { data, error } = await admin.storage.from('project-files').createSignedUrl(filePath, 3600)

  if (error || !data?.signedUrl) return { error: error?.message ?? 'Erreur inconnue' }
  return { url: data.signedUrl }
}
