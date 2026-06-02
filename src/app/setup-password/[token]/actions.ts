'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import type { PasswordSetupToken } from '@/lib/types'

export type SetupPasswordResult =
  | { success: true }
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

  return { success: true }
}
