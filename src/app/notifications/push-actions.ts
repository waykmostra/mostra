'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'

export type PushActionResult = { ok: true } | { ok: false; reason: string }

export interface SavePushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}

/** Enregistre (ou met à jour) l'abonnement push de l'appareil courant. */
export async function savePushSubscription(
  input: SavePushSubscriptionInput,
): Promise<PushActionResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'Non authentifié' }

  const { error } = await db(supabase)
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

/** Supprime l'abonnement push de l'appareil courant. */
export async function removePushSubscription(endpoint: string): Promise<PushActionResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'Non authentifié' }

  const { error } = await db(supabase)
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
