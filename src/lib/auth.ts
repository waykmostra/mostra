// ============================================================
// MOSTRA — Auth helpers (Server only)
// ============================================================
// Pattern centralisé pour les Server Actions et Server Components.
// 2 rôles : admin (Tarik) + client.
//
// Utilisation :
//   const auth = await requireAdmin()
//   if ('error' in auth) return { success: false, error: auth.error }
//   const { user, profile, supabase, admin } = auth
// ============================================================

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'

export type AuthError = { error: string }

export type AuthSuccess = {
  supabase: ReturnType<typeof createClient>
  admin: ReturnType<typeof createAdminClient>
  user: { id: string; email: string | undefined }
  profile: Profile
}

/**
 * Exige un utilisateur authentifié (admin OU client).
 * Renvoie le profil complet.
 */
export const requireUser = cache(async (): Promise<AuthError | AuthSuccess> => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const admin = createAdminClient()
  const { data: rawProfile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const profile = rawProfile as Profile | null
  if (!profile) return { error: 'Profil introuvable.' }

  return {
    supabase,
    admin,
    user: { id: user.id, email: user.email },
    profile,
  }
})

/**
 * Exige un utilisateur authentifié ET admin.
 */
export async function requireAdmin(): Promise<AuthError | AuthSuccess> {
  const result = await requireUser()
  if ('error' in result) return result
  if (!result.profile.is_admin) return { error: 'Accès admin requis.' }
  return result
}

/**
 * Vérifie qu'un utilisateur est soit admin, soit le client assigné à un projet
 * donné. Utilisé pour gating les actions (commenter, approuver) sur un projet.
 *
 * Depuis la migration 018, projects.client_id pointe vers clients.id, et la
 * relation au compte auth passe par clients.profile_id.
 */
export async function requireProjectAccess(
  projectId: string,
): Promise<AuthError | (AuthSuccess & { canEdit: boolean })> {
  const result = await requireUser()
  if ('error' in result) return result

  if (result.profile.is_admin) {
    return { ...result, canEdit: true }
  }

  // Client : projects.client_id → clients.id ; clients.profile_id = auth user
  const { data: rawProject } = await result.admin
    .from('projects')
    .select('client_id, clients:client_id (profile_id)')
    .eq('id', projectId)
    .maybeSingle()

  const project = rawProject as
    | { client_id: string | null; clients: { profile_id: string | null } | null }
    | null

  if (!project) return { error: 'Projet introuvable.' }
  if (!project.clients || project.clients.profile_id !== result.user.id) {
    return { error: 'Accès refusé à ce projet.' }
  }

  return { ...result, canEdit: false }
}

/**
 * Helper pour les pages côté client (sans middleware) — vérifie juste l'auth
 * et renvoie le profil ou null. Ne lève pas d'erreur, à utiliser dans les
 * layouts/pages qui font ensuite leur propre redirect.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: rawProfile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (rawProfile as Profile | null) ?? null
})
