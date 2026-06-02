'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin, requireProjectAccess } from '@/lib/auth'
import type { PhaseFile } from '@/lib/types'

// ─── uploadFile ──────────────────────────────────────────────────

export type UploadFileResult =
  | { success: true; file: PhaseFile }
  | { success: false; error: string }

export async function uploadFile(formData: FormData): Promise<UploadFileResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const file = formData.get('file') as File | null
  const phaseId = formData.get('phaseId') as string | null
  const projectId = formData.get('projectId') as string | null
  const phaseSlug = formData.get('phaseSlug') as string | null

  if (!file || !phaseId || !projectId || !phaseSlug) {
    return { success: false, error: 'Données manquantes' }
  }

  // Version
  const { data: lastVersion } = await admin
    .from('phase_files')
    .select('version')
    .eq('phase_id', phaseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const version = ((lastVersion as { version: number } | null)?.version ?? 0) + 1

  // Storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${projectId}/${phaseSlug}/v${version}/${safeName}`

  const { error: storageError } = await admin.storage
    .from('project-files')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })

  if (storageError) return { success: false, error: `[Storage] ${storageError.message}` }

  await db(admin).from('phase_files').update({ is_current: false }).eq('phase_id', phaseId)

  const { data: fileRecord, error: dbError } = await db(admin)
    .from('phase_files')
    .insert({
      phase_id: phaseId,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: storagePath,
      file_type: file.type || null,
      file_size: file.size,
      version,
      is_current: true,
    })
    .select('*')
    .single()

  if (dbError) return { success: false, error: `[DB] ${dbError.message}` }

  const { data: phaseRow } = await admin
    .from('project_phases')
    .select('name')
    .eq('id', phaseId)
    .maybeSingle()

  const phaseName = (phaseRow as { name: string } | null)?.name ?? 'phase'

  await db(admin)
    .from('activity_logs')
    .insert({
      project_id: projectId,
      user_id: user.id,
      action: 'file_uploaded',
      details: { file_name: file.name, phase_name: phaseName, version },
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
