'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import type { PasswordSetupToken } from '@/lib/types'

export type SetupPasswordResult =
  | { success: true; redirectTo: string; signedIn: boolean }
  | { success: false; error: string }

export async function setupPassword(
  token: string,
  password: string,
): Promise<SetupPasswordResult> {
  if (!password || password.length === 0) {
    return { success: false, error: 'Le mot de passe est requis.' }
  }

  const admin = createAdminClient()

  // 1. Resolve token
  const { data: rawToken } = await admin
    .from('password_setup_tokens')
    .select('id, user_id, token, used_at, expires_at, created_at')
    .eq('token', token)
    .maybeSingle()

  const tokenRow = rawToken as PasswordSetupToken | null
  if (!tokenRow) {
    return { success: false, error: 'Lien invalide.' }
  }

  if (tokenRow.used_at !== null) {
    return { success: false, error: 'Ce lien a déjà été utilisé.' }
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return { success: false, error: 'Ce lien a expiré.' }
  }

  // 2. Update the user's password via Admin API
  const { error: updateErr } = await admin.auth.admin.updateUserById(tokenRow.user_id, {
    password,
  })
  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  // 3. Mark token as used
  await db(admin)
    .from('password_setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  // 4. Open the session right away: the client lands in their space instead of
  //    on the login page. The cookie-based server client sets the session
  //    cookies on this Server Action's response.
  const { data: userData } = await admin.auth.admin.getUserById(tokenRow.user_id)
  const email = userData?.user?.email ?? null
  if (!email) return { success: true, redirectTo: '/login', signedIn: false }

  const supabase = createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    // Rare: fall back to the login page, email pre-filled.
    return { success: true, redirectTo: `/login?email=${encodeURIComponent(email)}`, signedIn: false }
  }

  return { success: true, redirectTo: await landingFor(tokenRow.user_id, email), signedIn: true }
}

/**
 * Where a client lands after activating their account: straight into the
 * project when they have exactly one active project, else their dashboard.
 * Same lookup as /client/dashboard (CRM record by profile or email, primary or
 * additional client of the project).
 */
async function landingFor(userId: string, email: string): Promise<string> {
  const admin = createAdminClient()
  const { data: rawProfile } = await admin.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  if ((rawProfile as { is_admin: boolean } | null)?.is_admin) return '/dashboard'

  const { data: rawClients } = await admin
    .from('clients')
    .select('id')
    .or(`profile_id.eq.${userId},email.eq.${email}`)
  const clientIds = [...new Set(((rawClients as { id: string }[] | null) ?? []).map((c) => c.id))]
  if (!clientIds.length) return '/client/dashboard'

  const { data: rawLinks } = await admin.from('project_clients').select('project_id').in('client_id', clientIds)
  const linked = [...new Set(((rawLinks as { project_id: string }[] | null) ?? []).map((l) => l.project_id))]
  const orProjects = `client_id.in.(${clientIds.join(',')})` + (linked.length ? `,id.in.(${linked.join(',')})` : '')

  const { data: rawProjects } = await admin
    .from('projects')
    .select('share_token')
    .or(orProjects)
    .eq('status', 'active')
  const projects = (rawProjects as { share_token: string }[] | null) ?? []
  return projects.length === 1 ? `/client/${projects[0].share_token}` : '/client/dashboard'
}
