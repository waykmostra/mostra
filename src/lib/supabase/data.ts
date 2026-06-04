import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { DataColumn, DataEntry, DataSet } from '@/lib/types'

type Sb = SupabaseClient<Database>

// ============================================================================
// Lectures de la section Data (migration 024) : bases personnalisables.
// Dégrade en douceur (valeurs vides) si les tables n'existent pas encore.
// ============================================================================

export async function getDataSets(supabase: Sb): Promise<DataSet[]> {
  const { data } = await supabase
    .from('data_sets')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as DataSet[] | null) ?? []
}

export interface DataSetFull {
  set: DataSet
  columns: DataColumn[]
  entries: DataEntry[]
}

export async function getDataSetFull(supabase: Sb, id: string): Promise<DataSetFull | null> {
  const { data: setRow } = await supabase.from('data_sets').select('*').eq('id', id).maybeSingle()
  const set = setRow as DataSet | null
  if (!set) return null

  const [colsRes, entriesRes] = await Promise.all([
    supabase
      .from('data_columns')
      .select('*')
      .eq('set_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('data_entries')
      .select('*')
      .eq('set_id', id)
      .order('created_at', { ascending: false }),
  ])

  return {
    set,
    columns: (colsRes.data as DataColumn[] | null) ?? [],
    entries: (entriesRes.data as DataEntry[] | null) ?? [],
  }
}

/** Compte d'entrées par base (pour la liste). */
export async function getEntryCounts(supabase: Sb): Promise<Record<string, number>> {
  const { data } = await supabase.from('data_entries').select('set_id')
  const rows = (data as { set_id: string }[] | null) ?? []
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.set_id] = (counts[r.set_id] ?? 0) + 1
  return counts
}
