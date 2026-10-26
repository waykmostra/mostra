import { createAdminClient } from '@/lib/supabase/admin'
import type { PhaseStatus } from '@/lib/types'

// ============================================================
// Aperçu d'un lien client partagé (WhatsApp, iMessage, Instagram…)
// ============================================================
// Les robots d'aperçu ne sont pas connectés : ces données sont lues sans
// session (le lien porte déjà le code d'accès) et ne contiennent que ce qui
// peut s'afficher dans une carte publique — nom du projet, étape, avancement.
// Jamais de montant, de fichier, de commentaire ni de nom de contact.

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  pending: 'à venir',
  in_progress: 'en production',
  in_review: 'à valider',
  approved: 'validée',
  completed: 'validée',
}

export interface LinkPreview {
  projectName: string
  progress: number
  phase: { name: string; status: PhaseStatus } | null
}

/**
 * `phase` = slug (ou id) de l'étape ; sans étape, l'étape en cours du projet
 * (la première en review, sinon en production). Null si le lien est inconnu.
 */
export async function getLinkPreview(token: string, phase?: string): Promise<LinkPreview | null> {
  const admin = createAdminClient()
  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, progress')
    .eq('share_token', token)
    .maybeSingle()
  const project = rawProject as { id: string; name: string; progress: number } | null
  if (!project) return null

  const { data: rawPhases } = await admin
    .from('project_phases')
    .select('id, name, slug, status, sort_order')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })
  const phases = (rawPhases as { id: string; name: string; slug: string; status: PhaseStatus }[] | null) ?? []

  const picked = phase
    ? phases.find((p) => p.slug === phase || p.id === phase)
    : phases.find((p) => p.status === 'in_review') ?? phases.find((p) => p.status === 'in_progress')

  return {
    projectName: project.name,
    progress: Math.max(0, Math.min(100, project.progress ?? 0)),
    phase: picked ? { name: picked.name, status: picked.status } : null,
  }
}

/** « Mon Miroir · Animation à valider » */
export function previewTitle(p: LinkPreview): string {
  return p.phase ? `${p.projectName} · ${p.phase.name} ${PHASE_STATUS_LABEL[p.phase.status]}` : p.projectName
}
