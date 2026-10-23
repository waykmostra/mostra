import type { createAdminClient } from '@/lib/supabase/admin'
import { isPhaseViewable } from '@/lib/currentPhase'
import type { ProjectPhase } from '@/lib/types'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Étapes d'un projet côté client, avec pour chacune son droit d'ouverture.
 * Le layout (menu), la vue d'ensemble et la page d'une étape s'appuient tous
 * dessus pour décider ce qui est un lien.
 */
export async function loadClientPhases(
  admin: Admin,
  projectId: string,
): Promise<{ phases: ProjectPhase[]; viewableIds: Set<string> }> {
  const { data: rawPhases } = await admin
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  const phases = (rawPhases as ProjectPhase[] | null) ?? []

  const withSubs = new Set<string>()
  if (phases.length > 0) {
    const { data: rawSubs } = await admin
      .from('sub_phases')
      .select('phase_id')
      .in(
        'phase_id',
        phases.map((p) => p.id),
      )
    for (const r of (rawSubs as { phase_id: string }[] | null) ?? []) withSubs.add(r.phase_id)
  }

  const viewableIds = new Set(phases.filter((p) => isPhaseViewable(p, withSubs.has(p.id))).map((p) => p.id))
  return { phases, viewableIds }
}
