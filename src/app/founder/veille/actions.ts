'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'

// ============================================================================
// Veille concurrentielle (migration 022).
// ============================================================================

export type CompetitorResult = { success: true } | { success: false; error: string }

function revalidate() {
  revalidatePath('/founder/veille')
  revalidatePath('/founder')
}

export interface CompetitorInput {
  name: string
  website?: string | null
  positioning?: string | null
  theirMethods?: string | null
  replicate?: string | null
}

export async function createCompetitor(input: CompetitorInput): Promise<CompetitorResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Le nom est requis.' }

  const { error } = await db(admin)
    .from('competitors')
    .insert({
      name,
      website: input.website?.trim() || null,
      positioning: input.positioning?.trim() || null,
      their_methods: input.theirMethods?.trim() || null,
      replicate: input.replicate?.trim() || null,
    })

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function updateCompetitor(id: string, input: CompetitorInput): Promise<CompetitorResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Le nom est requis.' }

  const { error } = await db(admin)
    .from('competitors')
    .update({
      name,
      website: input.website?.trim() || null,
      positioning: input.positioning?.trim() || null,
      their_methods: input.theirMethods?.trim() || null,
      replicate: input.replicate?.trim() || null,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function deleteCompetitor(id: string): Promise<CompetitorResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('competitors').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}
