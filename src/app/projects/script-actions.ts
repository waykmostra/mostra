'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { defaultLayout } from '@/lib/scriptTable'
import type { SubPhase, ProjectPhase, Script, ScriptColumn, ScriptCategory, ScriptBeat } from '@/lib/types'

export type ScriptActionResult = { success: true } | { success: false; error: string }
export type CreateScriptResult =
  | { success: true; scriptId: string }
  | { success: false; error: string }
export type SaveScriptResult =
  | { success: true; idMap: Record<string, string> }
  | { success: false; error: string }

/** Une ligne de tableau telle qu'envoyée par l'éditeur (id null = nouvelle ligne). */
export interface SaveScriptRow {
  _key: string
  id: string | null
  categoryId: string
  cells: Record<string, string>
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

async function revalidateSubPhase(
  supabase: ReturnType<typeof createClient>,
  subPhaseId: string,
) {
  const parents = await getSubPhaseParents(supabase, subPhaseId)
  if (parents) {
    revalidatePath(`/projects/${parents.phase.project_id}`)
    revalidatePath(
      `/projects/${parents.phase.project_id}/phases/${parents.phase.id}/sub/${subPhaseId}`,
    )
  }
}

async function getScriptSubPhaseId(
  supabase: ReturnType<typeof createClient>,
  scriptId: string,
): Promise<string | null> {
  const { data } = await supabase.from('scripts').select('sub_phase_id').eq('id', scriptId).maybeSingle()
  return (data as { sub_phase_id: string } | null)?.sub_phase_id ?? null
}

// ── Lecture des scripts d'une sous-phase ──────────────────────────

export async function getScripts(subPhaseId: string): Promise<Script[]> {
  const ctx = await getCreativeContext()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .from('scripts')
    .select('*')
    .eq('sub_phase_id', subPhaseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as Script[] | null) ?? []
}

// ── CRUD scripts ──────────────────────────────────────────────────

export async function createScript(
  subPhaseId: string,
  title?: string,
  description?: string,
): Promise<CreateScriptResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  const { count } = await db(supabase)
    .from('scripts')
    .select('id', { count: 'exact', head: true })
    .eq('sub_phase_id', subPhaseId)

  const isFirst = (count ?? 0) === 0
  const layout = defaultLayout()

  const { data, error } = await db(supabase)
    .from('scripts')
    .insert({
      sub_phase_id: subPhaseId,
      title: title?.trim() || 'Nouveau script',
      description: description?.trim() || null,
      is_selected: isFirst, // le 1er script est la version client par défaut
      sort_order: count ?? 0,
      // Layout de départ du tableau (migration 028)
      columns: layout.columns,
      categories: layout.categories,
      beats: layout.beats,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Erreur création script' }

  await revalidateSubPhase(supabase, subPhaseId)
  return { success: true, scriptId: data.id as string }
}

export async function updateScript(
  scriptId: string,
  patch: { title?: string; description?: string },
): Promise<ScriptActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) {
    const clean = patch.title.trim()
    if (!clean) return { success: false, error: 'Le titre est requis.' }
    update.title = clean
  }
  if (patch.description !== undefined) update.description = patch.description.trim() || null
  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await db(supabase).from('scripts').update(update).eq('id', scriptId)
  if (error) return { success: false, error: error.message }

  const subPhaseId = await getScriptSubPhaseId(supabase, scriptId)
  if (subPhaseId) await revalidateSubPhase(supabase, subPhaseId)
  return { success: true }
}

export async function deleteScript(scriptId: string): Promise<ScriptActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  const { data: rawScript } = await supabase
    .from('scripts')
    .select('id, sub_phase_id, is_selected')
    .eq('id', scriptId)
    .maybeSingle()
  const script = rawScript as Pick<Script, 'id' | 'sub_phase_id' | 'is_selected'> | null
  if (!script) return { success: false, error: 'Script introuvable' }

  const { error } = await db(supabase).from('scripts').delete().eq('id', scriptId)
  if (error) return { success: false, error: error.message }

  // Si on a supprimé la version client, on en re-sélectionne une (la 1re restante).
  if (script.is_selected) {
    const { data: rawRest } = await supabase
      .from('scripts')
      .select('id')
      .eq('sub_phase_id', script.sub_phase_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
    const rest = (rawRest as { id: string }[] | null) ?? []
    if (rest[0]) {
      await db(supabase).from('scripts').update({ is_selected: true }).eq('id', rest[0].id)
    }
  }

  await revalidateSubPhase(supabase, script.sub_phase_id)
  return { success: true }
}

