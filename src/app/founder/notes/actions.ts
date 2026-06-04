'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'

// ============================================================================
// Section Notes (migration 023) : groupes personnalisables + notes texte libre.
// ============================================================================

export type NoteResult = { success: true } | { success: false; error: string }
export type CreateGroupResult =
  | { success: true; groupId: string }
  | { success: false; error: string }

function revalidate() {
  revalidatePath('/founder/notes')
}

// ── Groupes ─────────────────────────────────────────────────────────────────

export async function createGroup(name: string, color: string): Promise<CreateGroupResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom du groupe est requis.' }

  const { data, error } = await db(admin)
    .from('note_groups')
    .insert({ name: clean, color: color || '#00D76B' })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true, groupId: data.id as string }
}

export async function renameGroup(id: string, name: string): Promise<NoteResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom du groupe est requis.' }

  const { error } = await db(admin).from('note_groups').update({ name: clean }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function recolorGroup(id: string, color: string): Promise<NoteResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('note_groups').update({ color }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function deleteGroup(id: string): Promise<NoteResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Les notes du groupe sont supprimées en cascade (FK ON DELETE CASCADE).
  const { error } = await db(admin).from('note_groups').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function createNote(groupId: string, content: string): Promise<NoteResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  if (!groupId) return { success: false, error: 'Groupe invalide.' }
  const clean = content.trim()
  if (!clean) return { success: false, error: 'La note est vide.' }

  const { error } = await db(admin).from('notes').insert({ group_id: groupId, content: clean })
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function updateNote(id: string, content: string): Promise<NoteResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = content.trim()
  if (!clean) return { success: false, error: 'La note est vide.' }

  const { error } = await db(admin).from('notes').update({ content: clean }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function deleteNote(id: string): Promise<NoteResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('notes').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}
