import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { Note, NoteGroup } from '@/lib/types'

type Sb = SupabaseClient<Database>

// ============================================================================
// Lectures de la section Notes (migration 023). Dégrade en douceur (valeurs
// vides) si les tables n'existent pas encore.
// ============================================================================

export interface NotesData {
  groups: NoteGroup[]
  notes: Note[]
}

export async function getNotesData(supabase: Sb): Promise<NotesData> {
  const [groupsRes, notesRes] = await Promise.all([
    supabase
      .from('note_groups')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  return {
    groups: (groupsRes.data as NoteGroup[] | null) ?? [],
    notes: (notesRes.data as Note[] | null) ?? [],
  }
}
