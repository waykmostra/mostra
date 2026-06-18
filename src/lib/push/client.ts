'use client'

import { savePushSubscription, removePushSubscription } from '@/app/notifications/push-actions'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-key' | 'error'; detail?: string }

/** Le navigateur supporte-t-il les notifications push ? */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function currentPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** Enregistre le service worker (idempotent). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.error('[push] SW registration failed:', err)
    return null
  }
}

/** Cet appareil est-il déjà abonné ? */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub !== null
  } catch {
    return false
  }
}

/** Demande la permission puis abonne l'appareil au push. */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }
  if (!PUBLIC_KEY) return { ok: false, reason: 'no-key' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    await registerServiceWorker()
    const reg = await navigator.serviceWorker.ready

    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as BufferSource,
      }))

    const json = sub.toJSON()
    if (!json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: 'error', detail: 'clés manquantes' }
    }

    const result = await savePushSubscription({
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })

    if (!result.ok) return { ok: false, reason: 'error', detail: result.reason }
    return { ok: true }
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return { ok: false, reason: 'error', detail: String(err) }
  }
}

/** Désabonne l'appareil courant. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await removePushSubscription(sub.endpoint)
      await sub.unsubscribe()
    }
  } catch (err) {
    console.error('[push] unsubscribe failed:', err)
  }
}