/** Marque un script comme la « version client » (un seul sélectionné par sous-phase). */
export async function setSelectedScript(scriptId: string): Promise<ScriptActionResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  const subPhaseId = await getScriptSubPhaseId(supabase, scriptId)
  if (!subPhaseId) return { success: false, error: 'Script introuvable' }

  await db(supabase).from('scripts').update({ is_selected: false }).eq('sub_phase_id', subPhaseId)
  const { error } = await db(supabase).from('scripts').update({ is_selected: true }).eq('id', scriptId)
  if (error) return { success: false, error: error.message }

  await revalidateSubPhase(supabase, subPhaseId)
  return { success: true }
}

// ── saveScript ────────────────────────────────────────────────────
// Sauvegarde le LAYOUT du tableau (colonnes/catégories/beats) sur la ligne
// `scripts`, et UPSERTE les lignes dans `phase_blocks` en PRÉSERVANT les id
// existants (= ancres des commentaires). Seules les lignes réellement
// supprimées sont effacées. Renvoie l'id réel des nouvelles lignes (idMap).

export async function saveScript(
  scriptId: string,
  payload: {
    columns: ScriptColumn[]
    categories: ScriptCategory[]
    beats: ScriptBeat[]
    rows: SaveScriptRow[]
  },
): Promise<SaveScriptResult> {
  const ctx = await getCreativeContext()
  if (!ctx) return { success: false, error: 'Permissions insuffisantes' }
  const { supabase } = ctx

  const { data: rawScript } = await supabase
    .from('scripts')
    .select('id, sub_phase_id')
    .eq('id', scriptId)
    .maybeSingle()
  const script = rawScript as Pick<Script, 'id' | 'sub_phase_id'> | null
  if (!script) return { success: false, error: 'Script introuvable' }

  // 1. Layout du tableau sur la ligne scripts
  const { error: layoutErr } = await db(supabase)
    .from('scripts')
    .update({ columns: payload.columns, categories: payload.categories, beats: payload.beats })
    .eq('id', scriptId)
  if (layoutErr) return { success: false, error: layoutErr.message }

  // 2. Lignes déjà en base pour ce script
  const { data: rawExisting } = await supabase
    .from('phase_blocks')
    .select('id')
    .eq('script_id', scriptId)
    .eq('type', 'script_section')
  const existingIds = new Set(((rawExisting as { id: string }[] | null) ?? []).map((r) => r.id))
  const keepIds = new Set(payload.rows.filter((r) => r.id).map((r) => r.id as string))

  // 3. Supprime les lignes retirées (cascade → leurs commentaires)
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id))
  if (toDelete.length) {
    const { error } = await db(supabase).from('phase_blocks').delete().in('id', toDelete)
    if (error) return { success: false, error: error.message }
  }

  // 4. Upsert dans l'ordre (update existant / insert nouveau)
  const idMap: Record<string, string> = {}
  for (let i = 0; i < payload.rows.length; i++) {
    const row = payload.rows[i]
    const content = { categoryId: row.categoryId, cells: row.cells }
    if (row.id && existingIds.has(row.id)) {
      const { error } = await db(supabase)
        .from('phase_blocks')
        .update({ content, sort_order: i + 1 })
        .eq('id', row.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { data, error } = await db(supabase)
        .from('phase_blocks')
        .insert({
          sub_phase_id: script.sub_phase_id,
          phase_id: null,
          script_id: scriptId,
          type: 'script_section',
          content,
          sort_order: i + 1,
          is_approved: false,
          created_by: null,
        })
        .select('id')
        .single()
      if (error || !data) return { success: false, error: error?.message ?? 'Erreur création ligne' }
      idMap[row._key] = data.id as string
    }
  }

  await revalidateSubPhase(supabase, script.sub_phase_id)
  return { success: true, idMap }
}
