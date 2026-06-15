import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'

// ============================================================================
// État d'accès d'un client : dernière connexion (auth) + état du lien
// set-password (actif / utilisé / expiré). Admin-only (service role).
// ============================================================================

export type SetupLinkState = 'none' | 'active' | 'used' | 'expired'

export interface ClientAccess {
  /** Dernière connexion réelle (auth.users.last_sign_in_at), ou null si jamais. */
  lastSignInAt: string | null
  link: {
    state: SetupLinkState
    expiresAt: string | null
    usedAt: string | null
    createdAt: string | null
  }
}

const EMPTY: ClientAccess = {
  lastSignInAt: null,
  link: { state: 'none', expiresAt: null, usedAt: null, createdAt: null },
}

export async function getClientAccess(profileId: string | null): Promise<ClientAccess> {
  if (!profileId) return EMPTY

  const admin = createAdminClient()

  // Dernière connexion via l'API auth admin.
  let lastSignInAt: string | null = null
  try {
    const { data } = await admin.auth.admin.getUserById(profileId)
    lastSignInAt = data?.user?.last_sign_in_at ?? null
  } catch {
    /* dégrade en douceur */
  }

  // Dernier token set-password généré pour ce compte.
  const { data: rawTok } = await db(admin)
    .from('password_setup_tokens')
    .select('used_at, expires_at, created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const tok = rawTok as { used_at: string | null; expires_at: string; created_at: string } | null

  let state: SetupLinkState = 'none'
  if (tok) {
    if (tok.used_at) state = 'used'
    else if (new Date(tok.expires_at) < new Date()) state = 'expired'
    else state = 'active'
  }

  return {
    lastSignInAt,
    link: {
      state,
      expiresAt: tok?.expires_at ?? null,
      usedAt: tok?.used_at ?? null,
      createdAt: tok?.created_at ?? null,
    },
  }
}
