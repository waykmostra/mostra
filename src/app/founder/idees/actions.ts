'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { ContentPlatform, ContentStatus } from '@/lib/types'

// ============================================================================
// Inbox idées de contenu (migration 022).
// ============================================================================

export type IdeaResult = { success: true } | { success: false; error: string }

const PLATFORMS: ContentPlatform[] = ['linkedin', 'instagram', 'x']
const STATUSES: ContentStatus[] = ['idea', 'in_progress', 'published']

function revalidate() {
  revalidatePath('/founder/idees')
}

export async function createIdea(content: string, platform: ContentPlatform): Promise<IdeaResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = content.trim()
  if (!clean) return { success: false, error: 'Le contenu est requis.' }
  if (!PLATFORMS.includes(platform)) return { success: false, error: 'Plateforme invalide.' }

  const { error } = await db(admin)
    .from('content_ideas')
    .insert({ content: clean, platform })

  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function updateIdeaStatus(id: string, status: ContentStatus): Promise<IdeaResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  if (!STATUSES.includes(status)) return { success: false, error: 'Statut invalide.' }

  const { error } = await db(admin).from('content_ideas').update({ status }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function updateIdeaContent(id: string, content: string): Promise<IdeaResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = content.trim()
  if (!clean) return { success: false, error: 'Le contenu est requis.' }

  const { error } = await db(admin).from('content_ideas').update({ content: clean }).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function deleteIdea(id: string): Promise<IdeaResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('content_ideas').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}
