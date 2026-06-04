'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { DataColumnType, DataNumberFormat, DataValue } from '@/lib/types'

// ============================================================================
// Section Data (migration 024) : bases personnalisables (sets / colonnes /
// entrées). Toutes les écritures sont admin-only.
// ============================================================================

export type DataResult = { success: true } | { success: false; error: string }
export type CreateResult = { success: true; id: string } | { success: false; error: string }

const COLUMN_TYPES: DataColumnType[] = ['number', 'category', 'text']

function revalidateList() {
  revalidatePath('/founder/data')
}
function revalidateSet(id: string) {
  revalidatePath('/founder/data')
  revalidatePath(`/founder/data/${id}`)
}

// ── Bases (data_sets) ─────────────────────────────────────────────────────────

export async function createSet(name: string, color: string): Promise<CreateResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom de la base est requis.' }

  const { data, error } = await db(admin)
    .from('data_sets')
    .insert({ name: clean, color: color || '#00D76B' })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidateList()
  return { success: true, id: data.id as string }
}

export async function renameSet(id: string, name: string): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom de la base est requis.' }

  const { error } = await db(admin).from('data_sets').update({ name: clean }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateSet(id)
  return { success: true }
}

export async function recolorSet(id: string, color: string): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('data_sets').update({ color }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateSet(id)
  return { success: true }
}

export async function deleteSet(id: string): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Colonnes + entrées supprimées en cascade (FK ON DELETE CASCADE).
  const { error } = await db(admin).from('data_sets').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateList()
  return { success: true }
}

// ── Colonnes (data_columns) ───────────────────────────────────────────────────

function cleanOptions(options: string[] | undefined): string[] | null {
  if (!options) return null
  const list = options.map((o) => o.trim()).filter(Boolean)
  return list.length > 0 ? Array.from(new Set(list)) : null
}

export async function addColumn(
  setId: string,
  name: string,
  type: DataColumnType,
  options?: string[],
  numberFormat?: DataNumberFormat,
  numberMax?: number,
): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom de la colonne est requis.' }
  if (!COLUMN_TYPES.includes(type)) return { success: false, error: 'Type de colonne invalide.' }

  const opts = type === 'category' ? cleanOptions(options) : null
  if (type === 'category' && !opts) {
    return { success: false, error: 'Ajoute au moins un choix pour une colonne catégorie.' }
  }

  const fmt = type === 'number' ? (numberFormat ?? 'raw') : null
  const max = fmt === 'rating' ? (numberMax ?? null) : null
  if (fmt === 'rating' && (!max || max <= 0)) {
    return { success: false, error: 'Indique le maximum de la note (ex. 5).' }
  }

  // sort_order = nb de colonnes existantes.
  const { count } = await db(admin)
    .from('data_columns')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', setId)

  const { error } = await db(admin)
    .from('data_columns')
    .insert({
      set_id: setId,
      name: clean,
      type,
      options: opts,
      number_format: fmt,
      number_max: max,
      sort_order: count ?? 0,
    })

  if (error) return { success: false, error: error.message }

  revalidateSet(setId)
  return { success: true }
}

export async function updateColumn(
  id: string,
  setId: string,
  patch: { name?: string; options?: string[]; numberFormat?: DataNumberFormat; numberMax?: number | null },
): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const clean = patch.name.trim()
    if (!clean) return { success: false, error: 'Le nom de la colonne est requis.' }
    update.name = clean
  }
  if (patch.options !== undefined) {
    update.options = cleanOptions(patch.options)
  }
  if (patch.numberFormat !== undefined) {
    update.number_format = patch.numberFormat
    if (patch.numberFormat === 'rating') {
      const max = patch.numberMax ?? null
      if (!max || max <= 0) return { success: false, error: 'Indique le maximum de la note (ex. 5).' }
      update.number_max = max
    } else {
      update.number_max = null
    }
  }
  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await db(admin).from('data_columns').update(update).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateSet(setId)
  return { success: true }
}

export async function deleteColumn(id: string, setId: string): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('data_columns').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateSet(setId)
  return { success: true }
}

// ── Entrées (data_entries) ────────────────────────────────────────────────────

function sanitizeValues(values: Record<string, DataValue>): Record<string, DataValue> {
  if (!values || typeof values !== 'object') return {}
  const out: Record<string, DataValue> = {}
  for (const [k, v] of Object.entries(values)) {
    if (v === '' || v === undefined) continue
    out[k] = v as DataValue
  }
  return out
}

export async function addEntry(setId: string, values: Record<string, DataValue>): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  if (!setId) return { success: false, error: 'Base invalide.' }
  const clean = sanitizeValues(values)
  if (Object.keys(clean).length === 0) return { success: false, error: 'Entrée vide.' }

  const { error } = await db(admin).from('data_entries').insert({ set_id: setId, values: clean })
  if (error) return { success: false, error: error.message }

  revalidateSet(setId)
  return { success: true }
}

export async function updateEntry(
  id: string,
  setId: string,
  values: Record<string, DataValue>,
): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = sanitizeValues(values)
  const { error } = await db(admin).from('data_entries').update({ values: clean }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateSet(setId)
  return { success: true }
}

export async function deleteEntry(id: string, setId: string): Promise<DataResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('data_entries').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateSet(setId)
  return { success: true }
}
