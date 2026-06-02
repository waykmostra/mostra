'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { ScriptSectionContent, SubPhase, ProjectPhase } from '@/lib/types'

export type ScriptActionResult = { success: true } | { success: false; error: string }

export interface ScriptBlock {
  id: string
  content: ScriptSectionContent
  sort_order: number
}

// ── Auth helper ───────────────────────────────────────────────────

async function getCreativeContext() {
  const auth = await requireAdmin()
  if ('error' in auth) return null
  return { supabase: auth.supabase, user: auth.user }
}

// ── Nav helper ────────────────────────────────────────────────────

async function getSubPhaseParents(
  supabase: ReturnType<typeof createClient>,
  subPhaseId: string,
) {
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

// ── saveScriptBlocks ──────────────────────────────────────────────
// Remplace tous les blocs script_section de la sous-phase par la nouvelle liste

export async function saveScriptBlocks(
  subPhaseId: string,
  blocks: { id?: string; content: ScriptSectionContent; sort_order: number }[],
): Promise<ScriptActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  // Delete existing
  const { error: delErr } = await db(supabase)
    .from('phase_blocks')
    .delete()
    .eq('sub_phase_id', subPhaseId)
    .eq('type', 'script_section')

  if (delErr) return { success: false, error: delErr.message }

  // Insert new list
  if (blocks.length > 0) {
    const rows = blocks.map((b, i) => ({
      sub_phase_id: subPhaseId,
      phase_id: null,
      type: 'script_section',
      content: b.content,
      sort_order: i + 1,
      is_approved: false,
      created_by: null,
    }))

    const { error: insErr } = await db(supabase).from('phase_blocks').insert(rows)
    if (insErr) return { success: false, error: insErr.message }
  }

  const parents = await getSubPhaseParents(supabase, subPhaseId)
  if (parents) {
    revalidatePath(`/projects/${parents.phase.project_id}`)
    revalidatePath(
      `/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${subPhaseId}`,
    )
  }

  return { success: true }
}
