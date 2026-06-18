// Server-only — envoi de notifications Web Push.
// Ne JAMAIS importer dans un composant client.
import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'

let configured = false

function configure(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  const subject = process.env.VAPID_SUBJECT || 'mailto:contact@mostra.app'
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body?: string
  /** URL ouverte au clic sur la notif. */
  url?: string
  /** Regroupe/remplace les notifs de même tag. */
  tag?: string
}

interface SubRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Envoie une notification push à tous les appareils abonnés d'un utilisateur.
 * Best-effort : ne lève jamais, purge les abonnements expirés (404/410).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!configure()) return // clés VAPID absentes → no-op silencieux

    const admin = createAdminClient()
    const { data } = await db(admin)
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    const subs = (data as SubRow[] | null) ?? []
    if (subs.length === 0) return

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? '',
      url: payload.url ?? '/',
      tag: payload.tag,
    })

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          )
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode
          if (code === 404 || code === 410) {
            // Abonnement périmé → on le supprime
            await db(admin).from('push_subscriptions').delete().eq('id', s.id)
          } else {
            console.error('[sendPushToUser] send error', code, (err as { body?: string })?.body)
          }
        }
      }),
    )
  } catch (err) {
    console.error('[sendPushToUser] error:', err)
  }
}
