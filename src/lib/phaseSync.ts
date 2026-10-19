/**
 * Cohérence des statuts phase / sous-étape / projet.
 *
 * Le statut d'une phase n'est pas saisi à la main : il se déduit de ses
 * sous-étapes. Toute action qui touche une sous-étape (démarrage, review,
 * validation, dévalidation) doit donc appeler `syncPhaseFromSubPhases`, sans
 * quoi une phase reste « en cours » alors que tout est validé — et le client
 * continue de voir une demande d'approbation.
 *
 * Règles :
 *   • aucune sous-étape        → le statut de la phase est piloté à la main
 *                                (Animation, Rendu : fichiers portés par la phase)
 *   • toutes validées          → phase terminée, et l'étape suivante démarre
 *   • au moins une en review   → phase en review
 *   • au moins une démarrée    → phase en cours
 *   • sinon                    → phase en attente
 */

import { db } from '@/lib/supabase/helpers'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'
import type { PhaseStatus } from '@/lib/types'

/** Accepte indifféremment le client serveur (session) et le client admin. */
type Client = ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>

const isDone = (s: PhaseStatus) => s === 'completed' || s === 'approved'

/** Avancement du projet = part des phases terminées. Clôt le projet au complet. */
export async function recalcProjectProgress(client: Client, projectId: string): Promise<void> {
  const { data } = await client.from('project_phases').select('status').eq('project_id', projectId)
  const phases = (data as { status: PhaseStatus }[] | null) ?? []
  if (phases.length === 0) return

  const done = phases.filter((p) => isDone(p.status)).length
  const progress = Math.round((done / phases.length) * 100)

  const update: Record<string, unknown> = { progress }
  // Le projet se referme tout seul quand tout est validé, et se rouvre si une
  // phase repart en arrière (dévalidation).
  update.status = done === phases.length ? 'completed' : 'active'

  await db(client).from('projects').update(update).eq('id', projectId)
}

/** Démarre la première phase en attente après `sortOrder`, si elle existe.
 *  Exporté pour les phases sans sous-étape (Animation, Rendu), validées d'un bloc. */
export async function startNextPhase(
  client: Client,
  projectId: string,
  sortOrder: number,
): Promise<void> {
  const { data } = await client
    .from('project_phases')
    .select('id, status, sort_order')
    .eq('project_id', projectId)
    .gt('sort_order', sortOrder)
    .order('sort_order', { ascending: true })
    .limit(1)

  const next = ((data as { id: string; status: PhaseStatus }[] | null) ?? [])[0]
  if (!next || next.status !== 'pending') return

  await db(client)
    .from('project_phases')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', next.id)

  // La première sous-étape de l'étape suivante démarre avec elle : sans ça le
  // client voit une étape ouverte dont tout le contenu est verrouillé.
  const { data: rawSubs } = await client
    .from('sub_phases')
    .select('id, status, sort_order')
    .eq('phase_id', next.id)
    .order('sort_order', { ascending: true })
    .limit(1)

  const firstSub = ((rawSubs as { id: string; status: PhaseStatus }[] | null) ?? [])[0]
  if (firstSub && firstSub.status === 'pending') {
    await db(client)
      .from('sub_phases')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', firstSub.id)
  }
}

/**
 * Recale le statut d'une phase sur celui de ses sous-étapes, puis l'avancement
 * du projet. Renvoie le statut retenu (null si la phase n'a pas de sous-étape).
 */
export async function syncPhaseFromSubPhases(
  client: Client,
  phaseId: string,
): Promise<PhaseStatus | null> {
  const { data: rawPhase } = await client
    .from('project_phases')
    .select('id, project_id, status, sort_order')
    .eq('id', phaseId)
    .maybeSingle()

  const phase = rawPhase as {
    id: string
    project_id: string
    status: PhaseStatus
    sort_order: number
  } | null
  if (!phase) return null

  const { data: rawSubs } = await client
    .from('sub_phases')
    .select('status')
    .eq('phase_id', phaseId)

  const subs = (rawSubs as { status: PhaseStatus }[] | null) ?? []
  if (subs.length === 0) {
    await recalcProjectProgress(client, phase.project_id)
    return null
  }

  let next: PhaseStatus
  if (subs.every((s) => isDone(s.status))) next = 'completed'
  else if (subs.some((s) => s.status === 'in_review')) next = 'in_review'
  else if (subs.some((s) => s.status !== 'pending')) next = 'in_progress'
  else next = 'pending'

  if (next !== phase.status) {
    const update: Record<string, unknown> = { status: next }
    if (next === 'completed') update.completed_at = new Date().toISOString()
    // Une phase qui repart en arrière perd sa date de fin.
    if (phase.status === 'completed' && next !== 'completed') update.completed_at = null
    if (next !== 'pending' && !['completed'].includes(next)) {
      update.started_at = update.started_at ?? new Date().toISOString()
    }
    await db(client).from('project_phases').update(update).eq('id', phaseId)
  }

  if (next === 'completed') {
    await startNextPhase(client, phase.project_id, phase.sort_order)
  }

  await recalcProjectProgress(client, phase.project_id)
  return next
}
